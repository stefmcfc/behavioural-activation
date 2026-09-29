# Week Planning (Backend)

**Status**: Implemented (backend + frontend) — all 37 backend ACs verified (2026-09-29). Pass 1
covered Requirements 1-4 (view/create/move/remove a `PlannedOccurrence`) and the `PlannedOccurrence`
half of Requirement 7's cascade delete. Pass 2 added Requirements 5-6 (`CompletionRecord`,
complete/undo/carry-forward) and the `CompletionRecord` half of Requirement 7's cascade delete.
Frontend consumption of these endpoints (`frontend_spec_004_week_planning.md`, all 40 ACs) is now
also implemented and verified end-to-end against this backend — see that spec's Status header. That
pass found and fixed one real backend gap not caught by `PlanControllerSpec` (which mocks
`PlanService` with plain in-memory entities, not real Hibernate proxies): `PlanController`'s
response mapping reads `occurrence.getActivity()/getSubTask()` (LAZY associations) after the
`@Transactional` `PlanService` method that loaded them has already returned (`open-in-view: false`
means the Hibernate session closes with it), throwing `LazyInitializationException` on `GET
/api/v1/plan`, `move`, `complete`, and `carryForward` as soon as a real, non-freshly-constructed
entity was involved. Fixed in `PlanService` with `Hibernate.initialize()` calls inside the
transactional methods before the entity crosses that boundary; all 155 backend Spock tests still
pass afterwards (0 regressions). Backend detail: `backend/src/main/java/uk/co/stefirby/
behaviouralactivation/{model/PlanSlot.java, model/PlannedOccurrence.java, model/CompletionRecord.java,
repository/PlannedOccurrenceRepository.java, repository/CompletionRecordRepository.java,
service/PlanService.java, controller/PlanController.java, dto/PlannedOccurrenceRequest.java,
dto/PlannedOccurrenceMoveRequest.java, dto/PlannedOccurrenceResponse.java,
dto/PlannedOccurrenceListResponse.java, exception/InvalidPlanRequestException.java,
exception/CarryForwardNotAllowedException.java}`, `backend/src/main/resources/db/migration/
{V004__create_planned_occurrences_table.sql, V005__create_completion_records_table.sql}`. Also added
`SubTaskRepository.findByIdAndOwner` (a plain owner-scoped lookup by sub-task id alone, needed
because `POST /api/v1/plan/occurrences` carries only a `subTaskId`, not an `activityId`).
`GlobalExceptionHandler` gained two new `@ExceptionHandler` methods: `InvalidPlanRequestException` →
400 (pass 1), `CarryForwardNotAllowedException` → 409 (pass 2). `PlannedOccurrenceResponse` now
carries `completed`/`completedAt`, resolved per-response from `CompletionRecord` lookups (bulk via
`PlanService.findCompletions` for `GET /api/v1/plan`, single via `PlanService.findCompletion` for
`PATCH`) rather than being stored on `PlannedOccurrence` itself. All `[AUTO]` ACs verified by Spock
specs under `backend/src/test/groovy/.../{model,service,controller,repository}/` —
`PlannedOccurrenceSpec`, `PlanServiceSpec`, `PlanControllerSpec`, `PlannedOccurrenceRepositorySpec`
(pass 1) and a new `CompletionRecordRepositorySpec` (pass 2) — both repository specs are real-Postgres
integration tests, not mocked, for the `ON DELETE CASCADE`/`CHECK` constraints AC-11/AC-32/AC-33/
AC-34 guarantee at the database level. Full suite: 155 tests, 0 failures (`gradlew.bat test`, run
against the real Postgres instance via Docker Compose — the `V004`/`V005` migrations apply cleanly
alongside `V001`-`V003`).
**Priority**: P1 — last of the 4 V1 spec pairs.
**Depends on**: `planner_spec_002_activity_bank.md` (`Activity` entity, `ActivityCategory` enum,
`ActivityRepository` owner-scoping pattern), `planner_spec_003_sub_tasks.md` (`SubTask` entity,
owner-scoping pattern, and its forward-contract note that a `PlannedOccurrence` references either
an `Activity` or a `SubTask`, never both)
**Area**: Backend
**Roadmap version**: V1

## Overview

Builds the weekly planner backend: a Monday–Friday Morning/Afternoon/Evening grid plus a flexible
weekend bucket list, backed by one unified `PlannedOccurrence` entity and a separate
`CompletionRecord` entity. This delivers Epics 2–4 of `.claude/HIGH_LEVEL_DESIGN.md` — US-003
(view a weekly plan), US-004 (plan/move/remove an activity), US-005 (record work — see below),
US-006 (plan a weekday in advance, edit without penalty), US-007 (weekend bucket list, including
carry-forward), US-008 (balance weekend activities), and US-009 (complete an activity, including
undo). US-010 (mood), US-011 (pleasure/achievement), and US-012 (recurring activities) are V2 and
explicitly out of scope here.

A single entity covers both weekday-scheduled and weekend-bucket items: a `PlannedOccurrence` with
a nullable `dayOfWeek`+`slot` pair — both set means "scheduled", both null means "still in the
bucket". This avoids two parallel tables/endpoints for what is, functionally, one thing at
different stages (US-007's "move an activity from the bucket list into a scheduled slot" is then a
single-field-pair update, not a cross-table move). `GET /api/v1/plan?weekStart=...` doubles as
"basic activity history" — navigating `weekStart` to a past Monday is the only history mechanism
needed for V1; there is no separate history endpoint (already recorded in
`.claude/ideas/future_ideas.md`'s "Dedicated activity-history view/endpoint" entry).

**Two design assumptions, confirmed explicitly before this spec was written:**
1. A weekend-bucket item can be promoted into *any* day's slot via `PATCH
   /api/v1/plan/occurrences/{id}` — there is no backend restriction tying bucket items to Saturday/
   Sunday specifically. "Weekend bucket" describes the common case, not an enforced constraint.
2. US-008 ("balance weekend activities") is a simple non-numeric signal — the frontend flags a
   category with zero occurrences in the current bucket while at least one other category has
   ≥1 — computed client-side from this spec's `GET /api/v1/plan` response. There is no backend
   endpoint or field for it; nothing here computes or returns a balance/ratio value.

**US-005 ("record work") needs no special modeling.** Work is planned exactly like any other
activity — the user creates an `Activity` (e.g. "Work", categorised `ROUTINE` or `NECESSARY`) in
their existing bank and plans/completes it via this spec's endpoints like anything else. There is
no `isWorkBlock` flag, no work-specific endpoint, and no work-specific validation anywhere in this
spec.

**Out of scope**: mood/pleasure/achievement ratings (`MoodRating` etc. — US-010/US-011, V2);
recurring activities (US-012, V2) — no `recurrence` field or generation logic on `Activity` or
`PlannedOccurrence`; per-occurrence category override (US-002's remaining AC — deferred, same as
`planner_spec_002_activity_bank.md`'s own out-of-scope note); a dedicated history endpoint (see
above — `weekStart` navigation covers it); drag-and-drop, finer-grained/custom time slots (both
already deferred in `future_ideas.md`); the "mark activities as repeatable vs one-off" idea raised
during this spec's design session — deliberately deferred to *after* this pair ships, since it
depends on completion tracking existing first (see `future_ideas.md`'s corresponding entry, added
2026-09-29, left as-is by this spec).

## Requirements

### Requirement 1 — View a week's plan

As a user, I want to see my week divided into Morning/Afternoon/Evening per day plus a weekend
bucket list, so I can plan around my normal routine (US-003) and later look back at what I did
(US-009's "appear in history").

- **PLANNER-004-AC-01** [AUTO]: When `GET /api/v1/plan?weekStart={Monday}` is requested by the
  owner, the `PlanController` shall return `200` with all of that owner's `PlannedOccurrence`s for
  that week — both scheduled (`dayOfWeek`+`slot` set) and weekend-bucket (`dayOfWeek`+`slot` null)
  — ordered by `createdAt` ascending.
- **PLANNER-004-AC-02** [AUTO]: The `GET /api/v1/plan` response body shall be the envelope shape
  `{ "data": [...], "count": N }`, matching the established list-response convention.
- **PLANNER-004-AC-03** [AUTO]: If `GET /api/v1/plan` is requested without a `weekStart` query
  parameter, then the `PlanController` shall return `400`.
- **PLANNER-004-AC-04** [AUTO]: If `GET /api/v1/plan` is requested with a `weekStart` that is not a
  Monday, then the `PlanController` shall return `400` without querying for occurrences.
- **PLANNER-004-AC-05** [AUTO]: If the owner has zero `PlannedOccurrence`s for the requested week,
  then `GET /api/v1/plan` shall return `200` with `{ "data": [], "count": 0 }`, not `404` — an
  empty week (including any past week with nothing planned) is a valid, ordinary state.

### Requirement 2 — Plan (create) an occurrence

As a user, I want to assign an activity or sub-task from my bank to a day and time slot, or to my
weekend bucket list, so I can build out my week in advance (US-004, US-006).

- **PLANNER-004-AC-06** [AUTO]: When `POST /api/v1/plan/occurrences` is requested by the owner with
  a valid `activityId`, a Monday `weekStart`, and both `dayOfWeek` and `slot` set, the `PlanService`
  shall create a scheduled `PlannedOccurrence` and the `PlanController` shall return `201` with the
  created occurrence.
- **PLANNER-004-AC-07** [AUTO]: When `POST /api/v1/plan/occurrences` is requested with a valid
  `subTaskId`, a Monday `weekStart`, and no `dayOfWeek`/`slot`, the `PlanService` shall create a
  weekend-bucket `PlannedOccurrence` (`dayOfWeek` and `slot` both null) and the `PlanController`
  shall return `201`.
- **PLANNER-004-AC-08** [AUTO]: The `PlanService` shall set the created `PlannedOccurrence`'s
  `category` by copying the referenced `Activity`'s or `SubTask`'s current `category` at creation
  time — never a live reference, and never client-supplied — mirroring
  `planner_spec_003_sub_tasks.md`'s snapshot-not-live-reference principle (PLANNER-003-AC-02).
- **PLANNER-004-AC-09** [AUTO]: The `PlanService` shall assign the created `PlannedOccurrence`'s
  owner from the authenticated principal resolved via `SecurityContextHolder`, never from a
  client-supplied field in the request body.
- **PLANNER-004-AC-10** [AUTO]: If `POST /api/v1/plan/occurrences` is requested with neither
  `activityId` nor `subTaskId` set, or with both set, then the `PlanController` shall return `400`
  without creating a `PlannedOccurrence`.
- **PLANNER-004-AC-11** [AUTO]: The `planned_occurrences` table shall enforce, via the
  `chk_planned_occurrences_exactly_one_target` `CHECK` constraint, that exactly one of
  `activity_id`/`sub_task_id` is set — a database-level guarantee independent of AC-10's
  application-level validation.
- **PLANNER-004-AC-12** [AUTO]: If `POST /api/v1/plan/occurrences` is requested with exactly one of
  `dayOfWeek`/`slot` set (not both, and not neither), then the `PlanController` shall return `400`
  without creating a `PlannedOccurrence`.
- **PLANNER-004-AC-13** [AUTO]: If `POST /api/v1/plan/occurrences` is requested with a missing or
  non-Monday `weekStart`, then the `PlanController` shall return `400` without creating a
  `PlannedOccurrence`.
- **PLANNER-004-AC-14** [AUTO]: If `POST /api/v1/plan/occurrences` references an `activityId` that
  does not exist or does not belong to the authenticated user, then the `PlanController` shall
  return `404` without creating a `PlannedOccurrence`.
- **PLANNER-004-AC-15** [AUTO]: If `POST /api/v1/plan/occurrences` references a `subTaskId` that
  does not exist or does not belong to the authenticated user, then the `PlanController` shall
  return `404` without creating a `PlannedOccurrence`.

### Requirement 3 — Move an occurrence

As a user, I want to reschedule a planned activity to a different day/slot, promote a bucket item
into a slot, or demote a scheduled item back to the bucket, so my plan stays realistic as
circumstances change without penalty (US-004, US-006, US-007).

- **PLANNER-004-AC-16** [AUTO]: When `PATCH /api/v1/plan/occurrences/{id}` is requested by the
  owner with both `dayOfWeek` and `slot` set, the `PlanService` shall update the
  `PlannedOccurrence` to that day/slot — rescheduling an already-scheduled item, or promoting a
  bucket item into a slot — and the `PlanController` shall return `200` with the updated occurrence.
- **PLANNER-004-AC-17** [AUTO]: When `PATCH /api/v1/plan/occurrences/{id}` is requested with both
  `dayOfWeek` and `slot` cleared (null), the `PlanService` shall demote the `PlannedOccurrence` back
  to a weekend-bucket item, leaving its `weekStart` unchanged, and the `PlanController` shall return
  `200`.
- **PLANNER-004-AC-18** [AUTO]: If `PATCH /api/v1/plan/occurrences/{id}` is requested with exactly
  one of `dayOfWeek`/`slot` set, then the `PlanController` shall return `400` without applying any
  change.
- **PLANNER-004-AC-19** [AUTO]: If `PATCH /api/v1/plan/occurrences/{id}` is requested for an `id`
  that does not exist or does not belong to the authenticated user, then the `PlanController` shall
  return `404` without applying any change.

### Requirement 4 — Remove an occurrence

As a user, I want to remove a planned activity from my week without deleting it from my activity
bank, so I can change my mind without losing the underlying activity (US-004).

- **PLANNER-004-AC-20** [AUTO]: When `DELETE /api/v1/plan/occurrences/{id}` is requested by the
  owner, the `PlanService` shall permanently delete the `PlannedOccurrence` (and, via cascade, its
  `CompletionRecord` if any) and the `PlanController` shall return `204`, without deleting the
  underlying `Activity` or `SubTask` from the user's bank.
- **PLANNER-004-AC-21** [AUTO]: If `DELETE /api/v1/plan/occurrences/{id}` is requested for an `id`
  that does not exist or does not belong to the authenticated user, then the `PlanController` shall
  return `404` without deleting anything.

### Requirement 5 — Complete and undo

As a user, I want to mark a planned activity as done and be able to undo that if I mis-tapped, so I
can see what I actually did without it being irreversible (US-009).

- **PLANNER-004-AC-22** [AUTO]: When `POST /api/v1/plan/occurrences/{id}/completion` is requested
  by the owner, the `PlanService` shall create a `CompletionRecord` with `completedAt` set to the
  current time, and the `PlanController` shall return `200` with the occurrence reflecting
  `completed: true` (not `201` — this endpoint is idempotent-simple by design, see AC-23).
- **PLANNER-004-AC-23** [AUTO]: When `POST /api/v1/plan/occurrences/{id}/completion` is requested
  for an occurrence that already has a `CompletionRecord`, the `PlanService` shall update that
  record's `completedAt` to the current time rather than creating a second record — re-completing
  is idempotent, not an error.
- **PLANNER-004-AC-24** [AUTO]: When `DELETE /api/v1/plan/occurrences/{id}/completion` is requested
  by the owner, the `PlanService` shall delete the occurrence's `CompletionRecord` and the
  `PlanController` shall return `204`.
- **PLANNER-004-AC-25** [AUTO]: If `DELETE /api/v1/plan/occurrences/{id}/completion` is requested
  for an occurrence with no current `CompletionRecord`, then the `PlanController` shall return `404`
  without effect.
- **PLANNER-004-AC-26** [AUTO]: If either completion endpoint is requested for an `id` that does not
  exist or does not belong to the authenticated user, then the `PlanController` shall return `404`.
- **PLANNER-004-AC-27** [AUTO]: The `GET /api/v1/plan` response shall reflect each occurrence's
  completion state via `completed` and `completedAt` fields, so a completed occurrence remains
  visible with its completion timestamp when the week is viewed again later — this, combined with
  `weekStart` navigation (AC-01), is what satisfies "completed activities appear in history"
  without a separate history endpoint.

### Requirement 6 — Carry a bucket item forward

As a user, I want to carry an unfinished weekend bucket-list item forward to next week instead of
losing it, so an unfinished intention isn't just discarded (US-007).

- **PLANNER-004-AC-28** [AUTO]: When `POST /api/v1/plan/occurrences/{id}/carry-forward` is
  requested by the owner for a weekend-bucket occurrence (`dayOfWeek` and `slot` both null) that is
  not complete, the `PlanService` shall advance its `weekStart` by 7 days, keeping the same
  occurrence `id` (continuous identity, not a new row), and the `PlanController` shall return `200`
  with the updated occurrence.
- **PLANNER-004-AC-29** [AUTO]: If `POST /api/v1/plan/occurrences/{id}/carry-forward` is requested
  for an occurrence that currently has `dayOfWeek` and `slot` set, then the `PlanController` shall
  return `409` without changing its `weekStart`.
- **PLANNER-004-AC-30** [AUTO]: If `POST /api/v1/plan/occurrences/{id}/carry-forward` is requested
  for an occurrence that is already complete, then the `PlanController` shall return `409` without
  changing its `weekStart`.
- **PLANNER-004-AC-31** [AUTO]: If `POST /api/v1/plan/occurrences/{id}/carry-forward` is requested
  for an `id` that does not exist or does not belong to the authenticated user, then the
  `PlanController` shall return `404`.

### Requirement 7 — Cascade delete keeps plan data consistent

As a user, I want deleting an activity, sub-task, or planned occurrence to clean up everything that
depends on it automatically, so I never end up with orphaned plan or completion data.

- **PLANNER-004-AC-32** [AUTO]: When an `Activity` row is deleted, the database shall cascade-delete
  all `planned_occurrences` rows referencing it via `fk_planned_occurrences_activity`'s `ON DELETE
  CASCADE`, without `ActivityService`/`PlanService` deleting them explicitly.
- **PLANNER-004-AC-33** [AUTO]: When a `SubTask` row is deleted, the database shall cascade-delete
  all `planned_occurrences` rows referencing it via `fk_planned_occurrences_sub_task`'s `ON DELETE
  CASCADE`, without `SubTaskService`/`PlanService` deleting them explicitly.
- **PLANNER-004-AC-34** [AUTO]: When a `PlannedOccurrence` row is deleted, the database shall
  cascade-delete its `completion_records` row (if any) via
  `fk_completion_records_planned_occurrence`'s `ON DELETE CASCADE`, without `PlanService` deleting
  it explicitly.

### Requirement 8 — Owner scoping and not-found/cross-owner indistinguishability

As a user, I want another user's planned-occurrence IDs to be completely unreachable to me, so my
plan and completion data can't leak by ID guessing.

- **PLANNER-004-AC-35** [AUTO]: The `PlannedOccurrence` and `CompletionRecord` entities shall each
  persist their own `owner` (`User`) reference directly, per the multi-user owner seam in
  `.claude/steering/structure.md`.
- **PLANNER-004-AC-36** [AUTO]: If any `/api/v1/plan/...` request references an `id` that either
  does not exist or belongs to a different owner, then the `PlanService` shall respond `404` in both
  cases identically — never `403`, and never a response body that reveals whether the resource
  exists under another owner.

### Requirement 9 — Every endpoint requires a session (inherited)

As the user, I want plan endpoints protected by my session like everything else, so my plan and
completion data isn't reachable without it.

- **PLANNER-004-AC-37** [AUTO — regression test, not new implementation]: The `SecurityFilterChain`
  (unchanged from `planner_spec_001_auth.md`) shall already require an authenticated session for
  all `/api/v1/plan/**` requests via its existing `.requestMatchers("/api/v1/**").authenticated()`
  rule; this spec adds a Spock test confirming the existing rule extends automatically to the new
  plan endpoints, without modifying `SecurityConfig`.

## Data model

`model/PlanSlot.java` (new enum):

```java
package uk.co.stefirby.behaviouralactivation.model;

/** A coarse time-of-day slot for a scheduled {@link PlannedOccurrence} (US-003). Deliberately
 * coarse, not clock-time — see {@code .claude/ideas/future_ideas.md}'s "Finer-grained/custom time
 * slots" entry for why this is left as a simple three-value enum for V1. */
public enum PlanSlot {
    MORNING,
    AFTERNOON,
    EVENING
}
```

`model/PlannedOccurrence.java` — mirrors `Activity`/`SubTask`'s style (mutation via named methods,
no bare setters). Exactly one of `activity`/`subTask` is set (enforced by `chk_planned_occurrences_
exactly_one_target`, AC-11); `dayOfWeek`/`slot` are both null (bucket) or both set (scheduled),
never mixed (enforced at the application level, AC-12/AC-18, and additionally at the database level
by `chk_planned_occurrences_day_slot_together`):

```java
@Entity
@Table(name = "planned_occurrences")
public class PlannedOccurrence {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id")
    private Activity activity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sub_task_id")
    private SubTask subTask;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActivityCategory category;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week")
    private DayOfWeek dayOfWeek;

    @Enumerated(EnumType.STRING)
    private PlanSlot slot;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PlannedOccurrence() {
        // JPA
    }

    public PlannedOccurrence(Activity activity, SubTask subTask, ActivityCategory category,
            LocalDate weekStart, DayOfWeek dayOfWeek, PlanSlot slot, User owner) {
        this.activity = activity;
        this.subTask = subTask;
        this.category = category;
        this.weekStart = weekStart;
        this.dayOfWeek = dayOfWeek;
        this.slot = slot;
        this.owner = owner;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void assignSlot(DayOfWeek dayOfWeek, PlanSlot slot) {
        this.dayOfWeek = dayOfWeek;
        this.slot = slot;
        this.updatedAt = Instant.now();
    }

    public void moveToBucket() {
        this.dayOfWeek = null;
        this.slot = null;
        this.updatedAt = Instant.now();
    }

    public void carryForward() {
        this.weekStart = this.weekStart.plusDays(7);
        this.updatedAt = Instant.now();
    }

    public boolean isBucketItem() {
        return dayOfWeek == null && slot == null;
    }

    public UUID getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public Activity getActivity() {
        return activity;
    }

    public SubTask getSubTask() {
        return subTask;
    }

    public ActivityCategory getCategory() {
        return category;
    }

    public LocalDate getWeekStart() {
        return weekStart;
    }

    public DayOfWeek getDayOfWeek() {
        return dayOfWeek;
    }

    public PlanSlot getSlot() {
        return slot;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
```

`model/CompletionRecord.java`:

```java
@Entity
@Table(name = "completion_records")
public class CompletionRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "planned_occurrence_id", nullable = false, unique = true)
    private PlannedOccurrence plannedOccurrence;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected CompletionRecord() {
        // JPA
    }

    public CompletionRecord(PlannedOccurrence plannedOccurrence, User owner, Instant completedAt) {
        this.plannedOccurrence = plannedOccurrence;
        this.owner = owner;
        this.completedAt = completedAt;
        this.createdAt = Instant.now();
    }

    public void recompleteAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public UUID getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public PlannedOccurrence getPlannedOccurrence() {
        return plannedOccurrence;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
```

No new `ActivityCategory` values — reused unmodified from `planner_spec_002_activity_bank.md`.

## Migrations

`backend/src/main/resources/db/migration/V004__create_planned_occurrences_table.sql` (next
migration number after `V003__create_sub_tasks_table.sql`, the highest existing at the time this
spec was written):

```sql
CREATE TABLE planned_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    activity_id UUID,
    sub_task_id UUID,
    category VARCHAR(20) NOT NULL,
    week_start DATE NOT NULL,
    day_of_week VARCHAR(10),
    slot VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_planned_occurrences_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_planned_occurrences_activity FOREIGN KEY (activity_id)
        REFERENCES activities(id) ON DELETE CASCADE,
    CONSTRAINT fk_planned_occurrences_sub_task FOREIGN KEY (sub_task_id)
        REFERENCES sub_tasks(id) ON DELETE CASCADE,
    CONSTRAINT chk_planned_occurrences_category CHECK (category IN ('ROUTINE', 'NECESSARY', 'PLEASURABLE')),
    CONSTRAINT chk_planned_occurrences_slot CHECK (slot IS NULL OR slot IN ('MORNING', 'AFTERNOON', 'EVENING')),
    CONSTRAINT chk_planned_occurrences_day_of_week CHECK (day_of_week IS NULL OR day_of_week IN
        ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
    CONSTRAINT chk_planned_occurrences_day_slot_together CHECK (
        (day_of_week IS NULL AND slot IS NULL) OR (day_of_week IS NOT NULL AND slot IS NOT NULL)
    ),
    CONSTRAINT chk_planned_occurrences_exactly_one_target CHECK (
        (activity_id IS NOT NULL) != (sub_task_id IS NOT NULL)
    )
);

CREATE INDEX idx_planned_occurrences_user_week ON planned_occurrences(user_id, week_start);
CREATE INDEX idx_planned_occurrences_activity_id ON planned_occurrences(activity_id);
CREATE INDEX idx_planned_occurrences_sub_task_id ON planned_occurrences(sub_task_id);
```

`backend/src/main/resources/db/migration/V005__create_completion_records_table.sql`:

```sql
CREATE TABLE completion_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    planned_occurrence_id UUID NOT NULL UNIQUE,
    completed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_completion_records_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_completion_records_planned_occurrence FOREIGN KEY (planned_occurrence_id)
        REFERENCES planned_occurrences(id) ON DELETE CASCADE
);

CREATE INDEX idx_completion_records_user_id ON completion_records(user_id);
```

## Repositories

```java
public interface PlannedOccurrenceRepository extends JpaRepository<PlannedOccurrence, UUID> {
    List<PlannedOccurrence> findByOwnerAndWeekStartOrderByCreatedAtAsc(User owner, LocalDate weekStart);
    Optional<PlannedOccurrence> findByIdAndOwner(UUID id, User owner);
}

public interface CompletionRecordRepository extends JpaRepository<CompletionRecord, UUID> {
    Optional<CompletionRecord> findByPlannedOccurrenceIdAndOwner(UUID plannedOccurrenceId, User owner);
    List<CompletionRecord> findByOwnerAndPlannedOccurrenceIdIn(User owner, List<UUID> plannedOccurrenceIds);
}
```

`findByOwnerAndPlannedOccurrenceIdIn` exists purely to avoid N+1 queries when `PlanService` builds
the `GET /api/v1/plan` response — one bulk lookup of completion state for the whole week's
occurrences, not one query per occurrence.

## Service and validation notes

`PlanService` (new) owns all validation and owner-scoping, matching `SubTaskService`'s precedent —
`PlanController` stays a thin delegate. Two new exception types are needed, both mapped by new
`@ExceptionHandler` methods added to the existing `GlobalExceptionHandler` (no other change to that
class):

- `InvalidPlanRequestException` → `400` — thrown for a non-Monday/missing `weekStart`, a
  zero-or-both `activityId`/`subTaskId` combination, or an unpaired `dayOfWeek`/`slot` (AC-04,
  AC-10, AC-12, AC-13, AC-18).
- `CarryForwardNotAllowedException` → `409` — thrown when `carry-forward` is requested for a
  scheduled (non-bucket) or already-complete occurrence (AC-29, AC-30).

Business-rule validation (the two exceptions above) is checked before ownership lookups, so a
malformed request never leaks whether a referenced `activityId`/`subTaskId` exists under another
owner (e.g. a 400 for "both set" is returned before any repository lookup runs).

## DTOs (`dto/`)

```java
public record PlannedOccurrenceRequest(
    UUID activityId,
    UUID subTaskId,
    @NotNull(message = "weekStart is required") LocalDate weekStart,
    DayOfWeek dayOfWeek,
    PlanSlot slot
) {}

public record PlannedOccurrenceMoveRequest(
    DayOfWeek dayOfWeek,
    PlanSlot slot
) {}

public record PlannedOccurrenceResponse(
    UUID id,
    UUID activityId,
    UUID subTaskId,
    String name,
    ActivityCategory category,
    LocalDate weekStart,
    DayOfWeek dayOfWeek,
    PlanSlot slot,
    boolean completed,
    Instant completedAt,
    Instant createdAt
) {}

public record PlannedOccurrenceListResponse(List<PlannedOccurrenceResponse> data, int count) {}
```

`name` is resolved live from `activity.getName()`/`subTask.getName()` at response-mapping time — it
is never stored on `PlannedOccurrence` itself. Only `category` is a creation-time snapshot (AC-08);
if the underlying activity or sub-task is later renamed, the planned occurrence's displayed `name`
follows that change. This is a deliberate, narrower scope than `SubTask`'s category-snapshot
precedent — nothing in US-003–US-009 requires the *name* to stay frozen, only the category (which
drives the balance signal in US-008).

## Endpoint summary

| Method & path | Purpose | Success | Failure |
|---|---|---|---|
| `GET /api/v1/plan?weekStart=` | View a week (US-003, history) | `200` | `400` missing/non-Monday |
| `POST /api/v1/plan/occurrences` | Plan an occurrence (US-004/US-006) | `201` | `400` validation, `404` not found/owned |
| `PATCH /api/v1/plan/occurrences/{id}` | Move/reschedule/promote/demote (US-004) | `200` | `400` validation, `404` |
| `DELETE /api/v1/plan/occurrences/{id}` | Remove from plan, keep in bank (US-004) | `204` | `404` |
| `POST /api/v1/plan/occurrences/{id}/completion` | Complete (US-009) | `200` | `404` |
| `DELETE /api/v1/plan/occurrences/{id}/completion` | Undo completion (US-009) | `204` | `404` |
| `POST /api/v1/plan/occurrences/{id}/carry-forward` | Carry a bucket item forward (US-007) | `200` | `404`, `409` |

## Cross-references

| This spec | Contracts against |
|---|---|
| `PlannedOccurrence` entity (`model/`) | New — `id`, `owner`, `activity`/`subTask` (exactly one), `category` (snapshot), `weekStart`, `dayOfWeek`/`slot` (paired or both null), `createdAt`, `updatedAt` |
| `PlanSlot` enum (`model/`) | New — `MORNING`, `AFTERNOON`, `EVENING` |
| `CompletionRecord` entity (`model/`) | New — `id`, `owner`, `plannedOccurrence` (unique), `completedAt`, `createdAt` |
| `ActivityCategory` enum (`model/`) | Reused unmodified from `planner_spec_002_activity_bank.md` |
| `PlanController` (`controller/`) | New — see Endpoint summary above |
| `PlanService` (`service/`) | New — owner-scoping, snapshot/validation logic, `InvalidPlanRequestException`/`CarryForwardNotAllowedException` |
| `PlannedOccurrenceRepository`, `CompletionRecordRepository` (`repository/`) | New |
| `PlannedOccurrenceRequest`/`PlannedOccurrenceMoveRequest`/`PlannedOccurrenceResponse`/`PlannedOccurrenceListResponse` (`dto/`) | New |
| `Activity`, `ActivityRepository` (`planner_spec_002_activity_bank.md`) | Referenced target, `ON DELETE CASCADE` source |
| `SubTask`, `SubTaskRepository` (`planner_spec_003_sub_tasks.md`) | Referenced target, `ON DELETE CASCADE` source — this spec fulfils that spec's forward-contract note |
| `GlobalExceptionHandler` (`exception/`) | Extended — two new `@ExceptionHandler` methods for `InvalidPlanRequestException` (400) and `CarryForwardNotAllowedException` (409) |
| `User` (`model/`), `SecurityContextHolder` | Owner resolution, unchanged from `planner_spec_001_auth.md` |
| `V004__create_planned_occurrences_table.sql`, `V005__create_completion_records_table.sql` | New migrations |
| `frontend_spec_004_week_planning.md` | Paired frontend spec — consumes these endpoints exactly as specified here |
| `.claude/ideas/future_ideas.md` ("Mark activities as repeatable vs one-off") | Deferred — depends on this spec's completion tracking existing first |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-004-AC-01/AC-05: an empty week returns 200 with an empty envelope"() {
    when: "GET /api/v1/plan is requested for a Monday with nothing planned"
        def response = client.get().uri("/api/v1/plan?weekStart=2026-10-05").exchange()

    then: "the response is 200 with an empty envelope, not 404"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("$.count").isEqualTo(0)
        response.expectBody().jsonPath("$.data").isEmpty()
}

def "PLANNER-004-AC-04: a non-Monday weekStart returns 400"() {
    when: "GET /api/v1/plan is requested with a Tuesday weekStart"
        def response = client.get().uri("/api/v1/plan?weekStart=2026-10-06").exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}

def "PLANNER-004-AC-06/AC-08: creates a scheduled occurrence with category copied from the activity"() {
    given: "an activity owned by the authenticated user, category ROUTINE"
        def activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.ROUTINE, null, currentUser))
        def request = new PlannedOccurrenceRequest(activity.id, null, LocalDate.of(2026, 10, 5),
            DayOfWeek.MONDAY, PlanSlot.MORNING)

    when: "POST /api/v1/plan/occurrences is requested"
        def response = client.post().uri("/api/v1/plan/occurrences").body(request).exchange()

    then: "the response is 201 with the category copied from the activity"
        response.expectStatus().isCreated()
        response.expectBody().jsonPath("$.category").isEqualTo("ROUTINE")
        response.expectBody().jsonPath("$.dayOfWeek").isEqualTo("MONDAY")
        response.expectBody().jsonPath("$.slot").isEqualTo("MORNING")
}

def "PLANNER-004-AC-10/AC-11: both activityId and subTaskId set returns 400, and the DB rejects it directly too"() {
    given: "an activity owned by the authenticated user"
        def activity = activityRepository.save(
            new Activity("Read a book", ActivityCategory.PLEASURABLE, null, currentUser))
        def subTask = subTaskRepository.save(
            new SubTask(activity, "Chapter one", ActivityCategory.PLEASURABLE, currentUser))
        def request = new PlannedOccurrenceRequest(activity.id, subTask.id,
            LocalDate.of(2026, 10, 5), null, null)

    when: "POST /api/v1/plan/occurrences is requested with both set"
        def response = client.post().uri("/api/v1/plan/occurrences").body(request).exchange()

    then: "the response is 400, no occurrence created"
        response.expectStatus().isBadRequest()
        plannedOccurrenceRepository.count() == 0

    when: "a row with both FKs set is attempted directly against the database, bypassing the service"
        jdbcTemplate.update(
            "INSERT INTO planned_occurrences (user_id, activity_id, sub_task_id, category, week_start) " +
            "VALUES (?, ?, ?, 'PLEASURABLE', ?)", currentUser.id, activity.id, subTask.id, LocalDate.of(2026, 10, 5))

    then: "the database itself rejects it via the CHECK constraint"
        thrown(DataIntegrityViolationException)
}

def "PLANNER-004-AC-12: dayOfWeek set without slot returns 400"() {
    given: "an activity owned by the authenticated user"
        def activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.ROUTINE, null, currentUser))
        def request = new PlannedOccurrenceRequest(activity.id, null, LocalDate.of(2026, 10, 5),
            DayOfWeek.MONDAY, null)

    when: "POST /api/v1/plan/occurrences is requested with only dayOfWeek set"
        def response = client.post().uri("/api/v1/plan/occurrences").body(request).exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}

def "PLANNER-004-AC-17: clearing dayOfWeek and slot demotes a scheduled occurrence to the bucket"() {
    given: "a scheduled occurrence"
        def activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.ROUTINE, null, currentUser))
        def occurrence = plannedOccurrenceRepository.save(
            new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, LocalDate.of(2026, 10, 5),
                DayOfWeek.MONDAY, PlanSlot.MORNING, currentUser))
        def moveRequest = new PlannedOccurrenceMoveRequest(null, null)

    when: "PATCH .../occurrences/{id} clears dayOfWeek and slot"
        def response = client.patch().uri("/api/v1/plan/occurrences/${occurrence.id}").body(moveRequest).exchange()

    then: "the response is 200 with the occurrence demoted to the bucket, weekStart unchanged"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("$.dayOfWeek").isEqualTo(null)
        response.expectBody().jsonPath("$.slot").isEqualTo(null)
        response.expectBody().jsonPath("$.weekStart").isEqualTo("2026-10-05")
}

def "PLANNER-004-AC-23: re-completing an already-complete occurrence is idempotent, not a duplicate"() {
    given: "an occurrence already completed once"
        def activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.ROUTINE, null, currentUser))
        def occurrence = plannedOccurrenceRepository.save(
            new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, LocalDate.of(2026, 10, 5),
                DayOfWeek.MONDAY, PlanSlot.MORNING, currentUser))
        client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/completion").exchange()

    when: "the completion endpoint is called again"
        def response = client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/completion").exchange()

    then: "the response is 200, and exactly one CompletionRecord exists"
        response.expectStatus().isOk()
        completionRecordRepository.count() == 1
}

def "PLANNER-004-AC-28: carrying a bucket item forward advances weekStart by 7 days, keeping the same id"() {
    given: "an incomplete weekend-bucket occurrence"
        def activity = activityRepository.save(
            new Activity("Go for a bike ride", ActivityCategory.PLEASURABLE, null, currentUser))
        def occurrence = plannedOccurrenceRepository.save(
            new PlannedOccurrence(activity, null, ActivityCategory.PLEASURABLE, LocalDate.of(2026, 10, 5),
                null, null, currentUser))

    when: "carry-forward is requested"
        def response = client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/carry-forward").exchange()

    then: "the response is 200 with weekStart advanced by 7 days and the same id"
        response.expectStatus().isOk()
        response.expectBody().jsonPath("$.id").isEqualTo(occurrence.id.toString())
        response.expectBody().jsonPath("$.weekStart").isEqualTo("2026-10-12")
}

def "PLANNER-004-AC-29: carrying forward a scheduled (non-bucket) occurrence returns 409"() {
    given: "a scheduled occurrence"
        def activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.ROUTINE, null, currentUser))
        def occurrence = plannedOccurrenceRepository.save(
            new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, LocalDate.of(2026, 10, 5),
                DayOfWeek.MONDAY, PlanSlot.MORNING, currentUser))

    when: "carry-forward is requested"
        def response = client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/carry-forward").exchange()

    then: "the response is 409, weekStart unchanged"
        response.expectStatus().isEqualTo(HttpStatus.CONFLICT)
        plannedOccurrenceRepository.findById(occurrence.id).get().weekStart == LocalDate.of(2026, 10, 5)
}

def "PLANNER-004-AC-32: deleting the parent activity cascade-deletes its planned occurrences"() {
    given: "an activity with one scheduled occurrence"
        def activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.ROUTINE, null, currentUser))
        plannedOccurrenceRepository.save(
            new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, LocalDate.of(2026, 10, 5),
                DayOfWeek.MONDAY, PlanSlot.MORNING, currentUser))

    when: "the parent activity is deleted"
        activityRepository.delete(activity)

    then: "the planned occurrence row is gone too"
        plannedOccurrenceRepository.count() == 0
}

def "PLANNER-004-AC-36: creating an occurrence against another user's activity returns 404, not 403"() {
    given: "an activity owned by a different user"
        def othersActivity = activityRepository.save(
            new Activity("Not mine", ActivityCategory.ROUTINE, null, otherUser))
        def request = new PlannedOccurrenceRequest(othersActivity.id, null,
            LocalDate.of(2026, 10, 5), null, null)

    when: "POST /api/v1/plan/occurrences is requested by currentUser"
        def response = client.post().uri("/api/v1/plan/occurrences").body(request).exchange()

    then: "the response is 404, not 403"
        response.expectStatus().isNotFound()
}

def "PLANNER-004-AC-37: an unauthenticated request to /api/v1/plan returns 401 (inherited rule)"() {
    when: "GET /api/v1/plan is requested with no session"
        def response = client.get().uri("/api/v1/plan?weekStart=2026-10-05").exchange()

    then: "the response is 401, from the existing SecurityFilterChain rule, unmodified"
        response.expectStatus().isUnauthorized()
}
```

**Test Case (Green)** for every sketch above: implement `PlanSlot`, `PlannedOccurrence`,
`CompletionRecord`, the `V004`/`V005` migrations, `PlannedOccurrenceRepository`,
`CompletionRecordRepository`, `PlanService`, `PlanController`, and the two `GlobalExceptionHandler`
additions until the specs above pass.

## Acceptance Criteria Summary

- [x] PLANNER-004-AC-01 — GET /api/v1/plan returns the owner's occurrences for the week, ordered by createdAt ascending
- [x] PLANNER-004-AC-02 — response is `{data, count}` envelope
- [x] PLANNER-004-AC-03 — missing weekStart → 400
- [x] PLANNER-004-AC-04 — non-Monday weekStart → 400
- [x] PLANNER-004-AC-05 — empty week returns 200 with `{data: [], count: 0}`, not 404
- [x] PLANNER-004-AC-06 — POST creates a scheduled occurrence, 201
- [x] PLANNER-004-AC-07 — POST creates a bucket occurrence (no day/slot), 201
- [x] PLANNER-004-AC-08 — category copied from the referenced activity/sub-task at creation, not client-supplied
- [x] PLANNER-004-AC-09 — owner assigned from principal, never from request body
- [x] PLANNER-004-AC-10 — neither or both of activityId/subTaskId set → 400
- [x] PLANNER-004-AC-11 — DB CHECK constraint also enforces exactly-one-target
- [x] PLANNER-004-AC-12 — exactly one of dayOfWeek/slot set → 400
- [x] PLANNER-004-AC-13 — missing/non-Monday weekStart on create → 400
- [x] PLANNER-004-AC-14 — activityId not found/not owned → 404
- [x] PLANNER-004-AC-15 — subTaskId not found/not owned → 404
- [x] PLANNER-004-AC-16 — PATCH with both dayOfWeek+slot set reschedules/promotes, 200
- [x] PLANNER-004-AC-17 — PATCH with both cleared demotes to bucket, weekStart unchanged, 200
- [x] PLANNER-004-AC-18 — PATCH with exactly one of dayOfWeek/slot set → 400
- [x] PLANNER-004-AC-19 — PATCH on not-found/not-owned id → 404
- [x] PLANNER-004-AC-20 — DELETE removes occurrence only, 204, underlying Activity/SubTask untouched
- [x] PLANNER-004-AC-21 — DELETE on not-found/not-owned id → 404
- [x] PLANNER-004-AC-22 — POST completion creates CompletionRecord, 200
- [x] PLANNER-004-AC-23 — re-completing is idempotent, no duplicate record
- [x] PLANNER-004-AC-24 — DELETE completion removes CompletionRecord, 204
- [x] PLANNER-004-AC-25 — undo when not currently complete → 404
- [x] PLANNER-004-AC-26 — completion endpoints on not-found/not-owned id → 404
- [x] PLANNER-004-AC-27 — GET /api/v1/plan reflects completed/completedAt
- [x] PLANNER-004-AC-28 — carry-forward success: weekStart +7, same id, 200
- [x] PLANNER-004-AC-29 — carry-forward on a scheduled occurrence → 409
- [x] PLANNER-004-AC-30 — carry-forward on an already-complete occurrence → 409
- [x] PLANNER-004-AC-31 — carry-forward on not-found/not-owned id → 404
- [x] PLANNER-004-AC-32 — deleting an Activity cascade-deletes its PlannedOccurrences
- [x] PLANNER-004-AC-33 — deleting a SubTask cascade-deletes its PlannedOccurrences
- [x] PLANNER-004-AC-34 — deleting a PlannedOccurrence cascade-deletes its CompletionRecord
- [x] PLANNER-004-AC-35 — owner persisted directly on both new entities
- [x] PLANNER-004-AC-36 — not-found and not-yours are indistinguishable (404 both) across every endpoint, including completion/carry-forward
- [x] PLANNER-004-AC-37 — existing SecurityFilterChain rule already covers new endpoints (regression test, no SecurityConfig change)
