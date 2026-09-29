package uk.co.stefirby.behaviouralactivation.service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceMoveRequest;
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceRequest;
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

    public PlanService(PlannedOccurrenceRepository plannedOccurrenceRepository,
            CompletionRecordRepository completionRecordRepository, ActivityRepository activityRepository,
            SubTaskRepository subTaskRepository, UserRepository userRepository) {
        this.plannedOccurrenceRepository = plannedOccurrenceRepository;
        this.completionRecordRepository = completionRecordRepository;
        this.activityRepository = activityRepository;
        this.subTaskRepository = subTaskRepository;
        this.userRepository = userRepository;
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
            .map(occurrence -> applyMove(occurrence, request));
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
        occurrence.carryForward();
        initializeTarget(occurrence);
        return occurrence;
    }

    private PlannedOccurrence applyMove(PlannedOccurrence occurrence, PlannedOccurrenceMoveRequest request) {
        if (request.dayOfWeek() == null && request.slot() == null) {
            occurrence.moveToBucket();
        } else {
            occurrence.assignSlot(request.dayOfWeek(), request.slot());
        }
        initializeTarget(occurrence);
        return occurrence;
    }

    // Activity/SubTask are LAZY associations, and open-in-view is deliberately disabled
    // (application.yml) -- PlanController's response mapping runs after this method's transaction
    // has already closed, so the referenced Activity/SubTask must be force-initialized here, inside
    // the transaction, or PlanController.toResponse()'s name resolution throws
    // LazyInitializationException. Found via real-browser/curl verification against a real
    // Hibernate-backed entity during frontend_spec_004's implementation -- PlanControllerSpec's
    // @WebMvcTest mocks PlanService with plain in-memory entities, so it never exercised a real
    // lazy proxy and didn't catch this.
    private static void initializeTarget(PlannedOccurrence occurrence) {
        if (occurrence.getActivity() != null) {
            Hibernate.initialize(occurrence.getActivity());
        } else {
            Hibernate.initialize(occurrence.getSubTask());
        }
    }

    private static void initializeCompletionChain(CompletionRecord completion) {
        PlannedOccurrence occurrence = completion.getPlannedOccurrence();
        Hibernate.initialize(occurrence);
        initializeTarget(occurrence);
    }

    private PlannedOccurrence saveScheduledFor(Activity activity, SubTask subTask, ActivityCategory category,
            PlannedOccurrenceRequest request, User owner) {
        PlannedOccurrence occurrence = new PlannedOccurrence(activity, subTask, category, request.weekStart(),
            request.dayOfWeek(), request.slot(), owner);
        return plannedOccurrenceRepository.save(occurrence);
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
        if (weekStart == null || weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new InvalidPlanRequestException("weekStart is required and must be a Monday");
        }
    }

    private User resolveOwner(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + username));
    }
}
