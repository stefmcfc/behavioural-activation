package uk.co.stefirby.behaviouralactivation.dto;

import jakarta.validation.constraints.NotNull;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;
import uk.co.stefirby.behaviouralactivation.model.PlanSlot;

// Exactly one of activityId/subTaskId must be set (PLANNER-004-AC-10, enforced in PlanService, not
// here) -- a bean-validation cross-field constraint would be more complex than a plain service-level
// check for a two-field either/or rule. dayOfWeek/slot are both null (weekend bucket) or both set
// (scheduled) -- also enforced in PlanService (PLANNER-004-AC-12).
public record PlannedOccurrenceRequest(
    UUID activityId,
    UUID subTaskId,
    @NotNull(message = "weekStart is required") LocalDate weekStart,
    DayOfWeek dayOfWeek,
    PlanSlot slot
) {
}
