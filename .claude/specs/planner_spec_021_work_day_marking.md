# Work Day Marking: Recurring Pattern + Per-Date Override (Backend)

**Status**: Draft
**Priority**: P3 — new feature, raised by the user as an idea 2026-10-06, scoped into a spec
2026-10-06
**Depends on**: `planner_spec_002_authentication.md` (owner-scoping pattern this spec follows for
two brand-new entities), `planner_spec_004_week_planning.md` (`weekStart`-is-a-Monday validation
this spec mirrors for its own week-effective-days endpoint)
**Area**: Backend
**Roadmap version**: V1 polish

## Summary

Not yet implemented — see Acceptance Criteria Summary.

## Overview

Raised by the user 2026-10-06: "Mark dates as work days - mark work days in your weekly planner
as you might have less time to pick up activities on those days." Scoped via three follow-up
questions, answered by the user before this spec was written:

1. **Scope**: a *hybrid* of a recurring weekly default pattern (e.g. "Mon–Fri are work days") plus
   a per-specific-date override for any single day (e.g. working an occasional Saturday, or taking
   an unplanned day off midweek).
2. **Behaviour**: *visual-only* — a day marked as a work day carries an informational badge, with
   no change to how many slots are shown or what can be planned on it. No restriction, no nudge —
   matches this product's generally non-restrictive, non-judgmental stance (`.claude/steering/
   product.md`).
3. **Control surface**: *both* — a Settings page section to define/edit the recurring pattern, and
   an inline per-day toggle in the Weekly Planner/Today grid to override an individual date. (The
   inline toggle is this spec's `PUT .../{date}` endpoint; the Settings UI and the grid badge
   itself are `frontend_spec_042_work_day_marking.md`'s concern, not this one.)

Confirmed by reading the code (`model/User.java`, `model/PlannedOccurrence.java`): no settings/
preferences entity of any kind exists yet, and no per-week-but-not-occurrence entity exists to
pattern-match. This spec introduces two new entities, following the same `owner`-scoped-entity
shape already used by `Activity`/`SubTask`/`PlannedOccurrence` (a `@ManyToOne` `User owner`, not a
new `@ElementCollection`-style pattern, since no such pattern exists anywhere in this codebase yet
and introducing one for a single feature would add a second way of doing the same kind of thing):

- **`WorkDayPattern`** — the recurring default. One row per `(owner, dayOfWeek)` that the owner has
  marked as normally a work day. An owner with zero rows has no recurring work days (the safe,
  opt-in default for a new user).
- **`WorkDayOverride`** — the per-date exception. One row per `(owner, date)` that explicitly pins
  that exact calendar date's work-day status to `true` or `false`, regardless of what the recurring
  pattern says for that date's day-of-week. An override always wins over the pattern for its date.

**Effective work-day status for a given date** = the override's value if one exists for that exact
date, else whether that date's day-of-week is present in the recurring pattern, else `false`.

**Out of scope**:
- No "clear override, revert to pattern default" endpoint. Toggling in the UI always `PUT`s an
  explicit value (the opposite of the date's current effective status) — if that happens to match
  what the pattern would already produce, the override row is harmless, explicit-beats-implicit
  redundancy, not a bug. Keeps the API surface to exactly the four endpoints below.
- No change to `PlannedOccurrence`, slot counts, or any planning/validation logic — purely a new,
  independent, informational read/write surface. `frontend_spec_042` renders the resulting flag as
  a badge only.
- No historical-date restriction — an override can be set for a past date (e.g. correcting the
  record), same as `PlannedOccurrence` itself places no such restriction.

## Requirement 1 — Recurring work-day pattern

**User story**: As a user, I want to define which days of the week are normally work days once,
so I don't have to re-mark the same days every week.

### PLANNER-021-AC-01 [AUTO]: Fetching the pattern for a user with none set returns empty
**Statement**: `GET /api/v1/work-days/pattern` shall return `200` with `{"days": []}` for an owner
who has never set a pattern.

**Rationale**: Safe, opt-in default — a brand-new account has no days flagged, matching this
product's non-restrictive stance.

**References**: Controller: `WorkDayController#getPattern` (new); Service:
`WorkDayService#getPattern` (new); Repository: `WorkDayPatternRepository#findByOwner` (new)

### PLANNER-021-AC-02 [AUTO]: Setting the pattern fully replaces the previous one
**Statement**: `PUT /api/v1/work-days/pattern` with body `{"days": ["MONDAY", "TUESDAY", ...]}`
shall delete every existing `WorkDayPattern` row for the owner and insert one new row per day in
the submitted set, then return `200` with the new set as the response body.

**Rationale**: Full-replace semantics (rather than separate add/remove-one-day endpoints) keeps the
API simple — the Settings UI always has the complete, intended set of checked days at the moment
of saving.

**References**: Service: `WorkDayService#setPattern` (new); Entity: `model.WorkDayPattern` (new)

### PLANNER-021-AC-03 [AUTO]: The pattern is strictly scoped to its owner
**Statement**: `GET`/`PUT /api/v1/work-days/pattern` shall only ever read or write
`WorkDayPattern` rows belonging to the authenticated user — one user's pattern must never be
visible to, or mutated by, a different authenticated user's request.

**Rationale**: Multi-user-readiness seam, required from V1 for every domain entity per
`CLAUDE.md`'s hard rules.

**References**: Service: `WorkDayService` (all methods resolve `owner` from
`Authentication#getName()` via `UserRepository#findByUsername`, mirroring `ActivityService`)

## Requirement 2 — Effective work-day status for a week

**User story**: As a user viewing my Weekly Planner or Today grid, I want to see which days are
marked as work days for that specific week, combining my recurring pattern with any one-off
overrides for that week's actual dates.

### PLANNER-021-AC-04 [AUTO]: A week's effective work-days are computed from pattern + overrides
**Statement**: `GET /api/v1/work-days?weekStart=<monday>` shall return `200` with exactly 7
entries, one per date from `weekStart` to `weekStart + 6 days` inclusive, each shaped as
`{"date": "...", "dayOfWeek": "...", "workDay": true|false}`, where `workDay` is: the matching
`WorkDayOverride`'s value if one exists for that exact date, else whether that date's day-of-week
is present in the owner's `WorkDayPattern`, else `false`.

**Rationale**: Core read endpoint the Weekly Planner/Today grid calls once per week view to render
badges — combines both data sources into one simple, pre-resolved response so the frontend never
needs to merge pattern + overrides itself.

**References**: Controller: `WorkDayController#getWeek` (new); Service:
`WorkDayService#getWeek` (new); Repositories: `WorkDayPatternRepository`, `WorkDayOverrideRepository`
(new, `findByOwnerAndDateBetween`)

### PLANNER-021-AC-05 [AUTO]: A missing or non-Monday `weekStart` is rejected
**Statement**: `GET /api/v1/work-days` with a missing `weekStart`, or one that is not a Monday,
shall respond `400 Bad Request` via the existing `InvalidPlanRequestException` →
`GlobalExceptionHandler` path, with the same message text `PlanService#validateWeekStart` already
uses ("weekStart is required and must be a Monday").

**Rationale**: Mirrors `PlanService.getWeek`'s existing validation exactly — one consistent rule
and error shape for "give me a week" across both controllers, reusing the existing exception type
rather than introducing a new one for the same kind of 400.

**References**: `PlanService#validateWeekStart` (existing precedent, same message text);
`exception.InvalidPlanRequestException` (reused, not planner_spec_004-specific)

### PLANNER-021-AC-06 [AUTO]: A brand-new user sees no work days anywhere
**Statement**: For an owner with no `WorkDayPattern` rows and no `WorkDayOverride` rows,
`GET /api/v1/work-days?weekStart=<any monday>` shall return all 7 entries with `workDay: false`.

**Rationale**: Explicit regression guard for the safe-default behaviour described in Requirement 1
— confirms it holds through the combined pattern+override computation, not just the bare pattern
endpoint.

**References**: `WorkDayService#getWeek`

## Requirement 3 — Per-date override

**User story**: As a user, I want to mark or unmark one specific date as a work day without
changing my overall recurring pattern, so an occasional exception (working a Saturday, taking an
unplanned day off) doesn't require editing my general schedule.

### PLANNER-021-AC-07 [AUTO]: Setting an override creates or updates it for that exact date
**Statement**: `PUT /api/v1/work-days/{date}` with body `{"workDay": true|false}` shall create a
new `WorkDayOverride` row for `(owner, date)` if none exists, or update the existing row's value if
one does, then return `200` with `{"date": "...", "dayOfWeek": "...", "workDay": ...}`.

**Rationale**: Core write endpoint behind the Weekly Planner/Today grid's inline per-day toggle.

**References**: Controller: `WorkDayController#setOverride` (new); Service:
`WorkDayService#setOverride` (new); Repository: `WorkDayOverrideRepository#findByOwnerAndDate`
(new); Entity: `model.WorkDayOverride` (new, unique `(user_id, date)`)

### PLANNER-021-AC-08 [AUTO]: An override always wins over the recurring pattern for its date
**Statement**: Once an override exists for a date, `GET /api/v1/work-days?weekStart=...` shall
return that override's `workDay` value for that date regardless of whether the date's day-of-week
is or isn't in the owner's `WorkDayPattern` — in both directions (forcing a normally-not-a-work-day
date to `true`, and forcing a normally-pattern-matched date to `false`).

**Rationale**: Core hybrid behaviour the user asked for — a specific date is always the more
specific, most-recently-expressed intent and must take precedence.

**References**: `WorkDayService#getWeek` (override lookup checked before falling back to pattern)

### PLANNER-021-AC-09 [AUTO]: Setting an override for the same date twice updates, not duplicates
**Statement**: Calling `PUT /api/v1/work-days/{date}` twice for the same `(owner, date)` shall
result in exactly one `WorkDayOverride` row for that pair, with the value from the second call.

**Rationale**: Idempotency guard — the inline toggle will call this endpoint repeatedly as the user
flips a day back and forth; this must never accumulate duplicate rows.

**References**: `WorkDayService#setOverride` (look up existing row by `(owner, date)` before
deciding insert vs. update), `work_day_overrides`'s unique `(user_id, date)` constraint as a
database-level backstop

### PLANNER-021-AC-10 [AUTO]: Overrides are strictly scoped to their owner
**Statement**: `PUT /api/v1/work-days/{date}` shall only ever create or update a
`WorkDayOverride` row owned by the authenticated user — one user's override must never be
visible to, or mutable by, a different authenticated user's request for the same date.

**Rationale**: Multi-user-readiness seam, required from V1 for every domain entity.

**References**: `WorkDayService#setOverride`

## Cross-references

| Reference | What it provides |
|---|---|
| `model/User.java`, `model/Activity.java` | The `owner`-scoped-entity shape this spec's two new entities follow |
| `PlanService#validateWeekStart` | Exact validation/error-message precedent reused for `GET /api/v1/work-days` |
| `ActivityController`/`ActivityService` | Thin-controller/owner-resolved-in-service precedent this spec's `WorkDayController`/`WorkDayService` follow |
| `API.md` | Needs a new "Work Days" section documenting all four endpoints |
| `frontend_spec_042_work_day_marking.md` | Paired frontend spec: Settings page pattern editor, grid inline toggle/badge, consumes this spec's four endpoints |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-021-AC-01: fetching the pattern for a user with none set returns empty"() {
    when: "the pattern is fetched for a fresh owner"
        def response = client.get().uri("/api/v1/work-days/pattern").exchange()

    then: "an empty set is returned"
        response.expectStatus().isOk()
        response.expectBody().jsonPath('$.days').isEmpty()
}

def "PLANNER-021-AC-02: setting the pattern fully replaces the previous one"() {
    given: "an owner with an existing Mon/Tue/Wed pattern"
        workDayService.setPattern(owner.username, [MONDAY, TUESDAY, WEDNESDAY] as Set)

    when: "the pattern is replaced with just Friday"
        def result = workDayService.setPattern(owner.username, [FRIDAY] as Set)

    then: "only Friday remains"
        result == [FRIDAY] as Set
        workDayPatternRepository.findByOwner(owner)*.dayOfWeek == [FRIDAY]
}

def "PLANNER-021-AC-04/AC-08: effective week combines pattern and overrides, override wins"() {
    given: "a Mon-Fri recurring pattern"
        workDayService.setPattern(owner.username, [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY] as Set)
    and: "Wednesday is overridden to false, and Saturday is overridden to true"
        workDayService.setOverride(owner.username, LocalDate.of(2026, 10, 14), false) // a Wednesday
        workDayService.setOverride(owner.username, LocalDate.of(2026, 10, 17), true)  // a Saturday

    when: "the effective week is fetched"
        def week = workDayService.getWeek(owner.username, LocalDate.of(2026, 10, 12)) // the Monday

    then: "pattern days are true except the overridden Wednesday, and Saturday is true via override"
        week.find { it.dayOfWeek() == MONDAY }.workDay()
        week.find { it.dayOfWeek() == WEDNESDAY }.workDay() == false
        week.find { it.dayOfWeek() == SATURDAY }.workDay()
        week.find { it.dayOfWeek() == SUNDAY }.workDay() == false
}

def "PLANNER-021-AC-05: a non-Monday weekStart is rejected"() {
    when: "the week is fetched with a Tuesday"
        workDayService.getWeek(owner.username, LocalDate.of(2026, 10, 13))

    then: "InvalidPlanRequestException is thrown"
        thrown(InvalidPlanRequestException)
}

def "PLANNER-021-AC-09: setting an override twice updates rather than duplicates"() {
    given: "an override already set for a date"
        def date = LocalDate.of(2026, 10, 14)
        workDayService.setOverride(owner.username, date, true)

    when: "it is set again with a different value"
        workDayService.setOverride(owner.username, date, false)

    then: "exactly one row exists, with the latest value"
        def rows = workDayOverrideRepository.findByOwnerAndDate(owner, date)
        rows.isPresent()
        rows.get().workDay == false
}

def "PLANNER-021-AC-03/AC-10: pattern and overrides are scoped per-owner"() {
    given: "two owners, one with a Monday pattern and a Tuesday override"
        workDayService.setPattern(ownerA.username, [MONDAY] as Set)
        workDayService.setOverride(ownerA.username, LocalDate.of(2026, 10, 13), true)

    when: "owner B fetches their own pattern and week"
        def patternB = workDayService.getPattern(ownerB.username)
        def weekB = workDayService.getWeek(ownerB.username, LocalDate.of(2026, 10, 12))

    then: "owner B sees none of owner A's data"
        patternB.isEmpty()
        weekB.every { !it.workDay() }
}
```

**Test Case (Green)**: add `WorkDayPattern`/`WorkDayOverride` entities, their repositories, a
Flyway migration (`V009__create_work_day_tables.sql`) creating `work_day_patterns`
(`id`, `user_id` FK, `day_of_week`, unique `(user_id, day_of_week)`) and `work_day_overrides`
(`id`, `user_id` FK, `date`, `work_day`, `created_at`, `updated_at`, unique `(user_id, date)`),
`WorkDayService` with the four methods above, `WorkDayController` wiring them to the four
endpoints, and the DTOs (`WorkDayPatternRequest`/`Response`, `WorkDayOverrideRequest`,
`WorkDayResponse`) until all sketches above pass.

## Acceptance Criteria Summary

- [ ] PLANNER-021-AC-01 — fetching the pattern for a user with none set returns empty
- [ ] PLANNER-021-AC-02 — setting the pattern fully replaces the previous one
- [ ] PLANNER-021-AC-03 — the pattern is strictly scoped to its owner
- [ ] PLANNER-021-AC-04 — a week's effective work-days are computed from pattern + overrides
- [ ] PLANNER-021-AC-05 — a missing or non-Monday `weekStart` is rejected
- [ ] PLANNER-021-AC-06 — a brand-new user sees no work days anywhere
- [ ] PLANNER-021-AC-07 — setting an override creates or updates it for that exact date
- [ ] PLANNER-021-AC-08 — an override always wins over the recurring pattern for its date
- [ ] PLANNER-021-AC-09 — setting an override for the same date twice updates, not duplicates
- [ ] PLANNER-021-AC-10 — overrides are strictly scoped to their owner
