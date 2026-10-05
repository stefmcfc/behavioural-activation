package uk.co.stefirby.behaviouralactivation.dto;

import jakarta.validation.constraints.Size;

// notes has no @NotBlank -- null is a valid request body, used to clear an existing note
// (planner_spec_022_occurrence_notes.md, PLANNER-022-AC-02).
public record UpdateOccurrenceNotesRequest(@Size(max = 200) String notes) {
}
