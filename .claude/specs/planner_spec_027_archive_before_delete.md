# Archive-Before-Delete for Activities (Backend)

**Status**: Implemented (2026-10-29)

**Priority**: P1 — data-integrity/safety fix for an existing unguarded delete flow. Raised after a
real incident: a seeded activity was genuinely hard-deleted during manual testing of
`frontend_spec_049_undo_delete.md`, which exposed that `ActivityService.delete()` has never had any
guard at all — any activity, archived or not, with or without planning/completion history, can be
permanently deleted, cascading through `sub_tasks` → `planned_occurrences` → `completion_records`
with zero warning.

**Depends on**: `planner_spec_002_activity_bank.md` (`Activity` entity, `ActivityRepository`,
`ActivityService`/`ActivityController` base shape — this spec amends `delete()` there),
`planner_spec_006_repeatable_activities.md` (`archived` field, `archive()`/`unarchive()` — reused
unmodified), `planner_spec_004_week_planning.md` (`PlannedOccurrence`, `CompletionRecord`)

**Area**: Backend

**Roadmap version**: V1 polish (matches `planner_spec_020_prevent_completed_occurrence_bucket_move.md`'s
own "V1 polish" framing for a correctness/safety fix, not a new V1–V5 feature)

**Supersedes**: `planner_spec_002_activity_bank.md`'s **PLANNER-002-AC-16** — "delete is
unconditional for the owner" is amended below to require `archived: true` first; AC-16's own
checklist entry stays checked as historical record (it described what shipped at the time), this
spec's AC-03 is the current, narrower behavior. **Reverses** `planner_spec_006_repeatable_activities.md`'s
"Out of scope" note — *"any user-initiated 'Archive' action from an otherwise-active state... the
two archive endpoints below exist for idempotent-success/possible-future-manual-use symmetry with
`unarchive`, not because this spec adds a UI trigger for calling the archive one directly"* — the
paired frontend spec (`frontend_spec_058_archive_before_delete.md`) now adds exactly that manual
trigger. `archive()`/`unarchive()` themselves are **not changed** by this spec.

## Overview

Two changes, both scoped to `ActivityService`/`ActivityController`:

1. `DELETE /api/v1/activities/{id}` now requires the target activity to already be `archived` —
   attempting to delete an active (non-archived) activity is rejected with `409`, not silently
   allowed. This is the actual enforcement point; the paired frontend spec removes the Delete button
   from active rows entirely, but the backend is the real guarantee (mirrors this codebase's own
   existing precedent — `BucketMoveNotAllowedException` exists specifically because frontend-only
   gating isn't trustworthy on its own).
2. A new read-only `GET /api/v1/activities/{id}/deletion-impact` endpoint reports how many
   `PlannedOccurrence`/`CompletionRecord` rows are tied to the activity (directly, or via any of its
   sub-tasks), so the frontend can warn the user with real numbers before they confirm deleting an
   archived activity that actually has history. This endpoint is purely informational — it does not
   change what deleting the activity actually does (the cascade is unchanged; this spec is about
   *whether/when* delete is allowed and *how informed* the decision is, not about preserving history
   on delete).

**Out of scope**: any change to `archive()`/`unarchive()`'s own behavior; soft-delete or any
history-preserving alternative to the existing `ON DELETE CASCADE` chain (a real cascade still
happens once delete is permitted — this spec informs the decision, it doesn't change the outcome);
restricting the new `deletion-impact` endpoint to archived activities only (it's a non-mutating
read, gating it would add friction with no real security benefit beyond the owner-scoping every
other single-activity endpoint already has).

## Requirement 1 — Deleting an activity requires it to already be archived

As a user, I want the app to stop me from permanently deleting an activity I'm still actively using,
so I can't destroy it (and its sub-tasks/planned occurrences/completion history) without having
deliberately archived it first.

- **PLANNER-027-AC-01** [AUTO]: When `DELETE /api/v1/activities/{id}` is requested for an activity
  owned by the authenticated user with `archived: false`, the `ActivityService` shall throw
  `ActivityDeleteNotAllowedException` and leave the activity (and everything that would have
  cascaded from it) untouched.
- **PLANNER-027-AC-02** [AUTO]: `ActivityDeleteNotAllowedException` shall be mapped to `409 Conflict`
  by `GlobalExceptionHandler`, matching the existing `BucketMoveNotAllowedException`/
  `CarryForwardNotAllowedException` pattern exactly (`ApiError.of(ex.getMessage())`, no `details`).
- **PLANNER-027-AC-03** [AUTO]: When `DELETE /api/v1/activities/{id}` is requested for an activity
  owned by the authenticated user with `archived: true`, the `ActivityService` shall permanently
  delete the activity and the `ActivityController` shall return `204 No Content` — this is
  `PLANNER-002-AC-16`'s original behavior, now conditional on the activity already being archived.
- **PLANNER-027-AC-04** [AUTO — regression test]: If `DELETE /api/v1/activities/{id}` is requested
  for an `id` that does not exist or belongs to a different owner, then the `ActivityController`
  shall return `404` without deleting anything and without evaluating the archived-state rule at
  all — `PLANNER-002-AC-17`/`AC-18`'s not-found/not-yours behavior (identical response either way,
  never distinguishable) is unmodified by this spec.

## Requirement 2 — A read-only endpoint reports what deleting an activity would actually affect

As a user, I want to know, before I delete an archived activity, whether it has any real
planning/completion history attached, so I can make an informed choice instead of being surprised
afterward.

- **PLANNER-027-AC-05** [AUTO]: When `GET /api/v1/activities/{id}/deletion-impact` is requested for
  an activity owned by the authenticated user, the `ActivityController` shall return `200` with an
  `ActivityDeletionImpactResponse` whose `plannedOccurrenceCount` equals the total number of
  `PlannedOccurrence` rows that target the activity directly, plus every `PlannedOccurrence` row
  that targets any of the activity's sub-tasks.
- **PLANNER-027-AC-06** [AUTO]: ...whose `completionCount` equals the total number of
  `CompletionRecord` rows tied to any `PlannedOccurrence` counted in AC-05 (directly-targeted or
  via a sub-task) — computed and summed independently of `plannedOccurrenceCount`, never conflated
  with it.
- **PLANNER-027-AC-07** [AUTO]: When the activity has never been planned at all (no matching
  `PlannedOccurrence` rows, directly or via any sub-task), the response shall report
  `plannedOccurrenceCount: 0` and `completionCount: 0`.
- **PLANNER-027-AC-08** [AUTO]: If `GET /api/v1/activities/{id}/deletion-impact` is requested for an
  `id` that does not exist or belongs to a different owner, then the `ActivityController` shall
  return `404`.
- **PLANNER-027-AC-09** [AUTO — regression test]: This endpoint shall be reachable regardless of the
  target activity's `archived` state — no precondition, unlike `DELETE`'s new rule in Requirement 1
  (see Overview's "Out of scope" for why).
- **PLANNER-027-AC-10** [AUTO — regression test]: `GET /api/v1/activities/{id}/deletion-impact`
  shall already require an authenticated session via the existing `SecurityFilterChain`'s blanket
  `.requestMatchers("/api/v1/**").authenticated()` rule, with no `SecurityConfig` change needed —
  mirrors `PLANNER-002-AC-19`'s precedent of adding a regression test confirming this rather than
  modifying security config.

## Data model / new types

New exception, `exception/ActivityDeleteNotAllowedException.java` — exact shape of
`BucketMoveNotAllowedException`:
```java
package uk.co.stefirby.behaviouralactivation.exception;

/**
 * Thrown by {@code ActivityService.delete(...)} when the target {@code Activity} is not yet
 * archived (planner_spec_027_archive_before_delete.md, PLANNER-027-AC-01). Mapped to {@code 409} by
 * {@link GlobalExceptionHandler}.
 */
public class ActivityDeleteNotAllowedException extends RuntimeException {

    public ActivityDeleteNotAllowedException(String message) {
        super(message);
    }
}
```

`GlobalExceptionHandler` gains one handler, identical shape to the existing nine:
```java
@ExceptionHandler(ActivityDeleteNotAllowedException.class)
public ResponseEntity<ApiError> handleActivityDeleteNotAllowedException(ActivityDeleteNotAllowedException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of(ex.getMessage()));
}
```

`ActivityService.delete()` — the archived-state gate goes inside the existing
`findByIdAndOwner(...).map(...)` shape (same pattern as `update()`'s own `.map(...)` body in this
same file):
```java
@Transactional
public boolean delete(String ownerUsername, UUID id) {
    User owner = resolveOwner(ownerUsername);
    return activityRepository.findByIdAndOwner(id, owner)
        .map(activity -> {
            if (!activity.isArchived()) {
                throw new ActivityDeleteNotAllowedException(
                    "An active activity must be archived before it can be deleted");
            }
            activityRepository.delete(activity);
            return true;
        })
        .orElse(false);
}
```

New DTO, `dto/ActivityDeletionImpactResponse.java`:
```java
public record ActivityDeletionImpactResponse(long plannedOccurrenceCount, long completionCount) {
}
```

New repository methods — plain derived Spring Data methods (no custom `@Query`; a plain
count-by-traversal isn't the "real complexity/scale reason" `.claude/steering/structure.md` reserves
custom `@Query` for), following the exact underscore-traversal naming convention already
established by `CompletionRecordRepository.findByOwnerAndPlannedOccurrence_SubTask_IdIn`:

`PlannedOccurrenceRepository` (field names confirmed: `PlannedOccurrence.activity`,
`PlannedOccurrence.subTask`):
```java
long countByOwnerAndActivity_Id(User owner, UUID activityId);
long countByOwnerAndSubTask_Activity_Id(User owner, UUID activityId);
```

`CompletionRecordRepository` (field name confirmed: `CompletionRecord.plannedOccurrence`):
```java
long countByOwnerAndPlannedOccurrence_Activity_Id(User owner, UUID activityId);
long countByOwnerAndPlannedOccurrence_SubTask_Activity_Id(User owner, UUID activityId);
```

New `ActivityService` method — requires injecting `PlannedOccurrenceRepository` and
`CompletionRecordRepository` into `ActivityService`'s constructor (currently only
`ActivityRepository`/`UserRepository`/`SubTaskRepository`):
```java
@Transactional(readOnly = true)
public Optional<ActivityDeletionImpactResponse> getDeletionImpact(String ownerUsername, UUID id) {
    User owner = resolveOwner(ownerUsername);
    return activityRepository.findByIdAndOwner(id, owner)
        .map(activity -> new ActivityDeletionImpactResponse(
            plannedOccurrenceRepository.countByOwnerAndActivity_Id(owner, id)
                + plannedOccurrenceRepository.countByOwnerAndSubTask_Activity_Id(owner, id),
            completionRecordRepository.countByOwnerAndPlannedOccurrence_Activity_Id(owner, id)
                + completionRecordRepository.countByOwnerAndPlannedOccurrence_SubTask_Activity_Id(owner, id)));
}
```

New `ActivityController` endpoint, thin delegate matching every other single-activity GET's shape:
```java
@GetMapping("/{id}/deletion-impact")
public ResponseEntity<ActivityDeletionImpactResponse> deletionImpact(@PathVariable UUID id,
        Authentication authentication) {
    return activityService.getDeletionImpact(authentication.getName(), id)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.notFound().build());
}
```

## Cross-references

| This spec | Contracts against |
|---|---|
| `ActivityService.delete()` (`planner_spec_002_activity_bank.md`) | Amended — gains the archived-state gate; supersedes `PLANNER-002-AC-16` |
| `ActivityService.archive()`/`unarchive()` (`planner_spec_006_repeatable_activities.md`) | Reused unmodified |
| `Activity.isArchived()` (`model/`, `planner_spec_006`) | Reused unmodified |
| `ActivityDeleteNotAllowedException` (`exception/`, new) | New — 409 via `GlobalExceptionHandler`, mirrors `BucketMoveNotAllowedException` |
| `ActivityDeletionImpactResponse` (`dto/`, new) | New — narrow, read-only response shape |
| `PlannedOccurrenceRepository`/`CompletionRecordRepository` (`repository/`) | Extended — four new derived count methods |
| `frontend_spec_058_archive_before_delete.md` | Paired frontend spec — adds the manual Archive UI trigger, the archived-activities section, and consumes this spec's new 409/`deletion-impact` contracts |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-027-AC-01/AC-02: deleting an active activity throws, mapped to 409"() {
    given: "an active (non-archived) activity"
        def activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.PLEASURABLE, null, currentUser))

    when: "DELETE /api/v1/activities/{id} is requested"
        def response = client.delete().uri("/api/v1/activities/${activity.id}").exchange()

    then: "the response is 409 and the activity still exists"
        response.expectStatus().isEqualTo(409)
        activityRepository.findById(activity.id).isPresent()
}

def "PLANNER-027-AC-03: deleting an archived activity succeeds"() {
    given: "an archived activity"
        def activity = activityRepository.save(
            new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, currentUser))
        activity.archive()
        activityRepository.save(activity)

    when: "DELETE /api/v1/activities/{id} is requested"
        def response = client.delete().uri("/api/v1/activities/${activity.id}").exchange()

    then: "the response is 204 and the activity is gone"
        response.expectStatus().isNoContent()
        activityRepository.findById(activity.id).isEmpty()
}

def "PLANNER-027-AC-04: deleting another user's activity is still 404, archived-state never evaluated"() {
    given: "an active activity owned by a different user"
        def otherUsersActivity = activityRepository.save(
            new Activity("Not mine", ActivityCategory.ROUTINE, null, otherUser))

    when: "DELETE /api/v1/activities/{id} is requested as the current user"
        def response = client.delete().uri("/api/v1/activities/${otherUsersActivity.id}").exchange()

    then: "404, not 409 -- ownership is checked before archived state"
        response.expectStatus().isNotFound()
}

def "PLANNER-027-AC-05/AC-06/AC-07: zero history reports zero counts"() {
    given: "an activity never planned"
        def activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.PLEASURABLE, null, currentUser))

    when: "GET /api/v1/activities/{id}/deletion-impact is requested"
        def response = client.get().uri("/api/v1/activities/${activity.id}/deletion-impact").exchange()

    then: "both counts are zero"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.plannedOccurrenceCount").isEqualTo(0)
        response.expectBody().jsonPath("\$.completionCount").isEqualTo(0)
}

def "PLANNER-027-AC-05/AC-06: counts sum direct-activity and via-sub-task occurrences/completions independently"() {
    given: "an activity with one direct occurrence (completed) and a sub-task with one occurrence (not completed)"
        def activity = activityRepository.save(
            new Activity("Deep clean the kitchen", ActivityCategory.NECESSARY, null, currentUser))
        def subTask = subTaskRepository.save(new SubTask(activity, "Clean the oven", activity.category, currentUser))
        def directOccurrence = createOccurrenceFor(activity, weekStart)
        def subTaskOccurrence = createOccurrenceFor(subTask, weekStart)
        completeOccurrence(directOccurrence)

    when: "GET /api/v1/activities/{id}/deletion-impact is requested"
        def response = client.get().uri("/api/v1/activities/${activity.id}/deletion-impact").exchange()

    then: "plannedOccurrenceCount counts both, completionCount counts only the completed one"
        response.expectBody().jsonPath("\$.plannedOccurrenceCount").isEqualTo(2)
        response.expectBody().jsonPath("\$.completionCount").isEqualTo(1)
}

def "PLANNER-027-AC-08: deletion-impact for another user's activity is 404"() {
    given: "an activity owned by a different user"
        def otherUsersActivity = activityRepository.save(
            new Activity("Not mine", ActivityCategory.ROUTINE, null, otherUser))

    when: "GET .../deletion-impact is requested as the current user"
        def response = client.get().uri("/api/v1/activities/${otherUsersActivity.id}/deletion-impact").exchange()

    then: "404"
        response.expectStatus().isNotFound()
}

def "PLANNER-027-AC-09: deletion-impact is reachable for an active (non-archived) activity too"() {
    given: "an active activity"
        def activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.PLEASURABLE, null, currentUser))

    when: "GET .../deletion-impact is requested"
        def response = client.get().uri("/api/v1/activities/${activity.id}/deletion-impact").exchange()

    then: "200, no archived-state precondition"
        response.expectStatus().isOk()
}
```

**Test Case (Green)**: implement `ActivityDeleteNotAllowedException`/`ActivityDeletionImpactResponse`/
the four new repository methods/`ActivityService.delete()`'s new guard/`ActivityService.getDeletionImpact`/
`ActivityController`'s new endpoint/`GlobalExceptionHandler`'s new handler as specified above until
every sketch above (and AC-10, covered by a regression-style auth test mirroring `PLANNER-002-AC-19`'s
own test) passes.

## Acceptance Criteria Summary

- [x] PLANNER-027-AC-01 — deleting an active activity throws `ActivityDeleteNotAllowedException`, nothing deleted
- [x] PLANNER-027-AC-02 — the exception maps to `409` via `GlobalExceptionHandler`
- [x] PLANNER-027-AC-03 — deleting an archived activity succeeds, `204`
- [x] PLANNER-027-AC-04 — not-found/not-yours still `404`, archived-state never evaluated first
- [x] PLANNER-027-AC-05 — `deletion-impact` reports `plannedOccurrenceCount` (direct + via sub-tasks)
- [x] PLANNER-027-AC-06 — `deletion-impact` reports `completionCount` independently
- [x] PLANNER-027-AC-07 — never-planned activity reports zero/zero
- [x] PLANNER-027-AC-08 — `deletion-impact` for another owner's activity is `404`
- [x] PLANNER-027-AC-09 — `deletion-impact` has no archived-state precondition
- [x] PLANNER-027-AC-10 — `deletion-impact` requires authentication (regression test)

## Summary

Implemented exactly as specified, with one adaptation to this codebase's established test
conventions (the spec's own sketches used a `WebTestClient`/`client.get()`/`client.delete()` style
that isn't actually what `ActivityServiceSpec`/`ActivityControllerSpec` use elsewhere in this
codebase — mocked-repository Spock unit tests for the service layer and `@WebMvcTest`+`MockMvc`
with a mocked service for the controller layer). Test coverage followed the existing per-layer
convention instead:

- `ActivityService.delete()` gained the archived-state gate exactly as specified, throwing the new
  `ActivityDeleteNotAllowedException` before calling `activityRepository.delete(...)`. The
  ownership check (`findByIdAndOwner`) still runs first, so not-found/not-owned stays a plain
  `false` (→ `404`) without ever reaching the archived-state branch.
- `ActivityService.getDeletionImpact(...)` added exactly as specified, requiring
  `PlannedOccurrenceRepository`/`CompletionRecordRepository` injected into the constructor.
- Four new derived repository methods added with the exact names specified; `PlannedOccurrenceRepositorySpec`/
  `CompletionRecordRepositorySpec` (both `@SpringBootTest`, real Postgres) gained new test cases
  verifying the direct-vs-via-sub-task count split and the zero/zero case for an activity with no
  history — these count derivations are real query behavior worth confirming against the actual
  database, not just a mocked repository.
- `GlobalExceptionHandler` gained the new `409` handler; `GlobalExceptionHandlerSpec` covers it
  directly (handler-level unit test, matching this file's existing pattern for every other
  `*NotAllowedException`).
- `ActivityController` gained the new `GET /api/v1/activities/{id}/deletion-impact` endpoint as a
  thin delegate; `ActivityControllerSpec` covers the `409` mapping (end-to-end through
  `GlobalExceptionHandler`, which `@WebMvcTest` picks up automatically as a `@RestControllerAdvice`
  bean — no explicit `@Import` needed), the new endpoint's `200`/counts and `404` shapes, and a
  `401` regression test for the inherited `SecurityFilterChain` rule (AC-10).
- `ActivityServiceSpec`'s existing `PLANNER-002-AC-16` delete test needed its fixture activity
  archived before the delete call, as flagged going in — fixed, and re-labeled
  `PLANNER-002-AC-16/PLANNER-027-AC-03` since it now also stands in for this spec's "succeeds when
  archived" case.

Test results: full backend suite green, 367 tests, 0 failures, 0 errors
(`gradlew.bat test`), including 17 new/changed tests across `ActivityServiceSpec` (7 new +1 fixed),
`ActivityControllerSpec` (4 new), `GlobalExceptionHandlerSpec` (1 new), `PlannedOccurrenceRepositorySpec`
(2 new), and `CompletionRecordRepositorySpec` (2 new).

No real deviations from the spec's code shapes — `ActivityDeleteNotAllowedException`,
`ActivityDeletionImpactResponse`, the four repository methods, `ActivityService.delete()`/
`getDeletionImpact()`, the controller endpoint, and the `GlobalExceptionHandler` handler all match
the spec's exact code verbatim.
