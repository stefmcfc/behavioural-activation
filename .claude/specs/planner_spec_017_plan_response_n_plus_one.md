# Eliminate the Weekly Plan Response's N+1 Lazy Loads (Backend)

**Status**: Implemented (2026-10-02)
**Priority**: P2 — performance, not a user-visible bug. Raised 2026-10-02 during a deliberate
performance investigation (user request, following up on `.claude/SPEC_CANDIDATES.md`'s "Bulk
sub-task fetch endpoint" candidate) — this spec targets a *separate*, more impactful finding from
that same investigation: the `GET /api/v1/plan` endpoint itself, not the frontend picker.
**Depends on**: `planner_spec_004_week_planning.md` (origin of `PlanController`/`PlanService`/
`PlannedOccurrenceRepository`, all touched here, unchanged in behavior), `planner_spec_010_bucket_reordering.md`
(origin of the bucket-reorder query this spec also fixes)
**Area**: Backend only — no API contract change (response shape is byte-for-byte identical), no
`API.md` update, no frontend changes
**Roadmap version**: V1 polish / internal — a performance fix to an already-shipped endpoint, not a
new capability

## Summary

All 5 ACs implemented and verified. Both named repository methods now use a custom `@Query` with
`LEFT JOIN FETCH` across `activity`, `subTask`, and `subTask.activity`; existing behavior is
unchanged (full 271-test suite passes, 0 failures).

**Measured query-count proof (AC-02)**: using `Statistics.getPrepareStatementCount()` against a
real Postgres instance, with one distinct `Activity`/`SubTask` per occurrence (not shared — see the
real finding below on why that distinction matters) —

| Scenario | Before fix | After fix |
|---|---|---|
| `GET /api/v1/plan`, 1 occurrence | 7 SQL statements | 6 SQL statements |
| `GET /api/v1/plan`, 10 occurrences (mixed activity-/sub-task-based) | 21 SQL statements | 6 SQL statements |

Before the fix, query count scaled with occurrence count (7 → 21, roughly +1.5 queries per extra
occurrence — one extra lazy load per activity-based occurrence, two per sub-task-based one). After
the fix it's flat at 6 regardless of N — proven, not assumed from the `JOIN FETCH` syntax alone.

**Real findings**:
- **`Statistics.getQueryExecutionCount()` is the wrong metric and would have made this test pass
  for the wrong reason.** It only counts explicit HQL/JPQL/Criteria query executions, not the
  individual SQL round trips triggered by entity/proxy loading (`Hibernate.initialize(...)` on a
  lazy association) — exactly the mechanism this N+1 runs through (`PlanService.initializeTarget`).
  It stayed identically flat whether the repository fix was present or deliberately reverted.
  Switched to `Statistics.getPrepareStatementCount()`, which counts every actual SQL round trip and
  does move between the two states — see `PlanControllerQueryCountSpec`'s own class-level Javadoc.
- **A test using one shared `Activity`/`SubTask` across every occurrence silently masks the N+1**,
  with or without the fix — Hibernate's session-level identity map serves every access after the
  first from its in-memory cache regardless of `JOIN FETCH`. The query-count spec gives every
  occurrence its own distinct `Activity`/`SubTask` specifically to avoid this.
- **The bucket-reorder endpoint (`PUT /api/v1/plan/bucket/order`) does not reach a true constant
  query count**, even after this fix, confirmed by direct measurement (not assumed) with distinct
  activities/sub-tasks: a 1-item vs. 4-item reorder went from an 11-statement delta (before the fix)
  to a 6-statement delta (after) — a real, measured improvement, but not flat. Root cause:
  `PlanService.reorderBucket` builds its *returned* list via a separate, pre-existing,
  per-submitted-id `plannedOccurrenceRepository.findByIdAndOwner` loop (one query per submitted id),
  not from the JOIN-FETCHed `currentBucket` query this spec's AC-03 fixes — and
  `PlanService.reorderBucket` is explicitly out of scope here (see Requirement 2's "unchanged
  itself" framing). AC-03's literal requirement (the repository method itself gets the `JOIN FETCH`
  treatment, verified at the repository level) is fully met; a true constant-query-count guarantee
  for the *whole* endpoint would require also changing how `PlanService.reorderBucket` sources its
  result list, which is a separate, legitimately-scoped follow-up, not silently folded into this
  spec. Noted as a candidate in `.claude/SPEC_CANDIDATES.md` rather than fixed here.
- Per this project's "don't implement a fix for a theory you haven't reproduced" convention: the
  original assumption (that fixing the `currentBucket` repository query alone would also flatten
  the bucket-reorder endpoint's full query count, since all the entities share one Hibernate
  session) was tested directly and only partially held — downgraded to the finding above rather
  than asserted as fact or quietly patched over with a mistuned test.

## Overview

`GET /api/v1/plan` (`PlanController.getWeek`) is the single most-hit endpoint in the app — it loads
on every Weekly Planner and Today view mount, and again on every week navigation. Its response
mapping (`PlanController.toResponse`, lines 142–158) reads `occurrence.getActivity()` or
`occurrence.getSubTask()` for every occurrence, plus `occurrence.getSubTask().getActivity()` for
`parentActivityName`/`repeatable` on sub-task-based occurrences. `PlannedOccurrence.activity` and
`PlannedOccurrence.subTask` are both `@ManyToOne(fetch = FetchType.LAZY)` (confirmed in the entity),
as is `SubTask.activity`. The repository method backing this
(`findByOwnerAndWeekStartOrderByCreatedAtAsc`) is a plain Spring Data derived query — no `JOIN FETCH`
— so each of those accesses triggers its own `SELECT`. For a week with 20 occurrences, that's up to
40 extra round trips (2 per sub-task-based occurrence: the sub-task's own activity, plus the parent
activity lookup) on top of the 1 query that actually fetched the occurrences, every single page load.

The same pattern exists in `PlanService.reorderBucket`, via a second, separately-defined repository
method (`findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc`) feeding the
same `toResponse` mapping — a lower-frequency write path (only hit when the user actually drags to
reorder the bucket) but the identical bug, fixed here too for consistency rather than left as a
known-but-unaddressed duplicate.

**The fix**: convert both derived-query repository methods to custom `@Query`s with `LEFT JOIN FETCH`
across `activity`, `subTask`, and `subTask.activity`, so the whole response is built from exactly one
`SELECT` regardless of how many occurrences are in the result. This is the "real complexity/scale
reason" `structure.md`'s "no custom `@Query` methods unless..." caveat anticipates — a derived method
name can't express a `JOIN FETCH`, so a custom query is the only way to fix this.

**No DTO/contract change**: `PlannedOccurrenceResponse`'s shape, every field, and every existing
caller's expectations are completely unchanged — this is purely an internal query-efficiency fix.
`PlanController.toResponse` itself needs no changes either; it already reads the right fields, it's
just reading them from a result set that's no longer lazy.

**Out of scope**: `CompletionRecord` lookups (`findCompletions`) are already a single bulk `IN` query
(`PLANNER-004-AC-27`'s note in `PlanController`'s own class-level Javadoc) — not part of this N+1,
nothing to fix there. Any change to `PlannedOccurrenceResponse`'s shape, or to any other endpoint not
named above.

## Requirement 1: `GET /api/v1/plan`'s occurrence fetch is a single query, including its relationships

**User story**: As a user, I want the Weekly Planner and Today view to load quickly regardless of how
many activities I've planned for the week, not slower the more I use the app.

### PLANNER-017-AC-01 [AUTO]: `findByOwnerAndWeekStartOrderByCreatedAtAsc` eager-fetches activity, sub-task, and the sub-task's parent activity in one query
**Statement**: `PlannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc` shall become
a custom `@Query` using `LEFT JOIN FETCH o.activity`, `LEFT JOIN FETCH o.subTask st`, and
`LEFT JOIN FETCH st.activity`, returning functionally identical results (same occurrences, same
order) to the current derived-query version, with every relationship already initialized — no further
lazy-load access needed by `PlanController.toResponse`.

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/repository/PlannedOccurrenceRepository.java`,
`backend/src/main/java/uk/co/stefirby/behaviouralactivation/controller/PlanController.java` (`getWeek`,
unchanged itself)

### PLANNER-017-AC-02 [AUTO]: `GET /api/v1/plan` issues a fixed, low number of queries regardless of occurrence count
**Statement**: Calling `GET /api/v1/plan?weekStart=...` for a week with N occurrences (activity-based
and sub-task-based mixed) shall issue a constant number of SQL queries independent of N — not scaling
linearly with the number of occurrences, confirmed via Hibernate query-execution statistics, not
assumed from the `JOIN FETCH` syntax alone.

**Rationale**: This is the AC that actually proves the fix — AC-01 alone (a `JOIN FETCH` was added)
is necessary but not sufficient to prove the N+1 is gone; a missed `JOIN FETCH` on one of the three
relationships, or `toResponse` developing a fourth lazy access later, would silently reintroduce it.
A query-count assertion catches that regardless of why it regressed.

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/controller/PlanController.java`

## Requirement 2: `PUT /api/v1/plan/bucket/order`'s occurrence re-fetch gets the identical fix

**User story**: As a user, reordering my weekend bucket list shouldn't be slow either, even though
I'll hit this less often than just viewing my plan.

### PLANNER-017-AC-03 [AUTO]: `findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc` gets the same `JOIN FETCH` treatment
**Statement**: `PlannedOccurrenceRepository.findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc`
shall become a custom `@Query` with the same `LEFT JOIN FETCH` chain as AC-01, applied to
`PlanService.reorderBucket`'s result set.

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/repository/PlannedOccurrenceRepository.java`,
`backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/PlanService.java` (`reorderBucket`,
unchanged itself)

## Requirement 3: Existing behavior is fully unaffected

**User story**: As a user, I want this to be invisible — exactly the same Weekly Planner and Today
view, just faster.

### PLANNER-017-AC-04 [AUTO]: Every existing `GET /api/v1/plan` test still passes unmodified
**Statement**: `planner_spec_004_week_planning.md`'s, `planner_spec_008`'s, and
`planner_spec_011_bucket_carry_forward_automation.md`'s existing `PlanServiceSpec`/`PlanController`-level
tests covering `getWeek`'s response shape, ordering, and field values shall pass with zero test-code
changes — this spec changes query efficiency, not the data returned.

**References**: `backend/src/test/groovy/uk/co/stefirby/behaviouralactivation/service/PlanServiceSpec.groovy`
and related integration specs

### PLANNER-017-AC-05 [AUTO]: Every existing `PUT /api/v1/plan/bucket/order` test still passes unmodified
**Statement**: `planner_spec_010_bucket_reordering.md`'s existing bucket-reorder tests shall pass with
zero test-code changes.

**References**: `backend/src/test/groovy/uk/co/stefirby/behaviouralactivation/service/PlanServiceBucketReorderIntegrationSpec.groovy`

## Cross-references

| This spec depends on / contracts against | What it provides |
|---|---|
| `planner_spec_004_week_planning.md` | `PlannedOccurrenceRepository`/`PlanController`/`PlanService`, the files this spec modifies |
| `planner_spec_010_bucket_reordering.md` | The second repository method this spec also fixes (Requirement 2) |
| `PlannedOccurrenceResponse` (`dto/`) | Unchanged — the contract this spec must not break |

## TDD test case sketches

Spock, `given/when/then`, following this project's established `@SpringBootTest` + real-Postgres
pattern for repository-level behavior (`PlannedOccurrenceRepositorySpec.groovy`'s own class-level
Javadoc explains why: lazy-loading behavior is a real Hibernate/JPA concern a mocked repository
cannot exercise).

### PLANNER-017-AC-01 / AC-04
```groovy
class PlannedOccurrenceRepositorySpec extends Specification {
    // ...existing setup...

    def "PLANNER-017-AC-01: findByOwnerAndWeekStartOrderByCreatedAtAsc returns occurrences with activity/subTask/subTask.activity already initialized"() {
        given: "an activity-based and a sub-task-based occurrence for the same week"
        // ...persist a User, Activity, SubTask, and two PlannedOccurrences (one activityId-based,
        // one subTaskId-based) via the real repositories, in setup...

        when: "fetched via the repository method, outside any further open Hibernate session"
        def results = plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, weekStart)
        entityManager.clear() // detach -- a lazy proxy would now throw if accessed

        then: "every relationship is already populated, no LazyInitializationException"
        results.find { it.activity != null }.activity.name == 'Go for a walk'
        def subTaskOccurrence = results.find { it.subTask != null }
        subTaskOccurrence.subTask.name == 'subtask 1'
        subTaskOccurrence.subTask.activity.name == 'Go for a walk'
    }
}
```

### PLANNER-017-AC-02
```groovy
// New: enable Hibernate statistics for this test class only (e.g. via
// @DynamicPropertySource setting hibernate.generate_statistics: true, or a dedicated test
// application-*.yml profile -- implementer's call on the mechanism, not the assertion shape).
class PlanControllerQueryCountSpec extends Specification {

    @Autowired
    EntityManagerFactory entityManagerFactory

    def "PLANNER-017-AC-02: GET /api/v1/plan issues a constant number of queries regardless of occurrence count"() {
        given: "a week with 1 occurrence, and a separate week with 10 occurrences (mix of activity- and sub-task-based)"
        def statistics = entityManagerFactory.unwrap(SessionFactory).statistics
        statistics.clear()

        when: "fetching the 1-occurrence week"
        def responseWithOne = restTemplate.getForEntity(/* GET /api/v1/plan?weekStart=... */)
        def queryCountForOne = statistics.queryExecutionCount
        statistics.clear()

        and: "fetching the 10-occurrence week"
        def responseWithTen = restTemplate.getForEntity(/* GET /api/v1/plan?weekStart=... */)
        def queryCountForTen = statistics.queryExecutionCount

        then: "query count does not scale with occurrence count"
        queryCountForOne == queryCountForTen
    }
}
```

### PLANNER-017-AC-03 / AC-05
```groovy
def "PLANNER-017-AC-03: findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc also returns initialized relationships"() {
    // same shape as the AC-01 sketch above, scoped to bucket-only occurrences
    // (dayOfWeek/slot both null), confirming PlanService.reorderBucket's result set
    // needs no further lazy access either.
}
```

### Deviations from the sketches above (see Summary for the full writeup)

- **AC-02**: implemented with `Statistics.getPrepareStatementCount()`, not
  `Statistics.getQueryExecutionCount()` as sketched — the latter doesn't count the SQL round trips
  entity/proxy loading triggers, so it couldn't actually have distinguished the fixed state from
  the unfixed one. `@DynamicPropertySource` was used, matching the sketch's own "implementer's call
  on the mechanism" note. The controller bean (`PlanController.getWeek`) is invoked directly rather
  than through `restTemplate` — this project has no existing `TestRestTemplate`/real-session-auth
  integration pattern yet, and calling the bean directly exercises the identical call chain.
- **AC-03/AC-05**: implemented exactly as sketched at the repository level (no deviation). No
  equivalent full-endpoint query-count test was added for the bucket-reorder endpoint — see the
  Summary's "real findings" for why a constant-count claim there would be false, given
  `PlanService.reorderBucket`'s own unrelated, out-of-scope per-id lookup loop.

## Acceptance Criteria Summary

- [x] PLANNER-017-AC-01 — `findByOwnerAndWeekStartOrderByCreatedAtAsc` eager-fetches activity/subTask/subTask.activity
- [x] PLANNER-017-AC-02 — `GET /api/v1/plan` issues a constant number of queries regardless of occurrence count
- [x] PLANNER-017-AC-03 — the bucket-reorder query method gets the same `JOIN FETCH` treatment
- [x] PLANNER-017-AC-04 — every existing `GET /api/v1/plan` test passes unmodified
- [x] PLANNER-017-AC-05 — every existing bucket-reorder test passes unmodified
