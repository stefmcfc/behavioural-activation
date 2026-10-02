# Eliminate the Bucket-Reorder Endpoint's Remaining Query Scaling (Backend)

**Status**: Implemented (2026-10-02)
**Priority**: P3 — performance, lower urgency than `planner_spec_017`. `PUT /api/v1/plan/bucket/order`
is a write path triggered only when the user actually drags to reorder the weekend bucket, not a
page-load read path — real, but much lower-frequency than `GET /api/v1/plan`.
**Depends on**: `planner_spec_010_bucket_reordering.md` (origin of `PlanService.reorderBucket`,
refactored here), `planner_spec_017_plan_response_n_plus_one.md` (the sibling fix this spec
completes — that spec's AC-03 already `JOIN FETCH`-ed the `currentBucket` query this spec reuses, but
explicitly left `reorderBucket`'s own per-item lookup loop out of scope; this spec is that follow-up,
confirmed as a new `SPEC_CANDIDATES.md` entry surfaced while implementing that spec)
**Area**: Backend only — no API contract change (response shape, status codes, and error messages are
byte-for-byte identical), no `API.md` update, no frontend changes
**Roadmap version**: V1 polish / internal — a performance fix to an already-shipped endpoint, not a
new capability

## Summary

All 7 ACs implemented and verified. `PlannedOccurrenceRepository` gained
`findByIdInAndOwner(Collection<UUID>, User)`, given the same 3-way `LEFT JOIN FETCH`
(`activity`/`subTask`/`subTask.activity`) treatment as `planner_spec_017`'s two existing methods.
`PlanService.reorderBucket` now calls it once instead of looping `findByIdAndOwner` per submitted id,
reconstructing `submitted` in `request.occurrenceIds()`'s exact order via a `Map<UUID,
PlannedOccurrence>` lookup (the bulk query's own result order is not guaranteed to match the
`IN`-list). Both 409 checks and the 404 check are unchanged in logic, type, and message — only
re-sourced from the bulk-fetched map instead of the per-id-loop's accumulator. Full suite: 273 tests,
0 failures (up from 271 before this spec — two new tests: the repository-level AC-01 test and the
AC-03 query-count test).

**Measured query-count finding (AC-03)**, using `Statistics.getPrepareStatementCount()` against a
real Postgres instance, one distinct `Activity`/`SubTask` per occurrence (never shared):

| Scenario | Raw total prepared statements |
|---|---|
| Reordering a 1-item bucket | 4 |
| Reordering a 6-item bucket | 9 |

The raw total is **not** perfectly flat (4 vs 9) — but this is expected and correctly attributed, not
a residual bug. It decomposes exactly as `3 + N`: **3 constant reads** (owner lookup, the new bulk
`findByIdInAndOwner`, and the already-`JOIN FETCH`-ed `currentBucket` fetch) plus **N necessary
writes** — one `UPDATE` per submitted occurrence, because `PlannedOccurrence.assignBucketPosition`
unconditionally sets `updatedAt = Instant.now()` on every call (not just when `bucketPosition`
actually changes), so every submitted occurrence is dirty-checked as changed regardless, and no
Hibernate batching is configured (`hibernate.jdbc.batch_size` unset). This N-sized write component is
exactly the Overview's own "N necessary UPDATEs for N changed rows, not an N+1 *read* bug" carve-out
— confirmed by direct measurement (4 = 3+1, 9 = 3+6), not assumed. The committed test therefore
asserts the fix's actual, provable claim — `(rawCount - submittedCount)` is identical across both
scenarios (3 both times) — isolating the constant *read* count the fix addresses, rather than
asserting a literally-flat raw total that the entity's own unconditional `updatedAt` touch makes
impossible regardless of this fix. This is the one deviation from the spec's TDD sketch (which
compared raw totals directly); see `PlanServiceReorderBucketQueryCountSpec`'s class Javadoc for the
full writeup.

No `API.md` update — no endpoint, request/response shape, or status code changed.

## Overview

`planner_spec_017` eagerly fetches `activity`/`subTask`/`subTask.activity` for the query that loads
the *current* bucket inside `PlanService.reorderBucket`
(`findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc`). Measured directly
while implementing that spec: `PUT /api/v1/plan/bucket/order` improved (an 11-statement delta for a
1-vs-4-item reorder dropped to 6) but still doesn't reach a flat, constant query count the way
`GET /api/v1/plan` now does. The remaining cause is a different, pre-existing loop, untouched by that
fix:

```java
List<PlannedOccurrence> submitted = new ArrayList<>();
for (UUID id : request.occurrenceIds()) {
    Optional<PlannedOccurrence> found = plannedOccurrenceRepository.findByIdAndOwner(id, owner);
    if (found.isEmpty()) {
        return Optional.empty(); // PLANNER-010-AC-11
    }
    submitted.add(found.get());
}
```

One `findByIdAndOwner` query per submitted id — classic N+1, scaling linearly with how many items the
client asks to reorder (realistically small, since it's bounded by one week's bucket size, but the
same shape of bug `planner_spec_017` already fixed once on the read side).

**The fix**: replace the per-id loop with one bulk query — a new
`findByIdInAndOwner(Collection<UUID>, User)` repository method, given the same 3-way
`LEFT JOIN FETCH` treatment as `planner_spec_017`'s two methods — then reconstruct `submitted` in the
client-requested order from the bulk result (a `WHERE id IN (...)` query does not guarantee its
result order matches the `IN`-list order, so this reordering step is load-bearing, not cosmetic).
Every existing validation check, exception type, exception message, and the response shape are
**completely unchanged** — this spec changes how `submitted` is *populated*, not what's checked once
it is.

**Why this needs its own design pass, not a one-line swap** (per the `SPEC_CANDIDATES.md` entry's own
framing): `reorderBucket` has two distinct 409 checks that look superficially similar but catch
different cases —

1. **"Every submitted id must currently be a weekend-bucket item for the given weekStart."** Checked
   today via `submitted.stream().allMatch(o -> o.isBucketItem() && o.getWeekStart().equals(weekStart))`,
   using the per-id-loop's fetched entities' own fields.
2. **"`occurrenceIds` must be exactly the current set of weekend-bucket items for the given
   weekStart."** Checked via `currentIds.equals(submittedIds)`, comparing against the separately
   fetched `currentBucket` query — this is what catches a *partial* submission (e.g. 2 of the week's 3
   bucket items), which check 1 alone would **not** catch, since every one of those 2 genuinely *is* a
   current bucket item — just not all of them.

Both checks must keep working, with their exact current error messages (`BucketReorderNotAllowedException`
carries a message string, not just a type), on data sourced from the new bulk query instead of N
individual ones. Getting this right — not accidentally collapsing the two checks into one, or losing
check 1's standalone failure mode — is the actual design work here, not just "add a bulk query."

**Explicitly out of scope**: the position-assignment writes themselves (`assignBucketPosition(i)` for
each submitted occurrence) genuinely touch N distinct rows for an N-item reorder — that's N necessary
`UPDATE`s for N changed rows, not an N+1 *read* bug, and isn't addressed here. A bulk `UPDATE` query
would bypass Hibernate's dirty-checking and this entity's own invariants for no clear benefit at this
app's realistic bucket sizes — not pursued. Any change to `PlanService.reorderBucket`'s validation
*logic*, exception types, or messages — this spec only changes how data is *fetched*, confirmed
identical behavior otherwise.

## Requirement 1: `reorderBucket` validates submitted ids via one bulk query, not one per id

**User story**: As a user, reordering my weekend bucket list should be fast regardless of how many
items are in it.

### PLANNER-019-AC-01 [AUTO]: A new repository method bulk-fetches submitted ids, eagerly
**Statement**: `PlannedOccurrenceRepository` shall gain a new `findByIdInAndOwner(Collection<UUID> ids,
User owner)` method, implemented as a custom `@Query` with the same `LEFT JOIN FETCH` chain across
`activity`, `subTask`, and `subTask.activity` as `planner_spec_017`'s two existing methods.

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/repository/PlannedOccurrenceRepository.java`

### PLANNER-019-AC-02 [AUTO]: `reorderBucket` uses the bulk method instead of a per-id loop
**Statement**: `PlanService.reorderBucket` shall replace its `for (UUID id : request.occurrenceIds())`
loop (one `findByIdAndOwner` call per iteration) with a single call to the new
`findByIdInAndOwner(request.occurrenceIds(), owner)`, then reconstruct `submitted` in the exact order
of `request.occurrenceIds()` by looking up each id in the bulk result (not relying on the bulk query's
own result ordering, which is not guaranteed to match the `IN`-list order).

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/PlanService.java`
(`reorderBucket`)

### PLANNER-019-AC-03 [AUTO]: `PUT /api/v1/plan/bucket/order` issues a constant number of queries regardless of submitted-item count
**Statement**: Calling `PUT /api/v1/plan/bucket/order` with N submitted ids shall issue a constant
number of SQL queries independent of N — confirmed via Hibernate query-execution statistics
(`Statistics.getPrepareStatementCount()`, the metric `planner_spec_017`'s own investigation confirmed
is the correct one — not `getQueryExecutionCount()`, which doesn't count lazy-proxy-initialization
round trips), not assumed from the query syntax alone.

**References**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/PlanService.java`,
`backend/src/main/java/uk/co/stefirby/behaviouralactivation/controller/PlanController.java`

## Requirement 2: Every existing validation check, exception, and ordering guarantee is preserved exactly

**User story**: As a user, I want reordering my bucket to behave exactly as it already does — this is
invisible, just faster.

### PLANNER-019-AC-04 [AUTO]: The 404 (not found / not owned) case is unchanged
**Statement**: Submitting an id that doesn't exist, or that exists but isn't owned by the authenticated
user, shall still return `Optional.empty()` (surfaced as `404` by `PlanController`) — equivalent to
today's per-id-loop behavior, now determined by comparing the bulk query's returned id set against the
full set of submitted ids rather than an early-exit per-iteration check.

**References**: Existing test `PLANNER-010-AC-11` in
`backend/src/test/groovy/uk/co/stefirby/behaviouralactivation/service/PlanServiceBucketReorderIntegrationSpec.groovy`
— must pass unmodified.

### PLANNER-019-AC-05 [AUTO]: Check 1 ("every submitted id must currently be a bucket item for this week") still fires independently of check 2
**Statement**: `BucketReorderNotAllowedException("Every occurrenceId must currently be a weekend-bucket
item for the given weekStart")` shall still be thrown when a submitted id exists and is owned, but
isn't currently a bucket item for the given `weekStart` (e.g. a scheduled grid occurrence) —
unchanged message, unchanged exception type, now evaluated against the bulk-fetched entities' own
fields instead of the per-id-loop's.

**References**: Existing test `PLANNER-010-AC-12` — must pass unmodified.

### PLANNER-019-AC-06 [AUTO]: Check 2 ("exactly the current set") still catches a partial submission
**Statement**: `BucketReorderNotAllowedException("occurrenceIds must be exactly the current set of
weekend-bucket items for the given weekStart")` shall still be thrown when every submitted id *is* a
current bucket item for the week, but the submitted set is a strict subset of the full current bucket
(a partial submission) — unchanged, still computed by comparing against the separately-fetched
`currentBucket` query, confirming this spec didn't accidentally collapse checks 1 and 2 into one.

**References**: Existing test `PLANNER-010-AC-13` — must pass unmodified.

### PLANNER-019-AC-07 [AUTO]: Bucket positions are still assigned in the exact submitted order
**Statement**: On success, `submitted`'s bucket positions (`0..N-1`) and the returned list's order
shall still exactly match `request.occurrenceIds()`'s order — confirming the bulk query's
unspecified result ordering was correctly normalized back to the requested order, not silently left
in whatever order the database happened to return.

**References**: Existing test `PLANNER-010-AC-14` — must pass unmodified; this is the AC most at risk
of a silent regression from this spec's change, since it's exactly the invariant a naive bulk-query
swap (without the reordering step in AC-02) would break.

## Cross-references

| This spec depends on / contracts against | What it provides |
|---|---|
| `planner_spec_010_bucket_reordering.md` | `PlanService.reorderBucket`, refactored here; its existing `PLANNER-010-AC-11`–`AC-14` tests, which must all keep passing unmodified |
| `planner_spec_017_plan_response_n_plus_one.md` | The `currentBucket` query's `JOIN FETCH` (already done, reused as-is) and the Hibernate-statistics query-count verification technique this spec reuses |
| `PlannedOccurrenceResponse` (`dto/`) | Unchanged — the contract this spec must not break |

## TDD test case sketches

Spock, following `planner_spec_017`'s established pattern exactly: existing integration tests serve as
the regression guard (run unmodified, not rewritten), plus one new repository-level test for the bulk
method and one new query-count test.

### PLANNER-019-AC-01
```groovy
// In PlannedOccurrenceRepositorySpec.groovy, alongside planner_spec_017's AC-01/AC-03 tests:
def "PLANNER-019-AC-01: findByIdInAndOwner returns the matching occurrences with relationships already initialized"() {
    given: "an activity-based and a sub-task-based occurrence, both owned by this spec's owner"
        // ...persist via real repositories, as in the sibling AC-01/AC-03 tests...

    when: "fetched by id via the new bulk method, outside any further open Hibernate session"
        def results = plannedOccurrenceRepository.findByIdInAndOwner([activityOccurrence.id, subTaskOccurrence.id], owner)
        entityManager.clear()

    then: "both are returned, with every relationship already populated"
        results.size() == 2
        results.find { it.activity != null }.activity.name == 'Go for a walk'
        results.find { it.subTask != null }.subTask.activity.name == 'Go for a walk'
}
```

### PLANNER-019-AC-02 / AC-04 / AC-05 / AC-06 / AC-07
No new sketches — `PlanServiceBucketReorderIntegrationSpec.groovy`'s existing `PLANNER-010-AC-11`
through `AC-14` tests (reproduced in full in this spec's Overview/Requirement 2 sections above) are
the regression guard. Run them unmodified before and after the refactor; all four passing unmodified
*is* the verification for AC-02/AC-04–AC-07 — this spec deliberately does not duplicate them with new,
differently-worded tests that could drift from the originals' exact assertions.

### PLANNER-019-AC-03
```groovy
// Same technique as PlanControllerQueryCountSpec.groovy (planner_spec_017), applied to reorderBucket:
class PlanServiceReorderBucketQueryCountSpec extends Specification {

    @DynamicPropertySource
    static void hibernateStatistics(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true")
    }

    def "PLANNER-019-AC-03: reorderBucket issues a constant number of queries regardless of submitted-item count"() {
        given: "a week with 1 bucket item, and a separate week with (e.g.) 6 bucket items, each with its own distinct Activity/SubTask (never shared -- see planner_spec_017's own finding on why a shared entity masks the N+1 via Hibernate's identity map)"
            // ...

        when: "reordering the 1-item week (trivial no-op reorder, same single id)"
            statistics.clear()
            def resultForOne = planService.reorderBucket(owner.username, new BucketReorderRequest(weekWithOne, [idA]))
            def queryCountForOne = statistics.prepareStatementCount

        and: "reordering the 6-item week"
            statistics.clear()
            def resultForSix = planService.reorderBucket(owner.username, new BucketReorderRequest(weekWithSix, sixIdsInSomeNewOrder))
            def queryCountForSix = statistics.prepareStatementCount

        then: "both reorders actually succeeded"
            resultForOne.isPresent()
            resultForSix.isPresent()

        and: "query count does not scale with submitted-item count"
            queryCountForOne == queryCountForSix
    }
}
```

## Acceptance Criteria Summary

- [x] PLANNER-019-AC-01 — `findByIdInAndOwner` bulk-fetches with relationships already initialized
- [x] PLANNER-019-AC-02 — `reorderBucket` uses the bulk method, reconstructed in requested order
- [x] PLANNER-019-AC-03 — `PUT /api/v1/plan/bucket/order` issues a constant number of *read* queries
      regardless of N (see Summary: the raw total is `3 + N` due to N necessary, pre-existing,
      explicitly-out-of-scope position-assignment writes — the test isolates and asserts the constant
      3-query read component)
- [x] PLANNER-019-AC-04 — 404 (not found/not owned) case unchanged
- [x] PLANNER-019-AC-05 — check 1 (must currently be a bucket item) still fires independently
- [x] PLANNER-019-AC-06 — check 2 (exactly the current set) still catches a partial submission
- [x] PLANNER-019-AC-07 — bucket positions still assigned in the exact submitted order
