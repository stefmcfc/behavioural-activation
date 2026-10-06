package uk.co.stefirby.behaviouralactivation.service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.co.stefirby.behaviouralactivation.dto.SubTaskReorderRequest;
import uk.co.stefirby.behaviouralactivation.dto.SubTaskRequest;
import uk.co.stefirby.behaviouralactivation.exception.InvalidSubTaskRequestException;
import uk.co.stefirby.behaviouralactivation.exception.SubTaskReorderNotAllowedException;
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
            .map(activity -> {
                SubTask subTask = new SubTask(activity, request.name(), activity.getCategory(), owner);
                // PLANNER-023-AC-04 -- appended at the end, never into the middle of the existing order.
                subTask.assignPosition((int) subTaskRepository.countByActivityIdAndOwner(activityId, owner));
                return subTaskRepository.save(subTask);
            });
    }

    @Transactional(readOnly = true)
    public Optional<List<SubTask>> listForActivity(String ownerUsername, UUID activityId) {
        User owner = resolveOwner(ownerUsername);
        return findOwnedActivity(activityId, owner)
            .map(activity -> subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(activityId, owner));
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
                renumberRemaining(activityId, owner); // PLANNER-023-AC-05
                return true;
            })
            .orElse(false);
    }

    // planner_spec_023_subtask_reordering.md (PLANNER-023-AC-06/AC-07/AC-08/AC-09/AC-10/AC-11) --
    // full-list-replacement reorder, mirroring PlanService.reorderBucket()'s pattern. Validation
    // (duplicate ids) runs before any repository access; the activityId-scoped bulk fetch
    // (findByIdInAndActivityIdAndOwner) means an id not found, not owned, or belonging to a
    // different activity simply isn't found -- collapsing into the same 404 as any other
    // not-found/not-yours case, with no separate "wrong activity" 409 needed (see the spec's
    // Overview).
    @Transactional
    public Optional<List<SubTask>> reorder(String ownerUsername, UUID activityId, SubTaskReorderRequest request) {
        validateNoDuplicateIds(request.subTaskIds());

        User owner = resolveOwner(ownerUsername);

        List<SubTask> found = subTaskRepository.findByIdInAndActivityIdAndOwner(request.subTaskIds(), activityId, owner);
        Map<UUID, SubTask> foundById = found.stream()
            .collect(Collectors.toMap(SubTask::getId, Function.identity()));
        if (foundById.size() != request.subTaskIds().size()) {
            return Optional.empty(); // PLANNER-023-AC-09
        }
        List<SubTask> submitted = request.subTaskIds().stream()
            .map(foundById::get)
            .toList();

        List<SubTask> currentChecklist = subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(activityId, owner);
        Set<UUID> currentIds = currentChecklist.stream().map(SubTask::getId).collect(Collectors.toSet());
        Set<UUID> submittedIds = new HashSet<>(request.subTaskIds());
        if (!currentIds.equals(submittedIds)) {
            throw new SubTaskReorderNotAllowedException(
                "subTaskIds must be exactly the current set of sub-tasks for the activity"); // PLANNER-023-AC-10
        }

        for (int i = 0; i < submitted.size(); i++) {
            submitted.get(i).assignPosition(i); // PLANNER-023-AC-11
        }
        return Optional.of(submitted);
    }

    private void renumberRemaining(UUID activityId, User owner) {
        List<SubTask> remaining = subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(activityId, owner);
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).assignPosition(i);
        }
    }

    private void validateNoDuplicateIds(List<UUID> subTaskIds) {
        if (new HashSet<>(subTaskIds).size() != subTaskIds.size()) {
            throw new InvalidSubTaskRequestException("subTaskIds must not contain duplicates"); // PLANNER-023-AC-08
        }
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
