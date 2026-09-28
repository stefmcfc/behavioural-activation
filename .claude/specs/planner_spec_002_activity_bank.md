# Activity Bank (Backend)

**Status**: Implemented and verified — `backend/src/main/java/uk/co/stefirby/behaviouralactivation/
{model/Activity.java, model/ActivityCategory.java, repository/ActivityRepository.java,
service/ActivityService.java, controller/ActivityController.java, dto/ActivityRequest.java,
dto/ActivityResponse.java, dto/ActivityListResponse.java}`,
`backend/src/main/resources/db/migration/V002__create_activities_table.sql`.
`GlobalExceptionHandler` extended with an `HttpMessageNotReadableException` → 400 handler (the
design decision this spec calls out). All `[AUTO]` ACs verified by Spock specs under
`backend/src/test/groovy/.../{model,service,controller,exception}/` — `ActivitySpec`,
`ActivityServiceSpec`, `ActivityControllerSpec`, plus an added case in `GlobalExceptionHandlerSpec`.
Owner-scoping lives entirely in `ActivityService` (resolves the `User` from the authenticated
username via `UserRepository`, never trusts the request body); not-found and cross-owner access are
both surfaced as an empty `Optional`/`false` from the service, so the controller's 404 response is
identical either way with no distinguishing detail (PLANNER-002-AC-18). Full suite: 55 tests, 0
failures (`gradlew.bat test`, run against the real Postgres instance via Docker Compose — the
`V002` migration applies cleanly).
**Priority**: P1 — first feature spec on top of auth; blocks Week Planning (pair 3), which
references `Activity`
**Depends on**: `planner_spec_001_auth.md` (authenticated principal, `SecurityFilterChain`,
`GlobalExceptionHandler`, `ApiError` shape)
**Area**: Backend
**Roadmap version**: V1

## Overview

Implements US-001 (create/edit/delete/list an activity) and the first two acceptance criteria of
US-002 (an activity has one primary category, changeable) from `.claude/HIGH_LEVEL_DESIGN.md`. Every
`Activity` carries an owning `User` from creation, per the multi-user seam in
`.claude/steering/structure.md`; every endpoint scopes its query/mutation to the authenticated
principal, resolved the same way `AuthController` already does (`Authentication authentication`
parameter). Auth itself (401 on no session) is inherited unmodified from `SecurityConfig`'s existing
`.requestMatchers("/api/v1/**").authenticated()` rule — no security config change is needed for
these endpoints to already require a session.

**Out of scope** (forward dependency to `planner_spec_003_week_planning.md`, pair 3): per-occurrence
category override and historical category snapshots — US-002's last two ACs. This spec makes
`Activity.category` mutable (Requirement 2 below); pair 3's `PlannedOccurrence` must copy the
category value at plan time into its own field, not live-reference `Activity.category`, so that
changing an activity's category later does not rewrite history. Also out of scope: tags, difficulty,
and effort/mood scoring (absent from every design doc — not being invented here), pagination on the
list endpoint (not needed at this data scale), and soft-delete (plain hard delete is fine — nothing
yet references `Activity`; pair 3's author must revisit delete semantics once `PlannedOccurrence` can
reference an `Activity`). No `GET /api/v1/activities/{id}` endpoint either — the paired frontend spec
prefills its edit form from the already-fetched list, avoiding a redundant round trip; add this
endpoint later only if something needs to deep-link a single activity.

## Requirements

### Requirement 1 — Create an activity

As a user, I want to create an activity so that I can reuse it when planning my week (US-001).

- **PLANNER-002-AC-01** [AUTO]: When `POST /api/v1/activities` is requested by an authenticated user
  with a non-blank `name` and a valid `category`, the `ActivityController` shall create a new
  `Activity` and return `201 Created` with the created activity.
- **PLANNER-002-AC-02** [AUTO]: The `ActivityService` shall assign the created `Activity`'s owner
  from the authenticated principal resolved via `SecurityContextHolder`, never from a client-supplied
  field in the request body.
- **PLANNER-002-AC-03** [AUTO]: If `POST /api/v1/activities` is requested with a blank or missing
  `name`, then the `ActivityController` shall return `400` without creating an `Activity`.
- **PLANNER-002-AC-04** [AUTO]: If `POST /api/v1/activities` is requested with a missing `category`,
  or a `category` value that is not one of `ROUTINE`, `NECESSARY`, or `PLEASURABLE`, then the
  `ActivityController` shall return `400` without creating an `Activity`.
- **PLANNER-002-AC-05** [AUTO]: Where a `description` is supplied, the `ActivityService` shall store
  it on the `Activity`; where omitted, the `Activity`'s `description` shall be `null`.

### Requirement 2 — Categorise an activity by purpose

As a user, I want to choose the category of an activity based on its purpose, and change it later
(US-002, first two ACs only — see Out of scope above for the rest).

- **PLANNER-002-AC-06** [AUTO]: The `Activity` entity shall persist exactly one primary category,
  whose value is one of `ROUTINE`, `NECESSARY`, or `PLEASURABLE` (`ActivityCategory` enum) — never
  more than one, never free text.
- **PLANNER-002-AC-07** [AUTO]: When `PUT /api/v1/activities/{id}` is requested with a `category`
  different from the activity's current one, the `ActivityService` shall update the stored `category`
  to the new value.

### Requirement 3 — List my activity bank

As a user, I want to see all the activities I've created, so that I can pick from them and manage
them.

- **PLANNER-002-AC-08** [AUTO]: When `GET /api/v1/activities` is requested, the `ActivityController`
  shall return `200` with only the activities owned by the authenticated user.
- **PLANNER-002-AC-09** [AUTO]: The `GET /api/v1/activities` response body shall be the envelope
  shape `{ "data": [...], "count": N }`, per `frontend_conventions.md`'s documented
  `activityApi.getAll()` convention — not a bare array.
- **PLANNER-002-AC-10** [AUTO]: The `ActivityRepository` shall return the owner's activities ordered
  alphabetically by `name` (ascending).
- **PLANNER-002-AC-11** [AUTO]: If the authenticated user owns no activities, then `GET
  /api/v1/activities` shall return `200` with `{ "data": [], "count": 0 }`, not an error.

### Requirement 4 — Edit an activity

As a user, I want to edit an activity's name, category, or description, so that I can correct or
refine it (US-001, US-002).

- **PLANNER-002-AC-12** [AUTO]: When `PUT /api/v1/activities/{id}` is requested by the activity's
  owner with a valid `name` and `category`, the `ActivityController` shall update the activity's
  `name`, `category`, and `description` and return `200` with the updated activity.
- **PLANNER-002-AC-13** [AUTO]: If `PUT /api/v1/activities/{id}` is requested with a blank or missing
  `name`, then the `ActivityController` shall return `400` without updating the activity.
- **PLANNER-002-AC-14** [AUTO]: If `PUT /api/v1/activities/{id}` is requested with a `category` that
  is not one of `ROUTINE`, `NECESSARY`, or `PLEASURABLE`, then the `ActivityController` shall return
  `400` without updating the activity.
- **PLANNER-002-AC-15** [AUTO]: If `PUT /api/v1/activities/{id}` is requested for an `id` that does
  not belong to the authenticated user, then the `ActivityController` shall return `404` without
  applying any update.

### Requirement 5 — Delete an activity

As a user, I want to delete an activity I no longer need, so that my bank stays relevant.

- **PLANNER-002-AC-16** [AUTO]: When `DELETE /api/v1/activities/{id}` is requested by the activity's
  owner, the `ActivityService` shall permanently delete the activity and the `ActivityController`
  shall return `204 No Content`.
- **PLANNER-002-AC-17** [AUTO]: If `DELETE /api/v1/activities/{id}` is requested for an `id` that
  does not belong to the authenticated user, then the `ActivityController` shall return `404` without
  deleting anything.

### Requirement 6 — Not-found and cross-owner access are indistinguishable

As a user, I want another user's activity IDs to be completely unreachable to me, so that my
planning data can't leak by ID guessing.

- **PLANNER-002-AC-18** [AUTO]: If any `/api/v1/activities/{id}` request references an `id` that
  either does not exist or belongs to a different owner, then the `ActivityService` shall respond
  `404` in both cases identically — never `403`, and never a response body that reveals whether the
  activity exists under another owner.

### Requirement 7 — Every endpoint requires a session (inherited)

As the user, I want the activity bank protected by my session like everything else, so my planning
data isn't reachable without it.

- **PLANNER-002-AC-19** [AUTO — regression test, not new implementation]: The `SecurityFilterChain`
  (unchanged from `planner_spec_001_auth.md`) shall already require an authenticated session for all
  `/api/v1/activities/**` requests via its existing `.requestMatchers("/api/v1/**").authenticated()`
  rule; this spec adds a Spock test confirming the existing rule extends automatically to the new
  endpoints, without modifying `SecurityConfig`.

## Design decision this spec must implement (not optional)

Binding `category` directly as the `ActivityCategory` enum means an invalid JSON literal (e.g.
`"category": "FUN"`) throws `HttpMessageNotReadableException` during deserialization, which
currently falls through `GlobalExceptionHandler`'s catch-all to a `500`. This spec adds
`@ExceptionHandler(HttpMessageNotReadableException.class)` → `400` with the existing `ApiError`
shape to `GlobalExceptionHandler` — without it, AC-04/AC-14 cannot hold for malformed (as opposed to
merely missing) category values.

## Data model

`model/Activity.java` — mirrors `User.java`'s style, adds mutability and an owner:

```java
@Entity
@Table(name = "activities")
public class Activity {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActivityCategory category;

    @Column
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Activity() {
        // JPA
    }

    public Activity(String name, ActivityCategory category, String description, User owner) {
        this.name = name;
        this.category = category;
        this.description = description;
        this.owner = owner;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void update(String name, ActivityCategory category, String description) {
        this.name = name;
        this.category = category;
        this.description = description;
        this.updatedAt = Instant.now();
    }

    // getters only — no bare setters
}
```

`model/ActivityCategory.java`: `public enum ActivityCategory { ROUTINE, NECESSARY, PLEASURABLE }`

## Migration

`backend/src/main/resources/db/migration/V002__create_activities_table.sql`:

```sql
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(20) NOT NULL,
    description VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_activities_category CHECK (category IN ('ROUTINE', 'NECESSARY', 'PLEASURABLE'))
);

CREATE INDEX idx_activities_user_id ON activities(user_id);
```

## Repository

```java
public interface ActivityRepository extends JpaRepository<Activity, UUID> {
    List<Activity> findByOwnerOrderByNameAsc(User owner);
    Optional<Activity> findByIdAndOwner(UUID id, User owner);
}
```

## DTOs (`dto/`)

```java
public record ActivityRequest(
    @NotBlank(message = "name is required") String name,
    @NotNull(message = "category is required") ActivityCategory category,
    String description
) {}

public record ActivityResponse(
    UUID id, String name, ActivityCategory category, String description, Instant createdAt
) {}

public record ActivityListResponse(List<ActivityResponse> data, int count) {}
```

## Cross-references

| This spec | Contracts against |
|---|---|
| `Activity` entity (`model/`) | New — `id`, `owner` (`User`), `name`, `category`, `description`, `createdAt`, `updatedAt` |
| `ActivityCategory` enum (`model/`) | New — `ROUTINE`, `NECESSARY`, `PLEASURABLE` |
| `ActivityController` (`controller/`) | New — `/api/v1/activities` (GET, POST), `/api/v1/activities/{id}` (PUT, DELETE) |
| `ActivityService` (`service/`) | New — owner-scoping enforced here, not in the controller |
| `ActivityRepository` (`repository/`) | New — `findByOwnerOrderByNameAsc`, `findByIdAndOwner` |
| `ActivityRequest`/`ActivityResponse`/`ActivityListResponse` (`dto/`) | New |
| `GlobalExceptionHandler` (`exception/`) | Extended — new `HttpMessageNotReadableException` handler |
| `User` (`model/`), `SecurityContextHolder` | Owner resolution, unchanged from `planner_spec_001_auth.md` |
| `V002__create_activities_table.sql` | New migration |
| `frontend_spec_002_activity_bank.md` | Paired frontend spec — consumes these endpoints exactly as specified here |
| `planner_spec_003_week_planning.md` (not yet written) | Forward dependency — must snapshot `Activity.category` at plan time, not live-reference it |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-002-AC-01: creates and returns a new activity, 201"() {
    given: "an authenticated user and a valid create request"
        def request = new ActivityRequest("Walk", ActivityCategory.ROUTINE, null)

    when: "POST /api/v1/activities is requested"
        def response = client.post().uri("/api/v1/activities").body(request).exchange()

    then: "the response is 201 Created with the new activity"
        response.expectStatus().isCreated()
        response.expectBody().jsonPath("$.name").isEqualTo("Walk")
}

def "PLANNER-002-AC-04: missing category returns 400, no activity created"() {
    given: "a request with no category"
        def request = [name: "Walk"]

    when: "POST /api/v1/activities is requested"
        def response = client.post().uri("/api/v1/activities").body(request).exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()

    and: "no activity was created"
        activityRepository.count() == 0
}

def "PLANNER-002-AC-08/AC-09: list returns only my activities in the documented envelope shape"() {
    given: "activities owned by two different users"
        // seed activity for otherUser and activity for currentUser

    when: "GET /api/v1/activities is requested as currentUser"
        def response = client.get().uri("/api/v1/activities").exchange()

    then: "only currentUser's activity is returned, in the {data, count} envelope"
        response.expectBody().jsonPath("$.count").isEqualTo(1)
        response.expectBody().jsonPath("$.data[0].name").isEqualTo(currentUsersActivityName)
}

def "PLANNER-002-AC-18: updating another user's activity returns 404, not 403"() {
    given: "an activity owned by a different user"
        def otherUsersActivity = activityRepository.save(
            new Activity("Read", ActivityCategory.PLEASURABLE, null, otherUser))

    when: "PUT is requested by currentUser for that id"
        def response = client.put().uri("/api/v1/activities/${otherUsersActivity.id}")
            .body(new ActivityRequest("Read more", ActivityCategory.PLEASURABLE, null)).exchange()

    then: "the response is 404"
        response.expectStatus().isNotFound()
}

def "PLANNER-002-AC-19: an unauthenticated request to /api/v1/activities returns 401 (inherited rule)"() {
    when: "GET /api/v1/activities is requested with no session"
        def response = client.get().uri("/api/v1/activities").exchange()

    then: "the response is 401, from the existing SecurityFilterChain rule, unmodified"
        response.expectStatus().isUnauthorized()
}
```

## Acceptance Criteria Summary

- [x] PLANNER-002-AC-01 — POST creates and returns activity, 201
- [x] PLANNER-002-AC-02 — owner assigned from principal, never from request body
- [x] PLANNER-002-AC-03 — blank/missing name → 400
- [x] PLANNER-002-AC-04 — missing/invalid category → 400
- [x] PLANNER-002-AC-05 — optional description stored or null
- [x] PLANNER-002-AC-06 — category is exactly one of 3 fixed enum values
- [x] PLANNER-002-AC-07 — category is changeable via PUT
- [x] PLANNER-002-AC-08 — list scoped to owner only
- [x] PLANNER-002-AC-09 — list response is `{data, count}` envelope
- [x] PLANNER-002-AC-10 — list sorted alphabetically by name
- [x] PLANNER-002-AC-11 — empty bank returns `{data: [], count: 0}`, not an error
- [x] PLANNER-002-AC-12 — PUT updates name/category/description, 200
- [x] PLANNER-002-AC-13 — PUT blank name → 400
- [x] PLANNER-002-AC-14 — PUT invalid category → 400
- [x] PLANNER-002-AC-15 — PUT on another owner's activity → 404
- [x] PLANNER-002-AC-16 — DELETE removes activity, 204
- [x] PLANNER-002-AC-17 — DELETE on another owner's activity → 404
- [x] PLANNER-002-AC-18 — not-found and not-yours are indistinguishable (404 both)
- [x] PLANNER-002-AC-19 — existing SecurityFilterChain rule already covers new endpoints (regression test, no SecurityConfig change)
