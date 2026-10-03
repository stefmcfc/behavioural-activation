# Weekly Summary Tab (Frontend)

**Status**: Implemented (2026-10-03). New "Summary" tab/route (`WeeklySummary.tsx`) with its own
independent week navigation, built on a new shared `WeekNav` component (`WeeklyPlanner/WeekNav.tsx`
+ `.module.css`) extracted from `WeeklyPlanner.tsx`'s previously-inline nav markup with no behavior
change (its own 53-test suite passes unmodified). Stats (planned/completed totals + completion
rate, per-category Routine/Necessary/Pleasurable breakdown, scheduled-vs-bucket split) computed
client-side by a new `computeStats` helper (`WeeklySummary/weeklySummaryStats.ts`) from
`planApi.getWeek`'s existing response — no backend change. 526/526 Vitest tests pass (513 baseline
+ 13 new: 2 `WeekNav.test.tsx`, 6 `WeeklySummary.test.tsx`, 3 `TabNav.test.tsx`, 2 `App.test.tsx`),
`npm run lint` (oxlint) clean, `tsc -b --noEmit` clean. `FRONTEND-036-AC-13` verified in a real
browser: a realistic mixed-category/completion week rendered correctly in both Light and Dark;
separately confirmed `WeeklySummary`'s own week navigation is fully independent of `WeeklyPlanner`'s
— stepping Summary forward a week left the Weekly Planner tab showing its own, unrelated week.
**Priority**: P2 — V1 polish, new top-level view
**Depends on**: `frontend_spec_005_navigation_and_theme.md` (`TabNav.tsx`'s `TABS` array,
`App.tsx`'s route table pattern this spec's new tab/route follows), `frontend_spec_004_week_
planning.md`/`planner_spec_004_week_planning.md` (`GET /api/v1/plan`, the `PlannedOccurrence` shape
this spec reads `completed`/`category`/`dayOfWeek`/`slot` from — no new fields, no backend change),
`frontend_spec_016_today_view.md` (precedent for a new top-level tab backed by its own local state,
independent of `WeeklyPlanner`'s), `planLabels.ts` (`getMondayOfCurrentWeek`, `parseWeekStart`,
`formatDate`, already shared across `WeeklyPlanner`/`TodayView`, reused again here)
**Area**: Frontend only — reads the existing `GET /api/v1/plan?weekStart=` response via the
existing `planApi.getWeek`; no new endpoint, no new DTO field, no `API.md` update
**Roadmap version**: V1 polish — **explicitly not V2**. `.claude/steering/product.md`'s V2 row is
"Tracking and reflection — mood/pleasure/achievement ratings, recurring activities, weekly
summary." This spec deliberately takes only the "weekly summary" word from that row while building
none of the rest: no mood/pleasure/achievement ratings, no new `CompletionRecord` schema, no
cross-week trend analysis. See Overview's "Out of scope" for the explicit boundary.

## Overview

The Weekly Planner and Today view show *what's* planned; there is currently no at-a-glance view of
*how a week is going* — how much of what's planned has actually been completed, and whether the
week leans toward one `ActivityCategory` over the others. This was logged as an unconfirmed idea in
`.claude/ideas/future_ideas.md` ("Weekly grid completion/category-balance summary strip," Claude's
own suggestion, never confirmed) and is being built now, reshaped from an inline strip into a full
top-level tab per the user's own framing when confirming this spec.

**A new top-level tab, not a section inside Weekly Planner.** Confirmed with the user: a 4th tab
("Summary") alongside Activities/Weekly Planner/Today, each entry in `TabNav.tsx`'s `TABS` array and
a matching `<Route>` in `App.tsx`, exactly the same mechanical shape `frontend_spec_016_today_
view.md` already established for "Today." Rejected alternative: a section embedded at the bottom of
`WeeklyPlanner.tsx`, which would have been simpler (no new route, reuses whatever week
`WeeklyPlanner` already has selected) but was explicitly not what the user wanted — a dedicated tab
reads as a clearer, more discoverable "check in on your week" destination than scrolling past the
bucket list.

**Independent week navigation, not shared with `WeeklyPlanner`.** `WeeklyPlanner.tsx` and
`WeeklySummary.tsx` (this spec's new component) are two separate route-mounted components — React
Router does not share state between them — so `WeeklySummary` owns its own `weekStart`, defaulting
to the real current week (`getMondayOfCurrentWeek()`) on every mount, independently browsable via
its own prev/next week controls. It does **not** attempt to stay in sync with whatever week
`WeeklyPlanner` was last showing (e.g. via a shared `localStorage` value) — no evidence yet that
cross-tab week-sync is something a user actually wants, and it would add real state-coordination
complexity for a V1-polish spec. Revisit only if this turns out to matter in real use.

**One small shared-component extraction.** `WeeklyPlanner.tsx` currently defines its "Week
Commencing" prev/next navigation (`shiftWeek`, `formatWeekCommencing`, `ChevronIcon`, and the
`.weekNav`/`.navButton`/`.chevronIcon` markup/CSS) entirely inline. Since `WeeklySummary` needs the
identical control, this spec extracts it into a new shared `WeekNav.tsx` component (and matching
`.module.css`) rather than duplicating ~40 lines of date math and SVG markup a second time —
`WeeklyPlanner.tsx` is refactored to use the extracted component too, behavior-preserving (its
existing tests must pass unmodified; see `FRONTEND-036-AC-09`). This is the only change this spec
makes to `WeeklyPlanner.tsx` itself.

**Stats are computed entirely client-side from data already fetched.** `WeeklySummary` calls the
existing `planApi.getWeek(weekStart)` directly (same service function `usePlanActions` already
wraps) rather than reusing `usePlanActions` itself — that hook's complete/undo/move/drag/bucket-
reorder machinery has no purpose in a read-only summary view, and pulling it in would mean carrying
a large unused surface area just to get the fetch. A plain `useEffect` fetch, mirroring `ActivityBank.
tsx`'s own direct-fetch-on-mount pattern, is simpler and sufficient.

**Out of scope** (stated explicitly to pre-empt scope creep into V2): mood/pleasure/achievement
ratings and any UI to capture them; any new `CompletionRecord` field or migration; cross-week trend
analysis ("activities with strongest positive effect," "activities repeatedly postponed," etc. —
`HIGH_LEVEL_DESIGN.md` §3's actual V2 feature list); any new backend endpoint — everything in this
spec reads data `GET /api/v1/plan` already returns, for one week at a time.

## Requirements

### Requirement 1 — A new "Summary" tab and route

As a user, I want a dedicated place to check in on how my week is going, reachable the same way I
reach Activities, Weekly Planner, and Today.

- **FRONTEND-036-AC-01** [AUTO]: `TabNav.tsx`'s `TABS` array shall gain a fourth entry, `{ to:
  '/summary', label: 'Summary' }`, rendered after "Today" in the existing tab order.
- **FRONTEND-036-AC-02** [AUTO]: `App.tsx`'s route table shall gain `<Route path="/summary"
  element={<WeeklySummary />} />`, mounting a new `WeeklySummary` component
  (`frontend/src/components/WeeklySummary/WeeklySummary.tsx`).

### Requirement 2 — Independent week navigation

As a user, I want to browse the Weekly Summary's week independently of whatever week I last had
open in the Weekly Planner, defaulting to the current real week.

- **FRONTEND-036-AC-03** [AUTO]: On mount, `WeeklySummary` shall default `weekStart` to
  `getMondayOfCurrentWeek()`, independent of any other component's state.
- **FRONTEND-036-AC-04** [AUTO]: `WeeklySummary` shall render the shared `WeekNav` component (see
  Requirement 3) and shift `weekStart` by ±7 days when its previous/next controls are activated,
  re-fetching that week's data.

### Requirement 3 — Extract a shared `WeekNav` component

As a developer, I want the "Week Commencing" navigation built once, not duplicated between Weekly
Planner and Weekly Summary.

- **FRONTEND-036-AC-05** [AUTO]: A new `frontend/src/components/WeeklyPlanner/WeekNav.tsx` (plus
  `WeekNav.module.css`) shall encapsulate the previous/next chevron buttons and the "Week Commencing
  <date>" label, accepting `weekStart` and `onPrevious`/`onNext` callbacks as props — extracted from
  `WeeklyPlanner.tsx`'s existing inline `shiftWeek`/`formatWeekCommencing`/`ChevronIcon`
  implementation with no behavior change.
- **FRONTEND-036-AC-06** [AUTO]: `WeeklyPlanner.tsx` shall render the extracted `WeekNav` in place
  of its former inline navigation markup, with its own week-shifting behavior unchanged.
- **FRONTEND-036-AC-07** [AUTO]: `WeeklySummary.tsx` shall render the same `WeekNav` component for
  its own independent `weekStart` state.

### Requirement 4 — Weekly stats, computed client-side

As a user, I want to see how much of what I planned this week actually got done, and how it breaks
down by category, without having to count it myself from the grid.

- **FRONTEND-036-AC-08** [AUTO]: On mount and whenever `weekStart` changes, `WeeklySummary` shall
  fetch that week's occurrences via `planApi.getWeek(weekStart)`.
- **FRONTEND-036-AC-09** [AUTO]: Given a non-empty week, `WeeklySummary` shall display: the total
  planned count and completed count for the week (grid-scheduled and bucket occurrences counted
  together) with a completion rate; a per-`ActivityCategory` breakdown (Routine/Necessary/
  Pleasurable) showing planned and completed counts for each; and a scheduled-vs-bucket count split
  (e.g. "9 scheduled, 3 in the weekend bucket").
- **FRONTEND-036-AC-10** [AUTO]: Given a week with zero occurrences, `WeeklySummary` shall display a
  plain empty-state message instead of a stats table, matching this app's existing neutral-language
  empty-state tone (e.g. `ActivityBank`'s "No activities yet...", `PlannerGrid`'s "No activities
  planned...").
- **FRONTEND-036-AC-11** [AUTO]: While a fetch is in flight, `WeeklySummary` shall display a loading
  indicator (`<output>Loading…</output>`, matching `WeeklyPlanner`/`ActivityBank`'s existing pattern).
- **FRONTEND-036-AC-12** [AUTO]: If the fetch fails, `WeeklySummary` shall display an error message
  with a Retry control that re-attempts the fetch, matching `WeeklyPlanner`/`ActivityBank`'s existing
  `loadError`-plus-Retry-button pattern.

### Requirement 5 — Visual correctness in both themes

As a user, I want the summary to be legible and correctly styled whichever theme I'm using.

- **FRONTEND-036-AC-13** [MANUAL]: `WeeklySummary`'s stats display renders correctly in both Light
  and Dark themes, verified against a real week with a realistic mix of categories and completion
  states (not just an empty or fully-complete week), by a real-browser check — jsdom cannot render
  CSS (`frontend_conventions.md`'s Testing Strategy note).

## Component/type changes

`frontend/src/components/WeeklyPlanner/WeekNav.tsx` (new, extracted from `WeeklyPlanner.tsx`):

```tsx
interface WeekNavProps {
  readonly weekStart: string
  readonly onPrevious: () => void
  readonly onNext: () => void
}

export function WeekNav({ weekStart, onPrevious, onNext }: WeekNavProps) {
  return (
    <div className={styles.weekNav}>
      <button type="button" className={styles.navButton} onClick={onPrevious} aria-label="Previous week">
        <ChevronIcon direction="left" />
      </button>
      <span>Week Commencing {formatWeekCommencing(weekStart)}</span>
      <button type="button" className={styles.navButton} onClick={onNext} aria-label="Next week">
        <ChevronIcon direction="right" />
      </button>
    </div>
  )
}
```

`formatWeekCommencing`/`ChevronIcon` move into this file unchanged; `WeeklyPlanner.tsx` imports
`WeekNav` and its own `shiftWeek` (which stays in `WeeklyPlanner.tsx` — it's a plain date-math
helper both components could technically share too, but only `WeeklyPlanner` currently needs ±7-day
shifting logic separated from the render; `WeeklySummary` can inline the same one-liner or import it
from wherever it ends up — implementer's call during implementation, not worth over-specifying here).

`frontend/src/components/WeeklySummary/WeeklySummary.tsx` (new):

```tsx
import { useEffect, useState } from 'react'
import { planApi } from '../../services/planApi'
import type { PlannedOccurrence } from '../../types/plan'
import type { ActivityCategory } from '../../types/activity'
import { WeekNav } from '../WeeklyPlanner/WeekNav'
import { getMondayOfCurrentWeek, parseWeekStart, formatDate } from '../WeeklyPlanner/planLabels'

interface CategoryStat {
  readonly category: ActivityCategory
  readonly planned: number
  readonly completed: number
}

function computeStats(occurrences: readonly PlannedOccurrence[]) {
  const planned = occurrences.length
  const completed = occurrences.filter((o) => o.completed).length
  const scheduled = occurrences.filter((o) => o.dayOfWeek !== null).length
  const bucket = planned - scheduled
  const categories: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']
  const byCategory: CategoryStat[] = categories.map((category) => {
    const inCategory = occurrences.filter((o) => o.category === category)
    return {
      category,
      planned: inCategory.length,
      completed: inCategory.filter((o) => o.completed).length,
    }
  })
  return { planned, completed, scheduled, bucket, byCategory }
}

export function WeeklySummary() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfCurrentWeek())
  const [occurrences, setOccurrences] = useState<PlannedOccurrence[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchWeek = () => {
    setLoadError(null)
    planApi
      .getWeek(weekStart)
      .then(setOccurrences)
      .catch(() => setLoadError('Could not load this week.'))
  }

  useEffect(fetchWeek, [weekStart])

  const shiftWeek = (days: number) => {
    const date = parseWeekStart(weekStart)
    date.setDate(date.getDate() + days)
    setOccurrences(null)
    setWeekStart(formatDate(date))
  }

  return (
    <section>
      <h2>Weekly summary</h2>
      <WeekNav weekStart={weekStart} onPrevious={() => shiftWeek(-7)} onNext={() => shiftWeek(7)} />

      {loadError && (
        <p role="alert">
          {loadError} <button type="button" onClick={fetchWeek}>Retry</button>
        </p>
      )}
      {occurrences === null && !loadError && <output>Loading…</output>}
      {occurrences !== null && occurrences.length === 0 && (
        <p>No activities planned for this week.</p>
      )}
      {occurrences !== null && occurrences.length > 0 && (
        /* stats table per FRONTEND-036-AC-09, using computeStats(occurrences) */
        <></>
      )}
    </section>
  )
}
```

*(The stats-table JSX itself is left to implementation — the ACs specify exactly what must be shown,
not the precise markup/CSS, matching how most of this project's "display some computed data" specs
leave final layout to the implementer, e.g. `frontend_spec_018_subtask_count_badge.md`.)*

`frontend/src/types/plan.ts` — no changes; `PlannedOccurrence` already carries every field
`computeStats` needs.

## Cross-references

| This spec | Contracts against |
|---|---|
| `TabNav.tsx` | Extended — new "Summary" tab entry |
| `App.tsx` | Extended — new `/summary` route |
| `WeekNav.tsx` (new) | Extracted from `WeeklyPlanner.tsx`; reused by both `WeeklyPlanner` and `WeeklySummary` |
| `WeeklySummary.tsx` (new) | Reads `planApi.getWeek` (`services/planApi.ts`, unchanged) |
| `GET /api/v1/plan?weekStart=` | Unchanged — existing endpoint, existing response shape, no `API.md` update needed |
| `.claude/ideas/future_ideas.md` | "Weekly grid completion/category-balance summary strip" entry, now spec'd here (reshaped from a strip into a full tab) — removed from that file in the same change as this spec's creation |
| `.claude/steering/product.md` | V2 row's "weekly summary" phrase — this spec explicitly takes only that word, not V2's mood/trend scope (see Overview) |

## Test case sketches (Vitest + RTL, red before implementation)

```tsx
// WeekNav.test.tsx (new)

describe('FRONTEND-036-AC-05: WeekNav renders the week label and fires callbacks', () => {
  it('calls onPrevious/onNext when the chevron buttons are clicked', async () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    render(<WeekNav weekStart="2026-09-28" onPrevious={onPrevious} onNext={onNext} />)

    expect(screen.getByText(/week commencing/i)).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Previous week'))
    await userEvent.click(screen.getByLabelText('Next week'))
    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
```

```tsx
// WeeklyPlanner.test.tsx -- FRONTEND-036-AC-06 is a regression guard, not a new test: every
// existing week-navigation test (previous/next week, "Week Commencing" label) must keep passing
// unmodified after WeekNav extraction.
```

```tsx
// WeeklySummary.test.tsx (new)

describe('FRONTEND-036-AC-08/AC-09: fetches the current week and displays stats', () => {
  it('shows planned/completed counts and a category breakdown for a non-empty week', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      makeOccurrence({ category: 'ROUTINE', completed: true }),
      makeOccurrence({ category: 'PLEASURABLE', completed: false, dayOfWeek: null, slot: null }),
    ])
    render(<WeeklySummary />)

    expect(await screen.findByText(/1 of 2/i)).toBeInTheDocument() // completion count, exact copy TBD
    expect(screen.getByText(/routine/i)).toBeInTheDocument()
    expect(screen.getByText(/pleasurable/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-036-AC-10: empty week shows a plain message', () => {
  it('renders an empty-state message instead of a stats table', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklySummary />)
    expect(await screen.findByText(/no activities planned/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-036-AC-03/AC-04: independent week navigation, refetches on change', () => {
  it('refetches when the next-week control is activated, independent of any other component', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklySummary />)
    await screen.findByText(/no activities planned/i)

    await userEvent.click(screen.getByLabelText('Next week'))
    await waitFor(() => expect(planApi.getWeek).toHaveBeenCalledTimes(2))
  })
})

describe('FRONTEND-036-AC-12: Retry re-attempts the fetch on failure', () => {
  it('shows an error with Retry, and refetches when clicked', async () => {
    vi.mocked(planApi.getWeek).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
    render(<WeeklySummary />)
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    await screen.findByText(/no activities planned/i)
  })
})
```

```tsx
// App.test.tsx / TabNav.test.tsx additions

describe('FRONTEND-036-AC-01/AC-02: Summary tab and route', () => {
  it('navigates to /summary and renders WeeklySummary', async () => {
    render(<App />, { route: '/summary' }) // or this project's existing router-test helper
    expect(await screen.findByRole('heading', { name: /weekly summary/i })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement `WeekNav`, refactor `WeeklyPlanner.tsx` to use it, implement
`WeeklySummary.tsx`/`computeStats`, and wire the new tab/route, until every sketch above (and the
existing `WeeklyPlanner.test.tsx` suite, unmodified) passes. `FRONTEND-036-AC-13` is verified
manually, per its own statement, in both Light and Dark.

## Acceptance Criteria Summary

- [x] FRONTEND-036-AC-01 — `TabNav` gains a "Summary" tab after "Today"
- [x] FRONTEND-036-AC-02 — `App.tsx` gains a `/summary` route rendering `WeeklySummary`
- [x] FRONTEND-036-AC-03 — `WeeklySummary` defaults to the real current week on mount, independent of other components
- [x] FRONTEND-036-AC-04 — previous/next controls shift `weekStart` by ±7 days and refetch
- [x] FRONTEND-036-AC-05 — `WeekNav` extracted as a shared component, no behavior change
- [x] FRONTEND-036-AC-06 — `WeeklyPlanner.tsx` uses the extracted `WeekNav`, existing tests stay green unmodified
- [x] FRONTEND-036-AC-07 — `WeeklySummary` renders the same `WeekNav` for its own state
- [x] FRONTEND-036-AC-08 — fetches `planApi.getWeek(weekStart)` on mount and on `weekStart` change
- [x] FRONTEND-036-AC-09 — displays planned/completed totals, completion rate, category breakdown, scheduled-vs-bucket split
- [x] FRONTEND-036-AC-10 — empty week shows a plain neutral-language empty-state message
- [x] FRONTEND-036-AC-11 — loading state shown while a fetch is in flight
- [x] FRONTEND-036-AC-12 — fetch failure shows an error with a working Retry control
- [x] FRONTEND-036-AC-13 — visually correct in Light and Dark (real-browser check)
