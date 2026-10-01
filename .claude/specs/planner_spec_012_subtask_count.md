# Sub-task Count on Activities (Backend)

**Status**: Implemented (2026-10-01) — both ACs checked, full backend suite green (208 tests, 0
failures). Composition approach chosen: `ActivityService.listForOwner` now returns
`List<ActivityWithSubTaskCount>` (a new small record in the `service` package pairing `Activity` +
`long subTaskCount`, composed by calling the new `SubTaskRepository.countByActivityIdAndOwner` once
per activity) — the "reshape `listForOwner`'s return type" option the spec left open, since it has no
other caller. `create`/`update`/`archive` keep their existing `Activity`/`Optional<Activity>` return
shapes unchanged (avoiding a wider ripple through their existing controller test mocks); the
controller instead calls a new single-activity `ActivityService.countSubTasks(ownerUsername,
activityId)` for `update`/`archive`, and hardcodes `0` for `create` (a brand-new activity can't have
sub-tasks yet, so no extra query). `unarchive` returns `204 No Content` with no response body, so it
carries no `subTaskCount` at all. Added one repository-level integration test
(`SubTaskRepositorySpec`, against real Postgres) alongside the service/controller unit tests, to
verify owner-scoping end-to-end rather than only by mock.
**Priority**: P3 — small UX polish, nothing else blocked on it
**Depends on**: `planner_spec_002_activity_bank.md` (`Activity`, `ActivityRepository`,
`ActivityService`, `ActivityResponse`, `ActivityController`), `planner_spec_003_sub_tasks.md`
(`SubTask`, `SubTaskRepository`)
**Area**: Backend
**Roadmap version**: N/A — UX polish on the existing V1 Activity Bank, not tied to a V1–V5 theme

## Overview

`.claude/ideas/future_ideas.md`'s "Activity Bank UX improvements" batch asks for a sub-task count
visible on an activity's row without expanding "Show sub-tasks" first. Confirmed scope (2026-10-01):
**a plain count only** — not the "2/3 done" completion-progress variant also raised in that note,
which is explicitly deferred (see `.claude/SPEC_CANDIDATES.md`) because there is no existing concept
of a sub-task being "done": completion only exists per `CompletionRecord`/`PlannedOccurrence`, which
is scoped per calendar week, not per sub-task lifetime, so "N done" has no single agreed meaning yet.
A plain count needs none of that — it's just how many `SubTask` rows exist for the activity.

Today, `GET /api/v1/activities` (`ActivityResponse`) carries no sub-task data at all; sub-tasks are
fetched lazily, per-activity, only when a row is expanded (`SubTaskList`'s own
`subTaskApi.getAll(activityId)` call). This spec adds a `subTaskCount` field to `ActivityResponse`,
populated via a `SubTaskRepository` count query, so the count is available immediately in the list
response — no extra round trip, no eager-fetch-all-sub-tasks pattern (unlike
`AssignActivityPicker`'s existing precedent, which fetches full sub-task bodies for a different
reason — category-filtering across sub-tasks — that doesn't apply here).

## Requirement 1: Expose each activity's sub-task count

**User story**: As someone with activities that have several sub-tasks, I want to see how many
sub-tasks an activity has without expanding it, so I can gauge its size from the list alone.

### PLANNER-012-AC-01 [AUTO]: ActivityResponse carries a subTaskCount field
**Statement**: The `ActivityResponse` returned by `GET /api/v1/activities` (and by
create/update/archive/unarchive, for consistency with every other field on that DTO) shall include
`subTaskCount`, the number of `SubTask` rows belonging to that activity.

**Rationale**: Makes the count available wherever an `ActivityResponse` is already returned, with no
extra endpoint or round trip.

**References**:
- Type: `ActivityResponse` (backend `dto/ActivityResponse.java`) — add `int subTaskCount` to the
  record.
- Related: `PLANNER-012-AC-02` (where the count actually comes from)

**Test Case (Red)**:
```groovy
def "PLANNER-012-AC-01: list response includes each activity's subTaskCount"() {
    given: "an owner with one activity that has two sub-tasks, and one with none"
        userRepository.findByUsername("steve") >> Optional.of(owner)
        def withSubTasks = activityWithId("Walk")
        def withoutSubTasks = activityWithId("Read")
        activityRepository.findByOwnerAndArchivedOrderByCreatedAtDesc(owner, false) >> [withSubTasks, withoutSubTasks]
        subTaskRepository.countByActivityIdAndOwner(withSubTasks.id, owner) >> 2
        subTaskRepository.countByActivityIdAndOwner(withoutSubTasks.id, owner) >> 0

    when: "the controller lists activities for that owner"
        def response = controller.list(false, authenticationFor("steve"))

    then: "each activity's response carries its own count"
        def body = response.body.data()
        body.find { it.name() == "Walk" }.subTaskCount() == 2
        body.find { it.name() == "Read" }.subTaskCount() == 0
}
```

**Test Case (Green)**: add `subTaskCount` to `ActivityResponse`; wire the count through
`ActivityController`/`ActivityService` per `PLANNER-012-AC-02`.

### PLANNER-012-AC-02 [AUTO]: Sub-task count query is owner-scoped
**Statement**: When computing an activity's `subTaskCount`, the `SubTaskRepository` shall count only
sub-tasks owned by the requesting user for that activity ID.

**Rationale**: Every repository query in this codebase is owner-scoped from V1 — this is a direct
continuation of that seam, not a new decision (`.claude/steering/structure.md`'s multi-user seam;
`CLAUDE.md`'s hard-rule on owner scoping).

**References**:
- Repository: `SubTaskRepository` gains `long countByActivityIdAndOwner(UUID activityId, User owner)`
  — a plain Spring Data derived method, matching this repository's existing
  `findByActivityIdAndOwnerOrderByCreatedAtAsc`/`findByIdAndActivityIdAndOwner` naming convention
  (no custom `@Query`, no new complexity).
- Service: `ActivityService` gains a `SubTaskRepository` dependency and composes the per-activity
  count when assembling the list for `ActivityController` (exact composition — e.g. a small
  `Activity`+count pairing returned from `listForOwner`, or a separate counts-by-id lookup the
  controller merges in — is an implementation detail for whoever implements this; `listForOwner` has
  no other caller today, so its return shape is free to change).

**Test Case (Red)**:
```groovy
def "PLANNER-012-AC-02: subTaskCount never counts another user's sub-tasks against this activity"() {
    given: "two owners, each with a same-named activity, only one has sub-tasks"
        // ... seed ownerA's activity with 2 sub-tasks owned by ownerA,
        //     ownerB's same-id-shaped activity with 0

    expect: "ownerB's count is unaffected by ownerA's sub-tasks"
        subTaskRepository.countByActivityIdAndOwner(activityId, ownerB) == 0
}
```

**Test Case (Green)**: the derived `countByActivityIdAndOwner` method, by construction, only counts
rows matching both `activityId` and `owner` — Spring Data generates the `WHERE` clause from the
method name.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `ActivityResponse` | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/dto/ActivityResponse.java` |
| `ActivityController.toResponse` mapping point | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/controller/ActivityController.java` |
| `ActivityService.listForOwner` (only caller, free to reshape) | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/ActivityService.java` |
| `SubTaskRepository` existing derived-method conventions | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/repository/SubTaskRepository.java` |
| Frontend consumer | `frontend_spec_018_subtask_count_badge.md` (depends on this spec) |
| Deferred completion-progress variant | `.claude/SPEC_CANDIDATES.md` ("Sub-task completion progress indicator") |

## Acceptance Criteria Summary

- [x] PLANNER-012-AC-01 [AUTO]: `ActivityResponse` carries a `subTaskCount` field, correct per activity
- [x] PLANNER-012-AC-02 [AUTO]: The count query is owner-scoped (never counts another user's sub-tasks)
