package uk.co.stefirby.behaviouralactivation.dto;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory;
import uk.co.stefirby.behaviouralactivation.model.PlanSlot;

// `name` is resolved live from the linked Activity/SubTask at response-mapping time (PlanController)
// -- never stored on PlannedOccurrence itself. Only `category` is a creation-time snapshot.
//
// `parentActivityName` is likewise resolved live: null when the occurrence targets an Activity
// directly, and the parent Activity's name when it targets a SubTask (PLANNER-008-AC-01/AC-02/AC-03).
//
// `completed`/`completedAt` reflect the occurrence's CompletionRecord, if any (PLANNER-004-AC-27)
// -- `completed` is true and `completedAt` non-null once POST .../completion has been called,
// reset to false/null by DELETE .../completion (undo).
public record PlannedOccurrenceResponse(
    UUID id,
    UUID activityId,
    UUID subTaskId,
    String name,
    String parentActivityName,
    ActivityCategory category,
    LocalDate weekStart,
    DayOfWeek dayOfWeek,
    PlanSlot slot,
    boolean completed,
    Instant completedAt,
    Instant createdAt
) {
}
