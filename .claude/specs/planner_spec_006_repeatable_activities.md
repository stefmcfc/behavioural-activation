# Mark Activities as Repeatable vs One-off (Backend)

**Status**: Not started
**Priority**: P2 — a real enhancement to the activity bank + completion loop, but nothing else is
blocked on it (unlike `planner_spec_003_sub_tasks.md`, which settled a schema decision
`planner_spec_004_week_planning.md` needed). Sequenced after Week Planning by design — see the
dependency note below.
**Depends on**: `planner_spec_002_activity_bank.md` (`Activity` entity, `ActivityCategory` enum,
`ActivityRepository`/`ActivityService` owner-scoping pattern, `GlobalExceptionHandler`,
`ActivityRequest`/`ActivityResponse`), `planner_spec_004_week_planning.md` (`PlannedOccurrence`,
`CompletionRecord`, `PlanService.complete()` — this spec's auto-archive trigger hooks directly into
that method)
**Area**: Backend
**Roadmap version**: V1 (extends the core planner's activity bank + completion loop from
`.claude/steering/product.md`'s V1 row — not V2's tracking/reflection scope, and not AI)

## Overview

Lets a user mark an `Activity` as either **repeatable** (the default — e.g. "Go for a walk", "Get
shopping", reusable indefinitely) or a **one-off** (e.g. "Apply for jobs", "Get new phone", "Join
gym"). Extends `.claude/HIGH_LEVEL_DESIGN.md`'s Epic 1 (US-001, "create an activity so that I can
reuse it when planning my week") and Epic 4 (US-009, "mark an activity as completed so that I can
see what I actually did") with a completion-driven housekeeping behaviour that isn't itself a
numbered user story: once a one-off activity is genuinely "done" — its own occurrence completes if
it has no sub-tasks, or every one of its sub-tasks has at least one completed occurrence if it does
— it auto-archives out of the "pick an activity to plan" list by default, while staying visible in
the activity bank and history. Repeatable activities never auto-archive. This was raised in
`.claude/ideas/future_ideas.md`'s "Mark activities as repeatable vs one-off" entry (2026-09-29),
confirmed as depending on completion tracking already existing (hence sequenced after
`planner_spec_004_week_planning.md`, the opposite dependency direction from how sub-tasks preceded
Week Planning), and is written up as a real spec here rather than staying a future idea.

**Design decisions settled before this spec was written** (not reopened here): archiving is a soft,
reversible state (`archived: boolean` on `Activity`) rather than a hard, one-way filter — a user can
always manually un-archive; archiving happens automatically on the triggering completion, with no
confirm step; for an activity with sub-tasks, "done" means *all* of its sub-tasks each have at least
one completed occurrence — the parent `Activity`'s own direct occurrence completing is not itself
required or checked in that case, and is not possible in practice since sub-task occurrences and the
parent's own occurrence are independent, per `planner_spec_003_sub_tasks.md`.

**Out of scope**: any user-initiated "Archive" action from an otherwise-active state — archiving is
*only* ever the automatic side effect of the completion described above; the two archive endpoints
below exist for idempotent-success/possible-future-manual-use symmetry with `unarchive`, not because
this spec adds a UI trigger for calling the archive one directly (the paired frontend spec,
`frontend_spec_006_repeatable_activities.md`, only wires a manual **Unarchive** action). No
automatic *re*-archiving trigger beyond the one described above — once manually unarchived, a later
completion re-archives it only by running through the exact same logic again, not a special
re-archive path. No `archived`/`repeatable` fields on `SubTask` — only the parent `Activity` carries
them; a `SubTask` has no independent repeatable/archived state of its own. No audit trail or
"archived because of occurrence X" record — `archived` is a plain boolean, not a history log. No
real-time push/notification when an activity auto-archives mid-session — the frontend picks this up
on its next fetch, not immediately in another open tab. No change to `PlannedOccurrenceResponse` or
`PlanController`'s response shape — `repeatable`/`archived` live on `Activity`/`ActivityResponse`
only.

## Requirements

### Requirement 1 — Create and edit an activity's `repeatable` flag

As a user, I want to mark an activity as repeatable or one-off when I create or edit it, so the app
knows whether it should ever auto-archive.

- **PLANNER-006-AC-01** [AUTO]: When `POST /api/v1/activities` is requested with no `repeatable`
  field in the body, the `ActivityService` shall create the `Activity` with `repeatable` set to
  `true`.
- **PLANNER-006-AC-02** [AUTO]: When `POST /api/v1/activities` is requested with `repeatable: false`
  in the body, the `ActivityService` shall create the `Activity` with `repeatable` set to `false`.
- **PLANNER-006-AC-03** [AUTO]: When `PUT /api/v1/activities/{id}` is requested by the owner with a
  `repeatable` value, the `ActivityService` shall update the `Activity`'s `repeatable` field to that
  value, exactly like `name`/`category`/`description` are already editable.
- **PLANNER-006-AC-04** [AUTO]: The `ActivityRequest` DTO shall declare no `archived` field, so a
  client-supplied `archived` value in a create or update request body has no effect — `archived` is
  never settable via `POST /api/v1/activities` or `PUT /api/v1/activities/{id}`, only via the
  archive/unarchive endpoints in Requirement 2.

### Requirement 2 — Archive and unarchive an activity

As a user, I want an activity I've finished with to get out of my way, and to be able to bring it
back if I want to reuse it after all.

- **PLANNER-006-AC-05** [AUTO]: When `POST /api/v1/activities/{id}/archive` is requested by the
  owner of a non-archived `Activity`, the `ActivityService` shall set that `Activity`'s `archived`
  to `true` and the `ActivityController` shall return `200` with the updated activity.
- **PLANNER-006-AC-06** [AUTO]: When `POST /api/v1/activities/{id}/archive` is requested by the
  owner of an `Activity` that is already `archived`, the `ActivityService` shall leave it archived
  and the `ActivityController` shall return `200` with the updated activity — idempotent success,
  never an error.
- **PLANNER-006-AC-07** [AUTO]: If `POST /api/v1/activities/{id}/archive` is requested for an `id`
  that does not exist or does not belong to the authenticated user, then the `ActivityController`
  shall return `404`, matching `planner_spec_002_activity_bank.md`'s uniform not-found/not-owned
  convention.
- **PLANNER-006-AC-08** [AUTO]: When `DELETE /api/v1/activities/{id}/archive` is requested by the
  owner of an `Activity`, the `ActivityService` shall set that `Activity`'s `archived` to `false`
  and the `ActivityController` shall return `204 No Content` — matching `PlanController`'s existing
  `DELETE .../completion` convention for a state-clearing action.
- **PLANNER-006-AC-09** [AUTO]: If `DELETE /api/v1/activities/{id}/archive` is requested for an `id`
  that does not exist or does not belong to the authenticated user, then the `ActivityController`
  shall return `404`.

### Requirement 3 — Archived activities are hidden by default when listing

As a user, I want my archived activities out of my everyday activity list by default, without
losing them permanently.

- **PLANNER-006-AC-10** [AUTO]: When `GET /api/v1/activities` is requested with no `includeArchived`
  query parameter (or `includeArchived=false`), the `ActivityController` shall return only
  non-archived activities belonging to the authenticated user.
- **PLANNER-006-AC-11** [AUTO]: When `GET /api/v1/activities?includeArchived=true` is requested, the
  `ActivityController` shall return both archived and non-archived activities belonging to the
  authenticated user.
- **PLANNER-006-AC-12** [AUTO]: Where `GET /api/v1/activities` returns a mixed set of archived and
  non-archived activities (`includeArchived=true`), the `ActivityController` shall still order the
  response by `name` ascending, unaffected by `archived` state — matching the existing
  `findByOwnerOrderByNameAsc` ordering contract from `planner_spec_002_activity_bank.md`.

### Requirement 4 — Auto-archive on completion: activity has no sub-tasks

As a user, I want a one-off activity with no checklist to archive itself the moment I complete it,
without an extra step.

- **PLANNER-006-AC-13** [AUTO]: When `PlanService.complete()` successfully completes a
  `PlannedOccurrence` that directly targets an `Activity` (not a `SubTask`) whose `repeatable` is
  `false`, whose `archived` is currently `false`, and which has zero `SubTask`s, then `PlanService`
  shall set that `Activity`'s `archived` to `true` and save it within the same transaction as the
  completion itself.

### Requirement 5 — Auto-archive on completion: activity has sub-tasks

As a user, I want a one-off activity with a checklist to archive itself only once every item on the
checklist is done — including the exact moment I finish the last item.

- **PLANNER-006-AC-14** [AUTO]: When `PlanService.complete()` successfully completes a
  `PlannedOccurrence` targeting a `SubTask` whose parent `Activity` has `repeatable: false` and at
  least one other sub-task with no completed occurrence yet, then `PlanService` shall leave that
  `Activity`'s `archived` as `false`.
- **PLANNER-006-AC-15** [AUTO]: When `PlanService.complete()` successfully completes a
  `PlannedOccurrence` targeting the *last* of a non-repeatable, non-archived `Activity`'s sub-tasks
  to gain its first completed occurrence — i.e. completing sub-task N of N — then `PlanService`
  shall, within that same completion's transaction, set the parent `Activity`'s `archived` to `true`.
- **PLANNER-006-AC-16** [AUTO]: When `PlanService.complete()` runs its auto-archive check against an
  `Activity` that is already `archived`, then `PlanService` shall leave it archived without error,
  regardless of that activity's sub-task completion state — the check in Requirements 4/5 is a
  no-op once `archived` is already `true`.

### Requirement 6 — Repeatable activities never auto-archive

As a user, I want my recurring activities to stay in my active list forever, no matter how many
times I complete them.

- **PLANNER-006-AC-17** [AUTO]: When `PlanService.complete()` successfully completes any
  `PlannedOccurrence` — direct or via a `SubTask` — whose target `Activity` has `repeatable: true`,
  then `PlanService` shall never set that `Activity`'s `archived` to `true`, regardless of that
  activity's sub-task completion state.

### Requirement 7 — Every endpoint requires a session (inherited)

As the user, I want the new archive endpoints protected by my session like everything else, so my
activity bank isn't reachable without it.

- **PLANNER-006-AC-18** [AUTO — regression test, not new implementation]: The `SecurityFilterChain`
  (unchanged from `planner_spec_001_auth.md`) shall already require an authenticated session for
  `/api/v1/activities/{id}/archive` requests via its existing
  `.requestMatchers("/api/v1/**").authenticated()` rule; this spec adds a Spock test confirming the
  existing rule extends automatically to the new endpoints, without modifying `SecurityConfig`.

## Data model

`model/Activity.java` — adds `repeatable`/`archived` fields, a new 5-arg constructor overload (the
existing 4-arg constructor delegates to it with `repeatable=true`, so every existing call site
across `ActivityService`/test specs keeps compiling unchanged), a new 4-arg `update(...)` overload
(the existing 3-arg overload delegates to it preserving the current `repeatable` value, so
`SubTaskSpec.groovy`'s existing `activity.update(name, category, description)` call keeps working
unchanged), and two new mutator methods, `archive()`/`unarchive()`, that are the *only* way
`archived` is ever set — never from `update(...)`:

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

    @Column(nullable = false)
    private boolean repeatable;

    @Column(nullable = false)
    private boolean archived;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Activity() {
        // JPA
    }

    // Unchanged signature -- defaults repeatable to true, matching the DB column default.
    public Activity(String name, ActivityCategory category, String description, User owner) {
        this(name, category, description, true, owner);
    }

    public Activity(String name, ActivityCategory category, String description, boolean repeatable,
            User owner) {
        this.name = name;
        this.category = category;
        this.description = description;
        this.repeatable = repeatable;
        this.archived = false;
        this.owner = owner;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    // Unchanged signature -- preserves the current repeatable value.
    public void update(String name, ActivityCategory category, String description) {
        update(name, category, description, this.repeatable);
    }

    public void update(String name, ActivityCategory category, String description, boolean repeatable) {
        this.name = name;
        this.category = category;
        this.description = description;
        this.repeatable = repeatable;
        this.updatedAt = Instant.now();
    }

    // The only two places archived is ever set -- never from update(...), never client-supplied.
    public void archive() {
        this.archived = true;
        this.updatedAt = Instant.now();
    }

    public void unarchive() {
        this.archived = false;
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public User getOwner() { return owner; }
    public String getName() { return name; }
    public ActivityCategory getCategory() { return category; }
    public String getDescription() { return description; }
    public boolean isRepeatable() { return repeatable; }
    public boolean isArchived() { return archived; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
```

No new enum, no change to `SubTask.java` or `PlannedOccurrence.java`.

## Migration

`backend/src/main/resources/db/migration/V006__add_repeatable_and_archived_to_activities.sql` (next
migration number after `V005__create_completion_records_table.sql`, the highest existing at the
time this spec was written):

```sql
ALTER TABLE activities
    ADD COLUMN repeatable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Supports the new default-excludes-archived list query (Requirement 3) without a full table scan.
CREATE INDEX idx_activities_owner_archived ON activities(user_id, archived);
```

## Repository

`repository/ActivityRepository.java` gains one derived query for the default (non-archived) list
case; `findByOwnerOrderByNameAsc` is kept unmodified for the `includeArchived=true` case:

```java
public interface ActivityRepository extends JpaRepository<Activity, UUID> {
    List<Activity> findByOwnerOrderByNameAsc(User owner);
    List<Activity> findByOwnerAndArchivedFalseOrderByNameAsc(User owner);
    Optional<Activity> findByIdAndOwner(UUID id, User owner);
}
```

`repository/CompletionRecordRepository.java` gains one derived query, used by `PlanService`'s new
auto-archive check (Requirement 5) to determine, in one round trip, which of an activity's
sub-tasks already have at least one completed occurrence. This is a *fully derived* Spring Data
method name — nested-property traversal (`plannedOccurrence.subTask.id`, written with the
`_`-disambiguated path `PlannedOccurrence_SubTask_Id`) — not a hand-written `@Query`, so it still
fits this project's "plain `JpaRepository` extensions, no custom queries unless there's a real
complexity/scale reason" convention while covering a case the existing bulk single-week lookup
(`findByOwnerAndPlannedOccurrenceIdIn`, added for `planner_spec_004_week_planning.md`) can't: it
needs to check completion across *all* of a sub-task's occurrences ever, not one week's:

```java
public interface CompletionRecordRepository extends JpaRepository<CompletionRecord, UUID> {
    Optional<CompletionRecord> findByPlannedOccurrenceIdAndOwner(UUID plannedOccurrenceId, User owner);
    List<CompletionRecord> findByOwnerAndPlannedOccurrenceIdIn(User owner, List<UUID> plannedOccurrenceIds);

    // Added for planner_spec_006_repeatable_activities.md's auto-archive check (PLANNER-006-AC-14/
    // AC-15) -- one query returning every CompletionRecord whose target occurrence's subTask id is
    // in the given set, across all weeks, not just the current one. PlanService reduces this to the
    // *set* of subTaskIds that have at least one completed occurrence and compares it against the
    // activity's full sub-task id set.
    List<CompletionRecord> findByOwnerAndPlannedOccurrence_SubTask_IdIn(User owner, List<UUID> subTaskIds);
}
```

`SubTaskRepository`'s existing `findByActivityIdAndOwnerOrderByCreatedAtAsc` (from
`planner_spec_003_sub_tasks.md`) is reused unmodified to fetch an activity's full sub-task list for
this comparison.

## Service

`service/ActivityService.java` — `create`/`update`/`listForOwner` change shape, `archive`/
`unarchive` are new:

```java
@Transactional
public Activity create(String ownerUsername, ActivityRequest request) {
    User owner = resolveOwner(ownerUsername);
    boolean repeatable = request.repeatable() == null || request.repeatable();
    Activity activity = new Activity(request.name(), request.category(), request.description(),
        repeatable, owner);
    return activityRepository.save(activity);
}

@Transactional(readOnly = true)
public List<Activity> listForOwner(String ownerUsername, boolean includeArchived) {
    User owner = resolveOwner(ownerUsername);
    return includeArchived
        ? activityRepository.findByOwnerOrderByNameAsc(owner)
        : activityRepository.findByOwnerAndArchivedFalseOrderByNameAsc(owner);
}

@Transactional
public Optional<Activity> update(String ownerUsername, UUID id, ActivityRequest request) {
    User owner = resolveOwner(ownerUsername);
    boolean repeatable = request.repeatable() == null || request.repeatable();
    return activityRepository.findByIdAndOwner(id, owner)
        .map(activity -> {
            activity.update(request.name(), request.category(), request.description(), repeatable);
            return activity;
        });
}

@Transactional
public Optional<Activity> archive(String ownerUsername, UUID id) {
    User owner = resolveOwner(ownerUsername);
    return activityRepository.findByIdAndOwner(id, owner)
        .map(activity -> {
            activity.archive(); // idempotent -- a no-op if already archived (AC-06)
            return activity;
        });
}

@Transactional
public boolean unarchive(String ownerUsername, UUID id) {
    User owner = resolveOwner(ownerUsername);
    return activityRepository.findByIdAndOwner(id, owner)
        .map(activity -> {
            activity.unarchive();
            return true;
        })
        .orElse(false);
}
```

`ActivityRequest.repeatable()` is a nullable `Boolean`, not a primitive `boolean` — so a
create/update request that omits the field entirely (AC-01) is distinguishable from one that
explicitly sends `false` (AC-02), and the `null`-defaults-to-`true` mapping happens once, in the
service, not relying on Jackson's primitive-default behaviour.

`service/PlanService.java`'s `complete()` gains one line calling a new private helper, run inside
the existing `@Transactional` method, before the transaction closes:

```java
@Transactional
public Optional<CompletionRecord> complete(String ownerUsername, UUID id) {
    User owner = resolveOwner(ownerUsername);
    return plannedOccurrenceRepository.findByIdAndOwner(id, owner)
        .map(occurrence -> upsertCompletion(occurrence, owner))
        .map(completion -> {
            maybeAutoArchive(completion.getPlannedOccurrence(), owner);
            initializeCompletionChain(completion);
            return completion;
        });
}

private void maybeAutoArchive(PlannedOccurrence occurrence, User owner) {
    Activity activity = occurrence.getActivity() != null
        ? occurrence.getActivity()
        : occurrence.getSubTask().getActivity(); // lazy-loaded here, inside the open transaction --
                                                   // see the implementation note below.
    if (activity.isRepeatable() || activity.isArchived()) {
        return; // AC-16/AC-17
    }

    List<SubTask> subTasks = subTaskRepository.findByActivityIdAndOwnerOrderByCreatedAtAsc(
        activity.getId(), owner);
    boolean done;
    if (subTasks.isEmpty()) {
        done = true; // AC-13 -- this occurrence completing is itself the whole activity
    } else {
        List<UUID> subTaskIds = subTasks.stream().map(SubTask::getId).toList();
        Set<UUID> completedSubTaskIds = completionRecordRepository
            .findByOwnerAndPlannedOccurrence_SubTask_IdIn(owner, subTaskIds).stream()
            .map(record -> record.getPlannedOccurrence().getSubTask().getId())
            .collect(Collectors.toSet());
        done = completedSubTaskIds.containsAll(subTaskIds); // AC-14/AC-15
    }

    if (done) {
        activity.archive();
        activityRepository.save(activity);
    }
}
```

**Implementation note (AC-15's "last sub-task, same request" case)**: the `CompletionRecord` for
the sub-task being completed *right now* is saved by `upsertCompletion(...)` earlier in the same
method, before `maybeAutoArchive` runs — but that save may not yet be flushed to the database when
`findByOwnerAndPlannedOccurrence_SubTask_IdIn` executes as a fresh JPQL query. Hibernate's default
`FlushModeType.AUTO` flushes pending changes to affected tables before running a query that could be
affected by them, so this should resolve correctly without an explicit `flush()` call — but this is
exactly the scenario `PLANNER-006-AC-15`'s test case must actually exercise end-to-end (ideally
against real Postgres, mirroring `CompletionRecordRepositorySpec`'s precedent from
`planner_spec_004_week_planning.md`, not a mocked repository) rather than assumed from this note
alone.

`Activity` and `SubTask` are `LAZY` associations and open-in-view is disabled
(`application.yml`, per the existing note in `PlanService.initializeTarget`) — but
`occurrence.getSubTask().getActivity()` above is accessed *inside* `complete()`'s own
`@Transactional` scope, so the session is still open and this lazy-load succeeds; it would *not*
succeed if accessed later, in `PlanController`'s response mapping, after the transaction has
already closed (the same class of bug fixed for `occurrence.getActivity()`/`getSubTask()` during
`planner_spec_004_week_planning.md`'s implementation pass).

## DTOs (`dto/`)

```java
public record ActivityRequest(
    @NotBlank(message = "name is required") String name,
    @NotNull(message = "category is required") ActivityCategory category,
    String description,
    Boolean repeatable
) {}

public record ActivityResponse(
    UUID id, String name, ActivityCategory category, String description, boolean repeatable,
    boolean archived, Instant createdAt
) {}
```

Note `ActivityRequest` has no `archived` field at all (AC-04) — like `SubTaskRequest`'s precedent
for `category` in `planner_spec_003_sub_tasks.md`, this is a request-shape decision, not merely a
validation rule, so a client cannot even attempt to set or change it via create/update.

`ActivityController` gains two new endpoints and one new query parameter on the existing list
endpoint:

```java
@GetMapping
public ResponseEntity<ActivityListResponse> list(
        @RequestParam(required = false, defaultValue = "false") boolean includeArchived,
        Authentication authentication) {
    List<ActivityResponse> data = activityService.listForOwner(authentication.getName(), includeArchived)
        .stream().map(ActivityController::toResponse).toList();
    return ResponseEntity.ok(new ActivityListResponse(data, data.size()));
}

@PostMapping("/{id}/archive")
public ResponseEntity<ActivityResponse> archive(@PathVariable UUID id, Authentication authentication) {
    return activityService.archive(authentication.getName(), id)
        .map(activity -> ResponseEntity.ok(toResponse(activity)))
        .orElseGet(() -> ResponseEntity.notFound().build());
}

@DeleteMapping("/{id}/archive")
public ResponseEntity<Void> unarchive(@PathVariable UUID id, Authentication authentication) {
    boolean unarchived = activityService.unarchive(authentication.getName(), id);
    return unarchived ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
}

private static ActivityResponse toResponse(Activity activity) {
    return new ActivityResponse(activity.getId(), activity.getName(), activity.getCategory(),
        activity.getDescription(), activity.isRepeatable(), activity.isArchived(), activity.getCreatedAt());
}
```

## Cross-references

| This spec | Contracts against |
|---|---|
| `Activity` entity (`model/`) | Extended — new `repeatable`/`archived` fields, new 5-arg constructor + 4-arg `update(...)` overloads, new `archive()`/`unarchive()` mutators |
| `ActivityRequest`/`ActivityResponse` (`dto/`) | Extended — `repeatable` (nullable `Boolean`, request only), `archived` (response only, never request) |
| `ActivityController` (`controller/`) | Extended — `GET /api/v1/activities?includeArchived`, new `POST`/`DELETE /api/v1/activities/{id}/archive` |
| `ActivityService` (`service/`) | Extended — `listForOwner(ownerUsername, includeArchived)` signature change, new `archive`/`unarchive` methods |
| `ActivityRepository` (`repository/`) | Extended — new `findByOwnerAndArchivedFalseOrderByNameAsc` |
| `CompletionRecordRepository` (`repository/`) | Extended — new `findByOwnerAndPlannedOccurrence_SubTask_IdIn` |
| `PlanService.complete()` (`planner_spec_004_week_planning.md`) | Extended — new `maybeAutoArchive` step, same transaction |
| `SubTask`, `SubTaskRepository` (`planner_spec_003_sub_tasks.md`) | Reused unmodified — `findByActivityIdAndOwnerOrderByCreatedAtAsc` for the sub-task-completion check |
| `PlannedOccurrence`, `CompletionRecord` (`planner_spec_004_week_planning.md`) | Reused unmodified |
| `GlobalExceptionHandler` (`exception/`) | Reused unmodified — no new exception type needed, both archive endpoints resolve to a plain `Optional`/`boolean` 404 path like `ActivityController.update`/`delete` already do |
| `V006__add_repeatable_and_archived_to_activities.sql` | New migration |
| `frontend_spec_006_repeatable_activities.md` | Paired frontend spec — consumes these endpoints exactly as specified here |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-006-AC-01: omitting repeatable on create defaults it to true"() {
    given: "a create request with no repeatable field"
        def request = new ActivityRequest("Go for a walk", ActivityCategory.PLEASURABLE, null, null)

    when: "POST /api/v1/activities is requested"
        def response = client.post().uri("/api/v1/activities").body(request).exchange()

    then: "the response is 201 with repeatable true"
        response.expectStatus().isCreated()
        response.expectBody().jsonPath("$.repeatable").isEqualTo(true)
}

def "PLANNER-006-AC-02: explicit repeatable false is honoured on create"() {
    given: "a create request with repeatable: false"
        def request = new ActivityRequest("Apply for jobs", ActivityCategory.NECESSARY, null, false)

    when: "POST /api/v1/activities is requested"
        def response = client.post().uri("/api/v1/activities").body(request).exchange()

    then: "the response is 201 with repeatable false"
        response.expectStatus().isCreated()
        response.expectBody().jsonPath("$.repeatable").isEqualTo(false)
}

def "PLANNER-006-AC-06: archiving an already-archived activity is an idempotent 200, not an error"() {
    given: "an already-archived activity"
        def activity = activityRepository.save(
            new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, currentUser))
        activity.archive()
        activityRepository.save(activity)

    when: "POST .../archive is requested again"
        def response = client.post().uri("/api/v1/activities/${activity.id}/archive").exchange()

    then: "the response is 200, still archived, no error"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("$.archived").isEqualTo(true)
}

def "PLANNER-006-AC-10/AC-11: GET /api/v1/activities excludes archived by default, includes with includeArchived=true"() {
    given: "one active and one archived activity"
        def active = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.PLEASURABLE, null, true, currentUser))
        def archived = activityRepository.save(
            new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, currentUser))
        archived.archive()
        activityRepository.save(archived)

    expect: "the default list excludes the archived activity"
        def defaultResponse = client.get().uri("/api/v1/activities").exchange()
        defaultResponse.expectBody().jsonPath("$.count").isEqualTo(1)
        defaultResponse.expectBody().jsonPath("$.data[0].id").isEqualTo(active.id.toString())

    and: "includeArchived=true returns both"
        def fullResponse = client.get().uri("/api/v1/activities?includeArchived=true").exchange()
        fullResponse.expectBody().jsonPath("$.count").isEqualTo(2)
}

def "PLANNER-006-AC-13: completing a one-off activity's own occurrence with no sub-tasks auto-archives it"() {
    given: "a non-repeatable activity with no sub-tasks, planned this week"
        def activity = activityRepository.save(
            new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, currentUser))
        def occurrence = createOccurrenceFor(activity, weekStart)

    when: "the occurrence is completed"
        def response = client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/completion").exchange()

    then: "the response succeeds and the activity is now archived"
        response.expectStatus().isOk()
        activityRepository.findById(activity.id).get().archived
}

def "PLANNER-006-AC-14/AC-15: completing the last of N sub-tasks archives the parent in that same request"() {
    given: "a non-repeatable activity with two sub-tasks, one already completed"
        def activity = activityRepository.save(
            new Activity("Organise a leaving party", ActivityCategory.PLEASURABLE, null, false, currentUser))
        def firstSubTask = subTaskRepository.save(
            new SubTask(activity, "Book a venue", activity.category, currentUser))
        def secondSubTask = subTaskRepository.save(
            new SubTask(activity, "Send invitations", activity.category, currentUser))
        def firstOccurrence = createOccurrenceFor(firstSubTask, weekStart)
        def secondOccurrence = createOccurrenceFor(secondSubTask, weekStart)
        client.post().uri("/api/v1/plan/occurrences/${firstOccurrence.id}/completion").exchange()

    expect: "the activity is not yet archived after only the first sub-task completes"
        !activityRepository.findById(activity.id).get().archived

    when: "the second (last remaining) sub-task's occurrence is completed"
        def response = client.post()
            .uri("/api/v1/plan/occurrences/${secondOccurrence.id}/completion").exchange()

    then: "the response succeeds and the parent activity is archived, in that same request"
        response.expectStatus().isOk()
        activityRepository.findById(activity.id).get().archived
}

def "PLANNER-006-AC-17: a repeatable activity never auto-archives, however many times it's completed"() {
    given: "a repeatable activity with no sub-tasks"
        def activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.PLEASURABLE, null, true, currentUser))
        def occurrence = createOccurrenceFor(activity, weekStart)

    when: "the occurrence is completed"
        client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/completion").exchange()

    then: "the activity is still not archived"
        !activityRepository.findById(activity.id).get().archived
}

def "PLANNER-006-AC-07/AC-09: archive/unarchive on another user's activity returns 404"() {
    given: "an activity owned by a different user"
        def othersActivity = activityRepository.save(
            new Activity("Not mine", ActivityCategory.ROUTINE, null, true, otherUser))

    expect: "archiving it returns 404"
        client.post().uri("/api/v1/activities/${othersActivity.id}/archive")
            .exchange().expectStatus().isNotFound()

    and: "unarchiving it also returns 404"
        client.delete().uri("/api/v1/activities/${othersActivity.id}/archive")
            .exchange().expectStatus().isNotFound()
}
```

**Test Case (Green)**: implement `Activity`/`ActivityRequest`/`ActivityResponse`/`ActivityRepository`/
`ActivityService`/`ActivityController`/`CompletionRecordRepository`/`PlanService` as specified above
until every sketch above (and the remaining ACs not sketched: AC-03/AC-04/AC-05/AC-08/AC-12/AC-16/
AC-18) passes.

## Acceptance Criteria Summary

- [ ] PLANNER-006-AC-01 — omitting `repeatable` on create defaults it to `true`
- [ ] PLANNER-006-AC-02 — explicit `repeatable: false` honoured on create
- [ ] PLANNER-006-AC-03 — `repeatable` editable via `PUT /api/v1/activities/{id}`
- [ ] PLANNER-006-AC-04 — `ActivityRequest` has no `archived` field; client-supplied value ignored
- [ ] PLANNER-006-AC-05 — `POST .../archive` succeeds, 200, `archived: true`
- [ ] PLANNER-006-AC-06 — `POST .../archive` on an already-archived activity is an idempotent 200
- [ ] PLANNER-006-AC-07 — `POST .../archive` on not-found/not-owned → 404
- [ ] PLANNER-006-AC-08 — `DELETE .../archive` succeeds, 204, `archived: false`
- [ ] PLANNER-006-AC-09 — `DELETE .../archive` on not-found/not-owned → 404
- [ ] PLANNER-006-AC-10 — `GET /api/v1/activities` default excludes archived
- [ ] PLANNER-006-AC-11 — `includeArchived=true` includes archived activities
- [ ] PLANNER-006-AC-12 — mixed-result ordering by name unaffected by `archived` state
- [ ] PLANNER-006-AC-13 — no-sub-tasks completion auto-archives a non-repeatable activity
- [ ] PLANNER-006-AC-14 — not-all-sub-tasks-complete leaves `archived` false
- [ ] PLANNER-006-AC-15 — completing the last (Nth of N) sub-task archives the parent in that request
- [ ] PLANNER-006-AC-16 — auto-archive check on an already-archived activity is a no-op
- [ ] PLANNER-006-AC-17 — repeatable activities never auto-archive regardless of completion
- [ ] PLANNER-006-AC-18 — existing `SecurityFilterChain` rule already covers the new endpoints (regression test, no `SecurityConfig` change)
