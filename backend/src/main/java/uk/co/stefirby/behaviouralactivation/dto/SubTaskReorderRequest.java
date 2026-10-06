package uk.co.stefirby.behaviouralactivation.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

// Request body for PUT /api/v1/activities/{activityId}/sub-tasks/order -- the complete desired
// order for an activity's sub-task checklist, submitted as one full-replacement list of ids rather
// than a single "move this one item to position N" call (planner_spec_023_subtask_reordering.md,
// Requirement 3). No weekStart-equivalent field is needed, unlike BucketReorderRequest -- activityId
// is already a path variable on this nested resource. subTaskIds emptiness is bean-validated here
// (PLANNER-023-AC-07); duplicates and the not-exactly-the-current-checklist case are checked in
// SubTaskService.reorder() instead, since they require real data, not just request shape
// (PLANNER-023-AC-08/AC-10).
public record SubTaskReorderRequest(
    @NotEmpty(message = "subTaskIds must not be empty") List<UUID> subTaskIds
) {
}
