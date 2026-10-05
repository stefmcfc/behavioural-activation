# Per-Occurrence Notes (Backend)

**Status**: Implemented (2026-10-05)
**Priority**: P3 — new feature, raised by the user as an idea 2026-10-06, scoped into a spec
2026-10-06
**Depends on**: `planner_spec_004_week_planning.md` (`PlannedOccurrence`, the existing
`move`/`findByIdAndOwner`/`initializeTarget` patterns this spec mirrors), `planner_spec_011_bucket_carry_forward_automation.md`
(carry-forward, which this spec's notes field must survive unchanged)
**Area**: Backend
**Roadmap version**: V1 polish

## Summary

All 7 ACs delivered exactly as specced — migration `V010`, `PlannedOccurrence.notes`/
`updateNotes(String)`, `UpdateOccurrenceNotesRequest`, `PlannedOccurrenceResponse.notes`, the
dedicated `PATCH /api/v1/plan/occurrences/{id}/notes` endpoint, and `PlanService.updateNotes`. Added
6 new `PlanServiceSpec` cases (AC-01/02/04/05/06/07) and 4 new `PlanControllerSpec` cases
(AC-01/02/03/04) — 318 backend tests total, 0 failures, 0 regressions. No deviations from the
spec's implementation notes were needed; `notes` was appended as the final field of
`PlannedOccurrenceResponse` (the spec didn't fix a position) rather than inserted mid-record, to
avoid reordering/renumbering every other existing positional-constructor call site.

## Overview

The same repeatable activity (e.g. "Read a book") can appear as many distinct `PlannedOccurrence`
rows across time, but there is currently no way to attach freeform text to one specific
occurrence — e.g. "Book A" on Tuesday's occurrence vs "Book B" on Thursday's. This is distinct
from `Activity.description`, which is shared across every occurrence of an activity and set once
at creation. This spec adds a nullable, length-capped `notes` field to `PlannedOccurrence`,
exposed through a new dedicated `PATCH /api/v1/plan/occurrences/{id}/notes` endpoint — deliberately
not folded into the existing move endpoint, mirroring how `complete`/`undo`/`carry-forward` already
each have their own dedicated endpoint rather than overloading one generic verb. This is also the
first occurrence endpoint in the codebase with real Jakarta Bean Validation (`@Size(max = 200)`) on
its request body, rather than relying on an unvalidated DB column cap as `Activity.description`
does.

## Requirements

### Requirement 1: Set or clear a note on an occurrence

**User story**: As a user, I want to attach a short freeform note to one specific planned
occurrence, so I can record detail that's true for that instance only (e.g. which book I'm
reading this time), not shared with every other occurrence of the same activity.

#### PLANNER-022-AC-01 [AUTO]: Set a note
**Statement**: When `PATCH /api/v1/plan/occurrences/{id}/notes` is requested with a non-null
`notes` value no longer than 200 characters, for an occurrence owned by the authenticated user,
the `PlanController` shall update the occurrence's `notes` field and return it with `200 OK`.

**Rationale**: The core capability this spec delivers.

**References**:
- Type: `UpdateOccurrenceNotesRequest` (new DTO), `PlannedOccurrenceResponse.notes` (new field)
- Entity: `PlannedOccurrence.notes` (new field), `PlannedOccurrence.updateNotes(String)` (new
  mutator)

#### PLANNER-022-AC-02 [AUTO]: Clear a note
**Statement**: When `PATCH /api/v1/plan/occurrences/{id}/notes` is requested with `notes: null`,
for an occurrence owned by the authenticated user, the `PlanController` shall clear the
occurrence's `notes` field and return it with `200 OK`.

**Rationale**: A user must be able to remove a note they no longer need, not just set one —
`UpdateOccurrenceNotesRequest.notes` has no `@NotBlank`, so `null` is a valid request body.

**References**:
- Related: `PLANNER-022-AC-01`

#### PLANNER-022-AC-03 [AUTO]: Reject an over-length note
**Statement**: When `PATCH /api/v1/plan/occurrences/{id}/notes` is requested with a `notes` value
longer than 200 characters, the `PlanController` shall return `400 Bad Request` via
`GlobalExceptionHandler`'s existing `MethodArgumentNotValidException` handler, and shall not
modify the occurrence.

**Rationale**: The user confirmed notes are meant to stay short (a label, not a journal entry) and
asked for a clean validation error rather than following `Activity.description`'s precedent of an
unvalidated DB-column-only cap. `@Valid` on the controller method plus `@Size(max = 200)` on the
DTO field reuses the handler already wired up for `ActivityRequest`/other `@Valid` bodies — no new
exception type or handler needed.

**References**:
- `GlobalExceptionHandler.handleValidationException` (existing, `exception/GlobalExceptionHandler.java:59-66`)

#### PLANNER-022-AC-04 [AUTO]: 404 for a nonexistent or not-owned occurrence
**Statement**: When `PATCH /api/v1/plan/occurrences/{id}/notes` is requested for an `id` that does
not exist, or that exists but is owned by a different user, the `PlanController` shall return
`404 Not Found`, with no distinction between the two cases in the response (matching
`PLANNER-004-AC-36`'s existing not-found/not-yours collapsing for this same resource).

**Rationale**: Consistent with every other occurrence endpoint's ownership-scoping behaviour.

**References**:
- Related: `PLANNER-004-AC-36`

### Requirement 2: Notes survive move and carry-forward

**User story**: As a user, I want a note I've attached to an occurrence to still be there after I
reschedule it or it carries forward to a new week, so I don't lose context I specifically attached
to that occurrence.

#### PLANNER-022-AC-05 [AUTO]: Note survives a move
**Statement**: While an occurrence has a non-null `notes` value, when
`PATCH /api/v1/plan/occurrences/{id}` (the existing move endpoint) is subsequently requested for
the same occurrence, the `PlanService` shall leave `notes` unchanged.

**Rationale**: `PlanService.move`/`applyMove` mutate the existing managed `PlannedOccurrence` row
in place (`assignSlot`/`moveToBucket`) rather than constructing a new one — `notes` is not among
the fields either method touches, so this should hold with zero code changes to `move`/`applyMove`
themselves; this AC exists to make that guarantee explicit and regression-tested.

**References**:
- `PlanService.applyMove` (`service/PlanService.java:329-347`)
- Related: `PLANNER-004-AC-16`/`AC-17`

#### PLANNER-022-AC-06 [AUTO]: Note survives manual carry-forward
**Statement**: While an occurrence has a non-null `notes` value, when
`POST /api/v1/plan/occurrences/{id}/carry-forward` is subsequently requested for the same
occurrence, the `PlanService` shall leave `notes` unchanged.

**Rationale**: `PlanService.applyCarryForward` calls `occurrence.carryForward()`, which only
mutates `weekStart`/`bucketPosition` on the same row — same in-place-mutation guarantee as
`PLANNER-022-AC-05`.

**References**:
- `PlannedOccurrence.carryForward` (`model/PlannedOccurrence.java:94-98`)
- Related: `PLANNER-011-AC-*` (manual carry-forward)

#### PLANNER-022-AC-07 [AUTO]: Note survives automatic carry-forward
**Statement**: While a bucket occurrence has a non-null `notes` value and is stale (from a
previous week), when `PlanService.migrateStaleBucketItems` runs (triggered by the next
`GET /api/v1/plan` call), the automatic migration shall leave `notes` unchanged on the migrated
occurrence.

**Rationale**: `PlannedOccurrence.autoCarryForwardTo` only mutates `weekStart`/`bucketPosition` —
same guarantee, for the automatic path.

**References**:
- `PlannedOccurrence.autoCarryForwardTo` (`model/PlannedOccurrence.java:105-109`)
- Related: `PLANNER-011-AC-06`/`AC-07`

## Cross-references

| This spec depends on / contracts against | Why |
|---|---|
| `planner_spec_004_week_planning.md` | `PlannedOccurrence` entity, `PlanService.move`/`findByIdAndOwner`/`initializeTarget` patterns this spec's new `updateNotes` method mirrors |
| `planner_spec_011_bucket_carry_forward_automation.md` | Carry-forward (manual + automatic), which Requirement 2 asserts is unaffected |
| `frontend_spec_043_occurrence_notes.md` | The paired frontend spec consuming this endpoint |
| `PlannedOccurrenceResponse` (`dto/PlannedOccurrenceResponse.java`) | Gains the new `notes` field, read by every occurrence response (list/create/move/notes-update) |
| `GlobalExceptionHandler` (`exception/GlobalExceptionHandler.java`) | Existing `MethodArgumentNotValidException` handler reused for `PLANNER-022-AC-03`, no changes needed |

## Implementation notes (for `backend-dev`)

- **Migration**: `backend/src/main/resources/db/migration/V010__add_notes_to_planned_occurrences.sql`:
  ```sql
  ALTER TABLE planned_occurrences
      ADD COLUMN notes VARCHAR(200);
  ```
- **`model/PlannedOccurrence.java`**: add `@Column(length = 200) private String notes;` (nullable),
  a `getNotes()` getter, and:
  ```java
  public void updateNotes(String notes) {
      this.notes = notes;
      this.updatedAt = Instant.now();
  }
  ```
- **New DTO** `dto/UpdateOccurrenceNotesRequest.java`:
  ```java
  public record UpdateOccurrenceNotesRequest(@Size(max = 200) String notes) {}
  ```
- **`dto/PlannedOccurrenceResponse.java`**: add `notes` field to the record; update
  `PlanController`'s private `toResponse(...)` helper (`controller/PlanController.java:142-158`) to
  pass `occurrence.getNotes()` through for every call site.
- **`controller/PlanController.java`**: new endpoint alongside the existing `carry-forward`/
  `completion` sub-resource endpoints:
  ```java
  @PatchMapping("/occurrences/{id}/notes")
  public ResponseEntity<PlannedOccurrenceResponse> updateNotes(@PathVariable UUID id,
          @Valid @RequestBody UpdateOccurrenceNotesRequest request, Authentication authentication) {
      return planService.updateNotes(authentication.getName(), id, request)
          .map(occurrence -> ResponseEntity.ok(toResponse(occurrence, /* completion */ null, false)))
          .orElseGet(() -> ResponseEntity.notFound().build());
  }
  ```
  Note: `toResponse` needs the occurrence's completion status looked up the same way `move` does
  (`planService.findCompletion(authentication.getName(), id)`), not a hardcoded `null`.
- **`service/PlanService.java`**: new method mirroring `move`'s shape (`service/PlanService.java:142-148`):
  ```java
  @Transactional
  public Optional<PlannedOccurrence> updateNotes(String ownerUsername, UUID id, UpdateOccurrenceNotesRequest request) {
      User owner = resolveOwner(ownerUsername);
      return plannedOccurrenceRepository.findByIdAndOwner(id, owner)
          .map(occurrence -> {
              occurrence.updateNotes(request.notes());
              initializeTarget(occurrence);
              return occurrence;
          });
  }
  ```

## TDD test case sketches

### PlanServiceSpec.groovy

```groovy
def "PLANNER-022-AC-01: updateNotes sets the note and bumps updatedAt"() {
    given: "an occurrence owned by steve, with no note yet"
        def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
            DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
        userRepository.findByUsername("steve") >> Optional.of(owner)
        plannedOccurrenceRepository.findByIdAndOwner(occurrence.id, owner) >> Optional.of(occurrence)

    when: "updateNotes is called with a note"
        def result = planService.updateNotes("steve", occurrence.id, new UpdateOccurrenceNotesRequest("Book A"))

    then: "the occurrence's notes field is set"
        result.get().notes == "Book A"
}

def "PLANNER-022-AC-02: updateNotes with null clears an existing note"() {
    given: "an occurrence with an existing note"
        def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
            DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
        occurrence.updateNotes("Book A")
        userRepository.findByUsername("steve") >> Optional.of(owner)
        plannedOccurrenceRepository.findByIdAndOwner(occurrence.id, owner) >> Optional.of(occurrence)

    when: "updateNotes is called with null"
        def result = planService.updateNotes("steve", occurrence.id, new UpdateOccurrenceNotesRequest(null))

    then: "the note is cleared"
        result.get().notes == null
}

def "PLANNER-022-AC-05: a note survives a subsequent move"() {
    given: "an occurrence with a note"
        def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
            DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
        occurrence.updateNotes("Book A")
        userRepository.findByUsername("steve") >> Optional.of(owner)
        plannedOccurrenceRepository.findByIdAndOwner(occurrence.id, owner) >> Optional.of(occurrence)

    when: "move is called to reschedule it"
        def moved = planService.move("steve", occurrence.id,
            new PlannedOccurrenceMoveRequest(DayOfWeek.WEDNESDAY, PlanSlot.EVENING))

    then: "the note is unchanged"
        moved.get().notes == "Book A"
}
```

### PlanControllerSpec.groovy

```groovy
def "PLANNER-022-AC-01: PATCH /api/v1/plan/occurrences/{id}/notes sets a note and returns 200"() {
    given: "the service sets the note successfully"
        def id = UUID.randomUUID()
        def body = objectMapper.writeValueAsString([notes: "Book A"])
        def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
            DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
        occurrence.updateNotes("Book A")
        planService.updateNotes("steve", id, _ as UpdateOccurrenceNotesRequest) >> Optional.of(occurrence)
        planService.findCompletion("steve", id) >> Optional.empty()

    when: "PATCH /api/v1/plan/occurrences/{id}/notes is requested"
        def result = mockMvc.perform(patch("/api/v1/plan/occurrences/${id}/notes")
            .with(SecurityMockMvcRequestPostProcessors.user("steve"))
            .contentType("application/json")
            .content(body))

    then: "the response is 200 with the note"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.notes').value("Book A"))
}

def "PLANNER-022-AC-03: PATCH /api/v1/plan/occurrences/{id}/notes returns 400 for a note over 200 characters"() {
    given: "a notes value longer than 200 characters"
        def id = UUID.randomUUID()
        def body = objectMapper.writeValueAsString([notes: "x" * 201])

    when: "PATCH /api/v1/plan/occurrences/{id}/notes is requested"
        def result = mockMvc.perform(patch("/api/v1/plan/occurrences/${id}/notes")
            .with(SecurityMockMvcRequestPostProcessors.user("steve"))
            .contentType("application/json")
            .content(body))

    then: "the response is 400 and the service is never called"
        result.andExpect(status().isBadRequest())
        0 * planService.updateNotes(_, _, _)
}

def "PLANNER-022-AC-04: PATCH /api/v1/plan/occurrences/{id}/notes returns 404 for an unknown or not-owned occurrence"() {
    given: "the service finds no matching owned occurrence"
        def id = UUID.randomUUID()
        def body = objectMapper.writeValueAsString([notes: "Book A"])
        planService.updateNotes("steve", id, _ as UpdateOccurrenceNotesRequest) >> Optional.empty()

    when: "PATCH /api/v1/plan/occurrences/{id}/notes is requested"
        def result = mockMvc.perform(patch("/api/v1/plan/occurrences/${id}/notes")
            .with(SecurityMockMvcRequestPostProcessors.user("steve"))
            .contentType("application/json")
            .content(body))

    then: "the response is 404"
        result.andExpect(status().isNotFound())
}
```

**Test Case (Green)**: implement the migration, entity field/mutator, DTO, controller endpoint,
and service method above until every sketch passes.

## Acceptance Criteria Summary

- [x] PLANNER-022-AC-01: Set a note
- [x] PLANNER-022-AC-02: Clear a note
- [x] PLANNER-022-AC-03: Reject an over-length note (400)
- [x] PLANNER-022-AC-04: 404 for a nonexistent or not-owned occurrence
- [x] PLANNER-022-AC-05: Note survives a move
- [x] PLANNER-022-AC-06: Note survives manual carry-forward
- [x] PLANNER-022-AC-07: Note survives automatic carry-forward
