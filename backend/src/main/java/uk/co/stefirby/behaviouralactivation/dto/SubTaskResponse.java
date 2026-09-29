package uk.co.stefirby.behaviouralactivation.dto;

import java.time.Instant;
import java.util.UUID;
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory;

public record SubTaskResponse(
    UUID id, UUID activityId, String name, ActivityCategory category, Instant createdAt
) {
}
