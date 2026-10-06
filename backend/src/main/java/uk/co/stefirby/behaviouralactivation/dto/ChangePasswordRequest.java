package uk.co.stefirby.behaviouralactivation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// planner_spec_024_change_password.md (PLANNER-024-AC-03) -- `8` is a deliberate, simple
// minimum-length judgment call, not a complexity-scoring scheme this single-user app doesn't need.
public record ChangePasswordRequest(
    @NotBlank(message = "currentPassword is required") String currentPassword,
    @NotBlank(message = "newPassword is required")
    @Size(min = 8, message = "newPassword must be at least 8 characters") String newPassword
) {
}
