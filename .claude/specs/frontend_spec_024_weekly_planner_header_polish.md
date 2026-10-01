# Weekly Planner Header and Spacing Polish (Frontend)

**Status**: Implemented (2026-10-01) — all 6 ACs green.
**Priority**: P3 — cosmetic polish on an already-shipped screen, nothing else blocked on it
**Depends on**: `frontend_spec_004_week_planning.md` (the week-navigation row and `PlannerGrid` this
spec restyles), `frontend_spec_015_weekday_weekend_grid_tabs.md` (`PlannerGrid`'s current `days`
prop shape, just merged)
**Area**: Frontend
**Roadmap version**: N/A — UX polish, not tied to a V1–V5 theme

## Summary

Implemented directly on `feature/weekday-weekend-grid-tabs` (bundled with `frontend_spec_015`,
since both touch the same Weekly Planner area) rather than a separate branch.

- `WeeklyPlanner.tsx` gained `formatWeekCommencing` (reuses `shiftWeek`'s safe local-date parsing,
  then `Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })`) and
  a local `ChevronIcon` component (`aria-hidden="true"`, deliberately not following
  `CompletionIcon`'s `role="img"`/`aria-label` pattern — see `FRONTEND-024-AC-04`'s rationale).
- CSS gap values chosen: `2rem` margin between the nav row and the grid, `row-gap: 1.5rem` inside
  `PlannerGrid` (column-gap unchanged at `0.5rem`), `2rem` margin between the grid and whatever
  renders next (`BucketList`).
- `FRONTEND-004-AC-16`'s existing test was updated to match the new "Week Commencing" wording — the
  requirement itself is unchanged, not superseded.
- Full suite: 285 Vitest tests, 0 regressions (up from 271); `oxlint`/`tsc -b --noEmit` clean.
- Real-browser verified (Light + Dark) at `localhost:4321/planner`: "Week Commencing 09/28/2026"
  renders in the browser's own locale format, nav row centered with working chevron buttons (clicking
  Next advanced to "Week Commencing 10/05/2026" correctly), and all three spacing increases
  (nav-to-grid, Morning/Afternoon/Evening row gap, grid-to-bucket-list) are clearly visible in both
  themes with no layout regressions.
- `FRONTEND-024-AC-06` (day-of-month numbers) added after the above landed, same branch. First pass
  used `justify-content: space-between` on `.dayLabel` (number flush left, day name flush right of
  the full column width) — real-browser check showed this reads badly: a narrow column's day name
  sits right against the *next* column's date number, so "MONDAY 29" visually reads as one pair even
  though 29 belongs to Tuesday. Fixed by dropping `justify-content` (default flex-start) so the
  number and day name sit together as a tight, unambiguous pair (`28 MONDAY`, `29 TUESDAY`, ...)
  instead of spanning the column edge-to-edge. Verified correct in both themes, on both the Weekdays
  tab (confirms the Sept→Oct month rollover: Wed 30 → Thu 1) and the Weekend tab (Sat 3 / Sun 4).
  Final suite: 286 Vitest tests, 0 regressions.

## Overview

Raised by the user (2026-10-01) immediately after `frontend_spec_015` shipped, as six small cosmetic
requests against the Weekly Planner screen:

1. `"Week of yyyy-mm-dd"` → `"Week Commencing"` + a locale-appropriate date format.
2. The Previous/Next week buttons become icon-only chevrons, each keeping an accessible label.
3. The week-navigation row is horizontally centered.
4. Larger gap between the navigation row and the grid below it.
5. Larger vertical gap between the Morning/Afternoon/Evening rows inside the grid.
6. Larger gap between the grid and the bucket list below it.

**On the locale question the user asked directly**: this codebase has no existing locale-detection
or date-formatting infrastructure (confirmed — no prior use of `Intl.*` or `navigator.language`
anywhere in `frontend/src`). Rather than hardcoding `dd/mm/yyyy` (correct for the UK, wrong for e.g.
US users) or building a new Settings > date format feature, this spec uses the browser-native
`Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })` — passing
`undefined` as the locale makes it resolve to the user's own browser/OS locale automatically (the
same mechanism `navigator.language` exposes). A UK browser renders `28/09/2026`; a US browser
renders `09/28/2026` — both locale-correct, with no stored preference and no new feature needed.
This fully addresses the stated concern, so no `future_ideas.md` entry is needed for a settings-based
alternative.

All six items are presentation-only — no new data, no new endpoint, no change to `WeeklyPlanner`'s
state or props beyond the display string. `PlannerGrid`'s existing `days`/`heading`/`emptyMessage`
prop contract (`frontend_spec_015`) is unchanged.

## Requirement 1: Locale-aware "Week Commencing" date

As a user in any country, I want the displayed week date formatted the way dates are normally
written where I am, so I don't have to mentally reparse an ambiguous `yyyy-mm-dd` string.

### FRONTEND-024-AC-01 [AUTO]: Displays "Week Commencing" with a formatted date
**Statement**: `WeeklyPlanner` shall display the text "Week Commencing" followed by the Monday of
`weekStart` formatted via `Intl.DateTimeFormat`, replacing the current "Week of yyyy-mm-dd" text.

**Rationale**: Item 1 — the literal wording the user asked for, resolved through a formatter rather
than a hardcoded separator/order.

**References**:
- `WeeklyPlanner.tsx` line 238 (current `<span>Week of {weekStart}</span>`) — replace with a
  `formatWeekCommencing(weekStart)` helper alongside the existing `formatDate`/`shiftWeek` helpers.
- Reuses the existing safe parse-then-construct pattern from `shiftWeek` (`weekStart.split('-')` →
  `new Date(year, month - 1, day)`) rather than `new Date(weekStart)`, which parses as UTC midnight
  and can render the wrong local day.

**Test Case (Red)**:
```tsx
it('FRONTEND-024-AC-01: shows "Week Commencing" followed by a formatted date', async () => {
  vi.mocked(planApi.getWeek).mockResolvedValue([])
  render(<WeeklyPlanner />)

  expect(await screen.findByText(/week commencing/i)).toBeInTheDocument()
  expect(screen.queryByText(/week of \d{4}-\d{2}-\d{2}/i)).not.toBeInTheDocument()
})
```

**Test Case (Green)**: add `formatWeekCommencing`, render it in place of the old span text.

### FRONTEND-024-AC-02 [AUTO]: The formatted date matches the actual Monday, with no timezone drift
**Statement**: The date rendered next to "Week Commencing" shall equal
`Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)`
for the same calendar date `weekStart` represents, parsed via local-time construction (not
UTC-parsed).

**Rationale**: Regression guard against the classic `new Date("yyyy-mm-dd")` UTC-midnight parsing
bug, which can render the day before the real Monday depending on the viewer's timezone offset —
exactly the class of bug `shiftWeek` already avoids by splitting the string manually.

**References**: `WeeklyPlanner.tsx`'s `formatWeekCommencing`, reusing `shiftWeek`'s parse approach.

**Test Case (Red)**:
```tsx
it('FRONTEND-024-AC-02: formats the exact calendar date with no timezone off-by-one', async () => {
  vi.mocked(planApi.getWeek).mockResolvedValue([])
  render(<WeeklyPlanner />)

  const expected = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(2026, 9, 5)) // the seeded default Monday — confirm against getMondayOfCurrentWeek()

  expect(await screen.findByText(new RegExp(expected.replace(/\//g, '\\/')))).toBeInTheDocument()
})
```

**Test Case (Green)**: `formatWeekCommencing` parses `weekStart` the same way `shiftWeek` does, then
calls the same `Intl.DateTimeFormat`.
*(Implementer note: confirm the actual default `weekStart` the test harness renders with — read
`getMondayOfCurrentWeek()`'s mocked `Date` setup at the top of `WeeklyPlanner.test.tsx` — rather than
assuming the date above, per this project's established practice of checking sketches against real
behavior before trusting them verbatim.)*

## Requirement 2: Icon-only week navigation with accessible labels

As a keyboard or screen-reader user, I want the Previous/Next week controls to stay fully
operable and clearly labelled even once they become icon-only, so the visual simplification doesn't
cost me usability.

### FRONTEND-024-AC-03 [AUTO]: Previous/Next controls become icon-only, with an accessible name
**Statement**: `WeeklyPlanner` shall render the Previous/Next week controls as icon-only buttons
(no visible "Previous week"/"Next week" text content) that each expose an accessible name via
`aria-label="Previous week"` / `aria-label="Next week"`.

**Rationale**: Item 2 — the visual change (chevrons, not text), with the explicit a11y-label
requirement the user called out. Keeping the accessible name text identical to today's visible text
also means the existing `FRONTEND-004-AC-14`/`AC-15` navigation tests
(`getByRole('button', { name: /previous week/i })` / `/next week/i`) keep passing unchanged — no
test update needed for those two.

**References**: `WeeklyPlanner.tsx` lines 235-241 (current text buttons) — replace button contents
with a small inline `ChevronIcon` component (local to this file, following `OccurrenceItem.tsx`'s
`CompletionIcon` precedent for an inline SVG), keep `aria-label` on the `<button>` itself.

**Test Case (Red)**:
```tsx
it('FRONTEND-024-AC-03: Previous/Next week buttons have no visible text but keep their accessible name', async () => {
  vi.mocked(planApi.getWeek).mockResolvedValue([])
  render(<WeeklyPlanner />)

  const previous = await screen.findByRole('button', { name: /previous week/i })
  const next = screen.getByRole('button', { name: /next week/i })
  expect(previous).toHaveAccessibleName('Previous week')
  expect(previous.textContent?.trim()).toBe('')
  expect(next).toHaveAccessibleName('Next week')
  expect(next.textContent?.trim()).toBe('')
})
```

**Test Case (Green)**: swap button text children for `<ChevronIcon direction="left" />` /
`<ChevronIcon direction="right" />`, keep `aria-label` on each `<button>`.

### FRONTEND-024-AC-04 [AUTO]: The chevron icons are decorative, not independently announced
**Statement**: The chevron SVGs shall be marked `aria-hidden="true"` so assistive technology reads
only the button's own `aria-label`, not a second, redundant/conflicting name from the icon itself.

**Rationale**: Unlike `CompletionIcon` (a standalone status indicator with its own
`role="img"`/`aria-label`), these icons are the entire visual content of an already-labelled
`<button>` — giving the icon its own accessible name would double-announce or conflict with the
button's label. This deliberately departs from the `CompletionIcon` pattern for that reason, rather
than copying it uncritically.

**References**: `ChevronIcon` component — `aria-hidden="true"`, no `role`/`aria-label` on the `<svg>`
itself.

**Test Case (Red)**:
```tsx
it('FRONTEND-024-AC-04: chevron icons are hidden from assistive tech', async () => {
  vi.mocked(planApi.getWeek).mockResolvedValue([])
  render(<WeeklyPlanner />)

  const previous = await screen.findByRole('button', { name: /previous week/i })
  const icon = previous.querySelector('svg')
  expect(icon).toHaveAttribute('aria-hidden', 'true')
})
```

**Test Case (Green)**: set `aria-hidden="true"` on `ChevronIcon`'s `<svg>`.

## Requirement 3: Visual layout polish

As a user, I want the week-navigation row and the grid below it to feel visually calmer and less
cramped, so the screen is easier to scan at a glance.

### FRONTEND-024-AC-05 [MANUAL]: Spacing and centering render correctly in both themes
**Statement**: In both Light and Dark themes, the week-navigation row (now containing the chevron
buttons and the "Week Commencing" label) shall be horizontally centered; there shall be a visibly
larger gap between the navigation row and the grid below it than before this change; there shall be
a visibly larger vertical gap between the Morning/Afternoon/Evening rows inside the grid than before
this change; and there shall be a visibly larger gap between the grid and the bucket list below it
than before this change.

**Rationale**: Items 3-6 — pure visual/spacing changes that jsdom cannot verify (it doesn't render
CSS — `frontend_conventions.md`'s Testing Strategy note). Verified by a real-browser check instead,
following the same pattern as `FRONTEND-015-AC-11`.

**References**:
- `WeeklyPlanner.module.css` — new class on the navigation row wrapper: `display: flex; align-items:
  center; justify-content: center;` plus an increased `margin-bottom` before the grid.
- `PlannerGrid.module.css`'s `.grid` — split the single `gap: 0.5rem` shorthand into separate
  `row-gap`/`column-gap` declarations, increasing `row-gap` only (column spacing between day columns
  is unaffected, which is what item 5 asks for specifically).
- `PlannerGrid.module.css` — a new class on `PlannerGrid`'s outer `<section>` adding `margin-bottom`,
  so there's space before whichever sibling renders next (`BucketList`, today; nothing else
  currently does).

**Test Case (Manual)**: Load the Weekly Planner in a real browser in both Light and Dark theme.
Confirm: the nav row is centered; there's a clearly bigger gap above the grid than the old cramped
spacing; the Morning/Afternoon/Evening rows have clearly more breathing room between them than the
day columns do between each other; there's a clearly bigger gap between the grid and the bucket list
below it. No layout regressions (grid still scrolls correctly on narrow viewports, nav row doesn't
wrap awkwardly).

## Requirement 4: Day-of-month number on each grid column header

As a user, I want to see the actual date next to each day name in the grid header, so I don't have
to cross-reference the week-commencing date to know what day-of-month "Wednesday" means.

### FRONTEND-024-AC-06 [AUTO]: Each day column header shows its date number alongside the day name
**Statement**: `PlannerGrid` shall render, for each day in its `days` prop, the day-of-month number
(derived from `weekStart` plus that day's offset from Monday) on the left and the day name on the
right of the same column header.

**Rationale**: Small polish item raised alongside this spec's other five — "add date number to the
top columns... Date number LHS, Day RHS." Needs the actual calendar date per column, not just the
day name, so `PlannerGrid` needs a new `weekStart` prop it didn't previously require.

**References**:
- `planLabels.ts` gains a shared `parseWeekStart(weekStart: string): Date` helper (the same safe
  `split('-').map(Number)` → `new Date(year, month - 1, day)` local-time construction already used
  by `WeeklyPlanner.tsx`'s `shiftWeek`/`formatWeekCommencing`) — extracted here so the parsing logic
  isn't triplicated across the two files now that `PlannerGrid` needs it too.
- `PlannerGrid.tsx` gains `getDayDate(weekStart: string, day: PlanDayOfWeek): number`, built on
  `parseWeekStart` plus `ALL_DAYS.indexOf(day)` as the day offset — relies on `Date`'s automatic
  month/year rollover (e.g. offset past the end of September correctly lands in October).
- `PlannerGrid`'s `PlannerGridProps` gains `weekStart: string` (required); `WeeklyPlanner.tsx` passes
  its own `weekStart` state straight through.
- Day-label markup becomes two child elements (date number, day name) instead of one text node, so
  existing tests asserting `styles.dayLabel` directly on the "Monday" text node need to assert it via
  `.closest()` on the container instead (see Test Case below) — the class itself still lands on the
  same outer `<div>`, only the text node it used to sit directly on is now nested one level deeper.

**Test Case (Red)**:
```tsx
it('FRONTEND-024-AC-06: shows the day-of-month number before the day name', () => {
  render(<PlannerGrid {...baseGridProps()} weekStart="2026-09-28" />)

  // 2026-09-28 is a Monday; Friday is 2026-10-02 — exercises month rollover too
  expect(screen.getByText('28').nextSibling).toHaveTextContent('Monday')
  expect(screen.getByText('2').nextSibling).toHaveTextContent('Friday')
})
```

**Test Case (Green)**: implement `parseWeekStart`/`getDayDate` as described in References; render
`<span>{getDayDate(weekStart, day)}</span><span>{DAY_LABELS[day]}</span>` inside the existing
`dayLabelClassName(...)`-classed container.
*(Implementer note: `baseGridProps()` in `PlannerGrid.test.tsx` needs a `weekStart` entry added now
that it's a required prop — pick a fixed test date, e.g. `'2026-09-28'`, for determinism.)*

## Component/type changes

No API contract changes. `WeeklyPlanner.tsx` gains:
- `formatWeekCommencing(weekStart: string): string` (local helper, alongside `formatDate`/`shiftWeek`)
- `ChevronIcon({ direction }: { direction: 'left' | 'right' })` (local component, alongside the
  existing file-local helpers — not promoted to a shared component, since nothing else in the
  codebase currently needs a chevron, matching `OccurrenceItem.tsx`'s `CompletionIcon` precedent
  over `RepeatableIcon`'s shared-component precedent)

`planLabels.ts` gains `parseWeekStart` (see `FRONTEND-024-AC-06`'s References); `WeeklyPlanner.tsx`'s
`shiftWeek`/`formatWeekCommencing` are refactored to use it instead of each re-parsing `weekStart`
independently. `PlannerGrid` gains a new required `weekStart: string` prop and `getDayDate`.

`WeeklyPlanner.test.tsx`'s existing `FRONTEND-004-AC-16` test
(`findByText(/week of \d{4}-\d{2}-\d{2}/i)`) needs updating to match the new "Week Commencing" text —
`FRONTEND-004-AC-16` itself ("`WeeklyPlanner` shall display the Monday date of the currently viewed
week") stays satisfied; only its wording/format changed, not its intent, so it is not superseded.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| Week-navigation row being restyled | `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` (lines 230-242) |
| Existing safe date-parsing pattern reused | `WeeklyPlanner.tsx`'s `shiftWeek` |
| Inline-SVG icon precedent followed (with a deliberate a11y departure, see `FRONTEND-024-AC-04`) | `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx`'s `CompletionIcon` |
| Grid row-gap being restyled | `frontend/src/components/WeeklyPlanner/PlannerGrid.module.css` (`.grid`), `PlannerGrid.tsx` (outer `<section>`) |
| Existing test needing a wording update (not a behavior change) | `WeeklyPlanner.test.tsx`'s `FRONTEND-004-AC-16` test (`frontend_spec_004_week_planning.md`) |
| Real-browser MANUAL-AC precedent followed | `frontend_spec_015_weekday_weekend_grid_tabs.md`'s `FRONTEND-015-AC-11` |

## Acceptance Criteria Summary

- [x] FRONTEND-024-AC-01 [AUTO]: Displays "Week Commencing" with a formatted date
- [x] FRONTEND-024-AC-02 [AUTO]: The formatted date matches the actual Monday, with no timezone drift
- [x] FRONTEND-024-AC-03 [AUTO]: Previous/Next controls become icon-only, with an accessible name
- [x] FRONTEND-024-AC-04 [AUTO]: The chevron icons are decorative, not independently announced
- [x] FRONTEND-024-AC-05 [MANUAL]: Spacing and centering render correctly in both themes
- [x] FRONTEND-024-AC-06 [AUTO]: Each day column header shows its date number alongside the day name
