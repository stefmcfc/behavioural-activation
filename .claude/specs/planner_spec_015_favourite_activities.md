# Favourite Activities (Backend)

**Status**: Implemented (2026-10-02) — all 12 ACs green. `Activity` gains a `favourite` field
(entity, migration `V008`, repository ordering, DTO, controller/service endpoints), mirroring the
`archived` flag pattern exactly as planned — no deviations from the spec's design. New
`markFavourite()`/`unmarkFavourite()` entity methods (idempotent, bump `updatedAt`, structurally
independent of `archive()`/`unarchive()`), new `ActivityService.markFavourite`/`unmarkFavourite`
(owner-scoped via the existing `findByIdAndOwner`), new `POST`/`DELETE /api/v1/activities/{id}
/favourite` controller endpoints mirroring the archive/unarchive pair including the `subTaskCount`
enrichment on the `POST` response. `ActivityRepository`'s two list methods renamed to
`findByOwnerOrderByFavouriteDescNameAsc`/`findByOwnerAndArchivedFalseOrderByFavouriteDescNameAsc` —
confirmed against real Postgres (not just the mocked `ActivityServiceSpec`) in a new
`ActivityServiceFavouriteOrderingIntegrationSpec`, since derived-query ordering correctness isn't
something a mocked repository can verify. `ActivityRequest` left untouched, confirmed by an explicit
`declaredFields` assertion in `ActivityControllerSpec` (AC-01/AC-02/AC-12). Orthogonality (AC-09)
covered by dedicated tests at both the model (`ActivitySpec`) and service (`ActivityServiceSpec`)
layers, each direction. Tests: `ActivitySpec` (+9 new cases, 17 total), `ActivityServiceSpec` (+6 new
cases, 29 total), `ActivityControllerSpec` (+11 new cases, 41 total), new
`ActivityServiceFavouriteOrderingIntegrationSpec` (2 cases, real Postgres via Docker Compose). Full
suite: 266 tests, 0 failures (`gradlew.bat test` against real Postgres via Docker Compose). No real
findings/surprises during implementation — the `archived` precedent carried over directly with no
adaptation needed beyond the field/method renames.
**Priority**: P3 — quality-of-life speed-up for finding commonly-used activities, no new domain
capability
**Depends on**: `planner_spec_002_activity_bank.md` (the `Activity` entity/endpoints this extends),
`planner_spec_006_repeatable_activities.md` (the `archived` flag pattern this mirrors exactly —
migration shape, dedicated mark/unmark endpoints, update-path immutability)
**Area**: Backend
**Roadmap version**: V2-ish polish — not tied to a specific `HIGH_LEVEL_DESIGN.md` version theme

## Overview

This specs out the "favourite activities" aside mentioned in `.claude/ideas/future_ideas.md`'s
"Drag-and-drop in the week planner: assign an unplanned activity via a sidebar/drawer" entry, split
off into its own narrower feature. That entry raised favourites only as "a possible new concept... to
make common repeatable activities faster to find/drag from such a panel — genuinely new scope beyond
drag-and-drop itself, not assumed necessary, just noted as a plausible pairing if this gets built."
The user has now confirmed favourites are worth building as their own thing, independent of the
sidebar/drawer drag feature — **the sidebar/drawer itself remains a separate, still-unspecced idea**
in `future_ideas.md`; this spec does not implement it, only a building block useful to it later.

**Scope, exactly as confirmed by the user**:
1. "Favourite" is a manual, user-toggled flag (like a star) — not an auto-computed "most used"
   ranking based on planning/completion frequency. No usage-frequency tracking or aggregation is
   part of this spec.
2. Favouriting applies to top-level `Activity` rows only, never `SubTask`. A sub-task can never be
   individually favourited, regardless of its parent activity's favourite status.
3. Favourited activities are pinned to the top of `GET /api/v1/activities` (their own group,
   alphabetical within the group), with non-favourites following in the existing alphabetical order.
   This is always-on reordering, not an opt-in filter.

**Architecture: mirrors the existing `archived` flag pattern exactly**, not a new design — `Activity`
already has one precedent boolean lifecycle flag (`archived`, `planner_spec_006_repeatable_activities.md`)
with its own dedicated idempotent mark/unmark endpoints, deliberately kept out of the general
create/update request body so an edit can never accidentally flip it. `favourite` follows the
identical shape: its own migration column, its own `markFavourite()`/`unmarkFavourite()` entity
methods, its own `POST`/`DELETE .../favourite` endpoint pair, and `ActivityRequest` is left
completely untouched. The two flags are fully orthogonal — archiving/unarchiving never touches
`favourite`, and marking/unmarking favourite never touches `archived` (Requirement 3).

**Why ordering needs no custom `@Query`**: Spring Data's derived-query-method naming already expresses
"favourite group first, alphabetical within each group" directly — `ORDER BY favourite DESC, name ASC`
sorts `true` before `false` for a boolean column in descending order, then alphabetically within each
group. Renaming the two existing repository methods to include `FavouriteDesc` in their derived name
is the entire ordering change; no `@Query`, no application-level sort.

## Requirement 1: An Activity carries a favourite flag, defaulting to false, never settable via create/update

**User story**: As a user, I want my activities to start out not-favourited and only become
favourited through an explicit action, so editing an activity's name or category never accidentally
changes its favourite status.

### PLANNER-015-AC-01 [AUTO]: New activities default to not favourited
**Statement**: When `POST /api/v1/activities` creates a new `Activity`, the `ActivityService` shall
set its `favourite` field to `false`, regardless of request body content (the request body has no
`favourite` field at all).

**Rationale**: Matches `archived`'s existing create-time default and the general principle that
lifecycle flags are never client-settable at creation.

**References**:
- Entity: `Activity` (backend `model/`), two-argument and four-argument constructors
- DTO: `ActivityRequest` (no `favourite` field)

### PLANNER-015-AC-02 [AUTO]: Updating an activity leaves its favourite status unchanged
**Statement**: When `PUT /api/v1/activities/{id}` is requested for an activity that is currently
favourited, the `ActivityService` shall leave `favourite` as `true` in the updated entity, regardless
of the request body — and symmetrically, a currently-not-favourited activity shall remain `false`
after an update.

**Rationale**: `ActivityRequest` carries no `favourite` field, so there is nothing for `update(...)`
to even read — this AC pins down that `favourite` survives an update untouched, mirroring
`archived`'s identical immutability through the same code path.

**References**:
- Entity: `Activity.update(String, ActivityCategory, String, boolean)` (unchanged signature —
  `favourite` is not a parameter)
- Service: `ActivityService.update(String, UUID, ActivityRequest)`

## Requirement 2: Dedicated mark/unmark-favourite endpoints, mirroring the existing archive/unarchive pattern

**User story**: As a user, I want a single, always-available action to mark or unmark an activity as
a favourite, so I can quickly pin the ones I plan with often without going through the edit form.

### PLANNER-015-AC-03 [AUTO]: Marking an activity favourite
**Statement**: When `POST /api/v1/activities/{id}/favourite` is requested for an activity owned by
the authenticated user, the `ActivityController` shall set `favourite: true` and return `200` with
the updated `ActivityResponse` (including its current `subTaskCount`, via the same
`countSubTasks` call the existing archive endpoint already uses).

**Rationale**: Mirrors `POST /api/v1/activities/{id}/archive` exactly — same status code, same
owner-scoped lookup, same `subTaskCount` enrichment.

**References**:
- Controller: `ActivityController.archive(UUID, Authentication)` (the method this new endpoint
  mirrors)
- Service: `ActivityService.archive(String, UUID)` (the method `markFavourite` mirrors)
- Entity: `Activity.markFavourite()` (new, mirrors `archive()`)

### PLANNER-015-AC-04 [AUTO]: Marking an already-favourited activity is idempotent
**Statement**: When `POST /api/v1/activities/{id}/favourite` is requested for an activity that is
already favourited, the `ActivityController` shall return `200` with `favourite: true` unchanged —
not an error.

**Rationale**: Matches `archive`'s existing idempotent-success behavior for an already-archived
activity.

**References**: Entity: `Activity.markFavourite()` (no-op if already `true`, still bumps `updatedAt`
— matches `archive()`'s own documented idempotency)

### PLANNER-015-AC-05 [AUTO]: Marking favourite on an activity not owned by the caller is a 404
**Statement**: When `POST /api/v1/activities/{id}/favourite` is requested for an `id` that doesn't
exist or belongs to a different owner, the `ActivityController` shall return `404` without creating
or modifying any row.

**References**: Service: `ActivityService.markFavourite(String, UUID)` — returns `Optional.empty()`
via the same `findByIdAndOwner` owner-scoping every other activity endpoint already uses (never
distinguishing "doesn't exist" from "not yours", per the existing `PLANNER-002-AC-18` convention).

### PLANNER-015-AC-06 [AUTO]: Unmarking an activity as favourite
**Statement**: When `DELETE /api/v1/activities/{id}/favourite` is requested for an activity owned by
the authenticated user, the `ActivityController` shall set `favourite: false` and return `204`.

**Rationale**: Mirrors `DELETE /api/v1/activities/{id}/archive` exactly.

**References**:
- Controller: `ActivityController.unarchive(UUID, Authentication)` (the method this new endpoint
  mirrors)
- Service: `ActivityService.unarchive(String, UUID)` (the method `unmarkFavourite` mirrors)
- Entity: `Activity.unmarkFavourite()` (new, mirrors `unarchive()`)

### PLANNER-015-AC-07 [AUTO]: Unmarking an already-not-favourited activity is idempotent
**Statement**: When `DELETE /api/v1/activities/{id}/favourite` is requested for an activity that is
already not favourited, the `ActivityController` shall return `204` — not an error.

**References**: Entity: `Activity.unmarkFavourite()` (no-op if already `false`)

### PLANNER-015-AC-08 [AUTO]: Unmarking favourite on an activity not owned by the caller is a 404
**Statement**: When `DELETE /api/v1/activities/{id}/favourite` is requested for an `id` that doesn't
exist or belongs to a different owner, the `ActivityController` shall return `404` without modifying
any row.

**References**: Service: `ActivityService.unmarkFavourite(String, UUID)` — returns `false` via the
same `findByIdAndOwner` owner-scoping.

## Requirement 3: Favourite and archived are fully orthogonal flags

**User story**: As a user, I want archiving an activity to never silently un-favourite it (and vice
versa), so the two states can be combined freely and predictably.

### PLANNER-015-AC-09 [AUTO]: Archiving/unarchiving never changes favourite status
**Statement**: When `POST /api/v1/activities/{id}/archive` or `DELETE /api/v1/activities/{id}/archive`
is requested for a favourited activity, the `ActivityService` shall leave `favourite` unchanged —
and symmetrically, `POST`/`DELETE /api/v1/activities/{id}/favourite` shall leave `archived` unchanged.

**Rationale**: Explicit regression guard — the two lifecycle flags are structurally independent
(separate columns, separate endpoint pairs, separate entity methods), but this pins down that neither
mutator reads or writes the other's field, since both now exist together on the same entity.

**References**: Entity: `Activity.archive()`, `Activity.unarchive()`, `Activity.markFavourite()`,
`Activity.unmarkFavourite()` — four independent single-field mutators

## Requirement 4: Listing activities surfaces favourites first

**User story**: As a user with a long activity bank, I want the ones I've favourited to always appear
at the top of my activity list, so I don't have to scroll or search for the ones I use most.

### PLANNER-015-AC-10 [AUTO]: Default list (excludes archived) orders favourites first
**Statement**: When `GET /api/v1/activities` (default `includeArchived=false`) is requested, the
`ActivityController` shall return the authenticated user's non-archived activities ordered with every
favourited activity before every non-favourited activity, alphabetical by name within each group.

**References**:
- Repository: `ActivityRepository.findByOwnerAndArchivedFalseOrderByFavouriteDescNameAsc` (renamed
  from `findByOwnerAndArchivedFalseOrderByNameAsc`)
- Service: `ActivityService.listForOwner(String, boolean)` (updated call site)

### PLANNER-015-AC-11 [AUTO]: Full list (includeArchived=true) orders favourites first, including archived favourites
**Statement**: When `GET /api/v1/activities?includeArchived=true` is requested, the
`ActivityController` shall return all of the authenticated user's activities (archived and
non-archived) ordered with every favourited activity before every non-favourited activity —
including an archived-and-favourited activity, which still sorts into the favourite group — and
alphabetical by name within each group.

**References**: Repository: `ActivityRepository.findByOwnerOrderByFavouriteDescNameAsc` (renamed
from `findByOwnerOrderByNameAsc`)

### PLANNER-015-AC-12 [AUTO]: ActivityResponse carries an accurate favourite field
**Statement**: The `ActivityController` shall include `favourite` (boolean) in every `ActivityResponse`
it returns (create, list, update, archive, unarchive, mark-favourite, unmark-favourite), accurately
reflecting the activity's current state.

**References**: DTO: `ActivityResponse` (new `favourite` field)

## Explicitly out of scope (do not implement as part of this spec)

- `SubTask` favouriting — sub-tasks are never individually favouritable, regardless of their parent
  activity's status.
- Any auto-computed "most used"/usage-frequency ranking — `favourite` is purely a manual toggle.
- An opt-in "favourites only" filter — favourites are always pinned to the top, not a separate filter
  state (contrast with the existing `includeArchived` query parameter, which *is* opt-in).
- The sidebar/drawer "assign an unplanned activity by dragging it onto the grid" idea — remains a
  separate, unspecced entry in `.claude/ideas/future_ideas.md`. This spec is a useful precursor to it
  (a drawer could reasonably show favourites first) but does not implement any part of the drawer or
  drag mechanism itself.

## Cross-references

| Reference | What it provides |
|---|---|
| `backend/src/main/java/uk/co/stefirby/behaviouralactivation/model/Activity.java` | Entity gaining `favourite` field, `markFavourite()`/`unmarkFavourite()`/`isFavourite()` |
| `backend/src/main/java/uk/co/stefirby/behaviouralactivation/dto/ActivityRequest.java` | Unchanged — confirms `favourite` is never client-settable at create/update |
| `backend/src/main/java/uk/co/stefirby/behaviouralactivation/dto/ActivityResponse.java` | Gains `favourite` boolean field |
| `backend/src/main/java/uk/co/stefirby/behaviouralactivation/repository/ActivityRepository.java` | Two ordering methods renamed to include `FavouriteDesc` |
| `backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/ActivityService.java` | New `markFavourite`/`unmarkFavourite`, updated `listForOwner` call sites |
| `backend/src/main/java/uk/co/stefirby/behaviouralactivation/controller/ActivityController.java` | New `POST`/`DELETE .../favourite` endpoints, mirroring `archive`/`unarchive` |
| `backend/src/main/resources/db/migration/V006__add_repeatable_and_archived_to_activities.sql` | The migration shape this spec's `V008` mirrors |
| `backend/src/main/resources/db/migration/V008__add_favourite_to_activities.sql` | New migration (this spec) — `favourite` column + `idx_activities_owner_favourite` index |
| `planner_spec_006_repeatable_activities.md` | The `archived` flag precedent this entire spec mirrors structurally |
| `API.md` | Needs new bullets for the two new endpoints, plus an updated `GET /api/v1/activities` ordering description |
| `frontend_spec_027_favourite_activities.md` | The paired frontend spec consuming these endpoints |
| `.claude/ideas/future_ideas.md` | The sidebar/drawer entry this was split from — remains separate, unspecced |

## TDD test case sketches

### PLANNER-015-AC-01 / AC-02
```groovy
def "PLANNER-015-AC-01: a new activity defaults to not favourited"() {
    given: "a valid create-activity request"
        def request = new ActivityRequest("Walk", ActivityCategory.PLEASURABLE, null, true)

    when: "the activity is created"
        def created = activityService.create(owner.username, request)

    then: "favourite defaults to false"
        !created.favourite
}

def "PLANNER-015-AC-02: updating an activity leaves favourite unchanged"() {
    given: "a favourited activity"
        def activity = activityService.create(owner.username, someRequest)
        activityService.markFavourite(owner.username, activity.id)

    when: "the activity is updated via PUT"
        def updated = activityService.update(owner.username, activity.id, newRequest).get()

    then: "favourite is still true"
        updated.favourite
}
```

### PLANNER-015-AC-03 / AC-04 / AC-05
```groovy
def "PLANNER-015-AC-03: marking an activity favourite returns 200 with favourite true"() {
    given: "an existing, not-favourited activity"
        def activity = activityService.create(owner.username, someRequest)

    when: "POST /api/v1/activities/{id}/favourite is requested"
        def response = client.post().uri("/api/v1/activities/${activity.id}/favourite").exchange()

    then: "the response is 200 with favourite true"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("\$.favourite").isEqualTo(true)
}

def "PLANNER-015-AC-04: marking an already-favourited activity is idempotent"() {
    given: "an already-favourited activity"
        def activity = activityService.create(owner.username, someRequest)
        activityService.markFavourite(owner.username, activity.id)

    when: "POST .../favourite is requested again"
        def response = client.post().uri("/api/v1/activities/${activity.id}/favourite").exchange()

    then: "still a 200 success, not an error"
        response.expectStatus().isOk()
}

def "PLANNER-015-AC-05: marking favourite on an activity not owned by the caller is a 404"() {
    given: "an activity owned by a different user"
        def activity = activityService.create(otherOwner.username, someRequest)

    when: "POST .../favourite is requested as the authenticated user"
        def response = client.post().uri("/api/v1/activities/${activity.id}/favourite").exchange()

    then: "a 404, not a 403 (never distinguishing not-yours from not-found)"
        response.expectStatus().isNotFound()
}
```

### PLANNER-015-AC-06 / AC-07 / AC-08
```groovy
def "PLANNER-015-AC-06: unmarking a favourited activity returns 204"() {
    given: "a favourited activity"
        def activity = activityService.create(owner.username, someRequest)
        activityService.markFavourite(owner.username, activity.id)

    when: "DELETE /api/v1/activities/{id}/favourite is requested"
        def response = client.delete().uri("/api/v1/activities/${activity.id}/favourite").exchange()

    then: "204, and the activity is no longer favourited"
        response.expectStatus().isNoContent()
        !activityRepository.findById(activity.id).get().favourite
}

def "PLANNER-015-AC-07: unmarking an already-not-favourited activity is idempotent"() {
    given: "a never-favourited activity"
        def activity = activityService.create(owner.username, someRequest)

    when: "DELETE .../favourite is requested"
        def response = client.delete().uri("/api/v1/activities/${activity.id}/favourite").exchange()

    then: "still 204, not an error"
        response.expectStatus().isNoContent()
}

def "PLANNER-015-AC-08: unmarking favourite on an activity not owned by the caller is a 404"() {
    given: "an activity owned by a different user"
        def activity = activityService.create(otherOwner.username, someRequest)

    when: "DELETE .../favourite is requested as the authenticated user"
        def response = client.delete().uri("/api/v1/activities/${activity.id}/favourite").exchange()

    then: "a 404"
        response.expectStatus().isNotFound()
}
```

### PLANNER-015-AC-09
```groovy
def "PLANNER-015-AC-09: archiving a favourited activity leaves favourite unchanged"() {
    given: "a favourited activity"
        def activity = activityService.create(owner.username, someRequest)
        activityService.markFavourite(owner.username, activity.id)

    when: "the activity is archived"
        def archived = activityService.archive(owner.username, activity.id).get()

    then: "favourite is still true, archived is true"
        archived.favourite
        archived.archived
}

def "PLANNER-015-AC-09: unmarking favourite leaves archived unchanged"() {
    given: "an archived, favourited activity"
        def activity = activityService.create(owner.username, someRequest)
        activityService.markFavourite(owner.username, activity.id)
        activityService.archive(owner.username, activity.id)

    when: "favourite is unmarked"
        activityService.unmarkFavourite(owner.username, activity.id)

    then: "archived is still true"
        activityRepository.findById(activity.id).get().archived
}
```

### PLANNER-015-AC-10 / AC-11
```groovy
def "PLANNER-015-AC-10: default list orders favourites first, alphabetical within group"() {
    given: "three non-archived activities, only 'Zebra errand' favourited"
        def apple = activityService.create(owner.username, requestNamed("Apple walk"))
        def zebra = activityService.create(owner.username, requestNamed("Zebra errand"))
        def mango = activityService.create(owner.username, requestNamed("Mango task"))
        activityService.markFavourite(owner.username, zebra.id)

    when: "GET /api/v1/activities is requested"
        def response = client.get().uri("/api/v1/activities").exchange()

    then: "Zebra errand first, then Apple walk, Mango task alphabetically"
        response.expectBody().jsonPath("\$.data[0].name").isEqualTo("Zebra errand")
        response.expectBody().jsonPath("\$.data[1].name").isEqualTo("Apple walk")
        response.expectBody().jsonPath("\$.data[2].name").isEqualTo("Mango task")
}

def "PLANNER-015-AC-11: includeArchived=true still pins an archived favourite to the top"() {
    given: "an archived, favourited activity and a non-archived, non-favourited one"
        def archived = activityService.create(owner.username, requestNamed("Old favourite"))
        activityService.markFavourite(owner.username, archived.id)
        activityService.archive(owner.username, archived.id)
        activityService.create(owner.username, requestNamed("Current task"))

    when: "GET /api/v1/activities?includeArchived=true is requested"
        def response = client.get().uri("/api/v1/activities?includeArchived=true").exchange()

    then: "the archived favourite still sorts first"
        response.expectBody().jsonPath("\$.data[0].name").isEqualTo("Old favourite")
}
```

### PLANNER-015-AC-12
```groovy
def "PLANNER-015-AC-12: ActivityResponse reflects favourite accurately across the lifecycle"() {
    given: "a newly created activity"
        def activity = activityService.create(owner.username, someRequest)

    expect: "favourite starts false"
        !toResponse(activity).favourite

    when: "marked favourite"
        def marked = activityService.markFavourite(owner.username, activity.id).get()

    then: "the response reflects true"
        toResponse(marked).favourite
}
```

## Acceptance Criteria Summary

- [x] PLANNER-015-AC-01 — new activities default to not favourited
- [x] PLANNER-015-AC-02 — updating an activity leaves favourite unchanged
- [x] PLANNER-015-AC-03 — marking an activity favourite returns 200, favourite true
- [x] PLANNER-015-AC-04 — marking an already-favourited activity is idempotent
- [x] PLANNER-015-AC-05 — marking favourite on a not-owned activity is a 404
- [x] PLANNER-015-AC-06 — unmarking a favourited activity returns 204
- [x] PLANNER-015-AC-07 — unmarking an already-not-favourited activity is idempotent
- [x] PLANNER-015-AC-08 — unmarking favourite on a not-owned activity is a 404
- [x] PLANNER-015-AC-09 — favourite and archived are fully orthogonal, neither mutator touches the other
- [x] PLANNER-015-AC-10 — default list orders favourites first, alphabetical within group
- [x] PLANNER-015-AC-11 — includeArchived=true list still pins favourites (including archived ones) first
- [x] PLANNER-015-AC-12 — ActivityResponse carries an accurate favourite field throughout the lifecycle
