package uk.co.stefirby.behaviouralactivation.service;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.co.stefirby.behaviouralactivation.dto.BucketReorderRequest;
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceMoveRequest;
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceRequest;
import uk.co.stefirby.behaviouralactivation.dto.UpdateOccurrenceNotesRequest;
import uk.co.stefirby.behaviouralactivation.exception.BucketMoveNotAllowedException;
import uk.co.stefirby.behaviouralactivation.exception.BucketReorderNotAllowedException;
import uk.co.stefirby.behaviouralactivation.exception.CarryForwardNotAllowedException;
import uk.co.stefirby.behaviouralactivation.exception.InvalidPlanRequestException;
import uk.co.stefirby.behaviouralactivation.model.Activity;
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory;
import uk.co.stefirby.behaviouralactivation.model.CompletionRecord;
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence;
import uk.co.stefirby.behaviouralactivation.model.PlanSlot;
import uk.co.stefirby.behaviouralactivation.model.SubTask;
import uk.co.stefirby.behaviouralactivation.model.User;
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository;
import uk.co.stefirby.behaviouralactivation.repository.CompletionRecordRepository;
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository;
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository;
import uk.co.stefirby.behaviouralactivation.repository.UserRepository;

/**
 * Owner-scoping and business-rule validation for the weekly plan live here, not in
 * {@code PlanController} -- matching {@code SubTaskService}'s precedent. Validation
 * ({@link InvalidPlanRequestException}, 400 via {@code GlobalExceptionHandler}) is always checked
 * before any ownership lookup, so a malformed request never leaks whether a referenced
 * {@code activityId}/{@code subTaskId} exists under another owner (PLANNER-004-AC-10/AC-12/AC-13's
 * "without querying"/"without creating" wording). Every "not found" and "not yours" case collapses
 * to the same empty {@link Optional}/{@code false} result -- never distinguishable in the response
 * (PLANNER-004-AC-36).
 *
 * <p>{@link CarryForwardNotAllowedException} (409 via {@code GlobalExceptionHandler}) is different:
 * its rule depends on the found occurrence's own state (bucket vs scheduled, complete vs not), so
 * the ownership lookup always runs first -- a not-found/not-owned id still yields 404, and only a
 * found-but-ineligible occurrence yields 409 (PLANNER-004-AC-29/AC-30/AC-31).
 *
 * <p>This covers all of planner_spec_004_week_planning.md's backend -- Requirements 1-4
 * (view/create/move/remove, pass 1) and Requirements 5-7 (complete/undo, carry-forward, and the
 * {@code CompletionRecord} half of cascade delete, pass 2).
 */
@Service
public class PlanService {

    private final PlannedOccurrenceRepository plannedOccurrenceRepository;
    private final CompletionRecordRepository completionRecordRepository;
    private final ActivityRepository activityRepository;
    private final SubTaskRepository subTaskRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public PlanService(PlannedOccurrenceRepository plannedOccurrenceRepository,
            CompletionRecordRepository completionRecordRepository, ActivityRepository activityRepository,
            SubTaskRepository subTaskRepository, UserRepository userRepository, Clock clock) {
        this.plannedOccurrenceRepository = plannedOccurrenceRepository;
        this.completionRecordRepository = completionRecordRepository;
        this.activityRepository = activityRepository;
        this.subTaskRepository = subTaskRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    // Runs as its own, ordinary read-write transaction -- must be called separately from getWeek()
    // (still @Transactional(readOnly = true), unchanged) by PlanController, never as a self-invocation
    // from inside getWeek() itself. A self-invocation would bypass PlanService's Spring-managed proxy
    // and silently inherit getWeek()'s own readOnly transaction, so the weekStart mutation below would
    // never be flushed -- see planner_spec_011_bucket_carry_forward_automation.md's Requirement 4
    // implementation note (PLANNER-011-AC-08/AC-09).
    @Transactional
    public Set<UUID> migrateStaleBucketItems(String ownerUsername) {
        User owner = resolveOwner(ownerUsername);
        LocalDate currentWeekMonday = LocalDate.now(clock).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        List<PlannedOccurrence> staleBucketItems = plannedOccurrenceRepository
            .findByOwnerAndDayOfWeekIsNullAndSlotIsNullAndWeekStartBefore(owner, currentWeekMonday);
        if (staleBucketItems.isEmpty()) {
            return Set.of();
        }

        List<UUID> staleIds = staleBucketItems.stream().map(PlannedOccurrence::getId).toList();
        Set<UUID> completedIds = completionRecordRepository.findByOwnerAndPlannedOccurrenceIdIn(owner, staleIds)
            .stream()
            .map(completionRecord -> completionRecord.getPlannedOccurrence().getId())
            .collect(Collectors.toSet());

        Set<UUID> migratedIds = new HashSet<>();
        for (PlannedOccurrence occurrence : staleBucketItems) {
            if (completedIds.contains(occurrence.getId())) {
                continue; // already complete -- stays at its original weekStart, AC-04
            }
            occurrence.autoCarryForwardTo(currentWeekMonday); // single-step jump, AC-06; resets bucketPosition, AC-07
            migratedIds.add(occurrence.getId());
        }
        // No explicit persistence call is needed here: occurrence is a managed entity loaded within
        // this transaction, so Hibernate's dirty checking flushes the mutation at commit, matching
        // the applyMove and applyCarryForward methods' existing style elsewhere in this class.
        return migratedIds;
    }

    @Transactional(readOnly = true)
    public List<PlannedOccurrence> getWeek(String ownerUsername, LocalDate weekStart) {
        validateWeekStart(weekStart);
        User owner = resolveOwner(ownerUsername);
        List<PlannedOccurrence> occurrences =
            plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, weekStart);
        occurrences.forEach(PlanService::initializeTarget);
        return occurrences;
    }

    @Transactional
    public Optional<PlannedOccurrence> create(String ownerUsername, PlannedOccurrenceRequest request) {
        validateExactlyOneTarget(request.activityId(), request.subTaskId());
        validateDaySlotPair(request.dayOfWeek(), request.slot());
        validateWeekStart(request.weekStart());

        User owner = resolveOwner(ownerUsername);

        if (request.activityId() != null) {
            return activityRepository.findByIdAndOwner(request.activityId(), owner)
                .map(activity -> saveScheduledFor(activity, null, activity.getCategory(), request, owner));
        }
        return subTaskRepository.findByIdAndOwner(request.subTaskId(), owner)
            .map(subTask -> saveScheduledFor(null, subTask, subTask.getCategory(), request, owner));
    }

    @Transactional
    public Optional<PlannedOccurrence> move(String ownerUsername, UUID id, PlannedOccurrenceMoveRequest request) {
        validateDaySlotPair(request.dayOfWeek(), request.slot());
        User owner = resolveOwner(ownerUsername);
        return plannedOccurrenceRepository.findByIdAndOwner(id, owner)
            .map(occurrence -> applyMove(occurrence, request, owner));
    }

    // planner_spec_022_occurrence_notes.md -- mirrors move(...)'s shape above. notes validation
    // (@Size(max = 200)) is enforced at the controller via @Valid on UpdateOccurrenceNotesRequest,
    // not re-checked here.
    @Transactional
    public Optional<PlannedOccurrence> updateNotes(String ownerUsername, UUID id, UpdateOccurrenceNotesRequest request) {
        User owner = resolveOwner(ownerUsername);
        return plannedOccurrenceRepository.findByIdAndOwner(id, owner)
            .map(occurrence -> {
                occurrence.updateNotes(request.notes());
                initializeTarget(occurrence);
                return occurrence;
            });
    }

    @Transactional
    public boolean delete(String ownerUsername, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return plannedOccurrenceRepository.findByIdAndOwner(id, owner)
            .map(occurrence -> {
                plannedOccurrenceRepository.delete(occurrence);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<CompletionRecord> complete(String ownerUsername, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return plannedOccurrenceRepository.findByIdAndOwner(id, owner)
            .map(occurrence -> upsertCompletion(occurrence, owner))
            .map(completion -> {
                maybeAutoArchive(completion.getPlannedOccurrence(), owner);
                initializeCompletionChain(completion);
                return completion;
            });
    }

    @Transactional
    public boolean uncomplete(String ownerUsername, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return plannedOccurrenceRepository.findByIdAndOwner(id, owner)
            .map(occurrence -> deleteCompletionIfPresent(occurrence, owner))
            .orElse(false);
    }

    @Transactional
    public Optional<PlannedOccurrence> carryForward(String ownerUsername, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return plannedOccurrenceRepository.findByIdAndOwner(id, owner)
            .map(occurrence -> applyCarryForward(occurrence, owner));
    }

    // PUT /api/v1/plan/bucket/order -- a whole-order replacement, not a single-item move
    // (planner_spec_010_bucket_reordering.md, Requirement 3). Every "not found"/"not yours" id
    // collapses to an empty Optional for the whole batch (PLANNER-010-AC-11), matching the rest of
    // this class's convention; a found-but-ineligible id (not currently a bucket item for the
    // requested weekStart, or a submitted set that doesn't exactly match the current bucket) is a 409
    // via BucketReorderNotAllowedException instead (PLANNER-010-AC-12/AC-13), mirroring
    // CarryForwardNotAllowedException's existing "found but wrong state" precedent.
    @Transactional
    public Optional<List<PlannedOccurrence>> reorderBucket(String ownerUsername, BucketReorderRequest request) {
        validateWeekStart(request.weekStart());
        validateNoDuplicateIds(request.occurrenceIds());

        User owner = resolveOwner(ownerUsername);

        // planner_spec_019_bucket_reorder_query_scaling.md (PLANNER-019-AC-02) -- one bulk query
        // instead of the former per-id findByIdAndOwner loop. The bulk query's result order is not
        // guaranteed to match request.occurrenceIds()'s order, so `submitted` is rebuilt by looking
        // each id up in a map, not by trusting foundById.values()'s iteration order -- PLANNER-010-
        // AC-14 depends on this.
        List<PlannedOccurrence> found =
            plannedOccurrenceRepository.findByIdInAndOwner(request.occurrenceIds(), owner);
        Map<UUID, PlannedOccurrence> foundById = found.stream()
            .collect(Collectors.toMap(PlannedOccurrence::getId, Function.identity()));
        if (foundById.size() != request.occurrenceIds().size()) {
            return Optional.empty(); // PLANNER-010-AC-11
        }
        List<PlannedOccurrence> submitted = request.occurrenceIds().stream()
            .map(foundById::get)
            .toList();

        boolean allCurrentBucketItemsForWeek = submitted.stream()
            .allMatch(occurrence -> occurrence.isBucketItem() && occurrence.getWeekStart().equals(request.weekStart()));
        if (!allCurrentBucketItemsForWeek) {
            throw new BucketReorderNotAllowedException(
                "Every occurrenceId must currently be a weekend-bucket item for the given weekStart");
        }

        List<PlannedOccurrence> currentBucket = plannedOccurrenceRepository
            .findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc(owner, request.weekStart());
        Set<UUID> currentIds = currentBucket.stream().map(PlannedOccurrence::getId).collect(Collectors.toSet());
        Set<UUID> submittedIds = new HashSet<>(request.occurrenceIds());
        if (!currentIds.equals(submittedIds)) {
            throw new BucketReorderNotAllowedException(
                "occurrenceIds must be exactly the current set of weekend-bucket items for the given weekStart");
        }

        for (int i = 0; i < submitted.size(); i++) {
            submitted.get(i).assignBucketPosition(i); // PLANNER-010-AC-14
        }
        submitted.forEach(PlanService::initializeTarget);
        return Optional.of(submitted);
    }

    @Transactional(readOnly = true)
    public Optional<CompletionRecord> findCompletion(String ownerUsername, UUID occurrenceId) {
        User owner = resolveOwner(ownerUsername);
        return completionRecordRepository.findByPlannedOccurrenceIdAndOwner(occurrenceId, owner);
    }

    // Bulk lookup used by PlanController when mapping GET /api/v1/plan's whole-week result -- one
    // query for the week's occurrences, not one per occurrence (see CompletionRecordRepository).
    @Transactional(readOnly = true)
    public Map<UUID, CompletionRecord> findCompletions(String ownerUsername, List<UUID> occurrenceIds) {
        if (occurrenceIds.isEmpty()) {
            return Map.of();
        }
        User owner = resolveOwner(ownerUsername);
        return completionRecordRepository.findByOwnerAndPlannedOccurrenceIdIn(owner, occurrenceIds).stream()
            .collect(Collectors.toMap(completion -> completion.getPlannedOccurrence().getId(), Function.identity()));
    }

    private CompletionRecord upsertCompletion(PlannedOccurrence occurrence, User owner) {
        Instant now = Instant.now();
        return completionRecordRepository.findByPlannedOccurrenceIdAndOwner(occurrence.getId(), owner)
            .map(existing -> {
                existing.recompleteAt(now);
                return existing;
            })
            .orElseGet(() -> completionRecordRepository.save(new CompletionRecord(occurrence, owner, now)));
    }

    // Auto-archive hook for planner_spec_006_repeatable_activities.md, run inside complete()'s own
    // transaction (Requirements 4/5/6). Activity/SubTask are LAZY and open-in-view is disabled -- but
    // this runs while complete()'s transaction is still open, so occurrence.getSubTask().getActivity()
    // is a safe lazy-load here (unlike in PlanController's response mapping, after the transaction
    // has closed).
    private void maybeAutoArchive(PlannedOccurrence occurrence, User owner) {
        Activity activity = occurrence.getActivity() != null
            ? occurrence.getActivity()
            : occurrence.getSubTask().getActivity();
        if (activity.isRepeatable() || activity.isArchived()) {
            return; // AC-16/AC-17
        }

        List<SubTask> subTasks = subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(
            activity.getId(), owner);
        boolean done;
        if (subTasks.isEmpty()) {
            done = true; // AC-13 -- this occurrence completing is itself the whole activity
        } else {
            List<UUID> subTaskIds = subTasks.stream().map(SubTask::getId).toList();
            Set<UUID> completedSubTaskIds = completionRecordRepository
                .findByOwnerAndPlannedOccurrence_SubTask_IdIn(owner, subTaskIds).stream()
                .map(completion -> completion.getPlannedOccurrence().getSubTask().getId())
                .collect(Collectors.toSet());
            done = completedSubTaskIds.containsAll(subTaskIds); // AC-14/AC-15
        }

        if (done) {
            activity.archive();
            activityRepository.save(activity);
        }
    }

    private boolean deleteCompletionIfPresent(PlannedOccurrence occurrence, User owner) {
        return completionRecordRepository.findByPlannedOccurrenceIdAndOwner(occurrence.getId(), owner)
            .map(completion -> {
                completionRecordRepository.delete(completion);
                return true;
            })
            .orElse(false);
    }

    private PlannedOccurrence applyCarryForward(PlannedOccurrence occurrence, User owner) {
        if (!occurrence.isBucketItem()) {
            throw new CarryForwardNotAllowedException("Only a weekend-bucket occurrence can be carried forward");
        }
        if (completionRecordRepository.findByPlannedOccurrenceIdAndOwner(occurrence.getId(), owner).isPresent()) {
            throw new CarryForwardNotAllowedException("A completed occurrence cannot be carried forward");
        }
        // Computed BEFORE mutating occurrence -- see the class-level hazard note in
        // planner_spec_010_bucket_reordering.md: mutating weekStart first would let the subsequent
        // COUNT query auto-flush that change and count the occurrence's own now-updated row as
        // already belonging to the destination week, inflating the computed position by one.
        int position = nextBucketPosition(owner, occurrence.getWeekStart().plusDays(7)); // PLANNER-010-AC-07
        occurrence.carryForward();
        occurrence.assignBucketPosition(position);
        initializeTarget(occurrence);
        return occurrence;
    }

    private PlannedOccurrence applyMove(PlannedOccurrence occurrence, PlannedOccurrenceMoveRequest request, User owner) {
        if (request.dayOfWeek() == null && request.slot() == null) {
            // planner_spec_020_prevent_completed_occurrence_bucket_move.md (PLANNER-020-AC-01) -- a
            // completed occurrence is done for the week; demoting it back to the bucket would silently
            // misrepresent it as not-yet-done. Checked only for the bucket-targeting branch -- moving a
            // completed occurrence between grid slots (the else branch below) is unaffected (AC-03).
            if (completionRecordRepository.findByPlannedOccurrenceIdAndOwner(occurrence.getId(), owner).isPresent()) {
                throw new BucketMoveNotAllowedException("A completed occurrence cannot be moved to the bucket");
            }
            // Computed BEFORE mutating occurrence -- same auto-flush hazard as applyCarryForward(...).
            int position = nextBucketPosition(owner, occurrence.getWeekStart()); // PLANNER-010-AC-05
            occurrence.moveToBucket();
            occurrence.assignBucketPosition(position);
        } else {
            occurrence.assignSlot(request.dayOfWeek(), request.slot()); // PLANNER-010-AC-06
        }
        initializeTarget(occurrence);
        return occurrence;
    }

    private int nextBucketPosition(User owner, LocalDate weekStart) {
        return (int) plannedOccurrenceRepository
            .countByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNull(owner, weekStart);
    }

    private void validateNoDuplicateIds(List<UUID> occurrenceIds) {
        if (new HashSet<>(occurrenceIds).size() != occurrenceIds.size()) {
            throw new InvalidPlanRequestException("occurrenceIds must not contain duplicates");
        }
    }

    // Activity/SubTask are LAZY associations, and open-in-view is deliberately disabled
    // (application.yml) -- PlanController's response mapping runs after this method's transaction
    // has already closed, so the referenced Activity/SubTask must be force-initialized here, inside
    // the transaction, or PlanController.toResponse()'s name resolution throws
    // LazyInitializationException. Found via real-browser/curl verification against a real
    // Hibernate-backed entity during frontend_spec_004's implementation -- PlanControllerSpec's
    // @WebMvcTest mocks PlanService with plain in-memory entities, so it never exercised a real
    // lazy proxy and didn't catch this.
    //
    // Extended for planner_spec_008_occurrence_detail_card.md: SubTask.activity is itself a LAZY
    // @ManyToOne, one hop further out than this method previously initialized --
    // PlannedOccurrenceResponse.parentActivityName is the first thing to read it, so it must be
    // force-initialized here too, or PlanController's mapping throws LazyInitializationException for
    // a sub-task-target occurrence exactly as the top-level activity/subTask association did before
    // planner_spec_004's fix.
    private static void initializeTarget(PlannedOccurrence occurrence) {
        if (occurrence.getActivity() != null) {
            Hibernate.initialize(occurrence.getActivity());
        } else {
            SubTask subTask = occurrence.getSubTask();
            Hibernate.initialize(subTask);
            Hibernate.initialize(subTask.getActivity());
        }
    }

    private static void initializeCompletionChain(CompletionRecord completion) {
        PlannedOccurrence occurrence = completion.getPlannedOccurrence();
        Hibernate.initialize(occurrence);
        initializeTarget(occurrence);
    }

    // Never called initializeTarget(...) before planner_spec_008_occurrence_detail_card.md -- it
    // worked by incidental luck, because the activity/subTask passed in is already a fully-loaded
    // entity (not a lazy proxy) from activityRepository.findByIdAndOwner(...)/
    // subTaskRepository.findByIdAndOwner(...), so the *direct* association never needed force-init.
    // That luck doesn't extend to subTask.getActivity(), which those repository lookups never
    // eager-fetch -- so this now force-initializes explicitly for PLANNER-008-AC-05.
    private PlannedOccurrence saveScheduledFor(Activity activity, SubTask subTask, ActivityCategory category,
            PlannedOccurrenceRequest request, User owner) {
        PlannedOccurrence occurrence = new PlannedOccurrence(activity, subTask, category, request.weekStart(),
            request.dayOfWeek(), request.slot(), owner);
        if (occurrence.isBucketItem()) {
            // No auto-flush hazard here (unlike applyMove/applyCarryForward) -- occurrence is a
            // freshly-constructed, not-yet-persisted entity, so nothing to flush ahead of the count.
            occurrence.assignBucketPosition(nextBucketPosition(owner, request.weekStart())); // PLANNER-010-AC-03
        }
        PlannedOccurrence saved = plannedOccurrenceRepository.save(occurrence);
        initializeTarget(saved);
        return saved;
    }

    private void validateExactlyOneTarget(UUID activityId, UUID subTaskId) {
        boolean hasActivity = activityId != null;
        boolean hasSubTask = subTaskId != null;
        if (hasActivity == hasSubTask) {
            throw new InvalidPlanRequestException("Exactly one of activityId or subTaskId must be set");
        }
    }

    private void validateDaySlotPair(DayOfWeek dayOfWeek, PlanSlot slot) {
        boolean hasDay = dayOfWeek != null;
        boolean hasSlot = slot != null;
        if (hasDay != hasSlot) {
            throw new InvalidPlanRequestException("dayOfWeek and slot must both be set or both be null");
        }
    }

    private void validateWeekStart(LocalDate weekStart) {
        if (weekStart == null || !weekStart.getDayOfWeek().equals(DayOfWeek.MONDAY)) {
            throw new InvalidPlanRequestException("weekStart is required and must be a Monday");
        }
    }

    private User resolveOwner(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + username));
    }
}
