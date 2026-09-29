package uk.co.stefirby.behaviouralactivation.exception;

/**
 * Thrown by {@code PlanService} for a business-rule validation failure that isn't already covered
 * by bean validation on a DTO field -- a non-Monday {@code weekStart}, a zero-or-both
 * {@code activityId}/{@code subTaskId} combination, or an unpaired {@code dayOfWeek}/{@code slot}
 * (planner_spec_004_week_planning.md, PLANNER-004-AC-04/AC-10/AC-12/AC-13/AC-18). Mapped to
 * {@code 400} by {@link GlobalExceptionHandler}.
 */
public class InvalidPlanRequestException extends RuntimeException {

    public InvalidPlanRequestException(String message) {
        super(message);
    }
}
