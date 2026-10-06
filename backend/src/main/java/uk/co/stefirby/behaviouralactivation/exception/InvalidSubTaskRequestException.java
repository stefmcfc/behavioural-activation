package uk.co.stefirby.behaviouralactivation.exception;

/**
 * Thrown by {@code SubTaskService} for a sub-task-domain business-rule validation failure that
 * isn't already covered by bean validation on a DTO field -- currently just a duplicate id in a
 * {@code SubTaskReorderRequest.subTaskIds} submission (planner_spec_023_subtask_reordering.md,
 * PLANNER-023-AC-08). Deliberately its own sub-task-domain exception rather than reusing
 * {@link InvalidPlanRequestException}, which is explicitly plan-domain. Mapped to {@code 400} by
 * {@link GlobalExceptionHandler}.
 */
public class InvalidSubTaskRequestException extends RuntimeException {

    public InvalidSubTaskRequestException(String message) {
        super(message);
    }
}
