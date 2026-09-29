package uk.co.stefirby.behaviouralactivation.exception;

/**
 * Thrown by {@code PlanService} when {@code POST /api/v1/plan/occurrences/{id}/carry-forward} is
 * requested for an occurrence that isn't eligible -- currently scheduled (not a weekend-bucket
 * item) or already complete (planner_spec_004_week_planning.md, PLANNER-004-AC-29/AC-30). Mapped to
 * {@code 409} by {@link GlobalExceptionHandler}.
 */
public class CarryForwardNotAllowedException extends RuntimeException {

    public CarryForwardNotAllowedException(String message) {
        super(message);
    }
}
