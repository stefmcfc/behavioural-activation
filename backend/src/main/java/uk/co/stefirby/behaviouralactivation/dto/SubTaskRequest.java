package uk.co.stefirby.behaviouralactivation.dto;

import jakarta.validation.constraints.NotBlank;

// Deliberately declares no `category` field (PLANNER-003-AC-06/AC-14) -- a sub-task's category is
// only ever set as a creation-time copy of its parent Activity's category (see SubTaskService),
// never client-supplied, and never editable after creation via this or any other endpoint.
public record SubTaskRequest(
    @NotBlank(message = "name is required") String name
) {
}
