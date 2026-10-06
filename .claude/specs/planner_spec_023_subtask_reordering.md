# Sub-task Manual Reordering (Backend)

**Status**: Not started
**Priority**: P2 — UX improvement raised directly by the user (2026-10-06), not blocking any
existing V1 flow. Mirrors `planner_spec_010_bucket_reordering.md`'s already-shipped pattern for a
different list.
**Depends on**: `planner_spec_003_sub_tasks.md` (`SubTask` entity, `SubTaskRepository`,
`SubTaskService`, `SubTaskController`, `SubTaskRequest`/`SubTaskResponse`/`SubTaskListResponse` —
this spec amends that spec's `PLANNER-003-AC-07`, see Amendment section below),
`planner_spec_014_subtask_category_cascade.md` (most recent prior state of `SubTask`/
`SubTaskService` this spec extends), `planner_spec_010_bucket_reordering.md` (the reorder pattern
this spec mirrors — full-list-replacement request shape, sequential-integer position scheme,
404/409 semantics), `planner_spec_019_bucket_reorder_query_scaling.md` (confirms why this spec does
*not* need an equivalent follow-up — see Requirement 3's note)
**Area**: Backend
**Roadmap version**: V1 (extends Activity management / sub-tasks from `product.md`'s V1 row —
`planner_spec_003_sub_tasks.md`'s original scope explicitly deferred "manual reordering of
sub-tasks" as out of scope at the time; this spec now delivers it)

## Overview

Sub-tasks under an activity currently have no persisted manual order — `GET
/api/v1/activities/{activityId}/sub-tasks` always returns them in `createdAt` ascending order
(`PLANNER-003-AC-07`), with no way for a user to rearrange that order. This spec adds a persisted
`position` field to `SubTask` and a new endpoint to submit a reordered list, so the paired frontend
spec (`frontend_spec_047_subtask_reordering.md`) can offer Move up/Move down controls on the
Activities page. This directly mirrors the already-shipped weekend bucket list reordering
(`planner_spec_010_bucket_reordering.md`) — same full-list-replacement request shape, same
sequential-integer position scheme (`0..N-1`, renumbered wholesale on every reorder, for the same
reason that spec gives: small lists, every mutation already touches the database once regardless of
scheme) — with two deliberate simplifications specific to sub-tasks:

1. **No separate "wrong state" 409 case.** The bucket precedent needs two distinct 409 checks
   because its bulk fetch (`findByIdInAndOwner`) is owner-scoped only — it can't tell at the query
   level whether a found occurrence is a *bucket* item or a *grid* item for the *requested week*.
   A `SubTask`'s parent `activityId` is a real, permanent foreign key, so this spec's bulk fetch is
   scoped by `id IN (...) AND activityId = :activityId AND owner = :owner` — an id belonging to a
   different activity (or a different owner) simply isn't found, collapsing into the same `404` as
   any other not-found/not-yours case. Only the set-mismatch `409` (stale/partial submission) case
   remains.
2. **`position` is always `NOT NULL`, never left `null`.** `bucketPosition` stays permanently
   nullable because it only applies to a subset of `PlannedOccurrence` rows (bucket items vs.
   grid-scheduled items coexist forever on that entity). Every `SubTask` row, by contrast, always
   belongs to exactly one activity and always needs a position — there's no "doesn't apply" state —
   so existing rows are backfilled and the column is made `NOT NULL` (Requirement 1).

**Out of scope**: drag-and-drop. The paired frontend spec deliberately offers Move up/Move down
buttons only, not drag-and-drop — see that spec's Overview for why (avoids reproducing the weekend
bucket list's known, still-open touch-support gap, tracked in `.claude/SPEC_CANDIDATES.md`). This
has no backend consequence — the reorder endpoint below is agnostic to how the client decided on
the submitted order. Also out of scope: any change to `ActivityPickerList.tsx` (the Activity Drawer
/ Assign Activity modal) — it will passively inherit the new `position` ordering once this ships
(it already consumes `GET /api/v1/sub-tasks`), but gets no reorder UI of its own; see the paired
frontend spec's Overview for this noted as an accepted side-effect, not a missed requirement.

## Requirements

### Requirement 1 — `SubTask` carries a persisted manual position

As a user, I want the order I arrange a checklist of sub-tasks into to actually be remembered, not
reset to creation order every time I reload the page.

### PLANNER-023-AC-01 [AUTO]: `SubTask` declares a persisted, non-null `position`
**Statement**: The `SubTask` entity shall declare a new `position` field of type `int`
(`NOT NULL`), persisted via a new Flyway migration (`V011__add_position_to_sub_tasks.sql`) that adds
a `position INTEGER` column to `sub_tasks`, backfills every existing row's `position` per-activity
by its current `createdAt` ascending order (0-indexed), then alters the column to `NOT NULL`, and
adds a composite index `(activity_id, position)`.

**Rationale**: Every sub-task always belongs to exactly one activity and always needs a position —
unlike `bucketPosition` on `PlannedOccurrence` (permanently nullable, applies to a subset of rows
only), there is no "doesn't apply" state here, so backfill-then-`NOT NULL` is correct from the
start rather than leaving legacy rows `null`.

**References**:
- Type: `model/SubTask.java` — new `position` field, `assignPosition(int)` mutator (same
  "set field + touch `updatedAt`" shape as the existing `rename()`/`recategorize()`), `getPosition()`.
- Migration: `backend/src/main/resources/db/migration/V011__add_position_to_sub_tasks.sql` (next
  number after `V010__add_notes_to_planned_occurrences.sql`, the highest existing at the time this
  spec was written).
- Related: `PLANNER-010-AC-01` (the `bucketPosition` precedent this AC mirrors, with the nullability
  divergence noted above).

**Test Case (Red)**:
```groovy
def "PLANNER-023-AC-01: existing sub-tasks are backfilled a contiguous position per activity, ordered by createdAt"() {
    given: "three sub-tasks created in a known order, as they existed before this migration"
        def first = subTaskRepository.save(new SubTask(activity, "First", ActivityCategory.PLEASURABLE, owner))
        def second = subTaskRepository.save(new SubTask(activity, "Second", ActivityCategory.PLEASURABLE, owner))
        def third = subTaskRepository.save(new SubTask(activity, "Third", ActivityCategory.PLEASURABLE, owner))

    expect: "positions reflect creation order, 0-indexed, after the backfill migration has run"
        subTaskRepository.findById(first.id).get().position == 0
        subTaskRepository.findById(second.id).get().position == 1
        subTaskRepository.findById(third.id).get().position == 2
}
```

**Test Case (Green)**: implement the migration and entity as specified above.

### PLANNER-023-AC-02 [AUTO]: `SubTaskResponse` exposes `position`
**Statement**: The `SubTaskResponse` record shall declare a new `position` field of type `int`,
exposing the entity's value as-is.

**Rationale**: Mirrors `PlannedOccurrenceResponse.bucketPosition` being exposed to the client — even
though list order already encodes it, a client that diffs/caches by field benefits from an explicit
value. Non-nullable here (unlike `bucketPosition`), matching AC-01's note.

**References**: `dto/SubTaskResponse.java`; `SubTaskController.toResponse(...)` (existing helper,
extended to pass `subTask.getPosition()`).

**Test Case (Green)**: exercised implicitly by every other test sketch below asserting on response
JSON — no standalone test needed beyond compilation, matching this spec's own treatment of purely
structural ACs elsewhere.

### Requirement 2 — List order, append-at-end on create, renumbering on delete

As a user, I want my sub-task checklist to always show my own arranged order — including right
after I add a new item (it should land at the end, not jump into the middle) or remove one (the
remaining items should stay in a clean, gap-free order).

### PLANNER-023-AC-03 [AUTO]: Listing a sub-task checklist is ordered by `position`, not `createdAt`
**Statement**: When `GET /api/v1/activities/{activityId}/sub-tasks` is requested, the
`SubTaskController` shall return the parent activity's sub-tasks ordered by `position` ascending.

**Amends `planner_spec_003_sub_tasks.md`'s `PLANNER-003-AC-07`** (see Amendment section below) —
its statement text is updated in place (ID unchanged, per `.claude/steering/ears_format.md`'s
immutable-reference-ID rule) to point here, since "ordered by `createdAt` ascending" is no longer
true of the shipped system once this spec lands.

**References**:
- `repository/SubTaskRepository.java` — `findByActivityIdAndOwnerOrderByCreatedAtAsc` renamed to
  `findByActivityIdAndOwnerOrderByPositionAsc`. Three call sites update mechanically (ordering is
  irrelevant to the other two — they only need the full set): `SubTaskService.listForActivity`
  (this AC), `PlanService.maybeAutoArchive` (checks every sub-task has a completed occurrence — set
  membership only), `ActivityService.cascadeCategoryToSubTasks` (`planner_spec_014`'s cascade —
  updates every sub-task's category regardless of order). Corresponding mocked-repository test
  stubs in `ActivityServiceSpec.groovy` and `PlanServiceSpec.groovy` are updated to stub the renamed
  method.

**Test Case (Red)**:
```groovy
def "PLANNER-023-AC-03: listing returns sub-tasks ordered by position, not creation order"() {
    given: "two sub-tasks created in order, then reordered so the second-created is now first"
        def firstCreated = subTaskRepository.save(new SubTask(activity, "Created first", ActivityCategory.PLEASURABLE, owner))
        def secondCreated = subTaskRepository.save(new SubTask(activity, "Created second", ActivityCategory.PLEASURABLE, owner))
        subTaskService.reorder(owner.username, activity.id,
            new SubTaskReorderRequest([secondCreated.id, firstCreated.id]))

    when: "the checklist is listed"
        def listed = subTaskService.listForActivity(owner.username, activity.id).get()

    then: "the list reflects the reordered position, not creation order"
        listed*.id == [secondCreated.id, firstCreated.id]
}
```

**Test Case (Green)**: rename the repository method and update its call sites as described above.

### PLANNER-023-AC-04 [AUTO]: A newly-created sub-task is appended at the end of the checklist
**Statement**: When `POST /api/v1/activities/{activityId}/sub-tasks` creates a new sub-task, the
`SubTaskService` shall assign it a `position` equal to the current count of that activity's
sub-tasks — appended at the end, never into the middle of the existing order.

**Rationale**: A newly-added item should land where a user would expect, at the end — mirrors
`PLANNER-010-AC-03`'s identical append-at-end rule for bucket items.

**References**: `service/SubTaskService.java#create` — computes
`subTaskRepository.countByActivityIdAndOwner(activityId, owner)` (existing method, reused, no new
repository method needed) and passes it as the new `position` constructor argument, before saving.

**Test Case (Red)**:
```groovy
def "PLANNER-023-AC-04: creating sub-tasks appends each one at the end of the checklist"() {
    given: "no existing sub-tasks for this activity"
        // activity has zero sub-tasks

    when: "two sub-tasks are created in sequence"
        def first = subTaskService.create(owner.username, activity.id, new SubTaskRequest("First")).get()
        def second = subTaskService.create(owner.username, activity.id, new SubTaskRequest("Second")).get()

    then: "positions are appended in creation order"
        first.position == 0
        second.position == 1
}
```

**Test Case (Green)**: implement `create()` as described in References.

### PLANNER-023-AC-05 [AUTO]: Deleting a sub-task renumbers the remaining checklist to stay contiguous
**Statement**: When `DELETE /api/v1/activities/{activityId}/sub-tasks/{id}` deletes a sub-task, the
`SubTaskService` shall renumber the activity's remaining sub-tasks' `position` values to `0..N-1`,
preserving their existing relative order.

**Rationale**: A deliberate correctness improvement over the bucket-list precedent, which never
renumbers siblings after a delete, leaving a gap and a latent hazard: a `COUNT`-based "next position"
can later collide with a surviving sibling's untouched position after a mid-list deletion. Sub-task
checklists are small (single digits, typically), so renumbering on every delete is cheap and keeps
the "`countByActivityIdAndOwner` = next append position" invariant (`PLANNER-023-AC-04`) always
correct with no edge case to reason about.

**References**: `service/SubTaskService.java#delete` — after `subTaskRepository.delete(subTask)`,
re-fetch the activity's remaining sub-tasks via
`findByActivityIdAndOwnerOrderByPositionAsc(activityId, owner)` and call `assignPosition(i)` for
each at its new index `i`.

**Test Case (Red)**:
```groovy
def "PLANNER-023-AC-05: deleting a middle sub-task renumbers the remaining checklist contiguously"() {
    given: "three sub-tasks in order"
        def a = subTaskService.create(owner.username, activity.id, new SubTaskRequest("A")).get()
        def b = subTaskService.create(owner.username, activity.id, new SubTaskRequest("B")).get()
        def c = subTaskService.create(owner.username, activity.id, new SubTaskRequest("C")).get()

    when: "the middle sub-task is deleted"
        subTaskService.delete(owner.username, activity.id, b.id)

    then: "the remaining two are renumbered 0 and 1, preserving their relative order"
        def remaining = subTaskService.listForActivity(owner.username, activity.id).get()
        remaining*.id == [a.id, c.id]
        remaining*.position == [0, 1]
}
```

**Test Case (Green)**: implement the renumbering as described in References.

### Requirement 3 — Submit a full new sub-task order in one request

As a user, once I've arranged my checklist into the order I want via Move up/Move down, I want that
whole new order saved in one action.

### PLANNER-023-AC-06 [AUTO]: A new endpoint accepts the complete desired sub-task order
**Statement**: The `SubTaskController` shall expose `PUT
/api/v1/activities/{activityId}/sub-tasks/order`, accepting a `SubTaskReorderRequest` body
(`subTaskIds` — the complete desired order as a list of sub-task ids).

**Rationale**: A full-list-replacement call, not a "move this one item to position N" call — same
rationale as `PLANNER-010-AC-08`: the client already knows the full desired final order the moment
a Move up/down interaction completes.

**References**: `dto/SubTaskReorderRequest.java` (new record, `@NotEmpty List<UUID> subTaskIds` —
no `weekStart`-equivalent field needed, since `activityId` is already a path variable on this
nested resource, unlike the bucket endpoint's flat, non-nested path).

**Test Case (Green)**: exercised by the sketches below, once the endpoint exists and routes
correctly.

### PLANNER-023-AC-07 [AUTO]: An empty `subTaskIds` list returns 400
**Statement**: If `PUT .../sub-tasks/order` is requested with an empty `subTaskIds` list, then the
request shall be rejected with `400` (bean validation), applying no change.

**References**: `SubTaskReorderRequest.subTaskIds`'s `@NotEmpty` constraint.

**Test Case (Red)** (`@WebMvcTest`, mocked `SubTaskService` — request-shape validation only):
```groovy
def "PLANNER-023-AC-07: an empty subTaskIds list returns 400 without calling SubTaskService"() {
    when: "PUT .../sub-tasks/order is requested with an empty subTaskIds list"
        def result = mockMvc.perform(put("/api/v1/activities/${activityId}/sub-tasks/order")
            .with(SecurityMockMvcRequestPostProcessors.user("steve"))
            .contentType(MediaType.APPLICATION_JSON)
            .content('{"subTaskIds":[]}'))

    then: "the response is 400"
        result.andExpect(status().isBadRequest())
}
```

**Test Case (Green)**: bean validation alone satisfies this once the request body is wired up.

### PLANNER-023-AC-08 [AUTO]: A duplicate id in `subTaskIds` returns 400
**Statement**: If `subTaskIds` contains a duplicate id, then the `SubTaskService` shall throw
`InvalidSubTaskRequestException` (`400`), applying no change.

**References**: `exception/InvalidSubTaskRequestException.java` (new), registered in
`GlobalExceptionHandler` alongside the existing handlers. Mirrors `PLANNER-010-AC-10`'s duplicate-id
check, but as its own sub-task-domain exception rather than reusing `InvalidPlanRequestException`
(that class is explicitly plan-domain — see its own Javadoc).

**Test Case (Red)**:
```groovy
def "PLANNER-023-AC-08: a duplicate id in subTaskIds throws InvalidSubTaskRequestException"() {
    given: "one existing sub-task"
        def a = subTaskService.create(owner.username, activity.id, new SubTaskRequest("A")).get()

    when: "a reorder submits its id twice"
        subTaskService.reorder(owner.username, activity.id, new SubTaskReorderRequest([a.id, a.id]))

    then: "InvalidSubTaskRequestException is thrown"
        thrown(InvalidSubTaskRequestException)
}
```

**Test Case (Green)**: validate for duplicates (e.g. via a `Set` size comparison) before any
repository access.

### PLANNER-023-AC-09 [AUTO]: An id not found, not owned, or belonging to a different activity returns 404
**Statement**: If any submitted id does not resolve to a `SubTask` owned by the authenticated user
under the requested `activityId`, then the `SubTaskController` shall return `404` for the whole
request, applying no change to any sub-task.

**Rationale**: Scoping the bulk fetch by `activityId` at the query level (not just by owner) means
"belongs to a different activity" and "not found"/"not yours" collapse into the same `404` —
structurally simpler than the bucket precedent's separate found-but-wrong-state `409` case (see
Overview).

**References**: `repository/SubTaskRepository.java` — new
`findByIdInAndActivityIdAndOwner(Collection<UUID> ids, UUID activityId, User owner)`.

**Test Case (Red)** (real Postgres — cross-activity/cross-owner behavior isn't provable against a
mock):
```groovy
def "PLANNER-023-AC-09: reordering with an id belonging to a different activity returns empty (404), applies no change"() {
    given: "a sub-task under a different activity owned by the same user, and one of this activity's own sub-tasks"
        def otherActivity = activityRepository.save(new Activity("Other activity", ActivityCategory.ROUTINE, null, owner))
        def foreign = subTaskService.create(owner.username, otherActivity.id, new SubTaskRequest("Foreign")).get()
        def mine = subTaskService.create(owner.username, activity.id, new SubTaskRequest("Mine")).get()

    when: "a reorder is submitted against activity.id including the foreign id"
        def result = subTaskService.reorder(owner.username, activity.id,
            new SubTaskReorderRequest([foreign.id, mine.id]))

    then: "the result is empty, and this activity's own sub-task is untouched"
        result.isEmpty()
        subTaskRepository.findById(mine.id).get().position == 0
}
```

**Test Case (Green)**: implement the activity-scoped bulk fetch and the empty-`Optional` 404 path.

### PLANNER-023-AC-10 [AUTO]: A partial or stale `subTaskIds` submission returns 409
**Statement**: If the submitted `subTaskIds` set does not exactly match the full current set of
sub-task ids for the activity (missing one that currently exists, or including one that doesn't),
then the `SubTaskService` shall throw `SubTaskReorderNotAllowedException` (`409`), applying no
change to any sub-task.

**Rationale**: Mirrors `PLANNER-010-AC-13` exactly — a mismatch means the client's view is stale
(e.g. a sub-task was added or deleted by a concurrent request/tab since the client last fetched),
so the whole submission is rejected rather than silently applying a partial/inconsistent reorder.

**References**: `exception/SubTaskReorderNotAllowedException.java` (new, `409` via
`GlobalExceptionHandler`, mirroring `BucketReorderNotAllowedException`'s existing handler).

**Test Case (Red)**:
```groovy
def "PLANNER-023-AC-10: submitting a partial set of the checklist's sub-tasks throws 409"() {
    given: "two sub-tasks"
        def a = subTaskService.create(owner.username, activity.id, new SubTaskRequest("A")).get()
        subTaskService.create(owner.username, activity.id, new SubTaskRequest("B"))

    when: "only one of the two current ids is submitted"
        subTaskService.reorder(owner.username, activity.id, new SubTaskReorderRequest([a.id]))

    then: "SubTaskReorderNotAllowedException is thrown"
        thrown(SubTaskReorderNotAllowedException)
}
```

**Test Case (Green)**: compare the submitted id set against the activity's current full id set
before assigning any positions.

### PLANNER-023-AC-11 [AUTO]: A fully valid request assigns positions in the exact submitted order
**Statement**: Given a fully valid request, the `SubTaskService` shall assign `position` values `0`
through `N-1` to the `N` submitted sub-tasks, in the exact order submitted, inside one transaction.

**References**: `service/SubTaskService.java#reorder` (new method).

**Test Case (Red)**:
```groovy
def "PLANNER-023-AC-11: reordering assigns 0..N-1 in the exact submitted order"() {
    given: "three sub-tasks in creation order"
        def a = subTaskService.create(owner.username, activity.id, new SubTaskRequest("A")).get()
        def b = subTaskService.create(owner.username, activity.id, new SubTaskRequest("B")).get()
        def c = subTaskService.create(owner.username, activity.id, new SubTaskRequest("C")).get()

    when: "they are reordered c, a, b"
        def reordered = subTaskService.reorder(owner.username, activity.id,
            new SubTaskReorderRequest([c.id, a.id, b.id])).get()

    then: "positions reflect the submitted order"
        reordered*.id == [c.id, a.id, b.id]
        reordered*.position == [0, 1, 2]
}
```

**Test Case (Green)**: implement `reorder()` as described across AC-08/09/10/11.

### PLANNER-023-AC-12 [AUTO]: A successful reorder returns the reordered checklist
**Statement**: On success, the `SubTaskController` shall return `200` with `{ "data": [...], "count":
N }`, the reordered sub-tasks in their new order.

**References**: `SubTaskController.reorder(...)` reuses the existing `toListResponse(...)` helper.

**Test Case (Green)**: exercised implicitly by `PLANNER-023-AC-11`'s sketch once routed through the
controller — no standalone test needed beyond the response-shape assertion already made there.

**Note on query scaling**: unlike `planner_spec_010_bucket_reordering.md`, which needed a follow-up
spec (`planner_spec_019_bucket_reorder_query_scaling.md`) to replace a per-submitted-id lookup loop
with a bulk query, this spec's `reorder()` uses the bulk `findByIdInAndActivityIdAndOwner` query from
the start (`PLANNER-023-AC-09`) — no equivalent follow-up is anticipated.

### Requirement 4 — No regression to the existing response contract

As a user, I want my existing sub-task checklist behaviour to keep working exactly as before, with
this one field simply added alongside it.

### PLANNER-023-AC-13 [AUTO]: Existing `SubTaskResponse` fields are unchanged
**Statement**: The existing `SubTaskResponse` fields (`id`, `activityId`, `name`, `category`,
`createdAt`) shall remain unchanged in shape and value for every sub-task — `position` is a pure
addition, not a restructuring, of `planner_spec_003_sub_tasks.md`'s existing contract.

**Test Case (Green)**: exercised implicitly by every sketch above asserting on response JSON — no
standalone test needed beyond compilation, matching `PLANNER-010-AC-16`'s equivalent treatment.

## Amendment to `planner_spec_003_sub_tasks.md`

`PLANNER-003-AC-07`'s statement ("...ordered by `createdAt` ascending") is updated in place (ID
unchanged, per `.claude/steering/ears_format.md`'s immutable-reference-ID rule) to read "...ordered
by `position` ascending — see `planner_spec_023_subtask_reordering.md`'s `PLANNER-023-AC-03`",
since this is no longer true of the shipped system once this spec lands. This is an amendment, not a
supersession in the `PLANNER-003-AC-20`/`PLANNER-014-AC-01` sense — the envelope shape, 404 scoping,
and every other part of `PLANNER-003-AC-07` are unaffected; only the ordering criterion changes.
`planner_spec_003_sub_tasks.md`'s Acceptance Criteria Summary line for `AC-07` gets a pointer to this
spec, matching the precedent `PLANNER-014-AC-01`'s amendment set for `PLANNER-003-AC-20`.

## Cross-references

| This spec | Contracts against |
|---|---|
| `SubTask.position` (`model/`) | New field |
| `SubTaskResponse.position` (`dto/`) | New field |
| `SubTaskReorderRequest` (`dto/`, new) | Request body for `PUT .../sub-tasks/order` |
| `InvalidSubTaskRequestException` (`exception/`, new) | New — `400` for a duplicate id in a reorder request |
| `SubTaskReorderNotAllowedException` (`exception/`, new) | New — `409` for a stale/partial reorder request |
| `SubTaskController.reorder(...)` (`controller/`) | New endpoint |
| `SubTaskService.reorder(...)` (`service/`); `create()`/`delete()` extended | New / modified |
| `SubTaskRepository` (`repository/`) | `findByActivityIdAndOwnerOrderByCreatedAtAsc` renamed to `...OrderByPositionAsc`; new `findByIdInAndActivityIdAndOwner` |
| `V011__add_position_to_sub_tasks.sql` | New migration |
| `planner_spec_003_sub_tasks.md` | `PLANNER-003-AC-07` amended in place (see Amendment section) |
| `planner_spec_014_subtask_category_cascade.md` | Most recent prior state of `SubTask`/`SubTaskService` this spec extends |
| `planner_spec_010_bucket_reordering.md` | Pattern precedent this spec mirrors (full-list-replacement request, sequential position scheme, 404/409 semantics) |
| `planner_spec_019_bucket_reorder_query_scaling.md` | Confirms no equivalent N+1 follow-up is needed here (see note under `PLANNER-023-AC-12`) |
| `PlanService.maybeAutoArchive`, `ActivityService.cascadeCategoryToSubTasks` | Unaffected call sites of the renamed repository method (order-irrelevant to both) |
| `frontend_spec_047_subtask_reordering.md` | Paired frontend spec — consumes `position` and `PUT .../sub-tasks/order` exactly as specified here |

## Test case sketches (Spock, red before implementation)

`AC-01`/`AC-04`/`AC-05`/`AC-09`/`AC-10`/`AC-11` depend on real per-activity counts and cross-row
query/migration behaviour that a mocked repository can't meaningfully prove — these run in a new
`SubTaskServiceReorderIntegrationSpec.groovy` (`@SpringBootTest`, real Postgres), mirroring
`PlanServiceBucketReorderIntegrationSpec.groovy`'s throwaway-`User` setup/cleanup pattern. Sketches
for each are given inline under their own AC above. `AC-03` and `AC-08` sketches are also given
inline above and run in the same integration spec (set membership and duplicate-id validation are
simple enough not to need a dedicated real-Postgres case, but colocating them in the same spec file
avoids a third test class for this feature).

`AC-07` (empty-list bean validation) runs as an ordinary `@WebMvcTest` `SubTaskControllerSpec`
addition, mocking `SubTaskService` (sketch given inline above) — it only exercises request-shape
validation, not real per-activity behaviour.

`AC-02`/`AC-06`/`AC-12`/`AC-13` (field/endpoint existence and the response-contract regression
guard) are exercised implicitly by the sketches above once the migration/entity/DTO/controller
compile and the endpoint responds — no standalone test needed beyond compilation and the assertions
already made on returned field values, matching `planner_spec_010_bucket_reordering.md`'s identical
treatment of its own structural ACs.

**Test Case (Green)**: implement the migration, `SubTask`, `SubTaskResponse`, `SubTaskRepository`,
`SubTaskService`, `SubTaskController`, `SubTaskReorderRequest`, `InvalidSubTaskRequestException`,
and `SubTaskReorderNotAllowedException` as specified above until every sketch above passes.

## Acceptance Criteria Summary

- [ ] PLANNER-023-AC-01 — `SubTask.position` field + backfilling migration + index
- [ ] PLANNER-023-AC-02 — `SubTaskResponse.position` field
- [ ] PLANNER-023-AC-03 — listing is ordered by `position`, amending `PLANNER-003-AC-07`
- [ ] PLANNER-023-AC-04 — `create()` appends a new sub-task at the end
- [ ] PLANNER-023-AC-05 — `delete()` renumbers the remaining checklist contiguously
- [ ] PLANNER-023-AC-06 — `PUT .../sub-tasks/order` endpoint exists
- [ ] PLANNER-023-AC-07 — empty `subTaskIds` returns 400
- [ ] PLANNER-023-AC-08 — duplicate id in `subTaskIds` returns 400
- [ ] PLANNER-023-AC-09 — any id not found/not owned/wrong-activity returns 404, no partial application
- [ ] PLANNER-023-AC-10 — submitted set not exactly the current checklist returns 409, no partial application
- [ ] PLANNER-023-AC-11 — a valid request assigns 0..N-1 in submitted order, in one transaction
- [ ] PLANNER-023-AC-12 — success returns 200 with the reordered checklist
- [ ] PLANNER-023-AC-13 — existing `SubTaskResponse` fields unchanged (regression guard)
