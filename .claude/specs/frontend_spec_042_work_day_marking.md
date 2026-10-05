# Work Day Marking: Settings Pattern Editor + Grid Toggle (Frontend)

**Status**: Draft
**Priority**: P3 — new feature, raised by the user as an idea 2026-10-06, scoped into a spec pair
2026-10-06
**Depends on**: `planner_spec_021_work_day_marking.md` (the four endpoints this spec consumes),
`frontend_spec_016_today_view.md` (`usePlanActions`'s per-view-independent-fetch precedent this
spec's new `useWorkDays` hook follows for `WeeklyPlanner`/`TodayView`)
**Area**: Frontend
**Roadmap version**: V1 polish

## Summary

Not yet implemented — see Acceptance Criteria Summary.

## Overview

Paired with `planner_spec_021_work_day_marking.md`. Per the user's own answers when this idea was
scoped (2026-10-06): the recurring pattern is edited on the Settings page; a single date's override
is toggled inline, directly on its day header in the Weekly Planner/Today grid; and marking a day
is **visual-only** — an informational badge, no change to slots or what can be planned.

Confirmed by reading the code: `Settings.tsx` currently holds only client-local, `localStorage`-
backed preferences (theme, grid orientation, category colours) — this is the first Settings section
backed by a real API call, so it needs its own load/save error handling, unlike its siblings.
`PlannerGrid.tsx` renders each day's header in two places (the `day-rows` layout's `<h4>` at
`PlannerGrid.tsx:191-194`, and the `day-columns` layout's `<div>` at `PlannerGrid.tsx:205-208`) —
both need the new toggle, since the orientation is a separate, independently-switchable Settings
preference (`frontend_spec_...`'s `gridOrientation`) and either one can be the active view at any
time.

**New files**:
- `frontend/src/types/workDay.ts` — `WorkDay` (`{ date, dayOfWeek, workDay }`) type, mirroring
  `types/plan.ts`'s existing shape conventions.
- `frontend/src/services/workDayApi.ts` — `getPattern`, `setPattern`, `getWeek`, `setOverride`,
  one call per `planner_spec_021` endpoint, following `planApi.ts`'s existing method-per-endpoint
  style.
- `frontend/src/components/WeeklyPlanner/useWorkDays.ts` — a `usePlanActions`-style hook taking
  `weekStart`, fetching that week's effective work-days, and exposing a `handleToggle(date)`
  action. Shared by `WeeklyPlanner.tsx` and `TodayView.tsx`, exactly as `usePlanActions` already is.
- `frontend/src/components/icons/WorkDayIcon.tsx` (+ `.module.css`) — a small inline SVG badge
  icon, following `RepeatableIcon.tsx`'s existing shape (`role="img"`, `aria-label`, `currentColor`
  stroke).

**Out of scope**: no change to slot counts, planning validation, or the weekend bucket list — the
badge is purely informational, per the user's explicit "visual-only" decision. No drag/drop
interaction with the toggle itself.

## Requirement 1 — Settings: recurring work-day pattern editor

**User story**: As a user, I want to set which days of the week are normally work days once, in
Settings, so every week reflects that pattern without re-marking it.

### FRONTEND-042-AC-01 [AUTO]: A "Work days" fieldset lists all 7 days, checked per the saved pattern
**Statement**: The Settings page shall render a new `<fieldset><legend>Work days</legend>` with one
checkbox per day Monday–Sunday, checked if and only if that day is present in the pattern returned
by `workDayApi.getPattern()` on mount.

**Rationale**: Direct UI for `planner_spec_021`'s `GET /api/v1/work-days/pattern`.

**References**: Component: `frontend/src/components/Settings/Settings.tsx`; Service:
`services/workDayApi.ts#getPattern`

### FRONTEND-042-AC-02 [AUTO]: Toggling a checkbox saves the full updated set immediately
**Statement**: Checking or unchecking a day's checkbox shall immediately call
`workDayApi.setPattern(...)` with the full new set of checked days (no separate "Save" button,
matching every other Settings fieldset's immediate-apply behaviour) and update the checkboxes from
the response.

**Rationale**: Consistency with the rest of the Settings page's existing apply-on-change UX
(`handleThemeChange`/`handleGridOrientationChange`/`handleColorChange` all apply immediately).

**References**: `Settings.tsx`; `services/workDayApi.ts#setPattern`

### FRONTEND-042-AC-03 [AUTO]: A failure loading the pattern shows an inline error with retry
**Statement**: If `workDayApi.getPattern()` rejects on mount, the "Work days" fieldset shall render
a `role="alert"` message (via the component's own `getErrorMessage` copy, matching every other
component's per-component-duplicated error formatting) with a "Retry" button that re-fetches.

**Rationale**: This is the first Settings section with a real network dependency — unlike its
`localStorage`-only siblings, it needs the load-error-plus-retry pattern already established
elsewhere (`WeeklyPlanner.tsx`'s `plan.loadError`).

**References**: `Settings.tsx`

### FRONTEND-042-AC-04 [AUTO]: A failure saving a change shows an error and reverts the checkbox
**Statement**: If `workDayApi.setPattern(...)` rejects, the fieldset shall show an inline
`role="alert"` error message and the toggled checkbox shall revert to its last-successfully-saved
state (not remain showing the failed, unsaved change).

**Rationale**: Prevents the UI from silently claiming a save succeeded when it didn't.

**References**: `Settings.tsx`

## Requirement 2 — Visual badge + inline per-date toggle on the grid

**User story**: As a user looking at my Weekly Planner or Today grid, I want to see which specific
days are marked as work days, and flip an individual day's status directly from the grid, without
visiting Settings.

### FRONTEND-042-AC-05 [AUTO]: Each day header shows a work-day toggle reflecting that date's status
**Statement**: In both of `PlannerGrid`'s layouts (`day-rows` and `day-columns`), each rendered
day's header shall include a toggle control (the new `WorkDayIcon`) whose visually-active state
reflects whether that exact calendar date's effective `workDay` flag (from
`workDayApi.getWeek(weekStart)`) is `true`.

**Rationale**: Core visibility requirement — the whole point of the feature is seeing, at a glance,
which days this week are work days.

**References**: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` (both header render sites);
new prop `workDays: ReadonlyMap<string, boolean>` (optional, default empty, matching
`dimmedOccurrenceIds`'s existing optional-with-default-value pattern so callers that don't pass it
— existing `PlannerGrid.test.tsx` cases — are unaffected)

### FRONTEND-042-AC-06 [AUTO]: Clicking the toggle flips that date's override via the API
**Statement**: Clicking a day's toggle shall call `workDayApi.setOverride(date, !currentEffective
Value)` for that exact date, and update the badge to the server-returned value once the call
resolves (not optimistically before the response, matching `usePlanActions`'s existing
await-then-update pattern for `handleMove`/`handleComplete`).

**Rationale**: Core write path, behind `planner_spec_021`'s `PUT /api/v1/work-days/{date}`.

**References**: `useWorkDays.ts#handleToggle`; `PlannerGrid.tsx` new prop
`onToggleWorkDay?: (date: string) => void`

### FRONTEND-042-AC-07 [AUTO]: Marking a day never changes its slots or plannability
**Statement**: Toggling a day's work-day status shall not add, remove, hide, or disable any
Morning/Afternoon/Evening slot, nor affect what can be dragged/added/completed on that day.

**Rationale**: Explicit regression guard for the user's own "visual-only" decision — this spec must
never grow into a capacity-limiting feature by accident.

**References**: `PlannerGrid.tsx` (`renderCell` — unchanged by this spec)

### FRONTEND-042-AC-08 [AUTO]: A failure toggling a day shows an inline error, badge unchanged
**Statement**: If `workDayApi.setOverride(...)` rejects, the grid shall show an inline action error
(mirroring `usePlanActions`'s existing `actionError` pattern) and the toggle's badge shall remain in
its pre-click state.

**Rationale**: Consistency with every other grid action's existing failure handling
(`handleMove`/`handleComplete`'s `actionError`).

**References**: `useWorkDays.ts`

## Requirement 3 — Per-week, per-view data wiring

**User story**: As a user, I want the work-day badges shown on the Weekly Planner and on Today to
always reflect the week actually being viewed, including after navigating to a different week.

### FRONTEND-042-AC-09 [AUTO]: `WeeklyPlanner` and `TodayView` each fetch their own week's work-days
**Statement**: `WeeklyPlanner.tsx` and `TodayView.tsx` shall each call `useWorkDays(weekStart)`
independently (mirroring `usePlanActions`'s existing per-view independence, `FRONTEND-016-AC-08`) —
fetching `TodayView`'s single current day's status must not depend on `WeeklyPlanner` being mounted,
and vice versa.

**Rationale**: Matches this codebase's existing precedent of fully independent, separately-mounted
data-fetching between these two views.

**References**: `components/WeeklyPlanner/useWorkDays.ts`; `WeeklyPlanner.tsx`; `TodayView.tsx`

### FRONTEND-042-AC-10 [AUTO]: Changing weeks refetches that week's work-days
**Statement**: Using `WeeklyPlanner`'s Previous/Next week navigation shall trigger a fresh
`workDayApi.getWeek(...)` call for the newly-displayed `weekStart`, replacing the previously-shown
badges.

**Rationale**: Regression guard — without this, badges would silently keep showing the prior week's
values after navigating.

**References**: `useWorkDays.ts` (effect keyed on `weekStart`, mirroring `usePlanActions`'s own
`weekStart`-keyed effect)

## Cross-references

| Reference | What it provides |
|---|---|
| `planner_spec_021_work_day_marking.md` | The four backend endpoints this spec's service layer calls |
| `Settings.tsx` | Existing fieldset/apply-on-change pattern this spec's new "Work days" fieldset matches |
| `usePlanActions.ts` | Per-view-independent fetch, await-then-update action, and per-component `getErrorMessage` precedents this spec's `useWorkDays` hook follows |
| `PlannerGrid.tsx` | The two day-header render sites this spec adds a toggle to |
| `RepeatableIcon.tsx` | Existing small inline-SVG icon component shape, matched by the new `WorkDayIcon` |
| `API.md` | Needs a new "Work Days" section once `planner_spec_021` ships |

## Test case sketches (Vitest + RTL, red before implementation)

```tsx
describe('FRONTEND-042-AC-01/AC-02: Settings work-day pattern', () => {
  it('shows checked days from the fetched pattern, and saves on toggle', async () => {
    vi.mocked(workDayApi.getPattern).mockResolvedValue(['MONDAY', 'TUESDAY'])
    vi.mocked(workDayApi.setPattern).mockResolvedValue(['MONDAY', 'TUESDAY', 'WEDNESDAY'])
    render(<Settings />)

    expect(await screen.findByRole('checkbox', { name: 'Monday' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Wednesday' })).not.toBeChecked()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Wednesday' }))

    expect(workDayApi.setPattern).toHaveBeenCalledWith(['MONDAY', 'TUESDAY', 'WEDNESDAY'])
    expect(await screen.findByRole('checkbox', { name: 'Wednesday' })).toBeChecked()
  })
})

describe('FRONTEND-042-AC-05/AC-06: grid toggle reflects and updates a date\'s status', () => {
  it('shows the active badge for a marked date, and flips it on click', async () => {
    vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday, week of 2026-09-28
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    vi.mocked(workDayApi.getWeek).mockResolvedValue([
      { date: '2026-09-28', dayOfWeek: 'MONDAY', workDay: true },
      { date: '2026-09-30', dayOfWeek: 'WEDNESDAY', workDay: false },
      // ...remaining 5 days
    ])
    vi.mocked(workDayApi.setOverride).mockResolvedValue(
      { date: '2026-09-30', dayOfWeek: 'WEDNESDAY', workDay: true },
    )
    render(<TodayView />)

    const toggle = await screen.findByRole('button', { name: /mark wednesday.*work day/i })
    await userEvent.click(toggle)

    expect(workDayApi.setOverride).toHaveBeenCalledWith('2026-09-30', true)
    expect(await screen.findByRole('button', { name: /unmark wednesday.*work day/i })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: add `types/workDay.ts`, `services/workDayApi.ts`, `useWorkDays.ts`, wire
both into `WeeklyPlanner.tsx`/`TodayView.tsx`, add the "Work days" fieldset to `Settings.tsx`, and
add the toggle (`WorkDayIcon` + button) to both of `PlannerGrid.tsx`'s header render sites, until
all sketches above pass.

## Acceptance Criteria Summary

- [ ] FRONTEND-042-AC-01 — "Work days" fieldset lists all 7 days, checked per the saved pattern
- [ ] FRONTEND-042-AC-02 — toggling a checkbox saves the full updated set immediately
- [ ] FRONTEND-042-AC-03 — a failure loading the pattern shows an inline error with retry
- [ ] FRONTEND-042-AC-04 — a failure saving a change shows an error and reverts the checkbox
- [ ] FRONTEND-042-AC-05 — each day header shows a work-day toggle reflecting that date's status
- [ ] FRONTEND-042-AC-06 — clicking the toggle flips that date's override via the API
- [ ] FRONTEND-042-AC-07 — marking a day never changes its slots or plannability
- [ ] FRONTEND-042-AC-08 — a failure toggling a day shows an inline error, badge unchanged
- [ ] FRONTEND-042-AC-09 — `WeeklyPlanner` and `TodayView` each fetch their own week's work-days
- [ ] FRONTEND-042-AC-10 — changing weeks refetches that week's work-days
