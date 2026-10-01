# Cascade an Activity's Category Change to Its Sub-tasks (Backend)

**Status**: Implemented (2026-10-01) — all 5 ACs green. `ActivityService.update()` now cascades a
changed category to every existing `SubTask` via a new `SubTask.recategorize(ActivityCategory)`
mutator, mirroring `rename()`'s pattern. Real finding during implementation: the AC-02 test sketch's
literal `reloaded.updatedAt == originalUpdatedAt` comparison (captured from the in-memory,
post-`save()` instance) spuriously failed against real Postgres independent of the cascade logic —
Postgres's `timestamp` column truncates to microsecond precision, while this JVM's `Instant.now()`
carries finer (sub-microsecond) resolution, so the two values never matched byte-for-byte even with
no code bug present. Fixed by capturing the baseline from a fresh reload (`subTaskRepository
.findById(...).get().updatedAt`, already at Postgres's own precision) instead of the in-memory
value — not a cascade/production-code issue, a test-fixture-precision one. Tests: new
`ActivityServiceCategoryCascadeIntegrationSpec` (real-Postgres, covers AC-01/AC-02/AC-03/AC-04/
AC-05), plus two unit-level guard tests added to `ActivityServiceSpec` (mocked, confirm the
interaction/non-interaction with `SubTaskRepository` directly) and a `SubTask.recategorize()` unit
test in `SubTaskSpec`. The superseded `PLANNER-003-AC-20` Spock test (actually located in
`model/SubTaskSpec.groovy`, not `repository/SubTaskRepositorySpec.groovy` as this spec's own
References section assumed) was replaced with a one-line comment pointing to this spec's AC-01/AC-02
coverage — not left alongside a contradictory assertion. Full suite: 215 tests, 0 failures
(`gradlew.bat test` against real Postgres via Docker Compose). Real-browser verification against
the live dev server and real pre-existing "Test category change" data confirmed the fix end-to-end
— one real, non-blocking observation along the way: an *already-open* sub-task panel in
`ActivityBank` doesn't refresh after editing its parent activity (it fetched once, on mount, and the
edit doesn't trigger a refetch), so it transiently showed the stale category until the panel was
collapsed and re-expanded, at which point the correct cascaded category appeared. This is a
pre-existing frontend data-staleness quirk unrelated to the cascade's own correctness (confirmed via
the real-Postgres integration tests and the fresh re-fetch) — logged separately in
`.claude/ideas/future_ideas.md` rather than addressed here, since it's out of this spec's scope.
**Priority**: P2 — a real, user-confirmed bug (reproduced live with real data), not just a
theoretical inconsistency
**Depends on**: `planner_spec_002_activity_bank.md` (`Activity`, `ActivityService.update`),
`planner_spec_003_sub_tasks.md` (`SubTask`, `SubTaskRepository` — **this spec formally supersedes
that spec's `PLANNER-003-AC-20`**, see below), `planner_spec_004_week_planning.md`
(`PlannedOccurrence.category`, confirmed unaffected by this spec — see Requirement 2)
**Area**: Backend
**Roadmap version**: N/A — bug fix, not tied to a V1–V5 theme

## Overview

`.claude/ideas/future_ideas.md`'s "Sub-task category drift" entry (surfaced 2026-09-30, confirmed
live with real data the same day): `SubTask.category` is copied from the parent `Activity` once, at
creation time, and never updated again. Editing an activity's category afterward leaves its existing
sub-tasks showing their stale, original category — a real, reproducible bug now visibly surfaced in
two places that render a sub-task's own stored category directly (`AssignActivityPicker`,
`OccurrenceItem`), where a sub-task's chip can visibly disagree with its own parent activity's
current chip.

**This was not an oversight — it was a deliberate, specced, tested decision**, documented on
`SubTask`'s own class comment and formalized as `planner_spec_003_sub_tasks.md`'s
`PLANNER-003-AC-20`: *"Where a parent Activity's category is changed after one of its SubTasks has
already been created, the SubTaskService shall leave that SubTask's already-stored category
unchanged."* That AC has its own passing Spock test
(`PLANNER-003-AC-20: changing the parent's category later does not change an existing sub-task's
category`, in `SubTaskRepositorySpec.groovy`) asserting exactly the opposite of what this spec now
implements.

**Resolved with the user (2026-10-01)**: cascade the update — when an activity's category changes,
every existing sub-task's stored category updates to match, restoring the "sub-tasks always inherit
the parent's current category" mental model the rest of the UI (filters, chips, labels) already
assumes. This formally **supersedes `PLANNER-003-AC-20`** — see the Amendment section below for how
`planner_spec_003_sub_tasks.md` itself is updated to reflect the reversal.

**Historical `PlannedOccurrence` rows are explicitly left alone** (also resolved with the user): a
`PlannedOccurrence`'s own `category` is copied from the sub-task (or activity) at
*occurrence*-creation time (`PlanService.saveScheduledFor`), one layer further removed — this spec
does not touch any existing `PlannedOccurrence` row. A past or currently-planned week keeps showing
whatever category was true when it was actually planned, preserving that as an audit record. Only
*new* occurrences, created after the cascade, pick up the corrected category — and they already
would, with no code change needed here, since `PlanService.saveScheduledFor` already reads
`subTask.getCategory()` live at creation time (see `PLANNER-014-AC-04`, a confirming regression test
rather than new implementation).

No migration needed — `category` already exists as a column on `sub_tasks`; this is purely an
application-logic change to when it gets written.

## Requirement 1: Cascade an activity's category change to its existing sub-tasks

**User story**: As someone who recategorizes an activity (e.g. from Pleasurable to Necessary), I
want its existing sub-tasks to reflect that change too, so I don't see a sub-task's category chip
visibly disagree with its own parent's current chip.

### PLANNER-014-AC-01 [AUTO]: Changing an activity's category cascades to its existing sub-tasks
**Statement**: When `ActivityService.update()` changes an activity's `category` to a different
value than it previously had, the service shall update every existing `SubTask` belonging to that
activity to the new `category` value.

**Rationale**: The core fix — restores the "sub-tasks always reflect their parent's current
category" invariant the rest of the UI already assumes.

**References**:
- `ActivityService.update()` (backend `service/ActivityService.java`) — capture the activity's
  `category` before calling `activity.update(...)`, compare against the new value, and if changed,
  fetch and update every sub-task via the existing
  `subTaskRepository.findByActivityIdAndOwnerOrderByCreatedAtAsc(activity.getId(), owner)`.
- `SubTask` (backend `model/SubTask.java`) needs a new mutator alongside its existing `rename()` —
  e.g. `recategorize(ActivityCategory category)` — setting `category` and bumping `updatedAt`, same
  pattern `rename()` already uses.

**Test Case (Red)**:
```groovy
def "PLANNER-014-AC-01: changing an activity's category cascades to its existing sub-tasks"() {
    given: "an activity and two sub-tasks created while it was PLEASURABLE"
        def activity = activityRepository.save(
            new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
        def guestList = subTaskRepository.save(
            new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
        def venue = subTaskRepository.save(
            new SubTask(activity, "Book a venue", ActivityCategory.PLEASURABLE, owner))

    when: "the activity's category is changed to NECESSARY"
        activityService.update(owner.username, activity.id,
            new ActivityRequest(activity.name, ActivityCategory.NECESSARY, activity.description, true))

    then: "both existing sub-tasks now show NECESSARY, not the stale PLEASURABLE"
        subTaskRepository.findById(guestList.id).get().category == ActivityCategory.NECESSARY
        subTaskRepository.findById(venue.id).get().category == ActivityCategory.NECESSARY
}
```

**Test Case (Green)**: implement the cascade as described in References.

### PLANNER-014-AC-02 [AUTO]: No cascade when the category is unchanged
**Statement**: When `ActivityService.update()` is called with the same `category` the activity
already had (e.g. only `name`/`description` changed), the service shall leave every existing
sub-task's `category` and `updatedAt` untouched.

**Rationale**: Regression guard — avoids unnecessary writes (and spurious `updatedAt` bumps) on
every activity edit, not just ones that actually change category.

**References**: Related: `PLANNER-014-AC-01`.

**Test Case (Red)**:
```groovy
def "PLANNER-014-AC-02: no cascade when the category is unchanged"() {
    given: "an activity and a sub-task, both PLEASURABLE"
        def activity = activityRepository.save(
            new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
        def subTask = subTaskRepository.save(
            new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
        def originalUpdatedAt = subTask.updatedAt

    when: "the activity is updated with the same category, only the name changed"
        activityService.update(owner.username, activity.id,
            new ActivityRequest("Organise a leaving party", ActivityCategory.PLEASURABLE, activity.description, true))

    then: "the sub-task's category and updatedAt are unchanged"
        def reloaded = subTaskRepository.findById(subTask.id).get()
        reloaded.category == ActivityCategory.PLEASURABLE
        reloaded.updatedAt == originalUpdatedAt
}
```

**Test Case (Green)**: the `previousCategory != request.category()` guard from `PLANNER-014-AC-01`
already satisfies this.

### PLANNER-014-AC-03 [AUTO]: Cascade is owner-scoped
**Statement**: The cascade shall only update sub-tasks owned by the same owner as the activity being
updated.

**Rationale**: Continuation of this codebase's owner-scoping seam from V1 — `ActivityService.update`
already resolves the activity via `findByIdAndOwner`, and the sub-task lookup reuses the same
owner-scoped repository method already established for `countSubTasks`
(`planner_spec_012_subtask_count.md`).

**References**: `SubTaskRepository.findByActivityIdAndOwnerOrderByCreatedAtAsc` (existing method,
already owner-scoped by construction — no new repository method needed).

**Test Case (Red)**:
```groovy
def "PLANNER-014-AC-03: cascade only updates the activity owner's own sub-tasks"() {
    given: "ActivityService.update resolves the activity via findByIdAndOwner, which already fails closed for a different owner"
        // Covered structurally: update() only proceeds if findByIdAndOwner(id, owner) finds a match,
        // so the cascade can never run against another owner's activity or sub-tasks in the first
        // place. No separate cross-owner scenario needed beyond AC-01's existing use of
        // findByActivityIdAndOwnerOrderByCreatedAtAsc, which is owner-scoped by construction.
    expect: true
}
```

**Test Case (Green)**: no additional code — `PLANNER-014-AC-01`'s implementation already satisfies
this by construction (both the activity lookup and the sub-task lookup are owner-scoped).

## Requirement 2: Historical PlannedOccurrence rows are never touched by this cascade

**User story**: As someone reviewing a past or currently-planned week, I want it to keep showing
whatever category was true when I actually planned it, even if I later recategorize the activity or
sub-task — so my planning history stays an accurate record, not a retroactively-rewritten one.

### PLANNER-014-AC-04 [AUTO]: Existing PlannedOccurrence rows keep their original category
**Statement**: When a sub-task's category is cascaded per `PLANNER-014-AC-01`, the service shall not
modify the `category` of any existing `PlannedOccurrence` row referencing that sub-task.

**Rationale**: Resolved with the user (2026-10-01) — preserves an audit trail of what was actually
planned at the time, rather than silently rewriting history. This is a regression guard confirming
the cascade's scope stays limited to `SubTask` rows, never reaching into `PlannedOccurrence`.

**References**: `PlannedOccurrence.category` (`planner_spec_004_week_planning.md`) — untouched by
this spec's implementation; no code in `PLANNER-014-AC-01`'s cascade references
`PlannedOccurrenceRepository` at all.

**Test Case (Red)**:
```groovy
def "PLANNER-014-AC-04: cascading a sub-task's category does not rewrite an existing planned occurrence's category"() {
    given: "an activity, a sub-task, and an occurrence already planned while the sub-task was PLEASURABLE"
        def activity = activityRepository.save(
            new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
        def subTask = subTaskRepository.save(
            new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
        def occurrence = plannedOccurrenceRepository.save(
            new PlannedOccurrence(null, subTask, ActivityCategory.PLEASURABLE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner))

    when: "the activity's category is changed to NECESSARY, cascading to the sub-task"
        activityService.update(owner.username, activity.id,
            new ActivityRequest(activity.name, ActivityCategory.NECESSARY, activity.description, true))

    then: "the sub-task is updated, but the already-planned occurrence still shows its original category"
        subTaskRepository.findById(subTask.id).get().category == ActivityCategory.NECESSARY
        plannedOccurrenceRepository.findById(occurrence.id).get().category == ActivityCategory.PLEASURABLE
}
```

**Test Case (Green)**: no code needed beyond `PLANNER-014-AC-01` — this test exists purely to prove
the cascade's blast radius stops at `SubTask`, confirmed by the occurrence's category remaining
`PLEASURABLE` after the cascade runs.

### PLANNER-014-AC-05 [AUTO]: A newly-created occurrence picks up the cascaded category
**Statement**: When a `PlannedOccurrence` is created for a sub-task *after* that sub-task's category
has been cascaded, the occurrence shall carry the sub-task's current (cascaded) category, not its
original one.

**Rationale**: Confirms the "only new occurrences get the fix, old ones don't" boundary from the
other direction — and that this already works correctly with **no new code**, since
`PlanService.saveScheduledFor` already reads `subTask.getCategory()` live at occurrence-creation
time (not a cached/stale value). This AC exists to lock that existing behavior in as tested, not to
introduce it.

**References**: `PlanService.saveScheduledFor` (existing code, unchanged by this spec).

**Test Case (Red)**:
```groovy
def "PLANNER-014-AC-05: a new occurrence created after the cascade uses the sub-task's updated category"() {
    given: "an activity and sub-task, category cascaded from PLEASURABLE to NECESSARY"
        def activity = activityRepository.save(
            new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
        def subTask = subTaskRepository.save(
            new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
        activityService.update(owner.username, activity.id,
            new ActivityRequest(activity.name, ActivityCategory.NECESSARY, activity.description, true))

    when: "a new occurrence is planned for that sub-task"
        def created = planService.createOccurrence(owner.username,
            new PlannedOccurrenceRequest(null, subTask.id, monday, DayOfWeek.TUESDAY, PlanSlot.AFTERNOON))

    then: "the new occurrence carries the sub-task's current, cascaded category"
        created.category == ActivityCategory.NECESSARY
}
```

**Test Case (Green)**: no production code change — confirms existing `PlanService` behavior already
satisfies this once `PLANNER-014-AC-01` lands.

## Amendment to `planner_spec_003_sub_tasks.md`

`PLANNER-003-AC-20` ("changing the parent's category later does not change an existing sub-task's
category") is **superseded by `PLANNER-014-AC-01`**, which implements the opposite behavior. Per
this project's immutable-reference-ID convention, `PLANNER-003-AC-20`'s statement and ID are not
deleted or rewritten — its entry in `planner_spec_003_sub_tasks.md` gets a note marking it
superseded, pointing here, and its Acceptance Criteria Summary checkbox gets an explanatory
strikethrough-equivalent note rather than being silently left checked as if still true. Its Spock
test (`SubTaskRepositorySpec.groovy`, `"PLANNER-003-AC-20: changing the parent's category later does
not change an existing sub-task's category"`) is replaced — not left alongside the new
`PLANNER-014-AC-01` test asserting the opposite outcome — with a short comment noting the reversal
and pointing to this spec's own `PLANNER-014-AC-01` test, which now covers the real (opposite)
behavior.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `ActivityService.update` | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/ActivityService.java` |
| `SubTask` (gains a `recategorize` mutator) | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/model/SubTask.java` |
| `SubTaskRepository.findByActivityIdAndOwnerOrderByCreatedAtAsc` (reused, no new method) | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/repository/SubTaskRepository.java` |
| `PlannedOccurrence.category`, confirmed untouched | `planner_spec_004_week_planning.md` |
| `PlanService.saveScheduledFor`, confirmed unchanged/already-correct | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/PlanService.java` |
| Superseded AC | `planner_spec_003_sub_tasks.md` (`PLANNER-003-AC-20`) |
| Frontend — no change needed | `AssignActivityPicker.tsx`, `OccurrenceItem.tsx`, `SubTaskList.tsx` already render whatever `category` the API returns; once the backend stores the correct value, these render correctly with no frontend code change |

## Acceptance Criteria Summary

- [x] PLANNER-014-AC-01 [AUTO]: Changing an activity's category cascades to its existing sub-tasks
- [x] PLANNER-014-AC-02 [AUTO]: No cascade when the category is unchanged
- [x] PLANNER-014-AC-03 [AUTO]: Cascade is owner-scoped
- [x] PLANNER-014-AC-04 [AUTO]: Existing `PlannedOccurrence` rows keep their original category
- [x] PLANNER-014-AC-05 [AUTO]: A newly-created occurrence picks up the cascaded category
