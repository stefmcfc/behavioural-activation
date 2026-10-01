package uk.co.stefirby.behaviouralactivation.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Request body for PUT /api/v1/plan/bucket/order -- the complete desired order for a week's
// weekend-bucket occurrences, submitted as one full-replacement list of ids rather than a single
// "move this item to position N" call (planner_spec_010_bucket_reordering.md, Requirement 3).
// occurrenceIds emptiness is bean-validated here (PLANNER-010-AC-10); duplicates and the
// not-exactly-the-current-bucket-set case are checked in PlanService.reorderBucket() instead, since
// they require real data, not just request shape (PLANNER-010-AC-10/AC-13).
public record BucketReorderRequest(
    @NotNull(message = "weekStart is required") LocalDate weekStart,
    @NotEmpty(message = "occurrenceIds must not be empty") List<UUID> occurrenceIds
) {
}
