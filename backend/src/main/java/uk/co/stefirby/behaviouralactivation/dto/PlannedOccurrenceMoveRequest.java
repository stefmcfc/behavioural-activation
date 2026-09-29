package uk.co.stefirby.behaviouralactivation.dto;

import java.time.DayOfWeek;
import uk.co.stefirby.behaviouralactivation.model.PlanSlot;

// Both null demotes a scheduled occurrence back to the weekend bucket (PLANNER-004-AC-17); both set
// reschedules/promotes it (PLANNER-004-AC-16). Exactly one set is a 400 (PLANNER-004-AC-18),
// enforced in PlanService.
public record PlannedOccurrenceMoveRequest(
    DayOfWeek dayOfWeek,
    PlanSlot slot
) {
}
