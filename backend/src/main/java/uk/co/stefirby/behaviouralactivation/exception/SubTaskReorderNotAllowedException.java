package uk.co.stefirby.behaviouralactivation.exception;

/**
 * Thrown by {@code SubTaskService.reorder(...)} when {@code PUT
 * /api/v1/activities/{activityId}/sub-tasks/order} is requested with a submitted
 * {@code subTaskIds} set that doesn't exactly match the activity's current checklist -- either
 * missing an id that currently exists, or including one that doesn't
 * (planner_spec_023_subtask_reordering.md, PLANNER-023-AC-10). Mapped to {@code 409} by
 * {@link GlobalExceptionHandler}, mirroring {@link BucketReorderNotAllowedException}'s existing
 * "found but wrong state" pattern.
 */
public class SubTaskReorderNotAllowedException extends RuntimeException {

    public SubTaskReorderNotAllowedException(String message) {
        super(message);
    }
}
