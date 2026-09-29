# Split an Activity into Smaller Sub-Tasks (Backend)

**Status**: Not started
**Priority**: P1 — inserted before Week Planning (now pair 4, shifted from its previous pair-3
slot). Week Planning's `PlannedOccurrence` schema needs the reference-target decision this spec
settles (an `Activity` and a `SubTask` are two distinct, non-recursive entities) as a settled
input, not something pair 4 has to re-derive — see the forward-contract note at the end of this
spec.
**Depends on**: `planner_spec_002_activity_bank.md` (`Activity` entity, `ActivityCategory` enum,
`ActivityRepository`/`ActivityService` owner-scoping pattern, `GlobalExceptionHandler`)
**Area**: Backend
**Roadmap version**: V1

## Overview

Lets a user break one activity down into a checklist of smaller sub-tasks — e.g. "Organise a
birthday party" decomposed into "Create a guest list", "Send invitations", "Plan the menu". This
extends Epic 1 (Activity management) of `.claude/HIGH_LEVEL_DESIGN.md`, specifically US-001
("create an activity so that I can reuse it when planning my week") with an optional decomposition
capability that isn't itself a numbered user story in the design doc — it was raised afterwards, in
`.claude/ideas/future_ideas.md`'s "Split an activity into smaller sub-tasks" entry (2026-09-28),
and is written up as a real spec here rather than staying a future idea.

This is a distinct, persisted, user-authored structural feature — **not** the same thing as the V3
AI-suggestion scenario in `HIGH_LEVEL_DESIGN.md` ("I keep postponing cleaning the bathroom" → the
app suggests breaking it into a smaller task), which is ephemeral and creates no data. It's also
distinct from "multiple activity templates" (a deferred, unrelated idea about reusable presets for
creating *similar* activities, not decomposing *one* activity). Sub-tasks are **one level deep
only** — no recursive sub-sub-tasks, no self-referential parent link. A `SubTask` belongs to exactly
one `Activity` and carries its own `User` owner directly (not just reachable via
`activity.owner`), per the multi-user owner seam in `.claude/steering/structure.md`.

**Out of scope**: sub-task completion/mood tracking (no `completed` field on `SubTask` — deferred
to whichever future pair adds completion/mood tracking generally, Week Planning (pair 4) or later);
recursive sub-sub-tasks (explicitly rejected — one level deep only, by design, not a temporary
limitation); manual reordering of sub-tasks (list order is creation order only — drag-and-drop is
already a deferred idea elsewhere in `.claude/ideas/future_ideas.md` for the week planner, and the
same reasoning applies here: no story requires it yet). No `GET
/api/v1/activities/{activityId}/sub-tasks/{id}` single-item endpoint either, mirroring
`planner_spec_002_activity_bank.md`'s precedent — the paired frontend spec renders and edits
sub-tasks from the already-fetched list, avoiding a redundant round trip.

**Forward-contract note for `planner_spec_004_week_planning.md` (pair 4, not yet written)**: that
spec's future `PlannedOccurrence` entity will need to reference *either* an `Activity` *or* a
`SubTask`, never both — most likely via two nullable foreign keys plus a DB `CHECK` constraint
requiring exactly one to be set. This is documented here as a settled input for pair 4's design,
not a re-open question; it is not a numbered AC in this spec because it constrains code that
doesn't exist yet and can't be tested here.

## Requirements

### Requirement 1 — Create a sub-task

As a user, I want to add a sub-task under an activity, so that a large or daunting activity feels
more approachable.

- **PLANNER-003-AC-01** [AUTO]: When `POST /api/v1/activities/{activityId}/sub-tasks` is requested
  by the parent activity's owner with a non-blank `name`, the `SubTaskController` shall create a
  new `SubTask` and return `201 Created` with the created sub-task.
- **PLANNER-003-AC-02** [AUTO]: The `SubTaskService` shall set the created `SubTask`'s `category`
  by copying the parent `Activity`'s current `category` value at creation time — never a live
  reference to the parent, and never client-supplied.
- **PLANNER-003-AC-03** [AUTO]: The `SubTaskService` shall assign the created `SubTask`'s owner
  from the authenticated principal resolved via `SecurityContextHolder`, never from a
  client-supplied field in the request body.
- **PLANNER-003-AC-04** [AUTO]: If `POST /api/v1/activities/{activityId}/sub-tasks` is requested
  with a blank or missing `name`, then the `SubTaskController` shall return `400` without creating
  a `SubTask`.
- **PLANNER-003-AC-05** [AUTO]: If `POST /api/v1/activities/{activityId}/sub-tasks` is requested
  for an `activityId` that does not exist or does not belong to the authenticated user, then the
  `SubTaskController` shall return `404` without creating a `SubTask`.
- **PLANNER-003-AC-06** [AUTO]: The `SubTaskRequest` DTO shall declare no `category` field, so a
  client-supplied `category` value in the request body has no effect on the created `SubTask`'s
  category (Requirement AC-02 is the only source of it).

### Requirement 2 — List a sub-task checklist

As a user, I want to see all the sub-tasks under one of my activities, so I can work through the
checklist.

- **PLANNER-003-AC-07** [AUTO]: When `GET /api/v1/activities/{activityId}/sub-tasks` is requested
  by the parent activity's owner, the `SubTaskController` shall return `200` with only the
  sub-tasks belonging to that activity, ordered by `createdAt` ascending.
- **PLANNER-003-AC-08** [AUTO]: The `GET /api/v1/activities/{activityId}/sub-tasks` response body
  shall be the envelope shape `{ "data": [...], "count": N }`, matching
  `ActivityListResponse`'s established convention — not a bare array.
- **PLANNER-003-AC-09** [AUTO]: If the parent activity has zero sub-tasks, then `GET
  /api/v1/activities/{activityId}/sub-tasks` shall return `200` with `{ "data": [], "count": 0 }`,
  not `404` — an activity existing with no sub-tasks yet is a valid, ordinary state.
- **PLANNER-003-AC-10** [AUTO]: If `GET /api/v1/activities/{activityId}/sub-tasks` is requested for
  an `activityId` that does not exist or does not belong to the authenticated user, then the
  `SubTaskController` shall return `404`.

### Requirement 3 — Rename a sub-task

As a user, I want to rename a sub-task, so that I can correct or refine its wording (category is
not user-editable per sub-task — see Requirement 7).

- **PLANNER-003-AC-11** [AUTO]: When `PATCH /api/v1/activities/{activityId}/sub-tasks/{id}` is
  requested by the owner with a non-blank `name`, the `SubTaskController` shall update the
  sub-task's `name` and return `200` with the updated sub-task.
- **PLANNER-003-AC-12** [AUTO]: If `PATCH /api/v1/activities/{activityId}/sub-tasks/{id}` is
  requested with a blank or missing `name`, then the `SubTaskController` shall return `400` without
  updating the sub-task.
- **PLANNER-003-AC-13** [AUTO]: If `PATCH /api/v1/activities/{activityId}/sub-tasks/{id}` is
  requested for an `id` or `activityId` that does not exist, or does not belong to the
  authenticated user, then the `SubTaskController` shall return `404` without applying any update.
- **PLANNER-003-AC-14** [AUTO]: The `SubTaskRequest` DTO used by this endpoint shall carry no
  `category` field — a sub-task's category can never be changed via this or any other `SubTask`
  endpoint after creation.

### Requirement 4 — Delete a sub-task

As a user, I want to remove a sub-task I no longer need, so my checklist stays relevant.

- **PLANNER-003-AC-15** [AUTO]: When `DELETE /api/v1/activities/{activityId}/sub-tasks/{id}` is
  requested by the owner, the `SubTaskService` shall permanently delete the sub-task and the
  `SubTaskController` shall return `204 No Content`.
- **PLANNER-003-AC-16** [AUTO]: If `DELETE /api/v1/activities/{activityId}/sub-tasks/{id}` is
  requested for an `id` or `activityId` that does not exist, or does not belong to the
  authenticated user, then the `SubTaskController` shall return `404` without deleting anything.

### Requirement 5 — Deleting an activity cascades to its sub-tasks

As a user, I want deleting an activity to clean up its sub-tasks automatically, so I never end up
with orphaned checklist data.

- **PLANNER-003-AC-17** [AUTO]: When an `Activity` row is deleted, the database shall cascade-delete
  all `sub_tasks` rows referencing it via the `fk_sub_tasks_activity` foreign key's `ON DELETE
  CASCADE`, without `ActivityService`/`SubTaskService` deleting them explicitly.

### Requirement 6 — Owner scoping and not-found/cross-owner indistinguishability

As a user, I want another user's sub-task or activity IDs to be completely unreachable to me, so my
planning data can't leak by ID guessing.

- **PLANNER-003-AC-18** [AUTO]: The `SubTask` entity shall persist its own `owner` (`User`)
  reference directly, independent of traversal through `activity.owner`, per the multi-user owner
  seam in `.claude/steering/structure.md`.
- **PLANNER-003-AC-19** [AUTO]: If any `/api/v1/activities/{activityId}/sub-tasks...` request
  references an `activityId` or sub-task `id` that either does not exist or belongs to a different
  owner, then the `SubTaskService` shall respond `404` in both cases identically — never `403`, and
  never a response body that reveals whether the resource exists under another owner.

### Requirement 7 — Category is a snapshot, not a live reference

As a user, I want a sub-task's category to stay stable once created, so editing the parent
activity's category later doesn't silently rewrite my existing checklist.

- **PLANNER-003-AC-20** [AUTO]: Where a parent `Activity`'s `category` is changed after one of its
  `SubTask`s has already been created, the `SubTaskService` shall leave that `SubTask`'s
  already-stored `category` unchanged — the value copied at creation time (AC-02) does not track
  later parent updates.

### Requirement 8 — Every endpoint requires a session (inherited)

As the user, I want sub-task endpoints protected by my session like everything else, so my
planning data isn't reachable without it.

- **PLANNER-003-AC-21** [AUTO — regression test, not new implementation]: The
  `SecurityFilterChain` (unchanged from `planner_spec_001_auth.md`) shall already require an
  authenticated session for all `/api/v1/activities/**` requests via its existing
  `.requestMatchers("/api/v1/**").authenticated()` rule; this spec adds a Spock test confirming the
  existing rule extends automatically to the new sub-task endpoints, without modifying
  `SecurityConfig`.

## Data model

`model/SubTask.java` — mirrors `Activity.java`'s style (mutation via a named method, no bare
setters), adds an `activity` reference:

```java
@Entity
@Table(name = "sub_tasks")
public class SubTask {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id", nullable = false)
    private Activity activity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActivityCategory category;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SubTask() {
        // JPA
    }

    public SubTask(Activity activity, String name, ActivityCategory category, User owner) {
        this.activity = activity;
        this.name = name;
        this.category = category;
        this.owner = owner;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void rename(String name) {
        this.name = name;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Activity getActivity() {
        return activity;
    }

    public User getOwner() {
        return owner;
    }

    public String getName() {
        return name;
    }

    public ActivityCategory getCategory() {
        return category;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
```

No new enum — `category` reuses `model/ActivityCategory.java` from `planner_spec_002_activity_bank.md`
unmodified.

## Migration

`backend/src/main/resources/db/migration/V003__create_sub_tasks_table.sql` (next migration number
after `V002__create_activities_table.sql`, the highest existing at the time this spec was written):

```sql
CREATE TABLE sub_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL,
    user_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_sub_tasks_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_tasks_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_sub_tasks_category CHECK (category IN ('ROUTINE', 'NECESSARY', 'PLEASURABLE'))
);

CREATE INDEX idx_sub_tasks_activity_id ON sub_tasks(activity_id);
CREATE INDEX idx_sub_tasks_user_id ON sub_tasks(user_id);
```

## Repository

```java
public interface SubTaskRepository extends JpaRepository<SubTask, UUID> {
    List<SubTask> findByActivityIdAndOwnerOrderByCreatedAtAsc(UUID activityId, User owner);
    Optional<SubTask> findByIdAndActivityIdAndOwner(UUID id, UUID activityId, User owner);
}
```

`SubTaskService` must additionally re-confirm the parent `activityId` belongs to the authenticated
user (via `ActivityRepository.findByIdAndOwner`) before any read/write — a `SubTask` row matching
`findByActivityIdAndOwner...` already implies this by construction, but the parent-existence check
is what produces the correct 404 for AC-05/AC-10 when the activity itself doesn't exist or isn't
owned by the caller, as distinct from the sub-task-level 404s in AC-13/AC-16.

## DTOs (`dto/`)

```java
public record SubTaskRequest(
    @NotBlank(message = "name is required") String name
) {}

public record SubTaskResponse(
    UUID id, UUID activityId, String name, ActivityCategory category, Instant createdAt
) {}

public record SubTaskListResponse(List<SubTaskResponse> data, int count) {}
```

Note `SubTaskRequest` has no `category` field at all (AC-06/AC-14) — this is a request-shape
decision, not merely a validation rule, so a client cannot even attempt to set or change it.

## Cross-references

| This spec | Contracts against |
|---|---|
| `SubTask` entity (`model/`) | New — `id`, `activity` (`Activity`), `owner` (`User`), `name`, `category` (snapshot), `createdAt`, `updatedAt` |
| `ActivityCategory` enum (`model/`) | Reused unmodified from `planner_spec_002_activity_bank.md` |
| `SubTaskController` (`controller/`) | New — `/api/v1/activities/{activityId}/sub-tasks` (GET, POST), `/api/v1/activities/{activityId}/sub-tasks/{id}` (PATCH, DELETE) |
| `SubTaskService` (`service/`) | New — owner-scoping and parent-activity-ownership check enforced here, not in the controller |
| `SubTaskRepository` (`repository/`) | New — `findByActivityIdAndOwnerOrderByCreatedAtAsc`, `findByIdAndActivityIdAndOwner` |
| `SubTaskRequest`/`SubTaskResponse`/`SubTaskListResponse` (`dto/`) | New |
| `Activity`, `ActivityRepository` (`planner_spec_002_activity_bank.md`) | Parent-ownership lookup, `ON DELETE CASCADE` target |
| `GlobalExceptionHandler` (`exception/`) | Reused unmodified — blank-name validation already produces `400` via the existing `MethodArgumentNotValidException` handler |
| `User` (`model/`), `SecurityContextHolder` | Owner resolution, unchanged from `planner_spec_001_auth.md` |
| `V003__create_sub_tasks_table.sql` | New migration |
| `frontend_spec_003_sub_tasks.md` | Paired frontend spec — consumes these endpoints exactly as specified here |
| `planner_spec_004_week_planning.md` (not yet written) | Forward dependency — `PlannedOccurrence` must reference either an `Activity` or a `SubTask`, never both (see Overview's forward-contract note) |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-003-AC-01/AC-02: creates a sub-task with category copied from the parent activity"() {
    given: "an activity owned by the authenticated user, category PLEASURABLE"
        def activity = activityRepository.save(
            new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, currentUser))
        def request = new SubTaskRequest("Create a guest list")

    when: "POST .../sub-tasks is requested"
        def response = client.post()
            .uri("/api/v1/activities/${activity.id}/sub-tasks").body(request).exchange()

    then: "the response is 201 Created with the category copied from the parent"
        response.expectStatus().isCreated()
        response.expectBody().jsonPath("$.name").isEqualTo("Create a guest list")
        response.expectBody().jsonPath("$.category").isEqualTo("PLEASURABLE")
}

def "PLANNER-003-AC-04: blank name returns 400, no sub-task created"() {
    given: "an activity owned by the authenticated user"
        def activity = activityRepository.save(
            new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, currentUser))

    when: "POST .../sub-tasks is requested with a blank name"
        def response = client.post()
            .uri("/api/v1/activities/${activity.id}/sub-tasks").body([name: " "]).exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()

    and: "no sub-task was created"
        subTaskRepository.count() == 0
}

def "PLANNER-003-AC-05/AC-19: creating a sub-task under another user's activity returns 404"() {
    given: "an activity owned by a different user"
        def othersActivity = activityRepository.save(
            new Activity("Not mine", ActivityCategory.ROUTINE, null, otherUser))

    when: "POST .../sub-tasks is requested by currentUser"
        def response = client.post()
            .uri("/api/v1/activities/${othersActivity.id}/sub-tasks")
            .body(new SubTaskRequest("Sneaky sub-task")).exchange()

    then: "the response is 404, not 403"
        response.expectStatus().isNotFound()
}

def "PLANNER-003-AC-09: an activity with no sub-tasks returns 200 with an empty list, not 404"() {
    given: "an activity with no sub-tasks"
        def activity = activityRepository.save(
            new Activity("Read a book", ActivityCategory.PLEASURABLE, null, currentUser))

    when: "GET .../sub-tasks is requested"
        def response = client.get().uri("/api/v1/activities/${activity.id}/sub-tasks").exchange()

    then: "the response is 200 with an empty envelope"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("$.count").isEqualTo(0)
        response.expectBody().jsonPath("$.data").isEmpty()
}

def "PLANNER-003-AC-17: deleting the parent activity cascade-deletes its sub-tasks"() {
    given: "an activity with one sub-task"
        def activity = activityRepository.save(
            new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, currentUser))
        subTaskRepository.save(new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, currentUser))

    when: "the parent activity is deleted"
        activityRepository.delete(activity)

    then: "the sub-task row is gone too"
        subTaskRepository.count() == 0
}

def "PLANNER-003-AC-20: changing the parent's category later does not change an existing sub-task's category"() {
    given: "an activity and a sub-task created while the activity was PLEASURABLE"
        def activity = activityRepository.save(
            new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, currentUser))
        def subTask = subTaskRepository.save(
            new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, currentUser))

    when: "the parent activity's category is later changed to NECESSARY"
        activity.update(activity.name, ActivityCategory.NECESSARY, activity.description)
        activityRepository.save(activity)

    then: "the sub-task's stored category is unchanged"
        subTaskRepository.findById(subTask.id).get().category == ActivityCategory.PLEASURABLE
}

def "PLANNER-003-AC-21: an unauthenticated request to sub-tasks returns 401 (inherited rule)"() {
    when: "GET .../sub-tasks is requested with no session"
        def response = client.get().uri("/api/v1/activities/${UUID.randomUUID()}/sub-tasks").exchange()

    then: "the response is 401, from the existing SecurityFilterChain rule, unmodified"
        response.expectStatus().isUnauthorized()
}
```

## Acceptance Criteria Summary

- [ ] PLANNER-003-AC-01 — POST creates and returns a sub-task, 201
- [ ] PLANNER-003-AC-02 — category copied from parent at creation, not client-supplied
- [ ] PLANNER-003-AC-03 — owner assigned from principal, never from request body
- [ ] PLANNER-003-AC-04 — blank/missing name → 400
- [ ] PLANNER-003-AC-05 — parent activity not found/not owned → 404, no sub-task created
- [ ] PLANNER-003-AC-06 — `SubTaskRequest` has no category field; client-supplied category ignored
- [ ] PLANNER-003-AC-07 — list scoped to the parent activity, ordered by createdAt ascending
- [ ] PLANNER-003-AC-08 — list response is `{data, count}` envelope
- [ ] PLANNER-003-AC-09 — zero sub-tasks returns `{data: [], count: 0}`, not 404
- [ ] PLANNER-003-AC-10 — list on not-found/not-owned parent activity → 404
- [ ] PLANNER-003-AC-11 — PATCH renames sub-task, 200
- [ ] PLANNER-003-AC-12 — PATCH blank name → 400
- [ ] PLANNER-003-AC-13 — PATCH on not-found/not-owned sub-task or activity → 404
- [ ] PLANNER-003-AC-14 — PATCH request carries no category field, category never editable
- [ ] PLANNER-003-AC-15 — DELETE removes sub-task, 204
- [ ] PLANNER-003-AC-16 — DELETE on not-found/not-owned sub-task or activity → 404
- [ ] PLANNER-003-AC-17 — deleting the parent activity cascade-deletes its sub-tasks
- [ ] PLANNER-003-AC-18 — `SubTask.owner` persisted directly, independent of `activity.owner`
- [ ] PLANNER-003-AC-19 — not-found and not-yours are indistinguishable (404 both) across every endpoint
- [ ] PLANNER-003-AC-20 — category is a creation-time snapshot, does not follow later parent changes
- [ ] PLANNER-003-AC-21 — existing SecurityFilterChain rule already covers new endpoints (regression test, no SecurityConfig change)
