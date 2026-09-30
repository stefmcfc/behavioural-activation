# Today View (Frontend)

**Status**: Not started
**Priority**: P2 — same tier as the sibling Weekly Planner UX specs. Split off `SPEC_CANDIDATES.md`'s
"Weekday/Weekend grid tabs + a 'Today' view" candidate into its own spec, confirmed 2026-09-30, so the
grid-tabs bug fix (`frontend_spec_015_weekday_weekend_grid_tabs.md`) can ship independently first.
**Depends on**: `frontend_spec_015_weekday_weekend_grid_tabs.md` (**must be implemented first** — this
spec's single-day view reuses `PlannerGrid`'s `days` prop, generalized there), `frontend_spec_005_navigation_and_theme.md`
(origin of `TabNav`/`App.tsx`'s route table this spec extends), `frontend_spec_004_week_planning.md`
(origin of `WeeklyPlanner`'s action/state logic this spec reuses), `frontend_spec_009_add_picker_modal.md`
(the `Modal`-wrapped `AssignActivityPicker` this spec reuses unmodified)
**Area**: Frontend-only, no backend pair — reuses `GET /api/v1/plan?weekStart=...` exactly as
`WeeklyPlanner` already does, just always for the real current week.
**Roadmap version**: V1 (extends `product.md`'s V1 planner row / US-003 "View a weekly plan" — a
reduced, single-day lens on the same data, not V2's tracking/reflection scope, and not AI)

## Overview

Adds a **Today** view: a new top-level nav tab (`TabNav`, alongside Activities/Weekly Planner/
Settings) showing only the current calendar day's plan — for the "what do I actually need to do right
now" use case the full weekly grid doesn't serve well, per the original candidate note. Confirmed
2026-09-30 as a genuine top-level route rather than a third tab inside `WeeklyPlanner`: living inside
the planner raises an awkward question the moment a user has navigated to a different week via
Previous/Next ("Today" for a week that isn't the real current week doesn't mean anything coherent),
whereas a separate route sidesteps that entirely — `TodayView` always fetches and shows the real
current week, completely independent of whatever week `WeeklyPlanner` happens to be displaying.

**Reuses `PlannerGrid` and `BucketList` outright, not a new grid implementation.**
`frontend_spec_015_weekday_weekend_grid_tabs.md` generalizes `PlannerGrid` to accept any `days` list
rather than hardcoding Monday–Friday; passing it a single-day array (`[todayDay]`) already produces
exactly a "today" grid (one column, three slot rows) with zero new grid markup. `BucketList` renders
underneath unchanged, matching `frontend_spec_015`'s confirmed decision that the bucket list stays
visible everywhere, not scoped to particular tabs/views.

**Extracts `WeeklyPlanner`'s action/state logic into a shared hook.** `WeeklyPlanner.tsx` today owns
~150 lines of state and handlers (occurrences fetch, assign/move/complete/undo/remove/carry-forward,
detail-open bookkeeping) that `TodayView` needs identically — same `PlannerGrid`/`BucketList`/
`AssignActivityPicker` wiring, just for a single day instead of five/two. Duplicating that logic
across two components would be a real maintenance hazard (the two copies would drift). Instead, this
spec extracts it into `usePlanActions(weekStart)`, a hook both components call — `WeeklyPlanner`
passes its own navigable `weekStart`, `TodayView` always passes the real current week's Monday. This
is a genuine refactor of already-shipped code, done here because it's what makes reuse possible, not
a separate maintenance pass — matching how `frontend_spec_013`'s `CategoryPicker` rewrite was folded
into that feature spec rather than split out.

**Out of scope**: any change to `OccurrenceItem`'s Move day `<select>` (still offers all seven days,
unchanged — moving something off today from within `TodayView` is expected to make it disappear from
that view, exactly as moving an occurrence off the active tab already behaves in
`frontend_spec_015`). Any backend change (none needed — same `GET /api/v1/plan` endpoint, same
request shape, just always called with the current week's Monday). A dedicated "today" API endpoint
(unnecessary — the existing per-week endpoint already returns everything needed; filtering to today's
day happens client-side, exactly as `PlannerGrid`/`BucketList` already filter the same fetched list
by day/slot today).

## Requirements

### Requirement 1 — Today is a new top-level nav tab

As a user, I want a fast, dedicated way to see just today's plan without navigating through the full
weekly grid.

- **FRONTEND-016-AC-01** [AUTO]: `TabNav` shall render a new "Today" entry between "Weekly Planner"
  and "Settings", routed to `/today`.
- **FRONTEND-016-AC-02** [AUTO]: `App.tsx` shall route `/today` to a new `TodayView` component,
  rendered only while authenticated (matching every other protected route).

### Requirement 2 — Today shows only the current day's plan, for the real current week

As a user, I want "Today" to always mean today — regardless of what week I've navigated to inside
the Weekly Planner — and I want my weekend bucket list visible from here too.

- **FRONTEND-016-AC-03** [AUTO]: `TodayView` shall fetch occurrences for the real current week's
  Monday, independent of any `weekStart` a separately-mounted `WeeklyPlanner` instance may hold.
- **FRONTEND-016-AC-04** [AUTO]: `TodayView` shall render a single-day `PlannerGrid` scoped to
  today's real calendar day, with a heading naming that day (e.g. "Wednesday").
- **FRONTEND-016-AC-05** [AUTO]: `TodayView` shall render `BucketList` beneath the grid, unchanged,
  matching `frontend_spec_015`'s decision that the bucket list is always visible.
- **FRONTEND-016-AC-06** [AUTO]: While no occurrences are scheduled for today, `TodayView`'s grid
  shall display an empty-state message specific to today (not the Weekday/Weekend grid's generic
  wording).

### Requirement 3 — Today supports the same interactions as the Weekly Planner

As a user, I want to Add, Complete/Undo, and open the full detail card (Rearrange/Remove/Carry
forward) from Today exactly as I already can from the Weekly Planner — not a read-only summary.

- **FRONTEND-016-AC-07** [AUTO]: `TodayView` shall support Add (via the same `Modal`-wrapped
  `AssignActivityPicker`), Complete/Undo, and the full occurrence detail card exactly as
  `WeeklyPlanner` does today, by calling the same shared `usePlanActions` hook — not a
  re-implementation of that logic.
- **FRONTEND-016-AC-08** [AUTO]: Actions taken in `TodayView` shall not affect, and shall not be
  affected by, any state in a separately-mounted `WeeklyPlanner` instance — confirming the two
  routes' `usePlanActions` calls are fully independent (React Router's `/today` and `/planner`
  routes are mutually exclusive, per `App.tsx`).

### Requirement 4 — Real-browser visual verification

As a user, I want the Today tab and its single-day grid to actually look right in both themes.

- **FRONTEND-016-AC-09** [MANUAL]: The Today nav tab, its single-day grid, and the bucket list
  render correctly in both Light and Dark themes. Verified by a real-browser check, since jsdom does
  not render CSS (`frontend_conventions.md`'s Testing Strategy note).

## Component/type changes

`usePlanActions.ts` (new, `frontend/src/components/WeeklyPlanner/`) — extracted from
`WeeklyPlanner.tsx`'s existing body, same logic, parameterized by `weekStart`:

```typescript
export function usePlanActions(weekStart: string) {
  const [occurrences, setOccurrences] = useState<PlannedOccurrence[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [detailOpenId, setDetailOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { /* fetch planApi.getWeek(weekStart), unchanged from today's WeeklyPlanner */ }, [weekStart, retryCount])

  // handleRetry, handleAssignSuccess, handleCloseAssign, handleMove, handleConfirmRemove,
  // handleComplete, handleUndo, handleOpenDetail, handleCloseDetail, handleCarryForward:
  // all moved verbatim from WeeklyPlanner.tsx, unchanged bodies

  return {
    occurrences, loadError, actionError, assignTarget, confirmingRemoveId, movingId,
    detailOpenId, busyId,
    handleRetry, handleAssignSuccess, handleCloseAssign, handleMove, handleConfirmRemove,
    handleComplete, handleUndo, handleOpenDetail, handleCloseDetail, handleCarryForward,
    setAssignTarget, setConfirmingRemoveId, setMovingId,
  }
}
```

`WeeklyPlanner.tsx` (refactored — now just week-navigation UI, the Weekdays/Weekend tab from
`frontend_spec_015`, and a call to the shared hook):

```tsx
export function WeeklyPlanner() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfCurrentWeek())
  const [gridTab, setGridTab] = useState<GridTab>(() => getDefaultGridTab()) // frontend_spec_015
  const plan = usePlanActions(weekStart)
  const todayColumn = weekStart === getMondayOfCurrentWeek() ? getTodayPlanDayOfWeek() : null

  // ...Previous/Next week handlers (unchanged), tab control (frontend_spec_015), then renders
  // PlannerGrid/BucketList/Modal using `plan.*` instead of its own local state/handlers
}
```

`TodayView.tsx` (new, `frontend/src/components/WeeklyPlanner/`):

```tsx
export function TodayView() {
  const weekStart = getMondayOfCurrentWeek()
  const plan = usePlanActions(weekStart)
  const today = getTodayPlanDayOfWeek()

  return (
    <section>
      <h2>Today</h2>
      {/* loadError/actionError/loading states, same pattern as WeeklyPlanner */}
      {plan.occurrences !== null && (
        <>
          <PlannerGrid
            days={[today]}
            heading={DAY_LABELS[today]}
            emptyMessage="No activities planned for today."
            occurrences={plan.occurrences}
            todayColumn={today}
            /* ...remaining props from plan.*, identical wiring to WeeklyPlanner */
          />
          <BucketList occurrences={plan.occurrences} /* ...plan.* wiring */ />
        </>
      )}
      <Modal isOpen={plan.assignTarget !== null} titleId="assign-picker-title" onClose={plan.handleCloseAssign}>
        {plan.assignTarget && (
          <AssignActivityPicker weekStart={weekStart} target={plan.assignTarget} onSuccess={plan.handleAssignSuccess} onCancel={plan.handleCloseAssign} />
        )}
      </Modal>
    </section>
  )
}
```

`TabNav.tsx` (extended):

```tsx
const TABS = [
  { to: '/activities', label: 'Activities' },
  { to: '/planner', label: 'Weekly Planner' },
  { to: '/today', label: 'Today' },
  { to: '/settings', label: 'Settings' },
] as const
```

`App.tsx` (extended — new protected route alongside the existing three):

```tsx
<Route path="/today" element={<TodayView />} />
```

## Cross-references

| This spec | Contracts against |
|---|---|
| `PlannerGrid.tsx` (`frontend_spec_015_weekday_weekend_grid_tabs.md`) | Reused unmodified via its generalized `days` prop — must be implemented first |
| `BucketList.tsx` | Reused unmodified |
| `AssignActivityPicker.tsx`/`Modal.tsx` (`frontend_spec_009_add_picker_modal.md`) | Reused unmodified |
| `WeeklyPlanner.tsx` | Refactored — action/state logic extracted into `usePlanActions.ts`, reused by both components |
| `usePlanActions.ts` (new) | No prior art — new file this spec introduces |
| `TodayView.tsx` (new) | No prior art — new file this spec introduces |
| `TabNav.tsx`/`App.tsx` (`frontend_spec_005_navigation_and_theme.md`) | Extended — new "Today" tab + `/today` route |
| `GET /api/v1/plan` (`planner_spec_004_week_planning.md`) | Unchanged — same endpoint, called with the real current week's Monday |

`WeeklyPlanner.test.tsx`'s existing tests exercise state/handlers that move into `usePlanActions` —
they'll continue passing unchanged against `WeeklyPlanner`'s public behaviour (same rendered output,
same user-facing flows), but some may need updating to account for the refactor if they reach into
internals rather than just querying rendered output. Not a new AC — an implementation-time
consequence, noted here per this project's usual practice.

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
describe('FRONTEND-016-AC-01/AC-02: Today is a routed top-level tab', () => {
  it('navigates to /today and renders TodayView when the Today tab is clicked', async () => {
    vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    renderApp() // existing App-level test harness, per TabNav.test.tsx's own convention

    await userEvent.click(screen.getByRole('link', { name: /today/i }))

    expect(await screen.findByRole('heading', { name: /today/i })).toBeInTheDocument()
    expect(screen.getByText('Wednesday')).toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-03/AC-04: shows only today, for the real current week', () => {
  it('fetches the real current week Monday regardless of any other navigated state', async () => {
    vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday, week of 2026-09-28
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<TodayView />)

    await screen.findByText(/no activities planned for today/i)
    expect(planApi.getWeek).toHaveBeenCalledWith('2026-09-28')
  })

  it('shows only occurrences scheduled for today, not other days in the same week', async () => {
    vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
    vi.mocked(planApi.getWeek).mockResolvedValue([wednesdayOccurrence, mondayOccurrence])
    render(<TodayView />)

    expect(await screen.findByText('Wednesday task')).toBeInTheDocument()
    expect(screen.queryByText('Monday task')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-05: the bucket list is always visible from Today', () => {
  it('renders the bucket list panel', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<TodayView />)

    expect(await screen.findByRole('region', { name: /weekend bucket list/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-016-AC-07: supports the same actions as the Weekly Planner', () => {
  it('completes a today occurrence from the tile', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([todayOccurrence])
    vi.mocked(planApi.complete).mockResolvedValue({ ...todayOccurrence, completed: true, completedAt: '2026-09-30T12:00:00Z' })
    render(<TodayView />)

    await userEvent.click(await screen.findByRole('button', { name: /complete/i }))

    expect(planApi.complete).toHaveBeenCalledWith(todayOccurrence.id)
  })

  it('opens the detail card and rearranges an occurrence from Today', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([todayOccurrence])
    render(<TodayView />)

    await userEvent.click(await screen.findByRole('button', { name: todayOccurrence.name }))
    expect(await screen.findByRole('dialog', { name: new RegExp(`${todayOccurrence.name} actions`, 'i') })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement `usePlanActions.ts`, refactor `WeeklyPlanner.tsx` to use it, add
`TodayView.tsx`, and extend `TabNav.tsx`/`App.tsx` as specified above until every sketch above (and
the remaining ACs not sketched: AC-06, AC-08, AC-09) passes. AC-09 is verified by a real-browser pass
in both Light and Dark, per `frontend_conventions.md`'s Testing Strategy note.

## Acceptance Criteria Summary

- [ ] FRONTEND-016-AC-01 — `TabNav` gains a "Today" entry, routed to `/today`
- [ ] FRONTEND-016-AC-02 — `App.tsx` routes `/today` to `TodayView`, protected like other routes
- [ ] FRONTEND-016-AC-03 — `TodayView` always fetches the real current week, independent of `WeeklyPlanner`
- [ ] FRONTEND-016-AC-04 — single-day `PlannerGrid` scoped to today, headed with today's day name
- [ ] FRONTEND-016-AC-05 — `BucketList` renders beneath the grid, unchanged
- [ ] FRONTEND-016-AC-06 — an empty-state message specific to today when nothing is scheduled
- [ ] FRONTEND-016-AC-07 — full Add/Complete/Undo/detail-card parity via the shared `usePlanActions` hook
- [ ] FRONTEND-016-AC-08 — `TodayView` and `WeeklyPlanner` state are fully independent across routes
- [ ] FRONTEND-016-AC-09 — Today tab + grid + bucket list render correctly in Light and Dark (real-browser check)
