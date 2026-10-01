ALTER TABLE planned_occurrences
    ADD COLUMN bucket_position INTEGER;

-- Supports PlanService.nextBucketPosition()'s per-week bucket-item count query, and
-- reorderBucket()'s "current full bucket set" lookup, without a full table scan
-- (PLANNER-010-AC-03/AC-05/AC-07/AC-13/AC-14).
CREATE INDEX idx_planned_occurrences_owner_week_bucket
    ON planned_occurrences(user_id, week_start, bucket_position);
