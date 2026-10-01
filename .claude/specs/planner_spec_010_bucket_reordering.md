# Weekend Bucket List Manual Reordering (Backend)

**Status**: Implemented (2026-10-01) — all 16 ACs green.
**Priority**: P2 — chunk 3a of the Weekly Planner UX batch raised after
`frontend_spec_006_repeatable_activities.md` shipped. Chunks 1–2 (occurrence detail card, "Add"
picker modal — `planner_spec_008_occurrence_detail_card.md`/`frontend_spec_008_occurrence_detail_card.md`,
`frontend_spec_009_add_picker_modal.md`) are specced but not yet implemented. Chunk 3b (automatic
carry-forward of stale bucket items) is a separate, independent spec,
`planner_spec_011_bucket_carry_forward_automation.md` — see "Interaction with carry-forward" in
Requirement 2 below for the exact contract both specs must honor identically.
**Depends on**: `planner_spec_004_week_planning.md` (`PlannedOccurrence`, `PlannedOccurrenceRepository`,
`PlanService`/`PlanController`, `PlannedOccurrenceResponse`), `planner_spec_006_repeatable_activities.md`
(most recent prior state of `PlanService`, and the real-Postgres integration-spec precedent —
`PlanServiceAutoArchiveIntegrationSpec.groovy` — this spec's own integration spec follows the same
pattern)
**Area**: Backend
**Roadmap version**: V1 (extends the weekend bucket list from `product.md`'s V1 row / US-007 "Create
a weekend bucket list" — not V2's tracking/reflection scope, and not AI)

## Summary

Implemented largely as specified — the spec's own Implementation Notes section already contained
working code for nearly every class, which held up well against the real codebase.

- `applyMove(...)` needed an added `owner` parameter (the spec's sketch implied this but didn't show
  the full signature change) so `nextBucketPosition(owner, ...)` could be computed before mutating.
- `PlannedOccurrenceResponse` already had `parentActivityName`/`repeatable` fields from specs
  008/013 (the overview text's claim that `parentActivityName` wasn't present yet was stale) —
  `bucketPosition` was appended as a 14th field rather than inserted into the sketch's shorter list.
- New `PlanServiceBucketReorderIntegrationSpec.groovy` (9 tests, real Postgres, mirroring
  `PlanServiceAutoArchiveIntegrationSpec.groovy`'s throwaway-`User` pattern) plus 5 new
  `@WebMvcTest` cases in `PlanControllerSpec.groovy`.
- Full suite: 229 tests (up from 215), 0 regressions — independently re-run from a clean
  `--rerun-tasks` build, not just trusting the implementing agent's own report.

## Overview

`BucketList.tsx` today renders the weekend bucket's occurrences in whatever order
`GET /api/v1/plan` returns them (currently `createdAt` ascending, per
`planner_spec_004_week_planning.md`) — there is no way for a user to arrange their own flexible
weekend list. This spec adds a persisted manual order to bucket items and a new endpoint to submit a
reordered list, so the paired frontend spec (`frontend_spec_010_bucket_reordering.md`) can offer
drag-and-drop plus a keyboard-accessible up/down fallback. This ties back to
`.claude/HIGH_LEVEL_DESIGN.md`'s US-007 ("Create a weekend bucket list") — the same user story
`planner_spec_004_week_planning.md` delivered the first version of; this spec extends it with manual
ordering rather than changing its underlying bucket/schedule model.

`PlannedOccurrence` gains a new nullable `bucketPosition` field — meaningful only for bucket items
(`dayOfWeek`/`slot` both `null`); always `null` for a grid-scheduled occurrence. Positions are simple
sequential integers (`0, 1, 2, ...`), renumbered on every reorder — a fractional/gap-based scheme
(e.g. floating-point positions with room to insert between two existing values without touching
every sibling row) is unnecessary complexity here: a single user's weekend bucket is small (single
digits to low tens of items in the overwhelmingly common case), every mutation that changes the
bucket's membership or order already has to touch the database in one request regardless of scheme,
and simple integers keep the invariant ("the bucket's `bucketPosition` values are always exactly
`0..N-1`, contiguous, no gaps") trivial to state and verify — a gap-based scheme would only pay off
at a write frequency or list size this app doesn't have.

Every code path that adds an occurrence to a week's bucket — creating a new bucket item
(`POST /api/v1/plan/occurrences`), demoting a scheduled occurrence back to the bucket
(`PATCH /api/v1/plan/occurrences/{id}` with both `dayOfWeek`/`slot` null), and carrying a bucket item
forward to the next week (`POST /api/v1/plan/occurrences/{id}/carry-forward`) — appends it at the end
of that week's current bucket order (Requirement 2). A new endpoint,
`PUT /api/v1/plan/bucket/order`, lets the frontend submit the complete desired order for a week's
bucket as one request — a "replace the whole order" call rather than a "move this one item to
position N" call, since the frontend already knows the full desired final order the moment a
drag-drop or up/down interaction completes, and a whole-order replacement avoids any server-side
insert-and-shift math (Requirement 3).

**Out of scope**: automatic carry-forward itself (`planner_spec_011_bucket_carry_forward_automation.md`,
separate, no dependency in either direction beyond the shared interaction rule in Requirement 2).
The occurrence detail card (`planner_spec_008_occurrence_detail_card.md`, separate — its
`parentActivityName` field is not touched here; this spec is written against the actual current
`PlannedOccurrenceResponse`/`PlanService`/`PlanController` shape, which does not yet include that
field, exactly as `frontend_spec_009_add_picker_modal.md` did for its own unrelated region of the
same files). The "Add" picker modal (`frontend_spec_009_add_picker_modal.md`, frontend-only, no
backend surface). No change to how grid-scheduled occurrences are ordered or displayed — this spec's
`bucketPosition` field has no meaning outside the weekend bucket.

## Requirements

### Requirement 1 — `PlannedOccurrence` carries a persisted manual bucket order

As a user, I want the order I arrange my weekend bucket list into to actually be remembered, not
reset to some arbitrary order every time I reload the page.

- **PLANNER-010-AC-01** [AUTO]: The `PlannedOccurrence` entity shall declare a new `bucketPosition`
  field of type `Integer` (nullable), persisted via a new Flyway migration
  (`V007__add_bucket_position_to_planned_occurrences.sql`) adding a nullable `bucket_position`
  integer column to `planned_occurrences`.
- **PLANNER-010-AC-02** [AUTO]: The `PlannedOccurrenceResponse` record shall declare a new
  `bucketPosition` field of type `Integer` (nullable), exposing the entity's value as-is.

### Requirement 2 — Every code path that adds an occurrence to a week's bucket appends it at the end

As a user, I don't want an activity I just added to the bucket, moved back into the bucket, or
carried forward to jump into the middle of my existing order — it should land at the end, where I'd
expect a newly-added item to go.

- **PLANNER-010-AC-03** [AUTO]: When `POST /api/v1/plan/occurrences` creates a new occurrence with
  `dayOfWeek`/`slot` both null (a bucket item), `PlanService.create()` shall assign it a
  `bucketPosition` equal to the current count of that week's bucket items — appended at the end.
- **PLANNER-010-AC-04** [AUTO]: When `POST /api/v1/plan/occurrences` creates a new occurrence with
  `dayOfWeek`/`slot` both set (a grid-scheduled item), `PlanService.create()` shall leave its
  `bucketPosition` `null`.
- **PLANNER-010-AC-05** [AUTO]: When `PATCH /api/v1/plan/occurrences/{id}` demotes a scheduled
  occurrence back to the bucket (both `dayOfWeek`/`slot` null in the request), `PlanService.move()`
  shall assign it a `bucketPosition` equal to the count of that week's bucket items *before* this
  change — appended at the end of the existing bucket order.
- **PLANNER-010-AC-06** [AUTO]: When `PATCH /api/v1/plan/occurrences/{id}` promotes/reschedules a
  bucket item into a day/slot, `PlanService.move()` shall set its `bucketPosition` to `null`.
- **PLANNER-010-AC-07** [AUTO]: When `POST /api/v1/plan/occurrences/{id}/carry-forward` advances a
  bucket item's `weekStart` by 7 days, `PlanService.carryForward()` shall reset its `bucketPosition`
  to `null` and then assign it a `bucketPosition` equal to the count of the *new* week's bucket items
  before this change — appended at the end of the new week's order, never preserving its old week's
  position. **This exact rule (reset to `null`, re-append at the end of the destination week's
  order) also governs `planner_spec_011_bucket_carry_forward_automation.md`'s automatic
  carry-forward path** — whatever code that spec adds for migrating a stale bucket item's `weekStart`
  must produce the identical outcome for `bucketPosition`, whether or not it literally reuses this
  method.

### Requirement 3 — Submit a full new bucket order in one request

As a user, once I've dragged (or keyboard-moved) items into the order I want, I want that whole new
order saved in one action.

- **PLANNER-010-AC-08** [AUTO]: `PlanController` shall expose `PUT /api/v1/plan/bucket/order`,
  accepting a `BucketReorderRequest` body (`weekStart`, `occurrenceIds` — the complete desired order
  as a list of occurrence ids).
- **PLANNER-010-AC-09** [AUTO]: If `weekStart` is missing or not a Monday, then
  `PlanService.reorderBucket()` shall throw `InvalidPlanRequestException` (`400`), applying no
  change.
- **PLANNER-010-AC-10** [AUTO]: If `occurrenceIds` is empty or contains a duplicate id, then
  `PlanService.reorderBucket()` shall reject the request with `400` (bean validation for empty,
  `InvalidPlanRequestException` for a duplicate), applying no change.
- **PLANNER-010-AC-11** [AUTO]: If any submitted id does not resolve to a `PlannedOccurrence` owned
  by the authenticated user, then `PlanController.reorderBucket()` shall return `404` for the whole
  request, applying no change to any occurrence — mirroring
  `planner_spec_004_week_planning.md`'s PLANNER-004-AC-36 "not found and not yours are never
  distinguishable" convention, extended here to a batch: one bad id fails the entire batch, not just
  that id.
- **PLANNER-010-AC-12** [AUTO]: If any submitted id resolves to an occurrence owned by the
  authenticated user but is not currently a bucket item (`dayOfWeek`/`slot` not both null) for the
  requested `weekStart`, then `PlanService.reorderBucket()` shall throw
  `BucketReorderNotAllowedException` (`409`), applying no change to any occurrence — mirroring
  `CarryForwardNotAllowedException`'s existing "found but wrong state" `409` pattern
  (`planner_spec_004_week_planning.md`).
- **PLANNER-010-AC-13** [AUTO]: If the submitted `occurrenceIds` set does not exactly match the full
  current set of bucket-item ids for the requested `weekStart` (missing an id that's currently in the
  bucket, or including an id that isn't), then `PlanService.reorderBucket()` shall throw
  `BucketReorderNotAllowedException` (`409`), applying no change to any occurrence — a mismatch means
  the client's view of the bucket is stale (e.g. an item was added or removed by a concurrent
  request/tab since the client last fetched), so the whole submission is rejected rather than
  silently applying a partial or inconsistent reorder; the client is expected to refetch and retry.
- **PLANNER-010-AC-14** [AUTO]: Given a fully valid request, `PlanService.reorderBucket()` shall
  assign `bucketPosition` values `0` through `N-1` to the `N` submitted occurrences, in the exact
  order submitted, inside one transaction.
- **PLANNER-010-AC-15** [AUTO]: On success, `PlanController.reorderBucket()` shall return `200` with
  `{ "data": [...], "count": N }`, the reordered bucket occurrences in their new order.

### Requirement 4 — No regression to the existing response contract

As a user, I want my existing weekly planner behaviour to keep working exactly as before, with this
one field simply added alongside it.

- **PLANNER-010-AC-16** [AUTO]: The existing `PlannedOccurrenceResponse` fields (`id`, `activityId`,
  `subTaskId`, `name`, `category`, `weekStart`, `dayOfWeek`, `slot`, `completed`, `completedAt`,
  `createdAt`) shall remain unchanged in shape and value for every occurrence — `bucketPosition` is a
  pure addition, not a restructuring, of `planner_spec_004_week_planning.md`'s existing contract.

## Implementation notes

`model/PlannedOccurrence.java` — new field, getter, and setter; `assignSlot(...)` (promotion out of
the bucket) and `carryForward()` (bucket-to-bucket week jump) both clear `bucketPosition`, since a
fresh position is always assigned by the caller immediately afterward:

```java
private Integer bucketPosition;

public Integer getBucketPosition() {
    return bucketPosition;
}

public void assignBucketPosition(int bucketPosition) {
    this.bucketPosition = bucketPosition;
    this.updatedAt = Instant.now();
}

public void assignSlot(DayOfWeek dayOfWeek, PlanSlot slot) {
    this.dayOfWeek = dayOfWeek;
    this.slot = slot;
    this.bucketPosition = null; // PLANNER-010-AC-06 -- no longer a bucket item
    this.updatedAt = Instant.now();
}

public void carryForward() {
    this.weekStart = this.weekStart.plusDays(7);
    this.bucketPosition = null; // PLANNER-010-AC-07 -- reset; caller re-appends in the new week
    this.updatedAt = Instant.now();
}
```

`service/PlanService.java` — a `nextBucketPosition(...)` helper backs every append-at-end path:

```java
private int nextBucketPosition(User owner, LocalDate weekStart) {
    return (int) plannedOccurrenceRepository
        .countByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNull(owner, weekStart);
}
```

**Hazard to avoid**: `nextBucketPosition(...)` must always be called *before* mutating the occurrence
being moved/carried-forward, not after. Hibernate's default `FlushModeType.AUTO` flushes pending
dirty state ahead of a query that could be affected by it; if `moveToBucket()`/`carryForward()`
mutates the occurrence's `dayOfWeek`/`slot`/`weekStart` first, the subsequent `COUNT` query can
auto-flush that change and then count the occurrence's own now-updated row as if it were already an
existing bucket item in the target week, inflating the computed position by one. Compute the position
first (while the occurrence is still clean, so nothing forces an early flush), then mutate:

```java
// applyMove(), demote-to-bucket branch:
int position = nextBucketPosition(owner, occurrence.getWeekStart()); // BEFORE mutating (PLANNER-010-AC-05)
occurrence.moveToBucket();
occurrence.assignBucketPosition(position);

// applyCarryForward():
int position = nextBucketPosition(owner, occurrence.getWeekStart().plusDays(7)); // BEFORE mutating (PLANNER-010-AC-07)
occurrence.carryForward();
occurrence.assignBucketPosition(position);
```

`saveScheduledFor(...)` (create, PLANNER-010-AC-03/AC-04) has no such hazard — the occurrence is a
freshly-constructed, not-yet-persisted entity at that point, so no dirty-checking/auto-flush risk
applies:

```java
private PlannedOccurrence saveScheduledFor(Activity activity, SubTask subTask, ActivityCategory category,
        PlannedOccurrenceRequest request, User owner) {
    PlannedOccurrence occurrence = new PlannedOccurrence(activity, subTask, category, request.weekStart(),
        request.dayOfWeek(), request.slot(), owner);
    if (occurrence.isBucketItem()) {
        occurrence.assignBucketPosition(nextBucketPosition(owner, request.weekStart()));
    }
    return plannedOccurrenceRepository.save(occurrence);
}
```

`reorderBucket(...)` (Requirement 3):

```java
@Transactional
public Optional<List<PlannedOccurrence>> reorderBucket(String ownerUsername, BucketReorderRequest request) {
    validateWeekStart(request.weekStart());
    validateNoDuplicateIds(request.occurrenceIds());

    User owner = resolveOwner(ownerUsername);

    List<PlannedOccurrence> submitted = new ArrayList<>();
    for (UUID id : request.occurrenceIds()) {
        Optional<PlannedOccurrence> found = plannedOccurrenceRepository.findByIdAndOwner(id, owner);
        if (found.isEmpty()) {
            return Optional.empty(); // PLANNER-010-AC-11
        }
        submitted.add(found.get());
    }

    boolean allCurrentBucketItemsForWeek = submitted.stream()
        .allMatch(o -> o.isBucketItem() && o.getWeekStart().equals(request.weekStart()));
    if (!allCurrentBucketItemsForWeek) {
        throw new BucketReorderNotAllowedException(
            "Every occurrenceId must currently be a weekend-bucket item for the given weekStart");
    }

    List<PlannedOccurrence> currentBucket = plannedOccurrenceRepository
        .findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc(owner, request.weekStart());
    Set<UUID> currentIds = currentBucket.stream().map(PlannedOccurrence::getId).collect(Collectors.toSet());
    Set<UUID> submittedIds = new HashSet<>(request.occurrenceIds());
    if (!currentIds.equals(submittedIds)) {
        throw new BucketReorderNotAllowedException(
            "occurrenceIds must be exactly the current set of weekend-bucket items for the given weekStart");
    }

    for (int i = 0; i < submitted.size(); i++) {
        submitted.get(i).assignBucketPosition(i); // PLANNER-010-AC-14
    }
    submitted.forEach(PlanService::initializeTarget);
    return Optional.of(submitted);
}

private void validateNoDuplicateIds(List<UUID> occurrenceIds) {
    if (new HashSet<>(occurrenceIds).size() != occurrenceIds.size()) {
        throw new InvalidPlanRequestException("occurrenceIds must not contain duplicates");
    }
}
```

`controller/PlanController.java`:

```java
@PutMapping("/bucket/order")
public ResponseEntity<PlannedOccurrenceListResponse> reorderBucket(
        @Valid @RequestBody BucketReorderRequest request, Authentication authentication) {
    return planService.reorderBucket(authentication.getName(), request)
        .map(occurrences -> {
            List<UUID> ids = occurrences.stream().map(PlannedOccurrence::getId).toList();
            Map<UUID, CompletionRecord> completions = planService.findCompletions(authentication.getName(), ids);
            List<PlannedOccurrenceResponse> data = occurrences.stream()
                .map(occurrence -> toResponse(occurrence, completions.get(occurrence.getId())))
                .toList();
            return ResponseEntity.ok(new PlannedOccurrenceListResponse(data, data.size()));
        })
        .orElseGet(() -> ResponseEntity.notFound().build());
}
```

`toResponse(...)` gains `occurrence.getBucketPosition()` in the constructed `PlannedOccurrenceResponse`.

`dto/BucketReorderRequest.java` (new):

```java
public record BucketReorderRequest(
    @NotNull(message = "weekStart is required") LocalDate weekStart,
    @NotEmpty(message = "occurrenceIds must not be empty") List<UUID> occurrenceIds
) {
}
```

`exception/BucketReorderNotAllowedException.java` (new, mapped `409` in `GlobalExceptionHandler`,
mirroring `CarryForwardNotAllowedException`'s existing handler):

```java
public class BucketReorderNotAllowedException extends RuntimeException {
    public BucketReorderNotAllowedException(String message) {
        super(message);
    }
}
```

```java
@ExceptionHandler(BucketReorderNotAllowedException.class)
public ResponseEntity<ApiError> handleBucketReorderNotAllowedException(BucketReorderNotAllowedException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of(ex.getMessage()));
}
```

`repository/PlannedOccurrenceRepository.java` — two new derived queries:

```java
long countByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNull(User owner, LocalDate weekStart);

List<PlannedOccurrence> findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc(
    User owner, LocalDate weekStart);
```

`db/migration/V007__add_bucket_position_to_planned_occurrences.sql` (new):

```sql
ALTER TABLE planned_occurrences
    ADD COLUMN bucket_position INTEGER;

-- Supports PlanService.nextBucketPosition()'s per-week bucket-item count query, and
-- reorderBucket()'s "current full bucket set" lookup, without a full table scan
-- (PLANNER-010-AC-03/AC-05/AC-07/AC-13/AC-14).
CREATE INDEX idx_planned_occurrences_owner_week_bucket
    ON planned_occurrences(user_id, week_start, bucket_position);
```

## Cross-references

| This spec | Contracts against |
|---|---|
| `PlannedOccurrence.bucketPosition` (`model/`) | New field |
| `PlannedOccurrenceResponse.bucketPosition` (`dto/`) | New field |
| `BucketReorderRequest` (`dto/`, new) | Request body for `PUT /api/v1/plan/bucket/order` |
| `BucketReorderNotAllowedException` (`exception/`, new) | New — `409` for a stale/invalid reorder request |
| `PlanController.reorderBucket(...)` (`controller/`) | New endpoint |
| `PlanService.reorderBucket(...)`, `nextBucketPosition(...)` (`service/`) | New |
| `PlannedOccurrenceRepository` (`repository/`) | Extended — two new derived queries |
| `V007__add_bucket_position_to_planned_occurrences.sql` | New migration |
| `planner_spec_004_week_planning.md` | Base `PlannedOccurrence`/`PlanService`/`PlanController`/`PlannedOccurrenceRepository` this spec extends |
| `planner_spec_006_repeatable_activities.md` | Most recent prior state of `PlanService` this spec extends |
| `planner_spec_011_bucket_carry_forward_automation.md` (sibling, not yet written) | No implementation dependency in either direction, but must apply the identical "reset to null, re-append at the end of the destination week" rule (Requirement 2's carry-forward AC) for its own `weekStart`-mutating code path |
| `frontend_spec_010_bucket_reordering.md` | Paired frontend spec — consumes `bucketPosition` and `PUT /api/v1/plan/bucket/order` exactly as specified here |

## Test case sketches (Spock, red before implementation)

`AC-03/05/06/07/11/12/13/14` depend on real per-week counts and cross-row query behaviour that a
mocked repository can't meaningfully prove (the same reasoning `PlanServiceAutoArchiveIntegrationSpec.groovy`
gives for its own real-Postgres approach) — these run in a new
`PlanServiceBucketReorderIntegrationSpec.groovy`, `@SpringBootTest`, following that spec's
`setup()`/`cleanup()` throwaway-`User` pattern:

```groovy
def "PLANNER-010-AC-03: creating bucket items appends each one at the end of the week's order"() {
    given: "two existing bucket items this week"
        def first = planService.create(owner.username,
            new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()
        def second = planService.create(owner.username,
            new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

    when: "a third bucket item is created"
        def third = planService.create(owner.username,
            new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

    then: "positions are appended in creation order"
        first.bucketPosition == 0
        second.bucketPosition == 1
        third.bucketPosition == 2
}

def "PLANNER-010-AC-06: promoting a bucket item into a grid slot clears its bucketPosition"() {
    given: "a bucket item"
        def created = planService.create(owner.username,
            new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

    when: "it is moved into a grid slot"
        def moved = planService.move(owner.username, created.id,
            new PlannedOccurrenceMoveRequest(DayOfWeek.MONDAY, PlanSlot.MORNING)).get()

    then: "bucketPosition is null"
        moved.bucketPosition == null
}

def "PLANNER-010-AC-07: carrying a bucket item forward resets and re-appends its bucketPosition in the new week"() {
    given: "one bucket item already sitting in next week's bucket, and a bucket item this week to carry forward"
        def nextWeek = monday.plusDays(7)
        planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, nextWeek, null, null))
        def toCarry = planService.create(owner.username,
            new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

    when: "it is carried forward"
        def carried = planService.carryForward(owner.username, toCarry.id).get()

    then: "it lands in next week's bucket, appended after the item already there, not preserving its old position"
        carried.weekStart == nextWeek
        carried.bucketPosition == 1
}

def "PLANNER-010-AC-14: reordering assigns 0..N-1 in the exact submitted order"() {
    given: "three bucket items in creation order"
        def a = planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()
        def b = planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()
        def c = planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

    when: "they are reordered c, a, b"
        def reordered = planService.reorderBucket(owner.username,
            new BucketReorderRequest(monday, [c.id, a.id, b.id])).get()

    then: "positions reflect the submitted order"
        reordered*.id == [c.id, a.id, b.id]
        reordered*.bucketPosition == [0, 1, 2]
}

def "PLANNER-010-AC-11: reordering with an id owned by a different user returns empty (404), applies no change"() {
    given: "a bucket item owned by a different user, and one of the caller's own bucket items"
        def otherOwner = userRepository.save(new User("other-${UUID.randomUUID()}", "hashed-password"))
        def otherActivity = activityRepository.save(new Activity("Other's activity", ActivityCategory.ROUTINE, otherOwner))
        def foreign = planService.create(otherOwner.username,
            new PlannedOccurrenceRequest(otherActivity.id, null, monday, null, null)).get()
        def mine = planService.create(owner.username,
            new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

    when: "the caller submits a reorder including the foreign id"
        def result = planService.reorderBucket(owner.username, new BucketReorderRequest(monday, [foreign.id, mine.id]))

    then: "the result is empty, and the caller's own item is untouched"
        result.isEmpty()
        plannedOccurrenceRepository.findByIdAndOwner(mine.id, owner).get().bucketPosition == 0

    cleanup:
        activityRepository.delete(otherActivity)
        userRepository.delete(otherOwner)
}

def "PLANNER-010-AC-12: reordering an id that is not currently a bucket item throws 409"() {
    given: "a scheduled (non-bucket) occurrence"
        def scheduled = planService.create(owner.username,
            new PlannedOccurrenceRequest(activity.id, null, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()

    when: "a reorder submits its id"
        planService.reorderBucket(owner.username, new BucketReorderRequest(monday, [scheduled.id]))

    then: "BucketReorderNotAllowedException is thrown"
        thrown(BucketReorderNotAllowedException)
}

def "PLANNER-010-AC-13: submitting a partial set of the week's bucket items throws 409"() {
    given: "two bucket items this week"
        def a = planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()
        planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null))

    when: "only one of the two current bucket ids is submitted"
        planService.reorderBucket(owner.username, new BucketReorderRequest(monday, [a.id]))

    then: "BucketReorderNotAllowedException is thrown"
        thrown(BucketReorderNotAllowedException)
}
```

`AC-09`/`AC-10` (request-shape validation) run as ordinary `@WebMvcTest` `PlanControllerSpec`
additions, mocking `PlanService`, since they only exercise validation/HTTP-mapping, not real
per-week counting behaviour:

```groovy
def "PLANNER-010-AC-09: a non-Monday weekStart in a reorder request returns 400"() {
    given: "PlanService rejects a non-Monday weekStart"
        planService.reorderBucket(_, _) >> { throw new InvalidPlanRequestException("weekStart is required and must be a Monday") }

    when: "PUT /api/v1/plan/bucket/order is requested with a Tuesday weekStart"
        def result = mockMvc.perform(put("/api/v1/plan/bucket/order")
            .with(SecurityMockMvcRequestPostProcessors.user("steve"))
            .contentType(MediaType.APPLICATION_JSON)
            .content('{"weekStart":"2026-10-06","occurrenceIds":["' + UUID.randomUUID() + '"]}'))

    then: "the response is 400"
        result.andExpect(status().isBadRequest())
}

def "PLANNER-010-AC-10: an empty occurrenceIds list returns 400 without calling PlanService"() {
    when: "PUT /api/v1/plan/bucket/order is requested with an empty occurrenceIds list"
        def result = mockMvc.perform(put("/api/v1/plan/bucket/order")
            .with(SecurityMockMvcRequestPostProcessors.user("steve"))
            .contentType(MediaType.APPLICATION_JSON)
            .content('{"weekStart":"2026-10-05","occurrenceIds":[]}'))

    then: "the response is 400"
        result.andExpect(status().isBadRequest())
}
```

`PLANNER-010-AC-01`/`AC-02`/`AC-04`/`AC-08`/`AC-15`/`AC-16` (field/endpoint existence and the
response-contract regression guard) are exercised implicitly by the sketches above once the
migration/entity/DTO/controller compile and the endpoint responds — no standalone test needed beyond
compilation and the assertions already made on returned field values above, matching
`planner_spec_008_occurrence_detail_card.md`'s treatment of similarly structural ACs.

**Test Case (Green)**: implement the migration, `PlannedOccurrence`, `PlannedOccurrenceResponse`,
`PlannedOccurrenceRepository`, `PlanService`, `PlanController`, `BucketReorderRequest`, and
`BucketReorderNotAllowedException` as specified above until every sketch above passes.

## Acceptance Criteria Summary

- [x] PLANNER-010-AC-01 — `PlannedOccurrence.bucketPosition` field + migration
- [x] PLANNER-010-AC-02 — `PlannedOccurrenceResponse.bucketPosition` field
- [x] PLANNER-010-AC-03 — `create()` appends a new bucket item at the end
- [x] PLANNER-010-AC-04 — `create()` leaves a grid item's `bucketPosition` null
- [x] PLANNER-010-AC-05 — `move()` demote-to-bucket appends at the end
- [x] PLANNER-010-AC-06 — `move()` promote-to-slot clears `bucketPosition`
- [x] PLANNER-010-AC-07 — `carryForward()` resets and re-appends `bucketPosition` in the new week
- [x] PLANNER-010-AC-08 — `PUT /api/v1/plan/bucket/order` endpoint exists
- [x] PLANNER-010-AC-09 — missing/non-Monday `weekStart` returns 400
- [x] PLANNER-010-AC-10 — empty/duplicate `occurrenceIds` returns 400
- [x] PLANNER-010-AC-11 — any id not found/not owned returns 404, no partial application
- [x] PLANNER-010-AC-12 — any id not currently a bucket item for the week returns 409, no partial application
- [x] PLANNER-010-AC-13 — submitted set not exactly the current bucket returns 409, no partial application
- [x] PLANNER-010-AC-14 — a valid request assigns 0..N-1 in submitted order, in one transaction
- [x] PLANNER-010-AC-15 — success returns 200 with the reordered bucket occurrences
- [x] PLANNER-010-AC-16 — existing `PlannedOccurrenceResponse` fields unchanged (regression guard)
