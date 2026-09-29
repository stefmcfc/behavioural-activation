# Occurrence Detail Card — Parent Activity Name (Backend)

**Status**: Implemented (this spec's full scope — a backend-only spec). Paired frontend spec
`frontend_spec_008_occurrence_detail_card.md` is also now implemented.
**Priority**: P2 — a UX-driven request (the Weekly Planner "far too much noise" complaint), not
blocking anything else. Small backend surface, but must land before the paired frontend spec since
the frontend needs `parentActivityName` on the wire before it can render it.
**Depends on**: `planner_spec_004_week_planning.md` (`PlannedOccurrence`, `PlanService`/
`PlanController`, and the `Hibernate.initialize(...)`/`open-in-view: false` `LazyInitializationException`
fix this spec extends), `planner_spec_003_sub_tasks.md` (`SubTask` entity and its lazy `activity`
association), `planner_spec_006_repeatable_activities.md` (most recent state of `PlanService`, and
the real-Postgres integration-spec precedent — `PlanServiceAutoArchiveIntegrationSpec.groovy` — this
spec's own integration spec follows the same pattern)
**Area**: Backend
**Roadmap version**: V1 (extends the core planner's weekly-grid display from `product.md`'s V1 row —
not V2's tracking/reflection scope, and not AI)

## Overview

This is the backend half of one of four requirements raised in a Weekly Planner UX batch (the user's
"far too much noise in the calendar" complaint, raised after `planner_spec_006_repeatable_activities.md`
shipped). The batch was split into four independent pieces; the other three — an "Add" picker modal,
weekend bucket drag-and-drop reordering + automatic carry-forward, and a weekly grid orientation
toggle — are tracked separately in `.claude/SPEC_CANDIDATES.md`/`ROADMAP.md` and are explicitly out
of scope here. Of the four confirmed requirements the paired frontend spec
(`frontend_spec_008_occurrence_detail_card.md`) implements, only one needs a backend change: showing
which parent `Activity` a sub-task occurrence belongs to, so a planned sub-task's tile in the weekly
grid no longer shows only its own bare name with no indication of the activity it's part of. This
ties back to `.claude/HIGH_LEVEL_DESIGN.md`'s US-003 ("view a weekly plan") — the response this spec
extends is exactly what that view renders.

Adds a new `parentActivityName` field to `PlannedOccurrenceResponse`: `null` when the occurrence
targets an `Activity` directly, and that activity's name when the occurrence targets a `SubTask`.
Like the existing `name` field, `parentActivityName` is resolved live at response-mapping time in
`PlanController.toResponse(...)` — never stored on `PlannedOccurrence` itself, no migration needed.

Because `SubTask.activity` is itself a `LAZY` `@ManyToOne` association and `open-in-view` is
deliberately disabled (`application.yml`), this spec also closes a real gap in `PlanService`'s
existing `Hibernate.initialize(...)` scaffolding. That scaffolding was added during
`planner_spec_004_week_planning.md`'s implementation pass to fix a real `LazyInitializationException`
(`PlanController.toResponse()` reading `occurrence.getActivity()`/`getSubTask()` after the
transactional `PlanService` method that loaded them had already returned) — but it only ever
force-initializes the occurrence's *direct* `activity`/`subTask` association, one hop from
`PlannedOccurrence`. `parentActivityName` is the first thing in the codebase to read one hop
further out (`subTask.getActivity()`), and without extending that scaffolding this spec would
reintroduce the exact same class of bug for every endpoint that can return a sub-task-target
occurrence. `PlanControllerSpec`'s existing `@WebMvcTest` mocks `PlanService` with plain in-memory
entities (a `SubTask` built via `new SubTask(activity, ...)` already holds a real, non-proxy
`activity` reference), so — exactly as before — it cannot catch this; this spec's lazy-load-safety
requirement is verified by a real-Postgres integration spec instead, following
`PlanServiceAutoArchiveIntegrationSpec.groovy`'s precedent.

**Out of scope**: the other three Weekly Planner UX batch items listed above. No new endpoint, no
migration, no persisted field. No change to `ActivityResponse`/`Activity` — this is purely a
`PlannedOccurrenceResponse` read-model addition. No `API.md` update — that file deliberately stays
at path/method/params/behavior-note level of detail (not full response bodies), and this change adds
a response field without altering any endpoint's path, method, params, or auth/ownership behavior.

## Requirements

### Requirement 1 — `PlannedOccurrenceResponse` carries the parent activity's name for a sub-task occurrence

As a user, I want a planned sub-task's tile to show which activity it belongs to, so I don't have to
remember or guess from its own name alone.

- **PLANNER-008-AC-01** [AUTO]: The `PlannedOccurrenceResponse` record shall declare a new
  `parentActivityName` field of type `String` (nullable), alongside its existing `name` field.
- **PLANNER-008-AC-02** [AUTO]: When `PlanController.toResponse(...)` builds a response for an
  occurrence that directly targets an `Activity` (not a `SubTask`), it shall set
  `parentActivityName` to `null`.
- **PLANNER-008-AC-03** [AUTO]: When `PlanController.toResponse(...)` builds a response for an
  occurrence that targets a `SubTask`, it shall set `parentActivityName` to that sub-task's parent
  `Activity`'s name (`occurrence.getSubTask().getActivity().getName()`).

### Requirement 2 — `subTask.activity` is safely initialized inside its owning transaction, for every code path that can return a sub-task occurrence

As a user, I don't want the weekly planner to error out with a server exception just because I
looked at, planned, moved, completed, or carried forward a sub-task instead of a whole activity.

- **PLANNER-008-AC-04** [AUTO]: When `GET /api/v1/plan` returns a week containing a sub-task-target
  occurrence, `PlanService.getWeek()` shall have force-initialized that occurrence's `subTask.activity`
  association within its own transaction, so `PlanController`'s later `parentActivityName`
  resolution never throws `LazyInitializationException`.
- **PLANNER-008-AC-05** [AUTO]: When `POST /api/v1/plan/occurrences` creates a new sub-task-target
  occurrence, `PlanService.create()` shall force-initialize that occurrence's `subTask.activity`
  association within its own transaction, so the response's `parentActivityName` resolution never
  throws `LazyInitializationException`.
- **PLANNER-008-AC-06** [AUTO]: When `PATCH /api/v1/plan/occurrences/{id}` moves a sub-task-target
  occurrence, `PlanService.move()` shall force-initialize that occurrence's `subTask.activity`
  association within its own transaction, so the response's `parentActivityName` resolution never
  throws `LazyInitializationException`.
- **PLANNER-008-AC-07** [AUTO]: When `POST /api/v1/plan/occurrences/{id}/completion` completes a
  sub-task-target occurrence, `PlanService.complete()` shall force-initialize that occurrence's
  `subTask.activity` association within its own transaction, so the response's `parentActivityName`
  resolution never throws `LazyInitializationException`.
- **PLANNER-008-AC-08** [AUTO]: When `POST /api/v1/plan/occurrences/{id}/carry-forward` carries
  forward a sub-task-target bucket occurrence, `PlanService.carryForward()` shall force-initialize
  that occurrence's `subTask.activity` association within its own transaction, so the response's
  `parentActivityName` resolution never throws `LazyInitializationException`.

### Requirement 3 — no regression to the existing response contract

As a user, I want my existing weekly planner behaviour to keep working exactly as before, with this
one field simply added alongside it.

- **PLANNER-008-AC-09** [AUTO]: The existing `PlannedOccurrenceResponse` fields (`id`, `activityId`,
  `subTaskId`, `name`, `category`, `weekStart`, `dayOfWeek`, `slot`, `completed`, `completedAt`,
  `createdAt`) shall remain unchanged in shape and value for both activity-target and sub-task-target
  occurrences — `parentActivityName` is a pure addition, not a restructuring, of
  `planner_spec_004_week_planning.md`'s existing contract.

## Implementation notes

`dto/PlannedOccurrenceResponse.java` — `parentActivityName` placed directly after `name`, the field
it's most closely related to:

```java
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
```

`controller/PlanController.java`'s `toResponse(...)`:

```java
private static PlannedOccurrenceResponse toResponse(PlannedOccurrence occurrence, CompletionRecord completion) {
    boolean isActivity = occurrence.getActivity() != null;
    UUID activityId = isActivity ? occurrence.getActivity().getId() : null;
    UUID subTaskId = isActivity ? null : occurrence.getSubTask().getId();
    String name = isActivity ? occurrence.getActivity().getName() : occurrence.getSubTask().getName();
    String parentActivityName = isActivity ? null : occurrence.getSubTask().getActivity().getName();
    boolean completed = completion != null;
    Instant completedAt = completion != null ? completion.getCompletedAt() : null;
    return new PlannedOccurrenceResponse(occurrence.getId(), activityId, subTaskId, name, parentActivityName,
        occurrence.getCategory(), occurrence.getWeekStart(), occurrence.getDayOfWeek(),
        occurrence.getSlot(), completed, completedAt, occurrence.getCreatedAt());
}
```

`service/PlanService.java`'s `initializeTarget(...)` (Requirement 2) — extended one hop further out:

```java
// Activity/SubTask are LAZY associations, and open-in-view is deliberately disabled
// (application.yml) -- see planner_spec_004_week_planning.md's original note. Extended for
// planner_spec_008_occurrence_detail_card.md: SubTask.activity is itself a LAZY @ManyToOne, one hop
// further out than this method previously initialized -- PlannedOccurrenceResponse.parentActivityName
// is the first thing to read it, so it must be force-initialized here too, or PlanController's
// mapping throws LazyInitializationException for a sub-task-target occurrence exactly as the
// top-level activity/subTask association did before planner_spec_004's fix.
private static void initializeTarget(PlannedOccurrence occurrence) {
    if (occurrence.getActivity() != null) {
        Hibernate.initialize(occurrence.getActivity());
    } else {
        SubTask subTask = occurrence.getSubTask();
        Hibernate.initialize(subTask);
        Hibernate.initialize(subTask.getActivity());
    }
}
```

`create()`'s private `saveScheduledFor(...)` helper never called `initializeTarget(...)` at all
before this spec — it worked by incidental luck, because the `activity`/`subTask` object passed in
is already a fully-loaded entity (not a lazy proxy) from `activityRepository.findByIdAndOwner(...)`/
`subTaskRepository.findByIdAndOwner(...)`, so the *direct* association never needed force-init. That
luck doesn't extend to `subTask.getActivity()`, which those repository lookups never eager-fetch —
so `create()` gains an explicit call for AC-05:

```java
private PlannedOccurrence saveScheduledFor(Activity activity, SubTask subTask, ActivityCategory category,
        PlannedOccurrenceRequest request, User owner) {
    PlannedOccurrence occurrence = new PlannedOccurrence(activity, subTask, category, request.weekStart(),
        request.dayOfWeek(), request.slot(), owner);
    PlannedOccurrence saved = plannedOccurrenceRepository.save(occurrence);
    initializeTarget(saved);
    return saved;
}
```

`move()` (`applyMove`) and `carryForward()` (`applyCarryForward`) already call `initializeTarget(occurrence)`
today, so extending the shared helper covers AC-06/AC-08 with no further code change in those methods.
`complete()`'s `initializeCompletionChain(...)` already calls `initializeTarget(occurrence)` too,
covering AC-07 the same way — and, as a secondary safety net, `maybeAutoArchive(...)`
(`planner_spec_006_repeatable_activities.md`) already unconditionally reads
`occurrence.getSubTask().getActivity()` earlier in the same transaction for every sub-task
completion, regardless of that activity's `repeatable`/`archived` state, so the association is
already initialized by the time `initializeCompletionChain` runs even before `initializeTarget`'s own
extension is considered — belt-and-braces, not a single point of failure.

## Cross-references

| This spec | Contracts against |
|---|---|
| `PlannedOccurrenceResponse` (`dto/`) | Extended — new `parentActivityName` field |
| `PlanController.toResponse(...)` (`controller/`) | Extended — resolves `parentActivityName` |
| `PlanService.initializeTarget(...)`, `saveScheduledFor(...)` (`service/`) | Extended — also force-initializes `subTask.getActivity()` |
| `SubTask` (`planner_spec_003_sub_tasks.md`) | Reused unmodified — its existing lazy `activity` association |
| `PlannedOccurrence`, `Activity` (`planner_spec_004_week_planning.md`, `planner_spec_002_activity_bank.md`) | Reused unmodified |
| `PlanService.maybeAutoArchive(...)` (`planner_spec_006_repeatable_activities.md`) | Reused unmodified — incidental secondary safety net noted above, not relied on alone |
| `PlanServiceAutoArchiveIntegrationSpec.groovy` (`planner_spec_006_repeatable_activities.md`) | Precedent — this spec's own real-Postgres integration spec follows the same pattern |
| `frontend_spec_008_occurrence_detail_card.md` | Paired frontend spec — consumes `parentActivityName` exactly as specified here |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-008-AC-02/AC-09: a whole-activity occurrence's response has parentActivityName null, other fields unaffected"() {
    given: "the service returns one whole-activity occurrence for the week"
        def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
            DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
        planService.getWeek("steve", monday) >> [occurrence]
        planService.findCompletions("steve", _) >> [:]

    when: "GET /api/v1/plan is requested"
        def result = mockMvc.perform(get("/api/v1/plan?weekStart=2026-10-05")
            .with(SecurityMockMvcRequestPostProcessors.user("steve")))

    then: "parentActivityName is null, and the existing fields are unchanged"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data[0].name').value("Go for a walk"))
        result.andExpect(jsonPath('$.data[0].parentActivityName').doesNotExist())
        result.andExpect(jsonPath('$.data[0].category').value("ROUTINE"))
        result.andExpect(jsonPath('$.data[0].dayOfWeek').value("MONDAY"))
}

def "PLANNER-008-AC-03: a sub-task occurrence's response carries its parent activity's name"() {
    given: "the service returns one sub-task occurrence for the week"
        def occurrence = new PlannedOccurrence(null, subTask, ActivityCategory.ROUTINE, monday,
            DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
        planService.getWeek("steve", monday) >> [occurrence]
        planService.findCompletions("steve", _) >> [:]

    when: "GET /api/v1/plan is requested"
        def result = mockMvc.perform(get("/api/v1/plan?weekStart=2026-10-05")
            .with(SecurityMockMvcRequestPostProcessors.user("steve")))

    then: "the sub-task's own name and its parent activity's name are both present"
        result.andExpect(status().isOk())
        result.andExpect(jsonPath('$.data[0].name').value("Chapter one"))
        result.andExpect(jsonPath('$.data[0].parentActivityName').value("Go for a walk"))
}

def "PLANNER-008-AC-04: getWeek() initializes a sub-task occurrence's parent activity without LazyInitializationException"() {
    given: "a sub-task planned this week, against real Postgres"
        def created = planService.create(owner.username,
            new PlannedOccurrenceRequest(null, subTask.id, monday, DayOfWeek.MONDAY, PlanSlot.MORNING))

    when: "the week is fetched, and the nested parent activity is read outside getWeek()'s own transaction"
        def occurrences = planService.getWeek(owner.username, monday)
        def parentActivityName = occurrences.find { it.subTask != null }.subTask.activity.name

    then: "no LazyInitializationException is thrown, and the correct parent activity name is returned"
        parentActivityName == activity.name
}

def "PLANNER-008-AC-05: create() initializes a new sub-task occurrence's parent activity without LazyInitializationException"() {
    when: "a sub-task is planned via create(), and its parent activity is read outside that transaction"
        def occurrence = planService.create(owner.username,
            new PlannedOccurrenceRequest(null, subTask.id, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()
        def parentActivityName = occurrence.subTask.activity.name

    then: "no LazyInitializationException is thrown, and the correct parent activity name is returned"
        parentActivityName == activity.name
}

def "PLANNER-008-AC-06: move() initializes a moved sub-task occurrence's parent activity without LazyInitializationException"() {
    given: "a sub-task occurrence already sitting in the weekend bucket"
        def created = planService.create(owner.username,
            new PlannedOccurrenceRequest(null, subTask.id, monday, null, null)).get()

    when: "it is moved into a grid slot, and its parent activity is read outside that transaction"
        def moved = planService.move(owner.username, created.id,
            new PlannedOccurrenceMoveRequest(DayOfWeek.MONDAY, PlanSlot.MORNING)).get()
        def parentActivityName = moved.subTask.activity.name

    then: "no LazyInitializationException is thrown, and the correct parent activity name is returned"
        parentActivityName == activity.name
}

def "PLANNER-008-AC-07: complete() initializes a completed sub-task occurrence's parent activity without LazyInitializationException"() {
    given: "a sub-task occurrence planned this week"
        def created = planService.create(owner.username,
            new PlannedOccurrenceRequest(null, subTask.id, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()

    when: "it is completed, and its parent activity is read outside that transaction"
        def completion = planService.complete(owner.username, created.id).get()
        def parentActivityName = completion.plannedOccurrence.subTask.activity.name

    then: "no LazyInitializationException is thrown, and the correct parent activity name is returned"
        parentActivityName == activity.name
}

def "PLANNER-008-AC-08: carryForward() initializes a carried-forward sub-task occurrence's parent activity without LazyInitializationException"() {
    given: "an incomplete sub-task occurrence in the weekend bucket"
        def created = planService.create(owner.username,
            new PlannedOccurrenceRequest(null, subTask.id, monday, null, null)).get()

    when: "it is carried forward, and its parent activity is read outside that transaction"
        def carried = planService.carryForward(owner.username, created.id).get()
        def parentActivityName = carried.subTask.activity.name

    then: "no LazyInitializationException is thrown, and the correct parent activity name is returned"
        parentActivityName == activity.name
}
```

`PLANNER-008-AC-01` (the field's mere existence) is exercised implicitly by every sketch above, once
the record compiles with the new field — no standalone test needed beyond compilation, matching
`planner_spec_006_repeatable_activities.md`'s treatment of similarly structural ACs.

The `AC-04`–`AC-08` sketches run against real Postgres (a new `@SpringBootTest` Spock spec,
`PlanServiceSubTaskParentNameIntegrationSpec.groovy`, following `PlanServiceAutoArchiveIntegrationSpec.groovy`'s
precedent — `setup()`/`cleanup()` create and delete a throwaway `owner` `User` per test); the
`AC-02`/`AC-03`/`AC-09` sketches run as ordinary `@WebMvcTest` `PlanControllerSpec` additions, since
they only exercise the mapping logic, not real Hibernate proxies.

**Test Case (Green)**: implement `PlannedOccurrenceResponse`/`PlanController`/`PlanService` as
specified above until every sketch above passes.

## Acceptance Criteria Summary

- [x] PLANNER-008-AC-01 — `PlannedOccurrenceResponse` declares a new `parentActivityName` field
- [x] PLANNER-008-AC-02 — activity-target occurrence responses have `parentActivityName: null`
- [x] PLANNER-008-AC-03 — sub-task-target occurrence responses carry the parent activity's name
- [x] PLANNER-008-AC-04 — `getWeek()` initializes `subTask.activity`, no `LazyInitializationException`
- [x] PLANNER-008-AC-05 — `create()` initializes `subTask.activity`, no `LazyInitializationException`
- [x] PLANNER-008-AC-06 — `move()` initializes `subTask.activity`, no `LazyInitializationException`
- [x] PLANNER-008-AC-07 — `complete()` initializes `subTask.activity`, no `LazyInitializationException`
- [x] PLANNER-008-AC-08 — `carryForward()` initializes `subTask.activity`, no `LazyInitializationException`
- [x] PLANNER-008-AC-09 — existing `PlannedOccurrenceResponse` fields unchanged (regression guard)
