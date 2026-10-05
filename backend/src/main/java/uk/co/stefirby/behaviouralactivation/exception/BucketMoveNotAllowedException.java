package uk.co.stefirby.behaviouralactivation.exception;

/**
 * Thrown by {@code PlanService} when {@code PATCH /api/v1/plan/occurrences/{id}} is requested with
 * a bucket-targeting move ({@code dayOfWeek}/{@code slot} both null) for an occurrence that already
 * has a {@code CompletionRecord} (planner_spec_020_prevent_completed_occurrence_bucket_move.md,
 * PLANNER-020-AC-01). Mapped to {@code 409} by {@link GlobalExceptionHandler}.
 */
public class BucketMoveNotAllowedException extends RuntimeException {

    public BucketMoveNotAllowedException(String message) {
        super(message);
    }
}
