package uk.co.stefirby.behaviouralactivation.dto;

/**
 * Response shape for {@code GET /api/v1/activities/{id}/deletion-impact}
 * (planner_spec_027_archive_before_delete.md, PLANNER-027-AC-05/AC-06) — reports how many
 * {@code PlannedOccurrence}/{@code CompletionRecord} rows are tied to the activity, directly or via
 * any of its sub-tasks, so the caller can make an informed decision before deleting it. Purely
 * informational — does not change what deleting the activity actually does.
 */
public record ActivityDeletionImpactResponse(long plannedOccurrenceCount, long completionCount) {
}
