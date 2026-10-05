# Today View: Stop Showing Today's Day Name Twice (Frontend)

**Status**: Implemented (2026-10-06)

## Summary

Both ACs implemented exactly as sketched: `TodayView.tsx`'s `heading` prop changed from
`DAY_LABELS[today]` to the literal `"Today's plan"` (and the now-unused `DAY_LABELS` import
removed). The existing `FRONTEND-016-AC-04` test was updated in place rather than left to bit-rot
against a comment describing the old (buggy) duplicate-rendering behavior as expected. 584/584
frontend tests pass, 0 regressions; `npm run lint`/`npx tsc -b --noEmit` both clean. Verified live:
logged in as the seeded user, confirmed "Today's plan" renders once and "5 Monday" (the real day/
date) renders once, no duplication.
**Priority**: P3 — cosmetic duplication, no functional impact
**Depends on**: `frontend_spec_016_today_view.md` (origin of `TodayView.tsx` and its
`FRONTEND-016-AC-04` requirement, amended by this spec — see Overview)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish

## Overview

Raised by the user 2026-10-06. On the "Today" tab, the current day's name (e.g. "Wednesday")
renders twice: once as `PlannerGrid`'s own `<h3>{heading}</h3>` (since `TodayView.tsx` passes
`heading={DAY_LABELS[today]}`), and again as that same single day's own column/section label,
which `PlannerGrid` always renders per day regardless of how many days are in its `days` prop.

Confirmed by reading the code and the existing test: `WeeklyPlanner.tsx` passes a *generic* title
to `heading` ("Week grid"/"Weekend grid") — `PlannerGrid`'s own per-day labels are what actually
name each day there, so no duplication occurs in that multi-day context. `TodayView.tsx` is the
only caller that passes an actual day name as `heading`, which — combined with its single-day
`days={[today]}` — produces the duplicate. `frontend_spec_016_today_view.md`'s
`FRONTEND-016-AC-04` ("renders a single-day grid headed with today's day name") was satisfied by
this exact duplication, confirmed by that spec's own test, which explicitly comments that the day
name "renders twice" and asserts both. That AC's text is left unchanged (immutable per
`ears_format.md`) — this spec amends its *effect*, not its wording: today's day name must still be
visibly shown, just once, not twice.

**Fix**: `TodayView.tsx` passes a generic `heading="Today's plan"` instead of the day name — distinct
from the page's own `<h2>Today</h2>` title just above it, matching `WeeklyPlanner.tsx`'s existing
convention of a grid-section heading that's related to but not identical to its page title (e.g.
"Week grid" under "Weekly Planner"). `PlannerGrid`'s own per-day label (already showing the date
and day name, e.g. "5 Wednesday") remains the single place the actual day name appears — unchanged,
no `PlannerGrid` code touched.

## Requirement 1 — Today's day name appears exactly once

**User story**: As a user on the Today tab, I want to see which day it is without the same day
name appearing twice in a row, so the page doesn't read as visually redundant.

### FRONTEND-041-AC-01 [AUTO]: The grid heading reads "Today's plan", not the day name
**Statement**: `TodayView` shall pass `heading="Today's plan"` to `PlannerGrid`, rendering
`<h3>Today's plan</h3>` (and the enclosing `<section aria-label="Today's plan">`) instead of the
actual day name.

**Rationale**: Direct fix — removes the duplicated source, replacing it with a generic, still
-accurate label distinct from both the specific day name shown below it and the page's own
`<h2>Today</h2>` title (avoiding a second, different kind of duplication: "Today" as both the
page title and the grid heading).

**References**: Component: `frontend/src/components/WeeklyPlanner/TodayView.tsx` (`heading` prop
passed to `PlannerGrid`)

### FRONTEND-041-AC-02 [AUTO]: The actual day name/date still appears exactly once
**Statement**: The real current day's name (e.g. "Wednesday") shall still appear on the page —
via `PlannerGrid`'s existing per-day column/section label, unchanged — but exactly once, not twice.

**Rationale**: Regression guard against over-correcting — the fix must not remove the day name
entirely (still useful information), only the duplication. Supersedes
`frontend_spec_016_today_view.md`'s `FRONTEND-016-AC-04` test assertion that the day name
"renders twice" — that was always an artifact of the heading-prop duplication, not a deliberate
design goal in its own right.

**References**: Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` (unchanged —
its own day-label rendering, around the existing `DAY_LABELS[day]` usage)

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/components/WeeklyPlanner/TodayView.tsx` | The one-line fix — `heading` prop value |
| `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` | Unchanged; its own per-day label is the sole remaining source of the day name |
| `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` | Unaffected precedent — already passes a generic `heading` ("Week grid"/"Weekend grid"), never hit this duplication |
| `frontend_spec_016_today_view.md` | Origin spec; its `FRONTEND-016-AC-04` test is updated here, not re-litigated |

## Test case sketches (Vitest + RTL, red before implementation)

```tsx
describe('FRONTEND-041-AC-01/AC-02: today\'s day name appears exactly once', () => {
  it('headings the grid "Today\'s plan", and shows the real day name exactly once', async () => {
    vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<TodayView />)

    expect(await screen.findByRole('heading', { name: "Today's plan", level: 3 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Wednesday', level: 3 })).not.toBeInTheDocument()
    expect(screen.getAllByText('Wednesday')).toHaveLength(1)
  })
})
```

**Test Case (Green)**: change `TodayView.tsx`'s `heading={DAY_LABELS[today]}` to
`heading="Today's plan"`; update `TodayView.test.tsx`'s existing `FRONTEND-016-AC-04` test (which
currently asserts the day name renders twice) to match the sketch above.

## Acceptance Criteria Summary

- [x] FRONTEND-041-AC-01 — the grid heading reads "Today's plan", not the day name
- [x] FRONTEND-041-AC-02 — the real day name still appears exactly once (not twice, not zero)
