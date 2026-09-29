package uk.co.stefirby.behaviouralactivation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory;

public record ActivityRequest(
    @NotBlank(message = "name is required") String name,
    @NotNull(message = "category is required") ActivityCategory category,
    String description,
    Boolean repeatable
) {
}
