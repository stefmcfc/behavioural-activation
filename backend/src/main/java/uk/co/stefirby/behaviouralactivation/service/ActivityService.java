package uk.co.stefirby.behaviouralactivation.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.co.stefirby.behaviouralactivation.dto.ActivityRequest;
import uk.co.stefirby.behaviouralactivation.model.Activity;
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory;
import uk.co.stefirby.behaviouralactivation.model.User;
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository;
import uk.co.stefirby.behaviouralactivation.repository.SubTaskCountProjection;
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository;
import uk.co.stefirby.behaviouralactivation.repository.UserRepository;

/**
 * Owner-scoping for the activity bank lives here, not in {@code ActivityController} — every method
 * resolves the owning {@link User} itself from the authenticated username (never trusting a
 * client-supplied field) and every read/write against {@link ActivityRepository} is scoped to that
 * owner. {@link #update(String, UUID, ActivityRequest)} and {@link #delete(String, UUID)} return an
 * empty/{@code false} result identically whether the id doesn't exist at all or belongs to a
 * different owner — see PLANNER-002-AC-18, never distinguishable from the response.
 */
@Service
public class ActivityService {

    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final SubTaskRepository subTaskRepository;

    public ActivityService(ActivityRepository activityRepository, UserRepository userRepository,
            SubTaskRepository subTaskRepository) {
        this.activityRepository = activityRepository;
        this.userRepository = userRepository;
        this.subTaskRepository = subTaskRepository;
    }

    @Transactional
    public Activity create(String ownerUsername, ActivityRequest request) {
        User owner = resolveOwner(ownerUsername);
        boolean repeatable = request.repeatable() == null || request.repeatable();
        Activity activity = new Activity(request.name(), request.category(), request.description(),
            repeatable, owner);
        return activityRepository.save(activity);
    }

    // planner_spec_018_bulk_sub_task_fetch.md (PLANNER-018-AC-04/AC-05) -- resolves every activity's
    // subTaskCount via one bulk GROUP BY query instead of a countByActivityIdAndOwner call per
    // activity (the former N+1). An activity absent from the grouped result has no sub-tasks, hence
    // the 0L default -- byte-identical subTaskCount values to the old per-activity loop.
    @Transactional(readOnly = true)
    public List<ActivityWithSubTaskCount> listForOwner(String ownerUsername, boolean includeArchived) {
        User owner = resolveOwner(ownerUsername);
        List<Activity> activities = includeArchived
            ? activityRepository.findByOwnerOrderByFavouriteDescNameAsc(owner)
            : activityRepository.findByOwnerAndArchivedFalseOrderByFavouriteDescNameAsc(owner);
        Map<UUID, Long> subTaskCountsByActivityId = subTaskRepository.countGroupedByActivityIdForOwner(owner).stream()
            .collect(Collectors.toMap(SubTaskCountProjection::activityId, SubTaskCountProjection::count));
        return activities.stream()
            .map(activity -> new ActivityWithSubTaskCount(activity,
                subTaskCountsByActivityId.getOrDefault(activity.getId(), 0L)))
            .toList();
    }

    // PLANNER-012-AC-01/AC-02 -- lets ActivityController carry an up-to-date subTaskCount on the
    // single-activity update/archive responses too, without assuming 0.
    @Transactional(readOnly = true)
    public long countSubTasks(String ownerUsername, UUID activityId) {
        User owner = resolveOwner(ownerUsername);
        return subTaskRepository.countByActivityIdAndOwner(activityId, owner);
    }

    @Transactional
    public Optional<Activity> update(String ownerUsername, UUID id, ActivityRequest request) {
        User owner = resolveOwner(ownerUsername);
        boolean repeatable = request.repeatable() == null || request.repeatable();
        return activityRepository.findByIdAndOwner(id, owner)
            .map(activity -> {
                ActivityCategory previousCategory = activity.getCategory();
                activity.update(request.name(), request.category(), request.description(), repeatable);
                if (previousCategory != request.category()) {
                    cascadeCategoryToSubTasks(activity, request.category(), owner);
                }
                return activity;
            });
    }

    // PLANNER-014-AC-01 -- supersedes PLANNER-003-AC-20's "category is a creation-time snapshot,
    // never updated again" behavior: every existing sub-task now follows its parent activity's
    // current category. Deliberately does not touch PlannedOccurrence rows (PLANNER-014-AC-04) --
    // those keep whatever category was true when they were actually planned.
    private void cascadeCategoryToSubTasks(Activity activity, ActivityCategory newCategory, User owner) {
        subTaskRepository.findByActivityIdAndOwnerOrderByCreatedAtAsc(activity.getId(), owner)
            .forEach(subTask -> subTask.recategorize(newCategory));
    }

    @Transactional
    public boolean delete(String ownerUsername, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return activityRepository.findByIdAndOwner(id, owner)
            .map(activity -> {
                activityRepository.delete(activity);
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<Activity> archive(String ownerUsername, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return activityRepository.findByIdAndOwner(id, owner)
            .map(activity -> {
                activity.archive(); // idempotent -- a no-op if already archived (AC-06)
                return activity;
            });
    }

    @Transactional
    public boolean unarchive(String ownerUsername, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return activityRepository.findByIdAndOwner(id, owner)
            .map(activity -> {
                activity.unarchive();
                return true;
            })
            .orElse(false);
    }

    @Transactional
    public Optional<Activity> markFavourite(String ownerUsername, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return activityRepository.findByIdAndOwner(id, owner)
            .map(activity -> {
                activity.markFavourite(); // idempotent -- a no-op if already favourited (AC-04)
                return activity;
            });
    }

    @Transactional
    public boolean unmarkFavourite(String ownerUsername, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return activityRepository.findByIdAndOwner(id, owner)
            .map(activity -> {
                activity.unmarkFavourite();
                return true;
            })
            .orElse(false);
    }

    private User resolveOwner(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + username));
    }
}
