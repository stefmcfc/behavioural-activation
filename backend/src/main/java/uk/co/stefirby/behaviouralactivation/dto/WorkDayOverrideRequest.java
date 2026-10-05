package uk.co.stefirby.behaviouralactivation.dto;

import jakarta.validation.constraints.NotNull;

public record WorkDayOverrideRequest(
    @NotNull(message = "workDay is required") Boolean workDay
) {
}
