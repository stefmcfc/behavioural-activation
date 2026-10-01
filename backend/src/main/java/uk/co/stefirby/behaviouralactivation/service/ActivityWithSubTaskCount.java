package uk.co.stefirby.behaviouralactivation.service;

import uk.co.stefirby.behaviouralactivation.model.Activity;

/**
 * An {@link Activity} paired with its owner-scoped sub-task count, as composed by
 * {@link ActivityService#listForOwner(String, boolean)} for {@code ActivityController} to map into
 * {@code ActivityResponse.subTaskCount} (planner_spec_012_subtask_count.md,
 * PLANNER-012-AC-01/AC-02). Internal to the service/controller boundary -- not an API-facing shape
 * itself, so it lives alongside {@link ActivityService} rather than in {@code dto}.
 */
public record ActivityWithSubTaskCount(Activity activity, long subTaskCount) {
}
