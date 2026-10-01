# Expose repeatable on PlannedOccurrenceResponse (Backend)

**Status**: Implemented — both ACs covered by new tests in `PlanControllerSpec.groovy`
(`PLANNER-013-AC-01`, `PLANNER-013-AC-02`); full backend suite green (200 tests, 0 failures).
`repeatable` added as the trailing field on `PlannedOccurrenceResponse` (only call site of its
constructor is `PlanController.toResponse()`, no migration needed).
**Priority**: P3 — small UX polish, nothing else blocked on it
**Depends on**: `planner_spec_004_week_planning.md` (`PlannedOccurrence`, `PlannedOccurrenceResponse`,
`PlanController.toResponse`), `planner_spec_006_repeatable_activities.md` (`Activity.repeatable`,
the only place `repeatable` is actually stored — `SubTask` has no `repeatable` field of its own)
**Area**: Backend
**Roadmap version**: N/A — UX polish, not tied to a V1–V5 theme

## Overview

`frontend_spec_021_repeatable_icon_in_bucket_list.md` (paired with this spec) wants to show a
repeatable-activity icon on weekend bucket list items. `PlannedOccurrenceResponse` currently has no
`repeatable` field at all:

```java
public record PlannedOccurrenceResponse(
    UUID id, UUID activityId, UUID subTaskId, String name, String parentActivityName,
    ActivityCategory category, LocalDate weekStart, DayOfWeek dayOfWeek, PlanSlot slot,
    boolean completed, Instant completedAt, Instant createdAt
) {}
```

This spec adds `repeatable`, resolved live at response-mapping time — the exact same pattern
`PlanController.toResponse()` already uses for `name`/`parentActivityName` (lines 112–123), not a
new mechanism. Since `repeatable` only exists on `Activity`, not `SubTask`
(`planner_spec_006_repeatable_activities.md`'s own scoping — a sub-task inherits its parent
activity's repeatable/one-off status, it has no independent value), a sub-task-sourced occurrence
resolves `repeatable` from its parent activity, same as `parentActivityName` already does:

```java
boolean repeatable = isActivity
    ? occurrence.getActivity().isRepeatable()
    : occurrence.getSubTask().getActivity().isRepeatable();
```

No migration, no new entity field — `repeatable` already exists and is persisted on `Activity`; this
spec only changes what `PlanController` reads and returns.

## Requirement 1: Resolve repeatable onto every PlannedOccurrenceResponse

**User story**: As the frontend, I need to know whether a planned occurrence's underlying activity is
repeatable without a second request, so I can show a repeatable indicator on bucket list items.

### PLANNER-013-AC-01 [AUTO]: Activity-sourced occurrence resolves repeatable from the activity directly
**Statement**: When a `PlannedOccurrence` references an `Activity` directly (not a `SubTask`), the
`PlanController` shall set `PlannedOccurrenceResponse.repeatable` to that activity's own
`repeatable` value.

**Rationale**: The direct case — no indirection needed.

**References**:
- Type: `PlannedOccurrenceResponse` (backend `dto/`) gains `boolean repeatable`.
- Mapping point: `PlanController.toResponse()` (lines 112–123).

**Test Case (Red)**:
```groovy
def "PLANNER-013-AC-01: activity-sourced occurrence resolves repeatable from the activity"() {
    given: "a repeatable activity and its planned occurrence"
        def activity = activityWithId("Walk", repeatable: true)
        def occurrence = occurrenceFor(activity)

    when: "the controller maps it to a response"
        def response = PlanController.toResponse(occurrence, null)

    then: "repeatable reflects the activity's own value"
        response.repeatable() == true
}
```

**Test Case (Green)**: add `repeatable` to the record; set it via
`isActivity ? occurrence.getActivity().isRepeatable() : ...` in `toResponse()`.

### PLANNER-013-AC-02 [AUTO]: Sub-task-sourced occurrence resolves repeatable from its parent activity
**Statement**: When a `PlannedOccurrence` references a `SubTask`, the `PlanController` shall set
`PlannedOccurrenceResponse.repeatable` to that sub-task's **parent activity's** `repeatable` value
(a sub-task has no independent `repeatable` value of its own).

**Rationale**: Mirrors exactly how `parentActivityName` is already resolved for the sub-task case
(`occurrence.getSubTask().getActivity().getName()`) — same indirection, same reasoning: a sub-task
inherits its parent's repeatable/one-off status.

**References**:
- Related: `PLANNER-013-AC-01`.
- Existing precedent for the same indirection: `parentActivityName`'s resolution in
  `PlanController.toResponse()`.

**Test Case (Red)**:
```groovy
def "PLANNER-013-AC-02: sub-task-sourced occurrence resolves repeatable from its parent activity, not itself"() {
    given: "a one-off parent activity with a sub-task, and the sub-task's planned occurrence"
        def activity = activityWithId("Big project", repeatable: false)
        def subTask = subTaskWithId("Step one", activity: activity)
        def occurrence = occurrenceFor(subTask)

    when: "the controller maps it to a response"
        def response = PlanController.toResponse(occurrence, null)

    then: "repeatable reflects the PARENT activity's value, not some independent sub-task value"
        response.repeatable() == false
}
```

**Test Case (Green)**: the ternary's `else` branch:
`occurrence.getSubTask().getActivity().isRepeatable()`.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `PlannedOccurrenceResponse` | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/dto/PlannedOccurrenceResponse.java` |
| Mapping point | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/controller/PlanController.java` (`toResponse`) |
| `Activity.repeatable` (source of truth, unchanged) | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/model/Activity.java` |
| Frontend consumer | `frontend_spec_021_repeatable_icon_in_bucket_list.md` (depends on this spec) |

## Acceptance Criteria Summary

- [x] PLANNER-013-AC-01 [AUTO]: Activity-sourced occurrence resolves `repeatable` from the activity directly
- [x] PLANNER-013-AC-02 [AUTO]: Sub-task-sourced occurrence resolves `repeatable` from its parent activity
