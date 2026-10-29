# Activity Recurrence and Due Dates (Backend)

**Status**: Not started

**Priority**: P2 — a real enhancement to the activity bank + completion loop, but nothing else is
blocked on it, matching `planner_spec_006_repeatable_activities.md`'s precedent for a sequencing
rationale rather than urgency.

**Depends on**: `planner_spec_002_activity_bank.md` (`Activity` entity, `ActivityCategory`,
`ActivityRepository`/`ActivityService`/`ActivityController` owner-scoping pattern,
`ActivityRequest`/`ActivityResponse`, `GlobalExceptionHandler`), `planner_spec_004_week_planning.md`
(`PlannedOccurrence`, `CompletionRecord`, `PlanService.complete()`/`uncomplete()` — this spec's
auto-advance hook runs inside `complete()`), `planner_spec_006_repeatable_activities.md` (the
`repeatable` field this spec is explicitly required to stay independent of, and whose auto-archive
behaviour is the regression-guard target), `planner_spec_011_bucket_carry_forward_automation.md`
(the injectable `Clock` bean/pattern this spec reuses for "now" comparisons, never a raw
`Instant.now()`)

**Area**: Backend

**Roadmap version**: V2 (`.claude/steering/product.md`'s V2 row: "Tracking and reflection —
mood/pleasure/achievement ratings, **recurring activities**, weekly summary"). Note this is a
narrower, visibility-only slice of Epic 5/US-012 (`.claude/HIGH_LEVEL_DESIGN.md`) — see Overview for
exactly how it differs from that user story's literal scope.

## Overview

Lets a user mark an `Activity` with a flexible recurrence interval (e.g. "every 3" + `MONTHS`) and
gives it a stored, independently-editable due date (`nextDueAt`) that the service auto-advances
every time an occurrence of that activity (direct or via one of its sub-tasks) is completed. This
extends `.claude/HIGH_LEVEL_DESIGN.md`'s Epic 4 (US-009, "mark an activity as completed so I can see
what I actually did") with a lightweight "when is this next due" signal, and partially overlaps
Epic 5 (US-012, "make some activities recurring so I don't have to recreate them every week") —
**but is deliberately not that story**: US-012 describes an activity *auto-reappearing on specific
days/slots in the weekly grid*, which this spec does not build (no auto-insertion onto the plan,
anywhere). What this spec actually delivers is purely a stored due-date signal plus a new read-only
`GET /api/v1/reminders` endpoint (its paired frontend spec, `frontend_spec_055_reminders_page.md`,
surfaces it as a "Reminders" page) — the user still has to plan and complete the activity themselves
next time around.

This was raised in `.claude/ideas/future_ideas.md`'s "Recurring activities with a repeat period and
a reminder date" entry (2026-10-14) and is **Pair 1 of 2**: Pair 2 (an overdue banner/icon surfaced
elsewhere in the app, depending on this pair existing first) is a deliberate, out-of-scope follow-up
— see that idea entry.

**Design decisions already confirmed with the user (not reopened here):**
1. Fully **independent** from the existing `repeatable` field (`planner_spec_006`) — `repeatable`
   still means exactly what it already means (skip auto-archive on completion) and is untouched by
   this spec. The new fields are named with "recurrence"/"interval", never "repeat", to avoid
   confusion between the two. A regression-guard AC (PLANNER-026-AC-03) confirms this explicitly.
2. `nextDueAt` is a **stored** column, auto-set by the service on completion, and **separately
   user-editable** — not a value computed on the fly from `createdAt`/`completedAt` + the interval.
3. The recurrence period is a **flexible count + unit** (`recurrenceIntervalCount` +
   `recurrenceIntervalUnit`), not a fixed preset enum like "weekly"/"monthly" alone.

**Resolved ambiguity, not explicit in the originating idea**: the three new fields are added to the
*existing* `ActivityRequest`/`ActivityResponse` DTOs, which are already shared between
`POST /api/v1/activities` (create) and `PUT /api/v1/activities/{id}` (update) — exactly like
`repeatable` already is. So a client *can* set recurrence and/or an initial `nextDueAt` at creation
time, not only via a follow-up edit; this mirrors how every other optional field on this DTO already
behaves and avoids a surprising "you can only ever set this on the *second* request" restriction.
The originating idea and planning note only described the *editing* path explicitly — this is a
reasonable, consistent extension of that, not a reinterpretation of it.

**Out of scope**: auto-inserting an overdue/upcoming activity back onto the weekly plan (the whole
point of this being a visibility feature, not a scheduling one); the overdue banner/icon elsewhere
in the app (Pair 2, a separate future spec); any push/real-time notification; a per-occurrence
recurrence override (recurrence lives only on the parent `Activity`, never on `PlannedOccurrence` or
`SubTask`); any change to the existing archive/unarchive endpoints or `repeatable`'s own behaviour;
editing recurrence/due date from the new Reminders page itself (read-only for this pair — editing
stays in the existing Activity create/edit form, per the paired frontend spec); an index on
`next_due_at` (this app's scale doesn't need one yet, matching `migrateStaleBucketItems`'s own
un-indexed-until-it-matters precedent, `.claude/steering/structure.md`).

## Data model

`model/Activity.java` gains three new nullable fields, a new `RecurrenceIntervalUnit` enum, and one
new mutator — `advanceNextDueAt(Instant)` — used only by `PlanService`'s auto-advance hook.
`nextDueAt` is otherwise a plain overwritable field like `description`, settable via the
constructor and via `update(...)` — it is *not* a single-purpose-setter field like `archived`/
`favourite` (which are never touched by `update(...)`); it has three legitimate writers: the
constructor (initial value), `update(...)` (manual edit), and `advanceNextDueAt(...)` (the
completion-driven auto-advance).

```java
package uk.co.stefirby.behaviouralactivation.model;

/**
 * An {@link Activity}'s optional recurrence period — flexible count + unit (e.g. "every 3" +
 * {@code MONTHS}), not a fixed preset. Fully independent of {@link Activity#isRepeatable()}.
 */
public enum RecurrenceIntervalUnit {
    WEEKS,
    MONTHS
}
```

```java
@Entity
@Table(name = "activities")
public class Activity {

    // ... existing fields (id, owner, name, category, description, repeatable, archived,
    // favourite, createdAt, updatedAt) unchanged ...

    @Column(name = "recurrence_interval_count")
    private Integer recurrenceIntervalCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "recurrence_interval_unit")
    private RecurrenceIntervalUnit recurrenceIntervalUnit;

    @Column(name = "next_due_at")
    private Instant nextDueAt;

    protected Activity() {
        // JPA
    }

    // Unchanged signature -- delegates with no recurrence/due-date configured.
    public Activity(String name, ActivityCategory category, String description, User owner) {
        this(name, category, description, true, owner);
    }

    // Unchanged signature -- delegates with no recurrence/due-date configured.
    public Activity(String name, ActivityCategory category, String description, boolean repeatable, User owner) {
        this(name, category, description, repeatable, null, null, null, owner);
    }

    // New canonical constructor -- PLANNER-026-AC-01/AC-04.
    public Activity(String name, ActivityCategory category, String description, boolean repeatable,
            Integer recurrenceIntervalCount, RecurrenceIntervalUnit recurrenceIntervalUnit, Instant nextDueAt,
            User owner) {
        this.name = name;
        this.category = category;
        this.description = description;
        this.repeatable = repeatable;
        this.recurrenceIntervalCount = recurrenceIntervalCount;
        this.recurrenceIntervalUnit = recurrenceIntervalUnit;
        this.nextDueAt = nextDueAt;
        this.archived = false;
        this.favourite = false;
        this.owner = owner;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    // Unchanged signature -- preserves current recurrence/due-date fields, matching repeatable's own
    // existing "narrower overload preserves the wider state" precedent (planner_spec_006).
    public void update(String name, ActivityCategory category, String description) {
        update(name, category, description, this.repeatable);
    }

    // Unchanged signature -- preserves current recurrence/due-date fields.
    public void update(String name, ActivityCategory category, String description, boolean repeatable) {
        update(name, category, description, repeatable, this.recurrenceIntervalCount, this.recurrenceIntervalUnit,
            this.nextDueAt);
    }

    // New canonical update() -- a plain overwrite of every field passed, no null-means-keep-old-value
    // magic (PLANNER-026-AC-07), exactly like description already behaves. Cross-field validation
    // (count/unit supplied together) is the caller's (ActivityService's) job, not re-checked here.
    public void update(String name, ActivityCategory category, String description, boolean repeatable,
            Integer recurrenceIntervalCount, RecurrenceIntervalUnit recurrenceIntervalUnit, Instant nextDueAt) {
        this.name = name;
        this.category = category;
        this.description = description;
        this.repeatable = repeatable;
        this.recurrenceIntervalCount = recurrenceIntervalCount;
        this.recurrenceIntervalUnit = recurrenceIntervalUnit;
        this.nextDueAt = nextDueAt;
        this.updatedAt = Instant.now();
    }

    // The only place nextDueAt is auto-advanced (as opposed to manually edited via update(...)) --
    // PlanService.complete()'s new maybeAdvanceNextDueAt hook (PLANNER-026-AC-11/AC-12/AC-13/AC-14).
    public void advanceNextDueAt(Instant nextDueAt) {
        this.nextDueAt = nextDueAt;
        this.updatedAt = Instant.now();
    }

    public Integer getRecurrenceIntervalCount() {
        return recurrenceIntervalCount;
    }

    public RecurrenceIntervalUnit getRecurrenceIntervalUnit() {
        return recurrenceIntervalUnit;
    }

    public Instant getNextDueAt() {
        return nextDueAt;
    }

    // ... existing getters unchanged ...
}
```

No change to `SubTask.java` or `PlannedOccurrence.java` — recurrence/due-date live only on the
parent `Activity`, never per-occurrence or per-sub-task (PLANNER-026-AC-13).

## Migration

`backend/src/main/resources/db/migration/V012__add_recurrence_and_due_date_to_activities.sql` (next
after `V011__add_position_to_sub_tasks.sql`, confirmed the latest migration in the repository as of
this spec):

```sql
ALTER TABLE activities
    ADD COLUMN recurrence_interval_count INTEGER,
    ADD COLUMN recurrence_interval_unit VARCHAR(10),
    ADD COLUMN next_due_at TIMESTAMPTZ;

ALTER TABLE activities
    ADD CONSTRAINT chk_activities_recurrence_interval_unit CHECK (
        recurrence_interval_unit IS NULL OR recurrence_interval_unit IN ('WEEKS', 'MONTHS')
    ),
    ADD CONSTRAINT chk_activities_recurrence_count_unit_together CHECK (
        (recurrence_interval_count IS NULL AND recurrence_interval_unit IS NULL)
        OR (recurrence_interval_count IS NOT NULL AND recurrence_interval_unit IS NOT NULL)
    ),
    ADD CONSTRAINT chk_activities_recurrence_count_positive CHECK (
        recurrence_interval_count IS NULL OR recurrence_interval_count > 0
    );

-- Deliberately no index on next_due_at -- matches PlanService.migrateStaleBucketItems's own
-- precedent of not indexing a comparable query until it actually matters at this app's scale.
```

## Service

`service/PlanService.java`'s `complete()` gains one more hook alongside the existing
`maybeAutoArchive(...)` call, run inside the same transaction, after the completion record itself is
upserted:

```java
@Transactional
public Optional<CompletionRecord> complete(String ownerUsername, UUID id) {
    User owner = resolveOwner(ownerUsername);
    return plannedOccurrenceRepository.findByIdAndOwner(id, owner)
        .map(occurrence -> upsertCompletion(occurrence, owner))
        .map(completion -> {
            maybeAutoArchive(completion.getPlannedOccurrence(), owner);
            maybeAdvanceNextDueAt(completion, owner); // new -- PLANNER-026-AC-11/AC-12/AC-13/AC-14
            initializeCompletionChain(completion);
            return completion;
        });
}

// Resolves the parent Activity the same way maybeAutoArchive already does. Runs for both a
// direct-activity occurrence and a sub-task-targeted one -- the SubTask itself never carries
// recurrence/nextDueAt (PLANNER-026-AC-13). Idempotent re-completion (upsertCompletion's
// recompleteAt path) recomputes nextDueAt from the *new* completedAt each time (PLANNER-026-AC-14)
// -- there is no history to "advance from," only the latest completion.
private void maybeAdvanceNextDueAt(CompletionRecord completion, User owner) {
    PlannedOccurrence occurrence = completion.getPlannedOccurrence();
    Activity activity = occurrence.getActivity() != null
        ? occurrence.getActivity()
        : occurrence.getSubTask().getActivity();

    Integer count = activity.getRecurrenceIntervalCount();
    RecurrenceIntervalUnit unit = activity.getRecurrenceIntervalUnit();
    if (count == null || unit == null) {
        return; // PLANNER-026-AC-15 -- no recurrence configured, nextDueAt stays whatever it was
    }

    ZonedDateTime completedAtZoned = completion.getCompletedAt().atZone(clock.getZone());
    Instant nextDueAt = (unit == RecurrenceIntervalUnit.WEEKS
        ? completedAtZoned.plusWeeks(count)
        : completedAtZoned.plusMonths(count)).toInstant();
    activity.advanceNextDueAt(nextDueAt);
    activityRepository.save(activity);
}
```

`uncomplete()` is **unchanged** — it deletes the `CompletionRecord` but never reverts
`activity.nextDueAt` (PLANNER-026-AC-16): there is no "previous due date" to revert to (the old
value was simply overwritten), and `nextDueAt` is independently editable anyway, so a revert would
silently fight a possible manual edit made in between.

`service/ActivityService.java`'s `create`/`update` gain the three new fields, applied as plain
overwrites, plus one new cross-field validation check (count/unit must be supplied together — not
expressible as a single bean-validation annotation):

```java
@Transactional
public Activity create(String ownerUsername, ActivityRequest request) {
    validateRecurrencePair(request.recurrenceIntervalCount(), request.recurrenceIntervalUnit());
    User owner = resolveOwner(ownerUsername);
    boolean repeatable = request.repeatable() == null || request.repeatable();
    Activity activity = new Activity(request.name(), request.category(), request.description(), repeatable,
        request.recurrenceIntervalCount(), request.recurrenceIntervalUnit(), request.nextDueAt(), owner);
    return activityRepository.save(activity);
}

@Transactional
public Optional<Activity> update(String ownerUsername, UUID id, ActivityRequest request) {
    validateRecurrencePair(request.recurrenceIntervalCount(), request.recurrenceIntervalUnit());
    User owner = resolveOwner(ownerUsername);
    boolean repeatable = request.repeatable() == null || request.repeatable();
    return activityRepository.findByIdAndOwner(id, owner)
        .map(activity -> {
            ActivityCategory previousCategory = activity.getCategory();
            activity.update(request.name(), request.category(), request.description(), repeatable,
                request.recurrenceIntervalCount(), request.recurrenceIntervalUnit(), request.nextDueAt());
            if (previousCategory != request.category()) {
                cascadeCategoryToSubTasks(activity, request.category(), owner);
            }
            return activity;
        });
}

// PLANNER-026-AC-05 -- count and unit must be supplied together or not at all; @Positive on
// recurrenceIntervalCount (ActivityRequest) covers the "must be > 0 when present" half.
private void validateRecurrencePair(Integer count, RecurrenceIntervalUnit unit) {
    if ((count == null) != (unit == null)) {
        throw new InvalidActivityRequestException(
            "recurrenceIntervalCount and recurrenceIntervalUnit must both be set or both be null");
    }
}
```

New `exception/InvalidActivityRequestException.java`, mirroring `InvalidSubTaskRequestException`'s
own precedent — an activity-domain business-rule failure not expressible as DTO bean validation,
mapped to `400` by `GlobalExceptionHandler`:

```java
public class InvalidActivityRequestException extends RuntimeException {
    public InvalidActivityRequestException(String message) {
        super(message);
    }
}
```

New `service/ReminderService.java` (thin, following `ActivityService`'s owner-resolution shape),
backed by one new derived query on `ActivityRepository`:

```java
public interface ActivityRepository extends JpaRepository<Activity, UUID> {
    // ... existing methods unchanged ...

    // New for planner_spec_026 -- ascending due-date order, non-archived only, only activities that
    // actually have a due date set (PLANNER-026-AC-17/AC-20/AC-21).
    List<Activity> findByOwnerAndArchivedFalseAndNextDueAtIsNotNullOrderByNextDueAtAsc(User owner);
}
```

```java
@Service
public class ReminderService {

    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    // constructor injection, same shape as every other service in this codebase

    @Transactional(readOnly = true)
    public List<ReminderResponse> listForOwner(String ownerUsername) {
        User owner = resolveOwner(ownerUsername);
        Instant now = Instant.now(clock); // PLANNER-026-AC-18/AC-19 -- never a raw Instant.now()
        return activityRepository
            .findByOwnerAndArchivedFalseAndNextDueAtIsNotNullOrderByNextDueAtAsc(owner).stream()
            .map(activity -> new ReminderResponse(activity.getId(), activity.getName(), activity.getCategory(),
                activity.getNextDueAt(), activity.getNextDueAt().isBefore(now)))
            .toList();
    }

    private User resolveOwner(String username) { /* same pattern as every other service */ }
}
```

`controller/ReminderController.java` (thin delegate, no business logic, inherits
`.requestMatchers("/api/v1/**").authenticated()` unmodified):

```java
@RestController
@RequestMapping("/api/v1/reminders")
public class ReminderController {

    private final ReminderService reminderService;

    public ReminderController(ReminderService reminderService) {
        this.reminderService = reminderService;
    }

    @GetMapping
    public ResponseEntity<ReminderListResponse> list(Authentication authentication) {
        List<ReminderResponse> data = reminderService.listForOwner(authentication.getName());
        return ResponseEntity.ok(new ReminderListResponse(data, data.size()));
    }
}
```

## DTOs (`dto/`)

```java
public record ActivityRequest(
    @NotBlank(message = "name is required") String name,
    @NotNull(message = "category is required") ActivityCategory category,
    String description,
    Boolean repeatable,
    @Positive(message = "recurrenceIntervalCount must be positive") Integer recurrenceIntervalCount,
    RecurrenceIntervalUnit recurrenceIntervalUnit,
    Instant nextDueAt
) {
}

public record ActivityResponse(
    UUID id, String name, ActivityCategory category, String description, boolean repeatable,
    boolean archived, boolean favourite, Instant createdAt, int subTaskCount,
    Integer recurrenceIntervalCount, RecurrenceIntervalUnit recurrenceIntervalUnit, Instant nextDueAt
) {
}

// Dedicated narrow DTO for GET /api/v1/reminders -- not a reuse of ActivityResponse, which carries
// fields (description, subTaskCount, favourite, repeatable, archived) the Reminders view has no
// use for.
public record ReminderResponse(UUID id, String name, ActivityCategory category, Instant nextDueAt, boolean overdue) {
}

public record ReminderListResponse(List<ReminderResponse> data, int count) {
}
```

`ActivityController.toResponse(...)` is extended with the three new fields, same mapping shape as
every other field.

## Requirements

### Requirement 1 — `Activity` carries an independent recurrence interval and due date (schema)

As a user, I want an activity to optionally carry a repeat period and a due date, completely
separate from whether it's a one-off, so the app can remind me when it's next due without
disturbing how `repeatable` already works.

- **PLANNER-026-AC-01** [AUTO]: The `Activity` entity shall expose three new nullable fields —
  `recurrenceIntervalCount` (`Integer`), `recurrenceIntervalUnit` (`RecurrenceIntervalUnit`:
  `WEEKS`/`MONTHS`), and `nextDueAt` (`Instant`) — each settable and readable independently of the
  existing `repeatable` field.
- **PLANNER-026-AC-02** [AUTO]: The `activities` table's `recurrence_interval_count`/
  `recurrence_interval_unit` columns shall reject (via a database `CHECK` constraint) any row where
  exactly one of the two is set, or where `recurrence_interval_count` is present but not greater
  than zero.
- **PLANNER-026-AC-03** [AUTO — regression guard]: When `PlanService.complete()` auto-archives a
  non-repeatable `Activity` with no sub-tasks per `planner_spec_006_repeatable_activities.md`'s
  existing rule, the presence of a configured recurrence interval and/or `nextDueAt` on that same
  `Activity` shall have no effect on that outcome — `repeatable`'s existing auto-archive behaviour
  is entirely unmodified by this spec.

### Requirement 2 — Create and edit an activity's recurrence interval and due date

As a user, I want to set or change how often an activity recurs, and to correct or clear its due
date myself, so the reminder stays accurate even when my plans change.

- **PLANNER-026-AC-04** [AUTO]: When `POST /api/v1/activities` or `PUT /api/v1/activities/{id}` is
  requested with both `recurrenceIntervalCount` and `recurrenceIntervalUnit` set to a valid pair,
  the `ActivityService` shall store both fields (and `nextDueAt`, if also supplied) exactly as
  given.
- **PLANNER-026-AC-05** [AUTO]: If `recurrenceIntervalCount` is supplied without
  `recurrenceIntervalUnit`, or vice versa, on either endpoint, then the `ActivityService` shall
  throw `InvalidActivityRequestException`, mapped by `GlobalExceptionHandler` to `400` — the
  create/update-time counterpart of the database constraint in AC-02, catching the same bad input
  earlier with a clearer error message.
- **PLANNER-026-AC-06** [AUTO]: If `recurrenceIntervalCount` is supplied as zero or negative on
  either endpoint, then bean validation (`@Positive`) shall reject the request with `400` before it
  reaches `ActivityService`.
- **PLANNER-026-AC-07** [AUTO]: When `PUT /api/v1/activities/{id}` is requested, the `ActivityService`
  shall overwrite `recurrenceIntervalCount`/`recurrenceIntervalUnit`/`nextDueAt` with exactly the
  values in the request body — including overwriting a previously-set value with `null` — never
  preserving the stored value when the field is omitted or sent as `null`, matching how
  `description` already behaves.
- **PLANNER-026-AC-08** [AUTO]: When `PUT /api/v1/activities/{id}` is requested with a `nextDueAt`
  value earlier than the activity's current `nextDueAt` (a deliberate back-dating correction), the
  `ActivityService` shall store that earlier value exactly as given, without rejecting it.
- **PLANNER-026-AC-09** [AUTO]: When `PUT /api/v1/activities/{id}` is requested with
  `recurrenceIntervalCount`/`recurrenceIntervalUnit` both set to `null` on an `Activity` that
  currently has a `nextDueAt` set, the `ActivityService` shall leave that `nextDueAt` value
  unchanged — removing recurrence does not clear the due date.
- **PLANNER-026-AC-10** [AUTO]: If `PUT /api/v1/activities/{id}` with recurrence/due-date fields is
  requested for an `id` that does not exist or does not belong to the authenticated user, then the
  `ActivityController` shall return `404`, matching the existing uniform not-found/not-owned
  convention.

### Requirement 3 — `nextDueAt` auto-advances when a recurring activity is completed

As a user, I want the due date to move forward on its own the moment I complete a recurring
activity, so I don't have to calculate or re-enter it myself every time.

- **PLANNER-026-AC-11** [AUTO]: When `PlanService.complete()` successfully completes a
  `PlannedOccurrence` that directly targets an `Activity` with `recurrenceIntervalUnit: WEEKS` and
  `recurrenceIntervalCount: n`, then `PlanService` shall set that `Activity`'s `nextDueAt` to the
  completion's `completedAt` plus `n` weeks, saved within the same transaction as the completion.
- **PLANNER-026-AC-12** [AUTO]: When `PlanService.complete()` successfully completes a
  `PlannedOccurrence` targeting an `Activity` with `recurrenceIntervalUnit: MONTHS` and
  `recurrenceIntervalCount: n`, then `PlanService` shall set that `Activity`'s `nextDueAt` to the
  completion's `completedAt` plus `n` months.
- **PLANNER-026-AC-13** [AUTO]: When `PlanService.complete()` successfully completes a
  `PlannedOccurrence` targeting a `SubTask` whose parent `Activity` has a recurrence interval
  configured, then `PlanService` shall advance the parent `Activity`'s `nextDueAt` (never any field
  on the `SubTask` itself, which carries no recurrence/due-date fields of its own).
- **PLANNER-026-AC-14** [AUTO]: When `PlanService.complete()` is called again for an already-complete
  `PlannedOccurrence` of a recurring `Activity` (the existing `recompleteAt` idempotent-completion
  path), then `PlanService` shall recompute `nextDueAt` from the new `completedAt`, overwriting
  whatever `nextDueAt` was previously stored.
- **PLANNER-026-AC-15** [AUTO]: When `PlanService.complete()` successfully completes a
  `PlannedOccurrence` whose target `Activity` has no recurrence interval configured
  (`recurrenceIntervalCount`/`recurrenceIntervalUnit` both `null`), then `PlanService` shall leave
  that `Activity`'s `nextDueAt` unchanged.
- **PLANNER-026-AC-16** [AUTO]: When `PlanService.uncomplete()` successfully deletes a
  `CompletionRecord` for a recurring `Activity`, then `PlanService` shall leave that `Activity`'s
  `nextDueAt` exactly as it was before the `uncomplete()` call — never reverted.

### Requirement 4 — View upcoming and overdue activities

As a user, I want to see, in one place, which recurring activities are coming up or overdue, so I
can act on them without having to remember or recalculate anything myself.

- **PLANNER-026-AC-17** [AUTO]: When `GET /api/v1/reminders` is requested, the `ReminderController`
  shall return every non-archived `Activity` belonging to the authenticated user that has a
  `nextDueAt` set, ordered ascending by `nextDueAt`.
- **PLANNER-026-AC-18** [AUTO]: Where an `Activity`'s `nextDueAt` is earlier than the current instant
  (per the injected `Clock`, never a raw `Instant.now()`), the `ReminderService` shall mark that
  reminder's `overdue` as `true`.
- **PLANNER-026-AC-19** [AUTO]: Where an `Activity`'s `nextDueAt` is at or after the current instant,
  the `ReminderService` shall mark that reminder's `overdue` as `false`.
- **PLANNER-026-AC-20** [AUTO]: `GET /api/v1/reminders` shall not include an `Activity` whose
  `nextDueAt` is `null` (recurrence configured but never yet completed, and no manual override set).
- **PLANNER-026-AC-21** [AUTO]: `GET /api/v1/reminders` shall not include an `Activity` that is
  `archived`, even if its `nextDueAt` is set.
- **PLANNER-026-AC-22** [AUTO]: `GET /api/v1/reminders` shall only ever return activities belonging
  to the authenticated user — another user's due activities, however many exist, shall never appear
  in the response.
- **PLANNER-026-AC-23** [AUTO — regression test, not new implementation]: The `SecurityFilterChain`
  (unchanged) shall already require an authenticated session for `GET /api/v1/reminders` via its
  existing `.requestMatchers("/api/v1/**").authenticated()` rule; this spec adds a Spock test
  confirming the existing rule extends automatically to the new endpoint, without modifying
  `SecurityConfig`.

## Cross-references

| This spec | Contracts against |
|---|---|
| `Activity` entity (`model/`) | Extended — new `recurrenceIntervalCount`/`recurrenceIntervalUnit`/`nextDueAt` fields, new canonical 8-arg constructor + 7-arg `update(...)` overload, new `advanceNextDueAt(Instant)` mutator |
| `RecurrenceIntervalUnit` (`model/`, new) | New enum — `WEEKS`, `MONTHS` |
| `ActivityRequest`/`ActivityResponse` (`dto/`) | Extended — three new fields, shared between create and update |
| `ReminderResponse`/`ReminderListResponse` (`dto/`, new) | New — narrow, Reminders-only shape |
| `ActivityController` (`controller/`) | Extended — `toResponse(...)` mapping |
| `ReminderController` (`controller/`, new) | New — `GET /api/v1/reminders` |
| `ActivityService` (`service/`) | Extended — `create`/`update` apply + validate the three new fields |
| `ReminderService` (`service/`, new) | New — owner-scoped list with `overdue` computed via `Clock` |
| `ActivityRepository` (`repository/`) | Extended — new `findByOwnerAndArchivedFalseAndNextDueAtIsNotNullOrderByNextDueAtAsc` |
| `InvalidActivityRequestException` (`exception/`, new) | New — 400 via `GlobalExceptionHandler`, mirrors `InvalidSubTaskRequestException`'s precedent |
| `PlanService.complete()`/`uncomplete()` (`planner_spec_004_week_planning.md`) | Extended — new `maybeAdvanceNextDueAt` hook in `complete()`; `uncomplete()` unchanged (AC-16) |
| `repeatable`/auto-archive (`planner_spec_006_repeatable_activities.md`) | Reused unmodified — regression-guarded (AC-03), never reused as a naming/behaviour pattern for the new fields |
| `Clock` bean (`planner_spec_011_bucket_carry_forward_automation.md`) | Reused unmodified — injected into `PlanService` (already) and `ReminderService` (new) |
| `V012__add_recurrence_and_due_date_to_activities.sql` | New migration |
| `frontend_spec_055_reminders_page.md` | Paired frontend spec — consumes `GET /api/v1/reminders` and the extended `ActivityRequest`/`ActivityResponse` exactly as specified here |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-026-AC-01: recurrence/due-date fields are independent of repeatable"() {
    given: "a repeatable activity with a recurrence interval and a due date configured"
        def activity = new Activity("Water the plants", ActivityCategory.ROUTINE, null, true,
            2, RecurrenceIntervalUnit.WEEKS, Instant.parse("2026-11-01T00:00:00Z"), currentUser)

    expect: "repeatable and recurrence are both true/set, independently"
        activity.repeatable
        activity.recurrenceIntervalCount == 2
        activity.recurrenceIntervalUnit == RecurrenceIntervalUnit.WEEKS
}

def "PLANNER-026-AC-02: a DB check constraint rejects a count without a unit"() {
    given: "an activity saved directly via the repository, bypassing service validation"
        def activity = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false,
            3, null, null, currentUser)

    when: "it is saved and flushed"
        activityRepository.saveAndFlush(activity)

    then: "the database rejects the row"
        thrown(DataIntegrityViolationException)
}

def "PLANNER-026-AC-05: count without unit on create returns 400"() {
    given: "a create request with recurrenceIntervalCount but no unit"
        def request = new ActivityRequest("Water the plants", ActivityCategory.ROUTINE, null, null, 2, null, null)

    when: "POST /api/v1/activities is requested"
        def response = client.post().uri("/api/v1/activities").body(request).exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}

def "PLANNER-026-AC-07/AC-09: update overwrites recurrence fields, clearing recurrence leaves nextDueAt untouched"() {
    given: "a monthly-recurring activity with a due date already set"
        def activity = activityRepository.save(new Activity("Service the boiler", ActivityCategory.NECESSARY,
            null, true, 6, RecurrenceIntervalUnit.MONTHS, Instant.parse("2027-01-01T00:00:00Z"), currentUser))

    when: "it is updated with recurrence cleared"
        def request = new ActivityRequest(activity.name, activity.category, null, true, null, null, null)
        client.put().uri("/api/v1/activities/${activity.id}").body(request).exchange()

    then: "recurrence is cleared but nextDueAt is unchanged"
        def reloaded = activityRepository.findById(activity.id).get()
        reloaded.recurrenceIntervalCount == null
        reloaded.recurrenceIntervalUnit == null
        reloaded.nextDueAt == Instant.parse("2027-01-01T00:00:00Z")
}

def "PLANNER-026-AC-11: completing a direct WEEKS-recurring activity's occurrence advances nextDueAt"() {
    given: "a weekly-recurring activity planned this week, no prior completion"
        def activity = activityRepository.save(new Activity("Go for a walk", ActivityCategory.PLEASURABLE,
            null, true, 1, RecurrenceIntervalUnit.WEEKS, null, currentUser))
        def occurrence = createOccurrenceFor(activity, weekStart)

    when: "the occurrence is completed"
        def response = client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/completion").exchange()

    then: "nextDueAt is set to completedAt plus one week"
        response.expectStatus().isOk()
        def completedAt = completionRecordRepository.findByPlannedOccurrenceIdAndOwner(occurrence.id, currentUser).get().completedAt
        activityRepository.findById(activity.id).get().nextDueAt ==
            completedAt.atZone(clock.zone).plusWeeks(1).toInstant()
}

def "PLANNER-026-AC-13: completing a sub-task occurrence advances the parent activity's nextDueAt"() {
    given: "a monthly-recurring activity with one sub-task, planned this week"
        def activity = activityRepository.save(new Activity("Deep clean the kitchen", ActivityCategory.NECESSARY,
            null, true, 3, RecurrenceIntervalUnit.MONTHS, null, currentUser))
        def subTask = subTaskRepository.save(new SubTask(activity, "Clean the oven", activity.category, currentUser))
        def occurrence = createOccurrenceFor(subTask, weekStart)

    when: "the sub-task's occurrence is completed"
        client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/completion").exchange()

    then: "the parent activity's nextDueAt is advanced"
        activityRepository.findById(activity.id).get().nextDueAt != null
}

def "PLANNER-026-AC-15: completing a non-recurring activity's occurrence leaves nextDueAt null"() {
    given: "an activity with no recurrence configured, planned this week"
        def activity = activityRepository.save(new Activity("Go for a walk", ActivityCategory.PLEASURABLE,
            null, true, currentUser))
        def occurrence = createOccurrenceFor(activity, weekStart)

    when: "the occurrence is completed"
        client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/completion").exchange()

    then: "nextDueAt stays null"
        activityRepository.findById(activity.id).get().nextDueAt == null
}

def "PLANNER-026-AC-16: uncomplete() never reverts nextDueAt"() {
    given: "a weekly-recurring activity whose occurrence has just been completed"
        def activity = activityRepository.save(new Activity("Go for a walk", ActivityCategory.PLEASURABLE,
            null, true, 1, RecurrenceIntervalUnit.WEEKS, null, currentUser))
        def occurrence = createOccurrenceFor(activity, weekStart)
        client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/completion").exchange()
        def advancedDueDate = activityRepository.findById(activity.id).get().nextDueAt

    when: "the occurrence is uncompleted"
        client.delete().uri("/api/v1/plan/occurrences/${occurrence.id}/completion").exchange()

    then: "nextDueAt is unchanged"
        activityRepository.findById(activity.id).get().nextDueAt == advancedDueDate
}

def "PLANNER-026-AC-17/AC-18/AC-19: GET /api/v1/reminders returns ascending order with correct overdue flags"() {
    given: "one overdue and one upcoming recurring activity"
        def overdue = activityRepository.save(new Activity("Overdue task", ActivityCategory.NECESSARY, null,
            true, 1, RecurrenceIntervalUnit.WEEKS, Instant.now(clock).minusSeconds(3600), currentUser))
        def upcoming = activityRepository.save(new Activity("Upcoming task", ActivityCategory.ROUTINE, null,
            true, 1, RecurrenceIntervalUnit.WEEKS, Instant.now(clock).plusSeconds(3600), currentUser))

    when: "GET /api/v1/reminders is requested"
        def response = client.get().uri("/api/v1/reminders").exchange()

    then: "the overdue activity is listed first, correctly flagged"
        response.expectBody().jsonPath("\$.data[0].id").isEqualTo(overdue.id.toString())
        response.expectBody().jsonPath("\$.data[0].overdue").isEqualTo(true)
        response.expectBody().jsonPath("\$.data[1].overdue").isEqualTo(false)
}

def "PLANNER-026-AC-20/AC-21: a never-due and an archived activity are both excluded"() {
    given: "a recurring activity never completed (no nextDueAt), and an archived one with nextDueAt set"
        activityRepository.save(new Activity("Never completed", ActivityCategory.ROUTINE, null, true,
            1, RecurrenceIntervalUnit.WEEKS, null, currentUser))
        def archived = activityRepository.save(new Activity("Archived but due", ActivityCategory.NECESSARY,
            null, false, 1, RecurrenceIntervalUnit.WEEKS, Instant.now(clock), currentUser))
        archived.archive()
        activityRepository.save(archived)

    when: "GET /api/v1/reminders is requested"
        def response = client.get().uri("/api/v1/reminders").exchange()

    then: "neither activity appears"
        response.expectBody().jsonPath("\$.count").isEqualTo(0)
}

def "PLANNER-026-AC-22: another user's due activities never appear"() {
    given: "a due activity belonging to a different user"
        activityRepository.save(new Activity("Not mine", ActivityCategory.ROUTINE, null, true,
            1, RecurrenceIntervalUnit.WEEKS, Instant.now(clock), otherUser))

    when: "GET /api/v1/reminders is requested as the current user"
        def response = client.get().uri("/api/v1/reminders").exchange()

    then: "the response is empty"
        response.expectBody().jsonPath("\$.count").isEqualTo(0)
}
```

**Test Case (Green)**: implement `Activity`/`RecurrenceIntervalUnit`/`ActivityRequest`/
`ActivityResponse`/`ActivityRepository`/`ActivityService`/`ActivityController`/
`InvalidActivityRequestException`/`PlanService`/`ReminderResponse`/`ReminderListResponse`/
`ReminderService`/`ReminderController` as specified above until every sketch above (and the
remaining ACs not sketched: AC-04/AC-06/AC-08/AC-10/AC-12/AC-14/AC-23) passes.

## Acceptance Criteria Summary

- [ ] PLANNER-026-AC-01 — `Activity` exposes recurrence/due-date fields, independent of `repeatable`
- [ ] PLANNER-026-AC-02 — DB check constraint: count/unit null-together, count > 0
- [ ] PLANNER-026-AC-03 — regression guard: `repeatable`'s auto-archive behaviour unaffected by recurrence fields
- [ ] PLANNER-026-AC-04 — valid count+unit (+ optional `nextDueAt`) stored as given on create/update
- [ ] PLANNER-026-AC-05 — count without unit (or vice versa) → 400 `InvalidActivityRequestException`
- [ ] PLANNER-026-AC-06 — non-positive count → 400 via `@Positive`
- [ ] PLANNER-026-AC-07 — update is a plain overwrite, no null-means-keep-old-value
- [ ] PLANNER-026-AC-08 — back-dating `nextDueAt` via manual override is accepted
- [ ] PLANNER-026-AC-09 — clearing recurrence leaves `nextDueAt` unchanged
- [ ] PLANNER-026-AC-10 — cross-owner `PUT` with recurrence fields → 404
- [ ] PLANNER-026-AC-11 — completing a direct WEEKS-recurring occurrence advances `nextDueAt`
- [ ] PLANNER-026-AC-12 — completing a direct MONTHS-recurring occurrence advances `nextDueAt`
- [ ] PLANNER-026-AC-13 — completing a sub-task occurrence advances the parent `Activity`'s `nextDueAt`
- [ ] PLANNER-026-AC-14 — idempotent re-completion recomputes `nextDueAt` from the new `completedAt`
- [ ] PLANNER-026-AC-15 — completing a non-recurring activity's occurrence leaves `nextDueAt` null
- [ ] PLANNER-026-AC-16 — `uncomplete()` never reverts `nextDueAt`
- [ ] PLANNER-026-AC-17 — `GET /api/v1/reminders` returns due activities, ascending by `nextDueAt`
- [ ] PLANNER-026-AC-18 — `overdue: true` when `nextDueAt` is in the past (via `Clock`)
- [ ] PLANNER-026-AC-19 — `overdue: false` when `nextDueAt` is in the future
- [ ] PLANNER-026-AC-20 — excludes an activity with no `nextDueAt` set
- [ ] PLANNER-026-AC-21 — excludes an archived activity even if due
- [ ] PLANNER-026-AC-22 — owner-scoped: never returns another user's activities
- [ ] PLANNER-026-AC-23 — `GET /api/v1/reminders` requires authentication (regression test)
