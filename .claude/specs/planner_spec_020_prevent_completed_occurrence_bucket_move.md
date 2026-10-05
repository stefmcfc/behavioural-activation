# Prevent a Completed Occurrence from Being Moved to the Bucket (Backend)

**Status**: Not started
**Priority**: P2 — correctness bug, found while reviewing the Weekly Summary tab's "X scheduled, Y
in the bucket" stat with the user (2026-10-05)
**Depends on**: `planner_spec_004_week_planning.md` (`PlanService.move`/`applyMove`, the
`PATCH /api/v1/plan/occurrences/{id}` endpoint this guards), `planner_spec_011_bucket_carry_
forward_automation.md` (origin of `CarryForwardNotAllowedException`, the exact precedent this spec
mirrors for an equivalent "wrong state for this action" rejection)
**Area**: Backend
**Roadmap version**: V1 polish

## Overview

`PlanService.applyMove` currently allows moving *any* `PlannedOccurrence` into the weekend bucket
(a request with `dayOfWeek: null, slot: null`) regardless of whether it has already been completed.
Confirmed by reading the code: `applyMove` branches only on whether the request targets the bucket,
with no completion check — unlike `applyCarryForward`, which already throws
`CarryForwardNotAllowedException("A completed occurrence cannot be carried forward")` for the
equivalent "wrong state" case via
`completionRecordRepository.findByPlannedOccurrenceIdAndOwner(...).isPresent()`. Reachable today
from two separate UI paths with no guard on either: `OccurrenceItem.tsx`'s "Send to bucket" button
(click-based) and dragging a completed grid tile onto the bucket list
(`frontend_spec_026_grid_bucket_cross_drag.md`'s cross-drag).

Conceptually, a completed activity is done for the week — the weekend bucket represents work still
to be scheduled/attempted, so turning a completed occurrence back into a bucket item would silently
misrepresent it as not-yet-done. This spec closes that gap with a new `BucketMoveNotAllowedException`
mirroring the existing `CarryForwardNotAllowedException`/`BucketReorderNotAllowedException` pattern
already established in this class, mapped to `409 Conflict` by `GlobalExceptionHandler`.

**Out of scope**: moving a completed occurrence between two grid slots (day/slot both non-null) is
unaffected — the user's concern is specifically about demoting a completed item back to the
unscheduled bucket, not about rescheduling it within the grid. No change to `carryForward` (already
guarded) or to `complete`/`uncomplete` themselves.

## Requirements

### Requirement 1 — Reject demoting a completed occurrence to the bucket

**User story**: As a user, I don't want to be able to turn a completed activity back into an
unscheduled bucket item, since the bucket represents things still to be done this week, not things
already done.

#### PLANNER-020-AC-01 [AUTO]: Moving a completed occurrence to the bucket is rejected
**Statement**: When `PATCH /api/v1/plan/occurrences/{id}` is requested with `dayOfWeek: null` and
`slot: null` for an occurrence that has an associated `CompletionRecord`, the `PlanService` shall
throw `BucketMoveNotAllowedException` and leave the occurrence's existing `dayOfWeek`/`slot`
unchanged.

**Rationale**: Core fix — mirrors `applyCarryForward`'s existing completed-state guard for the
equivalent "move to bucket" action.

**References**:
- Service: `uk.co.stefirby.behaviouralactivation.service.PlanService` (`applyMove`)
- Exception: `uk.co.stefirby.behaviouralactivation.exception.BucketMoveNotAllowedException` (new)
- Repository: `CompletionRecordRepository.findByPlannedOccurrenceIdAndOwner` (existing, same lookup
  `applyCarryForward` already uses)

#### PLANNER-020-AC-02 [AUTO]: `BucketMoveNotAllowedException` maps to 409 Conflict
**Statement**: When `BucketMoveNotAllowedException` is thrown, `GlobalExceptionHandler` shall
respond with `409 Conflict` and an `ApiError` body carrying the exception's message.

**Rationale**: Matches the existing `CarryForwardNotAllowedException`/`BucketReorderNotAllowedException`
handler pattern — one consistent JSON error shape for every "found but wrong state" rejection in this
controller.

**References**: `uk.co.stefirby.behaviouralactivation.exception.GlobalExceptionHandler`

#### PLANNER-020-AC-03 [AUTO]: Moving a completed occurrence within the grid still succeeds
**Statement**: When `PATCH /api/v1/plan/occurrences/{id}` is requested with a non-null
`dayOfWeek`/`slot` pair for an occurrence that has an associated `CompletionRecord`, the move shall
succeed exactly as before this spec — this restriction applies only to the bucket-targeting
(`null`/`null`) case.

**Rationale**: Explicit regression guard — rescheduling a completed occurrence to a different day/
slot is not the behavior the user flagged as wrong, and this spec must not restrict it.

**References**: `PlanService.applyMove` (the `else` branch, `assignSlot`)

#### PLANNER-020-AC-04 [AUTO]: Moving a not-completed occurrence to the bucket still succeeds
**Statement**: When `PATCH /api/v1/plan/occurrences/{id}` is requested with `dayOfWeek: null, slot:
null` for an occurrence with no associated `CompletionRecord`, the move shall succeed exactly as
before this spec.

**Rationale**: Explicit regression guard for the existing, correct "Send to bucket"/cross-drag-demote
behavior for not-yet-completed occurrences.

**References**: `PlanService.applyMove`

## Cross-references

| Reference | What it provides |
|---|---|
| `PlanService.applyMove` | The method this spec adds a guard to |
| `PlanService.applyCarryForward` | Existing precedent for the exact completed-state check (`completionRecordRepository.findByPlannedOccurrenceIdAndOwner(...).isPresent()`) this spec reuses |
| `CarryForwardNotAllowedException` / `BucketReorderNotAllowedException` | Existing sibling exceptions this spec's `BucketMoveNotAllowedException` matches in shape and `GlobalExceptionHandler` wiring |
| `PATCH /api/v1/plan/occurrences/{id}` (`API.md`) | The endpoint this spec adds a new `409` response case to — needs an `API.md` update |
| `frontend_spec_038_prevent_completed_occurrence_bucket_move.md` | The paired frontend spec that proactively hides/disables the now-invalid action, so this backend rejection is a defense-in-depth safety net, not the primary UX |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-020-AC-01: rejects moving a completed occurrence to the bucket"() {
    given: "a grid-scheduled, completed occurrence"
        def occurrence = createScheduledOccurrence(owner, MONDAY, MORNING)
        completeOccurrence(occurrence, owner)

    when: "it is moved to the bucket (dayOfWeek/slot both null)"
        planService.move(owner.username, occurrence.id, new PlannedOccurrenceMoveRequest(null, null))

    then: "BucketMoveNotAllowedException is thrown"
        thrown(BucketMoveNotAllowedException)

    and: "the occurrence's day/slot are unchanged"
        def reloaded = plannedOccurrenceRepository.findById(occurrence.id).get()
        reloaded.dayOfWeek == MONDAY
        reloaded.slot == MORNING
}

def "PLANNER-020-AC-02: BucketMoveNotAllowedException maps to 409"() {
    given: "a completed, grid-scheduled occurrence"
        def occurrence = createScheduledOccurrence(owner, MONDAY, MORNING)
        completeOccurrence(occurrence, owner)

    when: "PATCH .../move is requested with a bucket-targeting body"
        def response = client.patch()
            .uri("/api/v1/plan/occurrences/${occurrence.id}")
            .body(new PlannedOccurrenceMoveRequest(null, null))
            .exchange()

    then: "the response is 409 Conflict with a clear message"
        response.expectStatus().isEqualTo(409)
        response.expectBody().jsonPath('$.message').value(containsString("completed"))
}

def "PLANNER-020-AC-03: moving a completed occurrence to a different grid slot still succeeds"() {
    given: "a completed, grid-scheduled occurrence"
        def occurrence = createScheduledOccurrence(owner, MONDAY, MORNING)
        completeOccurrence(occurrence, owner)

    when: "it is moved to a different day/slot"
        def moved = planService.move(owner.username, occurrence.id,
            new PlannedOccurrenceMoveRequest(TUESDAY, EVENING))

    then: "the move succeeds"
        moved.isPresent()
        moved.get().dayOfWeek == TUESDAY
        moved.get().slot == EVENING
}

def "PLANNER-020-AC-04: moving a not-completed occurrence to the bucket still succeeds"() {
    given: "a grid-scheduled, not-completed occurrence"
        def occurrence = createScheduledOccurrence(owner, MONDAY, MORNING)

    when: "it is moved to the bucket"
        def moved = planService.move(owner.username, occurrence.id,
            new PlannedOccurrenceMoveRequest(null, null))

    then: "the move succeeds"
        moved.isPresent()
        moved.get().dayOfWeek == null
        moved.get().slot == null
}
```

**Test Case (Green)**: add the completed-state check to `applyMove`'s bucket-targeting branch, add
`BucketMoveNotAllowedException`, and wire it into `GlobalExceptionHandler` until all four sketches
above pass.

## Acceptance Criteria Summary

- [ ] PLANNER-020-AC-01 — moving a completed occurrence to the bucket is rejected, occurrence unchanged
- [ ] PLANNER-020-AC-02 — `BucketMoveNotAllowedException` maps to 409 Conflict
- [ ] PLANNER-020-AC-03 — moving a completed occurrence within the grid still succeeds (regression guard)
- [ ] PLANNER-020-AC-04 — moving a not-completed occurrence to the bucket still succeeds (regression guard)
