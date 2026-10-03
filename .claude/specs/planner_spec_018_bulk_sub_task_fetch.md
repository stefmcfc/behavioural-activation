# Bulk Sub-task Fetch Endpoint (Backend)

**Status**: Implemented (2026-10-03)
**Priority**: P2 — performance/scale. Raised 2026-10-01 (`.claude/SPEC_CANDIDATES.md`'s "Bulk
sub-task fetch endpoint" entry, from the `modern-web-guidance` review), promoted to a real spec
2026-10-02 as part of a broader performance investigation (user request).
**Depends on**: `planner_spec_003_sub_tasks.md` (origin of `SubTaskController`/`SubTaskService`/
`SubTaskRepository`, extended here), `planner_spec_012_subtask_count.md` (origin of
`ActivityWithSubTaskCount`/`ActivityResponse.subTaskCount`, whose backing query this spec also fixes)
**Area**: Backend — new endpoint, `API.md` update required. Paired with `frontend_spec_033_bulk_sub_task_fetch.md`
for the one real consumer of the new endpoint.
**Roadmap version**: V1 polish / internal — a performance fix plus a small new endpoint, not a new
user-facing capability (every sub-task already fetchable, just one activity at a time)

## Summary

All 6 ACs implemented and verified. `SubTaskController` was restructured per option (a) from this
spec's own Overview: its class-level `@RequestMapping("/api/v1/activities/{activityId}/sub-tasks")`
prefix was moved onto each of the four existing methods individually (as a `NESTED_BASE_PATH`
constant), freeing the class to also host the new `@GetMapping("/api/v1/sub-tasks")` bare-path
method — chosen over a second dedicated controller class since it's the same resource and the same
backing `SubTaskService`, so a second controller would only have split one cohesive concern across
two files for no benefit. `SubTaskService` gained `listForOwner(String)`, delegating to a new
`SubTaskRepository.findByOwner(User)` derived-query method — no parent-activity existence check
needed here (unlike `listForActivity`), since there's no single `activityId` to validate.

`ActivityService.listForOwner`'s N+1 fix: `SubTaskRepository` gained
`countGroupedByActivityIdForOwner(User)`, a custom `@Query` using a JPQL constructor expression
(`SELECT new ...SubTaskCountProjection(s.activity.id, COUNT(s)) ... GROUP BY s.activity.id`) backed
by a new `SubTaskCountProjection(UUID activityId, Long count)` record. `listForOwner` now calls this
once, builds a `Map<UUID, Long>` from the result, and looks up each activity's count via
`getOrDefault(activity.getId(), 0L)` — an activity absent from the grouped result has no sub-tasks,
so its count is implicitly zero, exactly matching the old per-activity loop's values.
`ActivityService.countSubTasks` (the single-activity path) was not touched, confirmed by its own
unchanged test plus the fact that no production or test code for it was edited.

**Measured query-count finding (AC-05)**, using `Statistics.getPrepareStatementCount()` against a
real Postgres instance: `GET /api/v1/activities` issues an *identical* query count for a 1-activity
owner and a 10-activity owner (half with a sub-task, half without) — a true constant, unlike
`planner_spec_019`'s sibling finding for the bucket-reorder endpoint. This is expected: unlike that
endpoint's N necessary position-assignment `UPDATE`s, this is a pure read path with no per-row write
component to introduce a legitimate `N`-sized term. The fix was confirmed to actually matter (not a
vacuously-passing test) by temporarily reverting `listForOwner` to the old per-activity-loop
implementation and re-running `ActivityControllerQueryCountSpec` — it failed, as expected, before the
fix was restored.

Full suite: 283 tests, 0 failures (up from 273 before this spec).

## Overview

Two separate N+1 problems, both rooted in the same gap — no way to fetch sub-tasks in bulk, only
`GET /api/v1/activities/{activityId}/sub-tasks`, one activity at a time — get fixed by one new
endpoint:

1. **Frontend**: `ActivityPickerList.tsx` (shared by the Weekly Planner's "Add" modal and Today's
   "Browse activities" drawer) calls `activityApi.getAll()` then fans out one
   `subTaskApi.getAll(activityId)` call per activity via `Promise.all` — parallelized, so not a
   sequential waterfall, but still N+1 HTTP round trips every time either picker opens.
2. **Backend**: `ActivityService.listForOwner` (backing `GET /api/v1/activities`, hit on every
   Activity Bank load) calls `subTaskRepository.countByActivityIdAndOwner(...)` once per activity in
   a `.stream().map(...)` loop, to populate `ActivityResponse.subTaskCount`
   (`planner_spec_012_subtask_count.md`) — N+1 `COUNT` queries instead of one.

Both are fixed by: a new `GET /api/v1/sub-tasks` endpoint returning every sub-task owned by the
authenticated user in one call (consumed directly by `ActivityPickerList.tsx`, fixing #1 — see
`frontend_spec_033`), plus a new bulk `GROUP BY`/`COUNT` repository query `ActivityService` uses
internally instead of its own per-activity loop (fixing #2, no API-facing change at all for this
half).

**Route placement, an implementation-time choice, not dictated here**: `SubTaskController` is
entirely nested under `/api/v1/activities/{activityId}/sub-tasks` (every existing method requires an
`activityId` path variable), and Spring doesn't support a method-level mapping "escaping" a
class-level `@RequestMapping` prefix. The new endpoint has no single `activityId` to nest under, so
it needs either: (a) restructuring `SubTaskController` to move its fixed path prefix onto each
existing method individually, freeing the class to also host a bare `/api/v1/sub-tasks` mapping, or
(b) a small, dedicated second controller just for this one endpoint. Either achieves the identical
contract below — pick whichever is less invasive once actually touching the file, don't treat this as
a decision needing to be re-litigated with the user first.

**No change to `GET /api/v1/activities/{activityId}/sub-tasks`** (the existing nested, single-activity
endpoint) — it stays exactly as-is; this is a new, additional endpoint, not a replacement.

**Explicitly out of scope**: any filtering/pagination on the new bulk endpoint (matches
`GET /api/v1/activities`'s own existing "return everything for this user" shape — see that spec's own
scale reasoning, unchanged here). Any change to `SubTaskResponse`'s shape — it already carries
`activityId` on every sub-task (confirmed in the current DTO), so the bulk response is already
naturally groupable by activity with zero new fields needed.

## Requirement 1: A new endpoint returns every sub-task owned by the authenticated user

**User story**: As a user, I want the Add picker / Browse activities drawer to load all activities
and their sub-tasks in roughly constant time, not slower the more activities I have.

### PLANNER-018-AC-01 [AUTO]: `GET /api/v1/sub-tasks` returns every sub-task for the authenticated user
**Statement**: `GET /api/v1/sub-tasks` shall return `200` with `{ "data": [...], "count": N }` — every
`SubTask` owned by the authenticated user, across all of their activities, in one call. A user with no
sub-tasks at all returns `{ "data": [], "count": 0 }`, not an error.

**References**: New repository method on `SubTaskRepository`; new/extended controller method (see
Overview's "Route placement" note); reuses the existing `SubTaskListResponse`/`SubTaskResponse` DTOs
unmodified.

### PLANNER-018-AC-02 [AUTO]: The response is scoped to the authenticated user only
**Statement**: `GET /api/v1/sub-tasks` shall never include a sub-task belonging to a different user,
regardless of which activity it belongs to — owner-scoped exactly like every other endpoint in this
API (`SubTaskService`'s existing owner-resolution pattern, reused here).

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/SubTaskService.java`

### PLANNER-018-AC-03 [AUTO]: The endpoint requires authentication
**Statement**: `GET /api/v1/sub-tasks` shall return `401` for an unauthenticated request, inheriting
the existing `SecurityConfig`'s blanket `/api/v1/**` authentication rule unmodified — no new security
configuration needed.

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/config/SecurityConfig.java`
(unchanged)

## Requirement 2: `GET /api/v1/activities`'s sub-task counts come from one bulk query, not N

**User story**: As a user, I want the Activity Bank to load in roughly constant time regardless of
how many activities I have, not slower the more I've built up.

### PLANNER-018-AC-04 [AUTO]: `ActivityService.listForOwner` uses one grouped-count query instead of a per-activity loop
**Statement**: `ActivityService.listForOwner` shall resolve every activity's `subTaskCount` via a
single new `SubTaskRepository` query grouping counts by `activityId` for the owner, replacing its
current `.stream().map(activity -> ... subTaskRepository.countByActivityIdAndOwner(...))` per-activity
loop. `ActivityResponse.subTaskCount`'s values are unchanged for every activity — this is a query-count
reduction, not a behavior change.

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/ActivityService.java`
(`listForOwner`), `backend/src/main/java/uk/co/stefirby/behaviouralactivation/repository/SubTaskRepository.java`
(new query)

### PLANNER-018-AC-05 [AUTO]: `GET /api/v1/activities` issues a constant number of queries regardless of activity count
**Statement**: Calling `GET /api/v1/activities` for a user with N activities shall issue a constant
number of SQL queries independent of N — confirmed via Hibernate query-execution statistics, same
verification mechanism as `planner_spec_017`'s AC-02, not assumed from the query syntax alone.

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/controller/ActivityController.java`

### PLANNER-018-AC-06 [AUTO]: `ActivityService.countSubTasks` (single-activity path) is unaffected
**Statement**: `ActivityService.countSubTasks` — used for single-activity update/archive/favourite
responses, already a single `COUNT` query, not part of this N+1 — shall remain unchanged.

**Rationale**: Explicit regression guard — only `listForOwner`'s per-activity loop is being replaced,
not every use of `countByActivityIdAndOwner`.

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/ActivityService.java`
(`countSubTasks`, unchanged)

## Explicitly out of scope (do not implement as part of this spec)

- Any filtering, pagination, or query parameters on `GET /api/v1/sub-tasks` — returns everything for
  the authenticated user, matching `GET /api/v1/activities`'s existing shape.
- Any change to `GET /api/v1/activities/{activityId}/sub-tasks` (the existing single-activity
  endpoint) — stays exactly as-is.
- Any change to `SubTaskResponse`/`SubTaskListResponse`'s shape.
- The frontend consumption change itself — see `frontend_spec_033_bulk_sub_task_fetch.md`.

## Cross-references

| This spec depends on / contracts against | What it provides |
|---|---|
| `planner_spec_003_sub_tasks.md` | `SubTaskController`/`SubTaskService`/`SubTaskRepository`, extended here |
| `planner_spec_012_subtask_count.md` | `ActivityWithSubTaskCount`/`ActivityResponse.subTaskCount`, whose backing query this spec optimizes |
| `planner_spec_017_plan_response_n_plus_one.md` | The sibling N+1 fix this spec follows the same "custom `@Query`, verified via Hibernate statistics" pattern from |
| `frontend_spec_033_bulk_sub_task_fetch.md` | The one real consumer of `GET /api/v1/sub-tasks` — `ActivityPickerList.tsx` |
| `API.md`'s "Sub-tasks" section | Needs a new bullet for `GET /api/v1/sub-tasks`, following the existing section's documentation style |

## TDD test case sketches

Spock, following `planner_spec_017`'s established pattern for this kind of fix: functional-correctness
assertions via `@SpringBootTest` against real Postgres, plus a Hibernate-statistics-based query-count
assertion for the "N+1 actually eliminated" claim.

### PLANNER-018-AC-01 / AC-02 / AC-03
```groovy
class SubTaskControllerBulkListSpec extends Specification {
    def "PLANNER-018-AC-01: returns every sub-task across all of the user's activities"() {
        given: "two activities, each with sub-tasks, owned by the authenticated user"
        // ...persist via real repositories...

        when:
        def response = restTemplate.getForEntity('/api/v1/sub-tasks', SubTaskListResponse)

        then:
        response.statusCode == HttpStatus.OK
        response.body.count == 3 // total across both activities
        response.body.data*.activityId.toSet() == [activity1.id, activity2.id].toSet()
    }

    def "PLANNER-018-AC-01: a user with no sub-tasks gets an empty list, not an error"() {
        expect:
        restTemplate.getForEntity('/api/v1/sub-tasks', SubTaskListResponse).body == new SubTaskListResponse([], 0)
    }

    def "PLANNER-018-AC-02: never includes another user's sub-tasks"() {
        given: "a sub-task owned by a different user"
        // ...

        when:
        def response = restTemplate.getForEntity('/api/v1/sub-tasks', SubTaskListResponse)

        then:
        !response.body.data*.id.contains(otherUsersSubTask.id)
    }

    def "PLANNER-018-AC-03: returns 401 when unauthenticated"() {
        expect:
        unauthenticatedRestTemplate.getForEntity('/api/v1/sub-tasks', String).statusCode == HttpStatus.UNAUTHORIZED
    }
}
```

### PLANNER-018-AC-04 / AC-05 / AC-06
```groovy
class ActivityServiceSpec extends Specification {
    def "PLANNER-018-AC-04: listForOwner's subTaskCount values are unchanged after the query-count fix"() {
        given: "activities with varying sub-task counts, including zero"
        // ...

        expect:
        activityService.listForOwner(owner.username, false)*.subTaskCount() == [2L, 0L, 5L] // matches pre-fix values exactly
    }

    def "PLANNER-018-AC-06: countSubTasks (single-activity path) is untouched"() {
        expect:
        activityService.countSubTasks(owner.username, activity.id) == 2L
    }
}

// Same Hibernate-statistics mechanism as planner_spec_017's AC-02 sketch, applied to GET /api/v1/activities:
def "PLANNER-018-AC-05: GET /api/v1/activities issues a constant number of queries regardless of activity count"() {
    // ...clear statistics, fetch with 1 activity, record count, fetch with 10 activities, assert equal...
}
```

## Acceptance Criteria Summary

- [x] PLANNER-018-AC-01 — `GET /api/v1/sub-tasks` returns every sub-task for the authenticated user
- [x] PLANNER-018-AC-02 — response is scoped to the authenticated user only
- [x] PLANNER-018-AC-03 — endpoint requires authentication
- [x] PLANNER-018-AC-04 — `ActivityService.listForOwner` uses one grouped-count query, not a per-activity loop
- [x] PLANNER-018-AC-05 — `GET /api/v1/activities` issues a constant number of queries regardless of activity count
- [x] PLANNER-018-AC-06 — `ActivityService.countSubTasks` (single-activity path) is unaffected
