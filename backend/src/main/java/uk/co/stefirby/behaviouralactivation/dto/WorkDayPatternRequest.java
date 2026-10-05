package uk.co.stefirby.behaviouralactivation.dto;

import jakarta.validation.constraints.NotNull;
import java.time.DayOfWeek;
import java.util.Set;

// Full-replace semantics (planner_spec_021_work_day_marking.md, PLANNER-021-AC-02) -- days is
// validated non-null (an empty set is valid, clearing the recurring pattern entirely), never
// partially merged with the existing pattern.
public record WorkDayPatternRequest(
    @NotNull(message = "days is required") Set<DayOfWeek> days
) {
}
