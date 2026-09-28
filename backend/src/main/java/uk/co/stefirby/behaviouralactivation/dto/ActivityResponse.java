package uk.co.stefirby.behaviouralactivation.dto;

import java.time.Instant;
import java.util.UUID;
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory;

public record ActivityResponse(
    UUID id, String name, ActivityCategory category, String description, Instant createdAt
) {
}
