package uk.co.stefirby.behaviouralactivation.repository;

import java.util.UUID;

/**
 * JPQL constructor-expression projection backing
 * {@link SubTaskRepository#countGroupedByActivityIdForOwner(uk.co.stefirby.behaviouralactivation.model.User)}
 * (planner_spec_018_bulk_sub_task_fetch.md, PLANNER-018-AC-04) -- one row per {@code activityId} that
 * has at least one sub-task for the given owner, paired with that activity's sub-task count. Internal
 * to the repository/service boundary, not an API-facing shape -- {@code count} is {@code Long}
 * (boxed), not {@code long}, to match Hibernate's JPQL {@code COUNT(...)} projection type exactly.
 */
public record SubTaskCountProjection(UUID activityId, Long count) {
}
