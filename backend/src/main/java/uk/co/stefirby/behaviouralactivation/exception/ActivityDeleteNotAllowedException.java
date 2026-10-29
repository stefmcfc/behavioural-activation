package uk.co.stefirby.behaviouralactivation.exception;

/**
 * Thrown by {@code ActivityService.delete(...)} when the target {@code Activity} is not yet
 * archived (planner_spec_027_archive_before_delete.md, PLANNER-027-AC-01). Mapped to {@code 409} by
 * {@link GlobalExceptionHandler}.
 */
public class ActivityDeleteNotAllowedException extends RuntimeException {

    public ActivityDeleteNotAllowedException(String message) {
        super(message);
    }
}
