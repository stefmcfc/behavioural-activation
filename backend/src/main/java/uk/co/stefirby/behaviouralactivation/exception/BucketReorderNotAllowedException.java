package uk.co.stefirby.behaviouralactivation.exception;

/**
 * Thrown by {@code PlanService.reorderBucket(...)} when {@code PUT /api/v1/plan/bucket/order} is
 * requested with a submitted {@code occurrenceIds} set that doesn't exactly match the given week's
 * current weekend-bucket items -- either because an id resolves to an occurrence that isn't
 * currently a bucket item for that {@code weekStart}, or because the submitted set is missing/
 * includes extra ids relative to the current bucket (planner_spec_010_bucket_reordering.md,
 * PLANNER-010-AC-12/AC-13). Mapped to {@code 409} by {@link GlobalExceptionHandler}, mirroring
 * {@link CarryForwardNotAllowedException}'s existing "found but wrong state" pattern.
 */
public class BucketReorderNotAllowedException extends RuntimeException {

    public BucketReorderNotAllowedException(String message) {
        super(message);
    }
}
