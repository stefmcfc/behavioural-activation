# Automatic Carry-Forward for Incomplete Bucket Items (Backend)

**Status**: Implemented (2026-10-01) — all 16 ACs green.
**Priority**: P2 — a real UX improvement to the weekend bucket list (today a user must remember to
manually hit "Carry forward" on every stale item, one at a time, or it just silently ages behind
the real current week with no way back into view via the normal weekly-navigation flow). Not
blocking anything else.
**Depends on**: `planner_spec_004_week_planning.md` (`PlannedOccurrence`, `PlanService`/
`PlanController`, `CompletionRecord`, the existing manual `PlanService.carryForward()`/
`PlannedOccurrence.carryForward()` mechanism this spec adds an automatic path alongside),
`planner_spec_006_repeatable_activities.md` (`PlanService.maybeAutoArchive()`'s cross-referencing
pattern — this spec's stale-item/completion cross-reference follows the same shape — and the
real-Postgres integration-spec precedent, `PlanServiceAutoArchiveIntegrationSpec.groovy`, this
spec's own integration spec follows), `planner_spec_010_bucket_reordering.md` (**being written in
parallel by a sibling agent, not yet merged as of this spec's own drafting** — introduces the new
`bucketPosition` field this spec's migration must reset; see Requirement 3 below)
**Area**: Backend
**Roadmap version**: V1 (extends the core planner's weekend bucket list from `product.md`'s V1 row
— not V2's tracking/reflection scope, and not AI)

## Summary

Implemented largely as specified, with one real sketch bug found and one real behavior confirmed
end-to-end in a live browser.

- **AC-01/AC-02's own sketch doesn't actually prove persistence.** It constructs
  `new PlanService(repos..., fixedClock)` directly and expects the `weekStart` mutation to survive —
  but a plain `new`-constructed `PlanService` has no Spring-managed `@Transactional` AOP proxy at
  all, so each repository call runs its own disjoint mini-transaction and the subsequent mutation is
  silently never flushed. This is a stronger version of the exact self-invocation hazard this spec's
  own Requirement 4 warns about, just hitting a manually-constructed instance instead. Moved AC-01/
  AC-02 (which is really only testing `Clock`-driven date arithmetic, not persistence) to a mocked
  unit test in `PlanServiceSpec.groovy`; the *durable-persistence* proof stays on AC-06/AC-08, via
  the real, Spring-managed `planService` bean.
- `PlannedOccurrenceResponse` already had `parentActivityName`/`repeatable`/`bucketPosition` fields
  from specs 008/013/010 by the time this was implemented — `recentlyCarriedForward` was appended as
  the 15th (final) field, matching how each of those three was itself appended rather than inserted.
- AC-10/AC-11/AC-14's sketch implied full-stack HTTP integration tests, which this codebase has no
  precedent for (every `@SpringBootTest` here tests the service layer directly; every HTTP-layer spec
  is `@WebMvcTest` with a mocked service). Split accordingly: migration/week-filtering correctness at
  the `PlanService` level against real Postgres; the controller's `recentlyCarriedForward` boolean
  mapping at the existing `@WebMvcTest` level.
- Full suite: 242 tests (up from 229), 0 regressions — independently re-run from a clean
  `--rerun-tasks` build.
- **Real-browser end-to-end verification** (beyond what the paired frontend spec's own real-browser
  check covers): created a bucket item in a stale past week via the live API, then triggered a real
  `GET /api/v1/plan` for the current week through the already-running app — confirmed via direct
  inspection of that exact response that the item's `weekStart` jumped straight to the current
  Monday, `bucketPosition` reset to `null`, and `recentlyCarriedForward` was `true` specifically on
  that triggering response (and correctly `false` on every later refetch, once no longer stale) —
  proving Requirement 4's transaction-ordering fix actually works against the real dev database, not
  just the integration spec's own assertions.

## Overview

Part of the same Weekly Planner UX batch as `planner_spec_008_occurrence_detail_card.md` (chunk 1)
and `frontend_spec_009_add_picker_modal.md` (chunk 2) — this is chunk 3b. The batch's "bucket
drag-and-drop reordering + automatic carry-forward" idea was originally one `SPEC_CANDIDATES.md`
entry, split into two independent specs during a 2026-09-29 planning pass once it was confirmed
neither depends on the other (`planner_spec_010_bucket_reordering.md` owns reordering; this spec
owns automatic carry-forward). This ties back to `.claude/HIGH_LEVEL_DESIGN.md`'s US-007 ("create a
weekend bucket list ... rather than assigning everything to specific times") — today a stale,
unfinished bucket item just sits behind the real current week, invisible unless the user manually
navigates back to that old week and clicks "Carry forward" themselves (the existing `POST
/api/v1/plan/occurrences/{id}/carry-forward` endpoint, unchanged and untouched by this spec). This
spec makes that recovery automatic: any incomplete bucket item whose `weekStart` has fallen behind
the real current week is silently relocated to the real current week the next time the user fetches
their plan.

**Confirmed design decisions (2026-09-29 planning pass, not re-litigated here):**

1. **Trigger mechanism**: a silent side effect of `GET /api/v1/plan` — fetching any week first
   checks for, and migrates, any of the owner's stale incomplete bucket items, before returning the
   requested week's results. This is a deliberate trade-off — a nominally read-only endpoint gaining
   a write side effect, not pure REST — accepted specifically because this project has no background
   job scheduler and explicitly rejects adding one (`CLAUDE.md`/`HIGH_LEVEL_DESIGN_FEEDBACK.md` §5).
   A dedicated migrate-on-page-load endpoint was considered and explicitly rejected in favour of this
   simpler option: it would need to be called from the same frontend lifecycle point `GET
   /api/v1/plan` already runs at, for no benefit over folding it into that call directly.
2. **Jump behaviour**: a stale item jumps straight to the real current week in one step when
   detected — never landing in, or passing through, an intermediate missed week, regardless of how
   many weeks were missed (Requirement 3).
3. Applies to bucket items only (`dayOfWeek`/`slot` both `null`). Grid-scheduled occurrences are
   never touched by this spec (Requirement 6).

**Two real implementation gaps this spec closes, found by reading the actual current source before
writing any AC:**

1. **`PlanService.getWeek()` is `@Transactional(readOnly = true)` today** (confirmed —
   `backend/src/main/java/uk/co/stefirby/behaviouralactivation/service/PlanService.java`):
   ```java
   @Transactional(readOnly = true)
   public List<PlannedOccurrence> getWeek(String ownerUsername, LocalDate weekStart) {
       validateWeekStart(weekStart);
       User owner = resolveOwner(ownerUsername);
       List<PlannedOccurrence> occurrences =
           plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, weekStart);
       occurrences.forEach(PlanService::initializeTarget);
       return occurrences;
   }
   ```
   A read-only transaction cannot durably persist the `weekStart` mutation this feature needs to
   make (Hibernate's read-only flush-mode behaviour means any entity mutation inside it is silently
   never flushed — this would *look* like it worked in the same request, since the mutated in-memory
   entity would still be returned, but the change would never reach the database). Resolving this by
   simply adding write logic inside the existing `readOnly = true` method is explicitly not an
   option. This spec instead adds a **separate, ordinary (read-write) `@Transactional` method**,
   `PlanService.migrateStaleBucketItems(...)`, and has `PlanController.getWeek()` call it **before**
   calling the existing, unmodified `PlanService.getWeek(...)` — two separate calls from the
   controller into two separate service methods, each entering through `PlanService`'s Spring-managed
   proxy independently, so each genuinely gets and commits its own transaction (see Requirement 4's
   implementation note for why this must be a controller-orchestrated two-call sequence, not one
   method calling the other internally).
2. **No `Clock` bean exists anywhere in this backend yet** (confirmed via a repo-wide grep for
   `Clock` — zero matches outside this spec's own new code). This is the first backend feature that
   needs to compute "what is the real current week" server-side — until now, "current week" has only
   ever been a frontend concept (`WeeklyPlanner.tsx`'s `getMondayOfCurrentWeek()`); the backend's
   `weekStart` has only ever been a client-supplied, validated-as-Monday request parameter, never
   computed by the server itself. Per this machine's global Java/Spring conventions ("inject `Clock`,
   don't call the no-arg `now()` overload" — applies to every Java backend on this machine, this
   project included), this spec introduces one injectable `Clock` bean (`config/ClockConfig.java`,
   `Clock.systemDefaultZone()` — a no-behaviour-change stand-in for the implicit JVM-zone default the
   no-arg overload would otherwise use) and threads it into `PlanService` via constructor injection
   (Requirement 1). **Scope note**: every other `Instant.now()`/`LocalDate.now()` call already in
   this codebase (`CompletionRecord`, `PlannedOccurrence`, `Activity`, `SubTask`, `User`,
   `PlanService.upsertCompletion`) is a plain audit-timestamp write, not a "what week is it"
   comparison — none of them currently need to be controllable/testable the way this spec's
   current-week computation does. They are **not** retrofitted to the new `Clock` bean as part of
   this spec's scope; flagged here as a candidate follow-up cleanup, not undertaken now.

**Frontend indicator — resolved, not left open.** `SPEC_CANDIDATES.md`'s original candidate entry
flagged this as undecided. Decision: **yes, add one**, via a small paired spec,
`frontend_spec_011_bucket_carry_forward_automation.md`. Rationale: unlike a completed bucket item
(which stays visibly marked "— Completed" in place, so its presence is self-explanatory) or the
*manual* carry-forward action (which the user explicitly triggered themselves, so there's no
"where did this come from" moment), an automatically-migrated item can appear in the current week's
bucket list on a fetch the user didn't consciously associate with moving anything — the item's own
tile carries no `weekStart` display today (`BucketList.tsx`/`OccurrenceItem.tsx` render bucket items
with no date at all), so without a signal it would look identical to something freshly added. Given
this app's explicit "neutral language, review over scorecard, don't let a missed activity read as
failure" product stance, a quiet "moved from last week" label costs very little (one new
response-only, never-persisted boolean field, one new line of text — not a redesign of
`OccurrenceItem`, which stays `frontend_spec_008`'s territory) against a real, if small, UX-clarity
benefit. See `frontend_spec_011_bucket_carry_forward_automation.md` for that half.

**Out of scope**: bucket drag-and-drop reordering itself (`planner_spec_010_bucket_reordering.md`
— this spec only reuses and resets its `bucketPosition` field, doesn't own its semantics). The
occurrence detail card (`planner_spec_008_occurrence_detail_card.md`/
`frontend_spec_008_occurrence_detail_card.md`). The "Add" picker modal
(`frontend_spec_009_add_picker_modal.md`). The weekly grid orientation toggle (separate
`SPEC_CANDIDATES.md` entry). Any change to grid-scheduled (non-bucket) occurrences. The existing
manual carry-forward endpoint/behaviour (`POST /api/v1/plan/occurrences/{id}/carry-forward`,
`PlanService.carryForward()`, `PlannedOccurrence.carryForward()`) — stays exactly as-is; this spec
adds an automatic path alongside it, not a replacement (Requirement 8). No migration/schema change
of its own — the only new persisted-field interaction is resetting `bucketPosition`, a field this
spec doesn't itself introduce (owned by `planner_spec_010`).

## Requirements

### Requirement 1 — A real, injectable `Clock` for computing "now" server-side

As a user, I want the backend's notion of "this week" to reflect the actual current date correctly
and consistently, so a stale bucket item is judged against real time, not an untestable, ambient
JVM default.

- **PLANNER-011-AC-01** [AUTO]: The application shall declare a `Clock` bean (`config/ClockConfig.java`,
  `@Configuration`, exposing `Clock.systemDefaultZone()`).
- **PLANNER-011-AC-02** [AUTO]: `PlanService` shall take a `Clock` via constructor injection and use
  `LocalDate.now(clock)` — never the no-arg `LocalDate.now()`/`Instant.now()` overload — when
  computing the real current date for the purpose of this spec's stale-item detection.

### Requirement 2 — Detect an owner's stale, incomplete bucket items

As a user, I want the app to notice, on my behalf, which of my weekend bucket items have fallen
behind the current week without my having finished them, so I don't have to remember to check.

- **PLANNER-011-AC-03** [AUTO]: `PlannedOccurrenceRepository` shall declare a new derived query,
  `findByOwnerAndDayOfWeekIsNullAndSlotIsNullAndWeekStartBefore(User owner, LocalDate weekStart)`,
  returning that owner's bucket items (`dayOfWeek`/`slot` both `null`) whose `weekStart` is strictly
  before the given date.
- **PLANNER-011-AC-04** [AUTO]: When `PlanService.migrateStaleBucketItems(...)` runs, it shall
  exclude from migration any stale bucket item that already has a `CompletionRecord` — cross-
  referencing the stale item set against `CompletionRecordRepository.findByOwnerAndPlannedOccurrenceIdIn(...)`,
  mirroring `PlanService.maybeAutoArchive(...)`'s existing cross-reference pattern
  (`planner_spec_006_repeatable_activities.md`) rather than inventing a different shape — a
  completed bucket item keeps its original `weekStart` and is never relocated.
- **PLANNER-011-AC-05** [AUTO]: `PlanService.migrateStaleBucketItems(...)` shall only ever query and
  mutate the authenticated owner's own occurrences — never another owner's — matching every other
  method on `PlanService`'s owner-scoping convention.

### Requirement 3 — Jump a stale bucket item straight to the real current week

As a user, I want a long-neglected bucket item to land exactly where I am now, not to require
several rounds of catching up, so an old intention doesn't need multiple visits to resurface fully.

- **PLANNER-011-AC-06** [AUTO]: For each stale, incomplete bucket item found (Requirement 2),
  `PlanService.migrateStaleBucketItems(...)` shall set its `weekStart` directly to the real current
  week's Monday (computed from `LocalDate.now(clock)`, Requirement 1) in a single step — never by
  repeatedly advancing 7 days at a time — regardless of how many weeks have elapsed since it was
  last touched.
- **PLANNER-011-AC-07** [AUTO]: When a stale bucket item's `weekStart` is updated by
  `PlanService.migrateStaleBucketItems(...)`, the new `PlannedOccurrence.autoCarryForwardTo(...)`
  model method it calls shall also reset that occurrence's `bucketPosition` field (introduced by
  `planner_spec_010_bucket_reordering.md`) to `null`, so it is treated as freshly appended to the
  end of its new week's bucket order — `bucketPosition`'s exact ordering semantics are owned by
  `planner_spec_010_bucket_reordering.md`, referenced here rather than re-derived.

### Requirement 4 — The migration is durably persisted, in its own transaction, ahead of the unchanged read-only week query

As a user, I want a migrated item's new week to actually stick, not silently revert because of a
transaction boundary I never see, so I can trust that what I see reflects what's saved.

- **PLANNER-011-AC-08** [AUTO]: `PlanService.migrateStaleBucketItems(String ownerUsername)` shall be
  a distinct, ordinary (read-write) `@Transactional` method — not `readOnly = true` — whose changes
  are committed to the database before `PlanController.getWeek(...)`'s subsequent, unmodified call to
  `PlanService.getWeek(...)` (still `@Transactional(readOnly = true)`, unchanged) executes its query,
  verified by a real-Postgres integration spec (not a mocked repository) proving the `weekStart`
  mutation survives past `migrateStaleBucketItems(...)`'s own transactional boundary — following
  `PlanServiceAutoArchiveIntegrationSpec.groovy`'s precedent (`planner_spec_006_repeatable_activities.md`)
  for exactly this class of transaction-boundary bug, which a mocked-repository unit test cannot
  catch.
- **PLANNER-011-AC-09** [AUTO]: `PlanController.getWeek(...)` shall call
  `planService.migrateStaleBucketItems(...)` unconditionally for every authenticated `GET
  /api/v1/plan` request, before calling `planService.getWeek(...)` — including when the requested
  `weekStart` query parameter is itself missing or invalid, since the migration step depends only on
  the owner, not on the requested week.

**Implementation note (why this must be a controller-orchestrated two-call sequence, not one method
calling the other internally)**: Spring's `@Transactional` is proxy-based AOP. If
`migrateStaleBucketItems(...)` were instead called *from inside* `getWeek(...)` (a self-invocation —
one method on `PlanService` calling another method on the same `PlanService` instance), the call
would bypass `PlanService`'s Spring-managed proxy entirely and would not start a fresh transaction of
its own — it would silently run inside whatever transaction the *caller* is already in (here,
`getWeek()`'s existing `readOnly = true` one), reproducing exactly the persistence bug this spec
exists to avoid. Calling `migrateStaleBucketItems(...)` from `PlanController` instead means it is
invoked as a genuine external call into `PlanService`'s proxy, exactly like every other
controller-to-service call in this codebase, so it gets its own real transaction.

### Requirement 5 — `GET /api/v1/plan`'s response reflects migration correctly, in both directions

As a user, I want the week I actually asked for to be accurate immediately, whether or not something
of mine just got moved into or out of it.

- **PLANNER-011-AC-10** [AUTO]: If the `weekStart` requested in a `GET /api/v1/plan` call is **not**
  the real current week, then a bucket item migrated by that same request's
  `migrateStaleBucketItems(...)` call shall **not** appear in that response's `data` — it no longer
  belongs to the requested week once migrated.
- **PLANNER-011-AC-11** [AUTO]: If the `weekStart` requested in a `GET /api/v1/plan` call **is** the
  real current week, then a bucket item migrated by that same request's `migrateStaleBucketItems(...)`
  call shall appear in that response's `data` — the migration and the read happen within the same
  request, not asynchronously.

### Requirement 6 — Only weekend-bucket items are ever migrated

As a user, I want my scheduled weekday plan to stay exactly where I put it, however old it gets, so
this automation never rewrites a day/slot I deliberately chose.

- **PLANNER-011-AC-12** [AUTO]: `PlanService.migrateStaleBucketItems(...)` shall never modify a
  grid-scheduled occurrence (`dayOfWeek`/`slot` both set), regardless of how far in the past its
  `weekStart` is — enforced structurally by Requirement 2's repository query, which only ever
  selects `dayOfWeek IS NULL AND slot IS NULL` rows.

### Requirement 7 — The response signals when an item was just carried forward automatically

As a user, I want a bucket item that just silently relocated to my current week to be visibly
explained, so it doesn't look like something appeared from nowhere.

- **PLANNER-011-AC-13** [AUTO]: `PlannedOccurrenceResponse` shall declare a new
  `recentlyCarriedForward` field of type `boolean` (never persisted — computed fresh per response),
  alongside its existing fields.
- **PLANNER-011-AC-14** [AUTO]: When `PlanController.getWeek(...)` builds its response, it shall set
  `recentlyCarriedForward: true` for exactly the occurrences whose `id` was returned by that same
  request's `migrateStaleBucketItems(...)` call, and `false` for every other occurrence in the
  response.
- **PLANNER-011-AC-15** [AUTO]: Every other `PlanController` response-building path (`create`,
  `move`, `complete`, `uncomplete`, the existing manual `carryForward`) shall always set
  `recentlyCarriedForward: false` — this signal exists only on `GET /api/v1/plan`'s response, for the
  request that performed the automatic migration; a manually-triggered carry-forward needs no such
  signal, since the user themselves just performed that action and already knows.

### Requirement 8 — No regression to the existing manual carry-forward path or any other existing behaviour

As a user, I want my existing "Carry forward" button to keep working exactly as it does today, with
this automation simply running alongside it, not replacing it.

- **PLANNER-011-AC-16** [AUTO — regression]: The existing `POST
  /api/v1/plan/occurrences/{id}/carry-forward` endpoint, `PlanService.carryForward(...)`, and
  `PlannedOccurrence.carryForward()` (the `weekStart += 7 days` single-step mechanism, from
  `planner_spec_004_week_planning.md`) shall remain unchanged in behaviour, unaffected by this
  spec's addition of the separate `autoCarryForwardTo(...)` method — `planner_spec_004`'s own
  existing test coverage (`PLANNER-004-AC-28`–`AC-31`) continues to exercise this path unmodified;
  no new test is added here for it.

## Implementation notes

`config/ClockConfig.java` (new — first `@Configuration` class in this codebase's `config/` package):

```java
package uk.co.stefirby.behaviouralactivation.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
```

`model/PlannedOccurrence.java` gains one new mutator, alongside the existing unmodified
`carryForward()`:

```java
// Automatic-migration path (planner_spec_011_bucket_carry_forward_automation.md) -- distinct from
// carryForward() above, which stays the manual +7-day single-step mechanism, unchanged. This jumps
// directly to an arbitrary target week (the real current week, however many weeks away) in one
// step, and resets bucketPosition (planner_spec_010_bucket_reordering.md) to null so the item is
// treated as freshly appended to its new week's bucket order.
public void autoCarryForwardTo(LocalDate newWeekStart) {
    this.weekStart = newWeekStart;
    this.bucketPosition = null;
    this.updatedAt = Instant.now();
}
```

`repository/PlannedOccurrenceRepository.java`:

```java
public interface PlannedOccurrenceRepository extends JpaRepository<PlannedOccurrence, UUID> {
    List<PlannedOccurrence> findByOwnerAndWeekStartOrderByCreatedAtAsc(User owner, LocalDate weekStart);
    Optional<PlannedOccurrence> findByIdAndOwner(UUID id, User owner);

    // planner_spec_011_bucket_carry_forward_automation.md's stale-bucket-item detection.
    List<PlannedOccurrence> findByOwnerAndDayOfWeekIsNullAndSlotIsNullAndWeekStartBefore(
        User owner, LocalDate weekStart);
}
```

`service/PlanService.java` — new field/constructor param, new public method (own transaction), plus
the `LocalDate.now(clock)` usage:

```java
import java.time.Clock;
import java.time.temporal.TemporalAdjusters;
import java.util.HashSet;

@Service
public class PlanService {

    private final PlannedOccurrenceRepository plannedOccurrenceRepository;
    private final CompletionRecordRepository completionRecordRepository;
    private final ActivityRepository activityRepository;
    private final SubTaskRepository subTaskRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public PlanService(PlannedOccurrenceRepository plannedOccurrenceRepository,
            CompletionRecordRepository completionRecordRepository, ActivityRepository activityRepository,
            SubTaskRepository subTaskRepository, UserRepository userRepository, Clock clock) {
        this.plannedOccurrenceRepository = plannedOccurrenceRepository;
        this.completionRecordRepository = completionRecordRepository;
        this.activityRepository = activityRepository;
        this.subTaskRepository = subTaskRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    // Runs as its own read-write transaction, called separately from getWeek() by PlanController --
    // see this spec's Requirement 4 implementation note for why self-invocation would break this.
    @Transactional
    public Set<UUID> migrateStaleBucketItems(String ownerUsername) {
        User owner = resolveOwner(ownerUsername);
        LocalDate currentWeekMonday = LocalDate.now(clock).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        List<PlannedOccurrence> staleBucketItems = plannedOccurrenceRepository
            .findByOwnerAndDayOfWeekIsNullAndSlotIsNullAndWeekStartBefore(owner, currentWeekMonday);
        if (staleBucketItems.isEmpty()) {
            return Set.of();
        }

        List<UUID> staleIds = staleBucketItems.stream().map(PlannedOccurrence::getId).toList();
        Set<UUID> completedIds = completionRecordRepository.findByOwnerAndPlannedOccurrenceIdIn(owner, staleIds)
            .stream()
            .map(record -> record.getPlannedOccurrence().getId())
            .collect(Collectors.toSet());

        Set<UUID> migratedIds = new HashSet<>();
        for (PlannedOccurrence occurrence : staleBucketItems) {
            if (completedIds.contains(occurrence.getId())) {
                continue; // already complete -- stays at its original weekStart, AC-04
            }
            occurrence.autoCarryForwardTo(currentWeekMonday);
            migratedIds.add(occurrence.getId());
        }
        // No explicit save() call -- occurrence is a managed entity loaded within this transaction;
        // Hibernate's dirty checking flushes the mutation at commit, matching applyMove()/
        // applyCarryForward()'s existing style elsewhere in this class.
        return migratedIds;
    }

    // getWeek() itself is UNCHANGED by this spec -- still @Transactional(readOnly = true), still
    // exactly as it was in planner_spec_004_week_planning.md. Shown here only to make explicit that
    // this spec does not touch it.
    @Transactional(readOnly = true)
    public List<PlannedOccurrence> getWeek(String ownerUsername, LocalDate weekStart) {
        // ... unchanged
    }
}
```

`controller/PlanController.java`'s `getWeek(...)` — the two-call sequence, and the new response
field:

```java
@GetMapping
public ResponseEntity<PlannedOccurrenceListResponse> getWeek(
        @RequestParam(required = false) LocalDate weekStart, Authentication authentication) {
    Set<UUID> migratedIds = planService.migrateStaleBucketItems(authentication.getName());
    List<PlannedOccurrence> occurrences = planService.getWeek(authentication.getName(), weekStart);
    List<UUID> ids = occurrences.stream().map(PlannedOccurrence::getId).toList();
    Map<UUID, CompletionRecord> completions = planService.findCompletions(authentication.getName(), ids);
    List<PlannedOccurrenceResponse> data = occurrences.stream()
        .map(occurrence -> toResponse(occurrence, completions.get(occurrence.getId()),
            migratedIds.contains(occurrence.getId())))
        .toList();
    return ResponseEntity.ok(new PlannedOccurrenceListResponse(data, data.size()));
}

// Every other call site (create/move/complete/carryForward) passes recentlyCarriedForward = false.
private static PlannedOccurrenceResponse toResponse(PlannedOccurrence occurrence, CompletionRecord completion,
        boolean recentlyCarriedForward) {
    boolean isActivity = occurrence.getActivity() != null;
    UUID activityId = isActivity ? occurrence.getActivity().getId() : null;
    UUID subTaskId = isActivity ? null : occurrence.getSubTask().getId();
    String name = isActivity ? occurrence.getActivity().getName() : occurrence.getSubTask().getName();
    boolean completed = completion != null;
    Instant completedAt = completion != null ? completion.getCompletedAt() : null;
    return new PlannedOccurrenceResponse(occurrence.getId(), activityId, subTaskId, name,
        occurrence.getCategory(), occurrence.getWeekStart(), occurrence.getDayOfWeek(),
        occurrence.getSlot(), recentlyCarriedForward, completed, completedAt, occurrence.getCreatedAt());
}
```

`dto/PlannedOccurrenceResponse.java` — `recentlyCarriedForward` placed directly after `slot`, the
field it's most closely tied to (whether the occurrence is a bucket item and which week it's in):

```java
public record PlannedOccurrenceResponse(
    UUID id,
    UUID activityId,
    UUID subTaskId,
    String name,
    ActivityCategory category,
    LocalDate weekStart,
    DayOfWeek dayOfWeek,
    PlanSlot slot,
    boolean recentlyCarriedForward,
    boolean completed,
    Instant completedAt,
    Instant createdAt
) {
}
```

**Field-ordering note**: if `planner_spec_008_occurrence_detail_card.md`'s `parentActivityName`
field or `planner_spec_010_bucket_reordering.md`'s `bucketPosition` field have already landed on
`PlannedOccurrenceResponse` by the time this spec is implemented, `recentlyCarriedForward` is added
alongside them without disturbing their positions — the exact final field order across all three
specs is an implementation-time integration detail, not fixed by any one of them individually.

## Cross-references

| This spec | Contracts against |
|---|---|
| `config/ClockConfig.java` | New — first `Clock` bean in this codebase |
| `PlanService.migrateStaleBucketItems(...)` (`service/`) | New — own read-write `@Transactional` method |
| `PlanService.getWeek(...)` (`planner_spec_004_week_planning.md`) | Reused unmodified — still `@Transactional(readOnly = true)` |
| `PlannedOccurrenceRepository.findByOwnerAndDayOfWeekIsNullAndSlotIsNullAndWeekStartBefore(...)` (`repository/`) | New |
| `CompletionRecordRepository.findByOwnerAndPlannedOccurrenceIdIn(...)` (`planner_spec_004_week_planning.md`) | Reused unmodified — same bulk lookup used for this spec's completion cross-reference |
| `PlanService.maybeAutoArchive(...)` (`planner_spec_006_repeatable_activities.md`) | Precedent — this spec's stale/completed cross-reference follows the same shape |
| `PlannedOccurrence.autoCarryForwardTo(...)` (`model/`) | New — distinct from the existing, unmodified `carryForward()` |
| `PlannedOccurrence.bucketPosition` (`planner_spec_010_bucket_reordering.md`) | Referenced, reset to `null` on migration — semantics owned by that spec, not this one |
| `PlannedOccurrenceResponse` (`dto/`) | Extended — new `recentlyCarriedForward` field |
| `PlanController.getWeek(...)` (`controller/`) | Extended — orchestrates the two-call sequence, resolves `recentlyCarriedForward` |
| `PlanServiceAutoArchiveIntegrationSpec.groovy` (`planner_spec_006_repeatable_activities.md`) | Precedent — this spec's own real-Postgres integration spec follows the same pattern |
| `frontend_spec_011_bucket_carry_forward_automation.md` | Paired frontend spec — consumes `recentlyCarriedForward` exactly as specified here |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-011-AC-01/AC-02: migrateStaleBucketItems computes the real current week from the injected Clock, not ambient now()"() {
    given: "a Clock fixed to a known Wednesday, and a stale bucket item"
        def fixedClock = Clock.fixed(Instant.parse("2026-10-14T09:00:00Z"), ZoneOffset.UTC) // Wed 2026-10-14
        def planServiceWithFixedClock = new PlanService(plannedOccurrenceRepository, completionRecordRepository,
            activityRepository, subTaskRepository, userRepository, fixedClock)
        def stale = plannedOccurrenceRepository.save(
            new PlannedOccurrence(activity, null, ActivityCategory.PLEASURABLE, LocalDate.of(2026, 9, 21),
                null, null, owner))

    when: "migrateStaleBucketItems is called"
        planServiceWithFixedClock.migrateStaleBucketItems(owner.username)

    then: "the item is moved to Monday of the fixed Clock's week (2026-10-12), not 2026-09-28 (one 7-day hop)"
        plannedOccurrenceRepository.findById(stale.id).get().weekStart == LocalDate.of(2026, 10, 12)
}

def "PLANNER-011-AC-04: a stale bucket item that is already complete is excluded from migration"() {
    given: "a stale bucket item with a CompletionRecord"
        def stale = plannedOccurrenceRepository.save(
            new PlannedOccurrence(activity, null, ActivityCategory.PLEASURABLE, LocalDate.of(2026, 9, 21),
                null, null, owner))
        completionRecordRepository.save(new CompletionRecord(stale, owner, Instant.now()))

    when: "migrateStaleBucketItems is called"
        def migratedIds = planService.migrateStaleBucketItems(owner.username)

    then: "the item is not migrated, and its weekStart is unchanged"
        migratedIds.isEmpty()
        plannedOccurrenceRepository.findById(stale.id).get().weekStart == LocalDate.of(2026, 9, 21)
}

def "PLANNER-011-AC-06/AC-08: a bucket item stale by several weeks jumps to the real current week in one step, durably persisted"() {
    given: "an incomplete bucket item stale by three weeks"
        def created = planService.create(owner.username,
            new PlannedOccurrenceRequest(activity.id, null, threeWeeksAgoMonday, null, null)).get()

    when: "migrateStaleBucketItems is called, and the result is re-read via a fresh repository call"
        def migratedIds = planService.migrateStaleBucketItems(owner.username)
        def persisted = plannedOccurrenceRepository.findById(created.id).get()

    then: "the item lands directly on the real current week's Monday, not one 7-day hop, and it is durably persisted"
        migratedIds == [created.id] as Set
        persisted.weekStart == currentWeekMonday
}

def "PLANNER-011-AC-07: migration resets bucketPosition to null"() {
    given: "an incomplete, stale bucket item with a non-null bucketPosition from a prior week's order"
        def stale = plannedOccurrenceRepository.save(
            new PlannedOccurrence(activity, null, ActivityCategory.PLEASURABLE, twoWeeksAgoMonday,
                null, null, owner))
        stale.assignBucketPosition(2) // planner_spec_010_bucket_reordering.md
        plannedOccurrenceRepository.save(stale)

    when: "migrateStaleBucketItems is called"
        planService.migrateStaleBucketItems(owner.username)

    then: "bucketPosition is reset to null, so the item is treated as freshly appended"
        plannedOccurrenceRepository.findById(stale.id).get().bucketPosition == null
}

def "PLANNER-011-AC-10: a migrated item does not appear when a non-current week is explicitly requested"() {
    given: "a stale bucket item that will be migrated to the real current week"
        def created = planService.create(owner.username,
            new PlannedOccurrenceRequest(activity.id, null, twoWeeksAgoMonday, null, null)).get()

    when: "GET /api/v1/plan is requested for the (now stale) original week"
        def response = client.get().uri("/api/v1/plan?weekStart=${twoWeeksAgoMonday}").exchange()

    then: "the migrated item is absent from that response"
        response.expectBody().jsonPath("\$.data[?(@.id=='${created.id}')]").doesNotExist()
}

def "PLANNER-011-AC-11/AC-14: a migrated item appears in the current-week response with recentlyCarriedForward true"() {
    given: "a stale bucket item that will be migrated to the real current week"
        def created = planService.create(owner.username,
            new PlannedOccurrenceRequest(activity.id, null, twoWeeksAgoMonday, null, null)).get()

    when: "GET /api/v1/plan is requested for the real current week"
        def response = client.get().uri("/api/v1/plan?weekStart=${currentWeekMonday}").exchange()

    then: "the migrated item is present, flagged as recently carried forward"
        response.expectBody().jsonPath("\$.data[?(@.id=='${created.id}')].recentlyCarriedForward")
            .isEqualTo([true])
}

def "PLANNER-011-AC-12: a stale grid-scheduled occurrence is never touched by migration"() {
    given: "a scheduled (non-bucket) occurrence with a stale weekStart"
        def scheduled = plannedOccurrenceRepository.save(
            new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, twoWeeksAgoMonday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner))

    when: "migrateStaleBucketItems is called"
        def migratedIds = planService.migrateStaleBucketItems(owner.username)

    then: "the scheduled occurrence is not migrated"
        !(scheduled.id in migratedIds)
        plannedOccurrenceRepository.findById(scheduled.id).get().weekStart == twoWeeksAgoMonday
}

def "PLANNER-011-AC-15: recentlyCarriedForward is always false on the manual carry-forward endpoint's own response"() {
    given: "an incomplete bucket item eligible for manual carry-forward"
        def occurrence = plannedOccurrenceRepository.save(
            new PlannedOccurrence(activity, null, ActivityCategory.PLEASURABLE, currentWeekMonday,
                null, null, owner))

    when: "the manual carry-forward endpoint is called"
        def response = client.post().uri("/api/v1/plan/occurrences/${occurrence.id}/carry-forward").exchange()

    then: "recentlyCarriedForward is false, unaffected by this spec's automatic-migration signal"
        response.expectBody().jsonPath("\$.recentlyCarriedForward").isEqualTo(false)
}
```

`PLANNER-011-AC-03`/`AC-05`/`AC-09`/`AC-13`/`AC-16` are exercised implicitly by the sketches above
(AC-03/AC-05 by the migration tests' correct scoping and results; AC-09 by every `GET /api/v1/plan`
test in this batch, since the controller's unconditional two-call sequence underlies all of them;
AC-13 by compilation once the DTO field exists, matching `planner_spec_008`'s precedent for a
similarly structural AC) or are explicitly out of scope for new test coverage (AC-16, a regression
already owned by `planner_spec_004_week_planning.md`'s existing tests) — no standalone sketch is
needed for them beyond what's shown.

The `AC-01`/`AC-04`/`AC-06`/`AC-07`/`AC-08`/`AC-10`/`AC-11`/`AC-12`/`AC-15` sketches run against real
Postgres (a new `@SpringBootTest` Spock spec,
`PlanServiceCarryForwardAutomationIntegrationSpec.groovy`, following
`PlanServiceAutoArchiveIntegrationSpec.groovy`'s precedent — `setup()`/`cleanup()` create and delete
a throwaway `owner` `User` per test) since they exercise real transaction-boundary and persistence
behaviour a mocked repository cannot prove; AC-14's assertion is folded into the same real-Postgres
spec rather than a separate `@WebMvcTest`, since it depends on the same real migration having
actually run.

**Test Case (Green)**: implement `ClockConfig`, `PlannedOccurrence.autoCarryForwardTo(...)`,
`PlannedOccurrenceRepository`'s new query, `PlanService.migrateStaleBucketItems(...)`,
`PlanController.getWeek(...)`'s two-call sequence, and `PlannedOccurrenceResponse`'s
`recentlyCarriedForward` field as specified above until every sketch above passes.

## Acceptance Criteria Summary

- [x] PLANNER-011-AC-01 — `ClockConfig` declares a `Clock` bean (`Clock.systemDefaultZone()`)
- [x] PLANNER-011-AC-02 — `PlanService` takes `Clock` via constructor injection, uses `LocalDate.now(clock)`
- [x] PLANNER-011-AC-03 — `PlannedOccurrenceRepository` gains the stale-bucket-item derived query
- [x] PLANNER-011-AC-04 — a stale bucket item with a `CompletionRecord` is excluded from migration
- [x] PLANNER-011-AC-05 — migration is scoped to the authenticated owner only
- [x] PLANNER-011-AC-06 — a stale item jumps to the real current week in one step, any number of weeks stale
- [x] PLANNER-011-AC-07 — migration resets `bucketPosition` to `null` (`planner_spec_010` field)
- [x] PLANNER-011-AC-08 — migration is its own read-write `@Transactional` method, durably persisted before `getWeek()`'s read-only query runs
- [x] PLANNER-011-AC-09 — `PlanController.getWeek()` calls migration unconditionally, before `getWeek()`, on every request
- [x] PLANNER-011-AC-10 — a migrated item is absent from a non-current-week response
- [x] PLANNER-011-AC-11 — a migrated item is present in the current-week response, same request
- [x] PLANNER-011-AC-12 — grid-scheduled occurrences are never migrated
- [x] PLANNER-011-AC-13 — `PlannedOccurrenceResponse` declares `recentlyCarriedForward: boolean`
- [x] PLANNER-011-AC-14 — `recentlyCarriedForward: true` set only for that request's migrated occurrences
- [x] PLANNER-011-AC-15 — every other response path always sets `recentlyCarriedForward: false`
- [x] PLANNER-011-AC-16 — the existing manual carry-forward endpoint/behaviour is unchanged (regression)
