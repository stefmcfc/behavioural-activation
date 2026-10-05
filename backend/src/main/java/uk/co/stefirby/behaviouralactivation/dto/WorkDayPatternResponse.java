package uk.co.stefirby.behaviouralactivation.dto;

import java.time.DayOfWeek;
import java.util.Set;

public record WorkDayPatternResponse(Set<DayOfWeek> days) {
}
