package uk.co.stefirby.behaviouralactivation.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.co.stefirby.behaviouralactivation.dto.SubTaskRequest;
import uk.co.stefirby.behaviouralactivation.model.Activity;
import uk.co.stefirby.behaviouralactivation.model.SubTask;
import uk.co.stefirby.behaviouralactivation.model.User;
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository;
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository;
import uk.co.stefirby.behaviouralactivation.repository.UserRepository;

/**
 * Owner-scoping for sub-tasks lives here, not in {@code SubTaskController}. Every method first
 * re-confirms the parent {@code activityId} belongs to the authenticated owner via
 * {@link ActivityRepository#findByIdAndOwner(UUID, User)} before touching {@link SubTaskRepository}
 * -- a {@code SubTask} row matching an owner-scoped query already implies this by construction, but
 * the parent-existence check is what produces the correct 404 when the activity itself doesn't
 * exist or isn't owned by the caller (PLANNER-003-AC-05/AC-10), as distinct from the sub-task-level
 * 404s (PLANNER-003-AC-13/AC-16). Every "not found" and "not yours" case collapses to the same empty
 * {@link Optional}/{@code false} result -- see PLANNER-003-AC-19, never distinguishable in the
 * response.
 */
@Service
public class SubTaskService {

    private final SubTaskRepository subTaskRepository;
    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;

    public SubTaskService(SubTaskRepository subTaskRepository, ActivityRepository activityRepository,
            UserRepository userRepository) {
        this.subTaskRepository = subTaskRepository;
        this.activityRepository = activityRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Optional<SubTask> create(String ownerUsername, UUID activityId, SubTaskRequest request) {
        User owner = resolveOwner(ownerUsername);
        return findOwnedActivity(activityId, owner)
            .map(activity -> subTaskRepository.save(
                new SubTask(activity, request.name(), activity.getCategory(), owner)));
    }

    @Transactional(readOnly = true)
    public Optional<List<SubTask>> listForActivity(String ownerUsername, UUID activityId) {
        User owner = resolveOwner(ownerUsername);
        return findOwnedActivity(activityId, owner)
            .map(activity -> subTaskRepository.findByActivityIdAndOwnerOrderByCreatedAtAsc(activityId, owner));
    }

    // planner_spec_018_bulk_sub_task_fetch.md (PLANNER-018-AC-01/AC-02) -- every sub-task owned by
    // the authenticated user, across all of their activities, in one call. Unlike
    // listForActivity(...), there's no parent activityId to own-check first -- owner-scoping is
    // the only scoping here, enforced entirely by SubTaskRepository#findByOwner.
    @Transactional(readOnly = true)
    public List<SubTask> listForOwner(String ownerUsername) {
        User owner = resolveOwner(ownerUsername);
        return subTaskRepository.findByOwner(owner);
    }

    @Transactional
    public Optional<SubTask> update(String ownerUsername, UUID activityId, UUID id, SubTaskRequest request) {
        User owner = resolveOwner(ownerUsername);
        return findOwnedActivity(activityId, owner)
            .flatMap(activity -> findOwnedSubTask(id, activityId, owner))
            .map(subTask -> {
                subTask.rename(request.name());
                return subTask;
            });
    }

    @Transactional
    public boolean delete(String ownerUsername, UUID activityId, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return findOwnedActivity(activityId, owner)
            .flatMap(activity -> findOwnedSubTask(id, activityId, owner))
            .map(subTask -> {
                subTaskRepository.delete(subTask);
                return true;
            })
            .orElse(false);
    }

    private Optional<Activity> findOwnedActivity(UUID activityId, User owner) {
        return activityRepository.findByIdAndOwner(activityId, owner);
    }

    private Optional<SubTask> findOwnedSubTask(UUID id, UUID activityId, User owner) {
        return subTaskRepository.findByIdAndActivityIdAndOwner(id, activityId, owner);
    }

    private User resolveOwner(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + username));
    }
}
