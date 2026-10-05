package uk.co.stefirby.behaviouralactivation.dto;

import java.time.DayOfWeek;
import java.time.LocalDate;

// The resolved, effective work-day status for one calendar date -- combines WorkDayPattern and
// WorkDayOverride into one pre-resolved shape so the frontend never needs to merge the two data
// sources itself (planner_spec_021_work_day_marking.md, PLANNER-021-AC-04).
public record WorkDayResponse(LocalDate date, DayOfWeek dayOfWeek, boolean workDay) {
}
