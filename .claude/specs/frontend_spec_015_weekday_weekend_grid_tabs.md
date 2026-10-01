# Weekday/Weekend Grid Tabs (Frontend)

**Status**: Implemented (2026-10-01)
**Priority**: P2 — same tier as the sibling Weekly Planner UX specs (`frontend_spec_008`–`012`).
Fixes a real, confirmed bug: `frontend_spec_008_occurrence_detail_card.md`'s Move sub-state offers
all seven days (`ALL_DAYS` in `planLabels.ts`) as a move target, but `PlannerGrid` only ever renders
Monday–Friday columns and `BucketList` only shows occurrences with a `null` day/slot — so moving an
occurrence to Saturday or Sunday saves successfully on the backend (no validation rejects it) but
then has no view that displays it; it's simply invisible in the UI. Logged in
`.claude/SPEC_CANDIDATES.md` while refining that spec's detail card, confirmed 2026-09-30 as worth a
real fix (not the quick patch of just removing Saturday/Sunday from the day `<select>` — the user
wants Saturday/Sunday to have a real, visible place in the grid, not to be funnelled away).
**Depends on**: `frontend_spec_004_week_planning.md` (origin of `PlannerGrid`/`WeeklyPlanner`/
`BucketList`), `frontend_spec_008_occurrence_detail_card.md` (origin of the Move day `<select>` that
surfaced this bug, and of `todayColumn` highlighting — extended here to cover Saturday/Sunday)
**Area**: Frontend-only, no backend pair. The backend already fully accepts any `dayOfWeek` value —
confirmed by reading `PlanService.java`/`planner_spec_004_week_planning.md`'s validation, which only
checks day/slot are both-null-or-both-set (`validateDaySlotPair`), never which specific day. Same
scope-boundary precedent as `frontend_spec_012_grid_orientation_toggle.md`.
**Roadmap version**: V1 (extends the core planner's weekly-grid display from `product.md`'s V1 row /
US-003 "View a weekly plan" — not V2's tracking/reflection scope, and not AI)

## Summary

All 11 ACs implemented and tested (10 new/rewritten Vitest + RTL tests across
`WeeklyPlanner.test.tsx` and `PlannerGrid.test.tsx`; 281 tests pass repo-wide, 0 regressions).
`npm run lint` and `tsc -b --noEmit` (via `npm run build`) are both clean.

**Real findings**:
- None — the spec's proposed code snippets matched the real current shape of `PlannerGrid.tsx`/
  `WeeklyPlanner.tsx` closely enough to implement close to verbatim; no deviation from the plan.

**Amendments**:
- `WeeklyPlanner.test.tsx`'s pre-existing `FRONTEND-008-AC-18/AC-20/AC-21` describe block's first
  test ("computes a null today-column on a weekend, even during the current week") was rewritten,
  not deleted, to assert the new correct behaviour — the Weekend tab's Saturday column *is*
  highlighted during the real current week. A comment in the test file marks the supersession,
  per this project's established practice (`planner_spec_014`'s handling of `planner_spec_003`'s
  contradicted AC-20).

**Real-browser verification** (AC-11): verified against the real dev servers (`:4321`/`:8420`) with
a scripted Chromium pass (Playwright, run ad hoc — not added as a project dependency) covering both
Light and Dark theme, since jsdom can't render CSS:
- The Weekdays/Weekend tab control renders as a segmented pill pair above the grid, with a filled
  accent/selected state and legible contrast in both themes.
- Switching tabs swaps the grid between the Monday–Friday and Saturday/Sunday layouts; the bucket
  list stays visible and unchanged beneath either tab.
- Moving a real occurrence ("Go for a walk") to Saturday via its existing Rearrange control made it
  appear on the Weekend tab's Saturday/Morning cell without auto-switching away from the active
  Weekdays tab, confirming the bug this spec exists to fix is actually resolved end-to-end against
  the real backend, not just in jsdom.
- Today's column (Thursday, the real date at verification time) highlighted correctly on the
  Weekdays tab; the Weekend tab showed no highlight, correctly, since today wasn't a Saturday/Sunday
  at verification time.
- The moved test occurrence was moved back to its original Monday/Morning slot afterward, restoring
  the dev database to how it was found.

## Overview

Splits `WeeklyPlanner`'s single Monday–Friday grid into two tabs — **Weekdays** (Monday–Friday, 5
columns × 3 slots, today's existing layout) and **Weekend** (Saturday/Sunday, 2 columns × 3 slots,
same layout mechanics reused) — so every day of the week has a real, visible home in the grid.
`PlannerGrid` becomes day-list-agnostic (a `days` prop) rather than hardcoding Monday–Friday, so both
tabs render through the exact same component and markup, not a forked implementation.

**Confirmed with the user 2026-09-30** (resolving the open questions `SPEC_CANDIDATES.md` flagged
before writing ACs below):
1. **Split from the "Today" view idea into two separate specs.** This spec is the grid-tabs fix
   only; the "Today" view (a possible new top-level nav tab showing just the current day's plan) is
   `frontend_spec_016_today_view.md`, a separate, later spec — matching this project's established
   pattern of shipping the bug-fix/foundation piece first (e.g. `frontend_spec_009` before
   `013`/`014`). This spec does not depend on `frontend_spec_016`.
2. **The bucket list stays visible under both tabs, unchanged.** Not scoped to the Weekend tab only,
   despite the bucket list being a conceptually weekend-specific mechanism per
   `.claude/HIGH_LEVEL_DESIGN.md` — the user wants to be able to add to it while reviewing either
   view. `BucketList.tsx` needs no changes at all for this spec.
3. **Default tab matches today's actual calendar day**, re-evaluated every time `WeeklyPlanner`
   mounts (Weekend tab if today is Saturday/Sunday, Weekdays otherwise) — not persisted across
   mounts, and not affected by Previous/Next week navigation (switching weeks never changes which
   tab is active; the two are independent state).

**Also confirmed via code reading, not a new product decision**: the Move day `<select>`
(`OccurrenceItem.tsx`'s `ALL_DAYS`) needs **no change**. It already offers all seven days; the bug
was that four of the twelve slot-cells those days could land in (Saturday/Sunday × 3 slots) had no
displaying view. Once the Weekend tab exists, every value the select already offers has somewhere to
land — so this spec's fix is entirely on the display side.

**Out of scope**: the "Today" view (`frontend_spec_016`, separate spec). Restricting or changing the
Move day `<select>` (unneeded, see above). `frontend_spec_012_grid_orientation_toggle.md`'s
day-rows/day-columns toggle — independent, not yet built; this spec is written against the current,
real `PlannerGrid` shape (day-columns only), matching the precedent `frontend_spec_012` itself
already established for the same situation (written against `frontend_spec_008`'s pre-amendment
shape rather than a not-yet-real future state). Whichever of these two specs is implemented second
will need a small follow-up amendment to the other. Any backend change (none needed).

## Requirements

### Requirement 1 — The weekly grid splits into Weekdays/Weekend tabs

As a user, I want Saturday and Sunday to have their own real place in the grid, not just be
selectable as a move target with nowhere to actually show up.

- **FRONTEND-015-AC-01** [AUTO]: `WeeklyPlanner` shall render a two-option tab control (Weekdays /
  Weekend) above the grid.
- **FRONTEND-015-AC-02** [AUTO]: While the Weekdays tab is active, `PlannerGrid` shall render exactly
  the same Monday–Friday, 3-slot layout it renders today.
- **FRONTEND-015-AC-03** [AUTO]: While the Weekend tab is active, `PlannerGrid` shall render
  Saturday/Sunday as its day columns, using the same 3-slot (Morning/Afternoon/Evening) row layout as
  the Weekdays tab.
- **FRONTEND-015-AC-04** [AUTO]: If an occurrence is moved (via `OccurrenceItem`'s existing Move
  controls) to a day not in the currently active tab, then `WeeklyPlanner` shall not automatically
  switch the active tab — the occurrence becomes visible by the user manually switching to the tab
  containing its new day, matching how completing/moving elsewhere in the app never auto-navigates.

### Requirement 2 — The default tab matches today's actual day

As a user, I want the planner to open on whichever tab actually contains today, not always default
to Weekdays even when I open the app on a Saturday.

- **FRONTEND-015-AC-05** [AUTO]: When `WeeklyPlanner` mounts, it shall default the active tab to
  Weekend if today's real calendar date is Saturday or Sunday, else Weekdays.
- **FRONTEND-015-AC-06** [AUTO]: Selecting Previous week or Next week shall not change the active
  tab — tab selection and `weekStart` are independent state.
- **FRONTEND-015-AC-07** [AUTO]: The active tab shall not persist across a remount (e.g. navigating
  away to another route and back) — each mount re-evaluates the default per AC-05. No
  `localStorage`.

### Requirement 3 — Today-highlighting extends to Saturday/Sunday

As a user, I want today's column highlighted on the Weekend tab too when today is a Saturday or
Sunday, matching the existing Monday–Friday behaviour (`frontend_spec_008_occurrence_detail_card.md`).

- **FRONTEND-015-AC-08** [AUTO]: While viewing the real current week, `PlannerGrid` shall highlight
  today's column on whichever tab actually contains it — including Saturday/Sunday on the Weekend
  tab, which today never highlights (this spec extends `getTodayPlanDayOfWeek` to return
  `'SATURDAY'`/`'SUNDAY'` instead of `null`).
- **FRONTEND-015-AC-09** [AUTO]: While viewing a week other than the real current week, no column in
  either tab shall be highlighted as today — unchanged behaviour, now also holding for the Weekend
  tab.

### Requirement 4 — The bucket list is unaffected

As a user, I want to keep adding to and viewing my weekend bucket list regardless of which grid tab
I'm looking at.

- **FRONTEND-015-AC-10** [AUTO]: `BucketList` shall remain visible beneath the grid regardless of
  which tab (Weekdays/Weekend) is active — no behaviour change from today.

### Requirement 5 — Real-browser visual verification

As a user, I want the new tab control and the Weekend grid to actually look right — legible,
consistent with the existing Weekdays grid's styling — in both themes.

- **FRONTEND-015-AC-11** [MANUAL]: The tab control, both grids (Weekdays and Weekend), and the
  extended today-highlight render correctly in both Light and Dark themes. Verified by a real-browser
  check, since jsdom does not render CSS (`frontend_conventions.md`'s Testing Strategy note).

## Component/type changes

`planLabels.ts` (extended — the day lists `PlannerGrid` needs per tab, replacing its own local
`WEEKDAYS` constant):

```typescript
export const WEEKDAY_DAYS: readonly PlanDayOfWeek[] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY',
]
export const WEEKEND_DAYS: readonly PlanDayOfWeek[] = ['SATURDAY', 'SUNDAY']
```

`PlannerGrid.tsx` (extended — day list, heading, and empty-state message become props instead of
hardcoded, so the same component renders either tab):

```tsx
interface PlannerGridProps {
  readonly days: readonly PlanDayOfWeek[]
  readonly heading: string
  readonly emptyMessage: string
  // ...all other existing props (occurrences, busyId, detailOpenId, todayColumn, handlers) unchanged
}

export function PlannerGrid({ days, heading, emptyMessage, /* ...unchanged */ }: PlannerGridProps) {
  // ...
  return (
    <section aria-label={heading}>
      <h3>{heading}</h3>
      {scheduled.length === 0 && <p>{emptyMessage}</p>}
      <div className={styles.scroll}>
        <div className={styles.grid} style={{ '--day-count': days.length } as CSSProperties}>
          {days.map((day) => (/* ...unchanged, day comes from the prop now */))}
          {ALL_SLOTS.map((slot) => days.map((day) => (/* ...unchanged */)))}
        </div>
      </div>
    </section>
  )
}
```

`PlannerGrid.module.css` (`.grid`'s column count becomes dynamic via the CSS custom property set
above, instead of the current hardcoded `repeat(5, ...)` — `.scroll`'s existing `overflow-x: auto`
still handles narrow viewports by scrolling rather than wrapping, for either day count):

```css
.grid {
  display: grid;
  grid-template-columns: repeat(var(--day-count), minmax(8rem, 1fr));
  gap: 0.5rem;
  align-items: start;
}
```

`WeeklyPlanner.tsx` (extended — `gridTab` state, the new tab control, `getTodayPlanDayOfWeek` no
longer returns `null` for weekend days):

```tsx
type GridTab = 'WEEKDAYS' | 'WEEKEND'

function getDefaultGridTab(): GridTab {
  const day = new Date().getDay()
  return day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAYS'
}

function getTodayPlanDayOfWeek(): PlanDayOfWeek {
  const byJsDay: Record<number, PlanDayOfWeek> = {
    0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY',
    4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY',
  }
  return byJsDay[new Date().getDay()]
}

// in the component:
const [gridTab, setGridTab] = useState<GridTab>(() => getDefaultGridTab())

// ...

<fieldset className={styles.tabFieldset}>
  <legend>View</legend>
  <div className={styles.tabGroup}>
    <label className={styles.tabOption}>
      <input type="radio" name="grid-tab" checked={gridTab === 'WEEKDAYS'} onChange={() => setGridTab('WEEKDAYS')} />
      Weekdays
    </label>
    <label className={styles.tabOption}>
      <input type="radio" name="grid-tab" checked={gridTab === 'WEEKEND'} onChange={() => setGridTab('WEEKEND')} />
      Weekend
    </label>
  </div>
</fieldset>

<PlannerGrid
  days={gridTab === 'WEEKDAYS' ? WEEKDAY_DAYS : WEEKEND_DAYS}
  heading={gridTab === 'WEEKDAYS' ? 'Week grid' : 'Weekend grid'}
  emptyMessage={
    gridTab === 'WEEKDAYS' ? 'No activities planned for this week.' : 'No activities planned for the weekend.'
  }
  // ...all other existing props unchanged
/>
```

`WeeklyPlanner.module.css` (new — the tab control follows the same segmented-pill idiom as
`CategoryPicker.module.css`/`Settings.module.css`'s `.themeList`: visually-hidden native
`input[type="radio"]`, `:has(input:checked)` for the filled/accent selected state,
`:focus-within` outline):

```css
.tabFieldset { border: none; padding: 0; margin: 0 0 1rem; }
.tabGroup { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
.tabOption {
  display: inline-flex; align-items: center; padding: 0.35rem 0.85rem;
  border-radius: 999px; border: 1px solid var(--border); background: var(--surface);
  font-size: 0.85rem; font-weight: 600; cursor: pointer;
}
.tabOption:has(input:checked) { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.tabOption:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.tabOption input[type='radio'] { /* visually-hidden, same clip-rect technique as CategoryPicker */ }
```

`BucketList.tsx` — **unmodified**, per the confirmed decision to keep it visible under both tabs.

## Cross-references

| This spec | Contracts against |
|---|---|
| `PlannerGrid.tsx` (`frontend_spec_004_week_planning.md`) | Extended — `days`/`heading`/`emptyMessage` become props instead of hardcoded Monday–Friday |
| `WeeklyPlanner.tsx` | Extended — `gridTab` state, new tab control, `getTodayPlanDayOfWeek` returns a real day for weekends instead of `null` |
| `BucketList.tsx` | Unmodified |
| `planLabels.ts` | Extended — `WEEKDAY_DAYS`/`WEEKEND_DAYS` (replaces `PlannerGrid`'s own local `WEEKDAYS` constant) |
| `OccurrenceItem.tsx`'s Move day `<select>` (`ALL_DAYS`, `frontend_spec_008`) | Unmodified — every day it already offers now has a real display home |
| `PlanService.java`'s `validateDaySlotPair` (`planner_spec_004_week_planning.md`) | Unchanged — already accepts any day, confirmed by reading, not modified here |
| `frontend_spec_008_occurrence_detail_card.md` | Origin of the bug this spec fixes, and of `todayColumn` highlighting (extended here to Saturday/Sunday) |
| `frontend_spec_012_grid_orientation_toggle.md` | Independent, not yet built; written against the current day-columns shape (this spec) — needs a follow-up amendment to whichever lands second |
| `frontend_spec_016_today_view.md` | Sibling spec (not yet written), split from the same original candidate — no dependency either direction |

`WeeklyPlanner.test.tsx`'s existing `FRONTEND-008-AC-18/AC-20/AC-21` describe block asserts a
Saturday computes a **null** today-column "even during the current week" — that assertion describes
exactly the bug this spec fixes, and will need rewriting to assert the Weekend tab's Saturday column
*is* highlighted instead, once `getTodayPlanDayOfWeek` stops returning `null` for weekends. Not a new
AC — an implementation-time consequence, noted here per this project's usual practice
(`frontend_spec_013_add_activity_modal.md`'s Cross-references section made the same kind of
call-out).

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
describe('FRONTEND-015-AC-01/AC-02/AC-03: Weekdays/Weekend tab switches the grid', () => {
  it('shows the Weekdays grid by default and the Weekend grid after switching', async () => {
    vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    await screen.findByRole('radio', { name: /weekdays/i })
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.queryByText('Saturday')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /weekend/i }))

    expect(screen.getByText('Saturday')).toBeInTheDocument()
    expect(screen.getByText('Sunday')).toBeInTheDocument()
    expect(screen.queryByText('Monday')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-015-AC-05: default tab matches today', () => {
  afterEach(() => vi.useRealTimers())

  it('defaults to Weekend when today is a Saturday', async () => {
    vi.setSystemTime(new Date('2026-10-03T09:00:00')) // a Saturday
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    expect(await screen.findByRole('radio', { name: /weekend/i })).toBeChecked()
  })

  it('defaults to Weekdays when today is a weekday', async () => {
    vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    expect(await screen.findByRole('radio', { name: /weekdays/i })).toBeChecked()
  })
})

describe('FRONTEND-015-AC-06: switching weeks does not change the active tab', () => {
  it('keeps the Weekend tab selected after clicking Next week', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    await userEvent.click(await screen.findByRole('radio', { name: /weekend/i }))
    await userEvent.click(screen.getByRole('button', { name: /next week/i }))

    expect(screen.getByRole('radio', { name: /weekend/i })).toBeChecked()
  })
})

describe('FRONTEND-015-AC-08/AC-09: today-highlight extends to Saturday/Sunday', () => {
  afterEach(() => vi.useRealTimers())

  it('highlights Saturday on the Weekend tab during the real current week', async () => {
    vi.setSystemTime(new Date('2026-10-10T09:00:00')) // a Saturday
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    await screen.findByText(/no activities planned for the weekend/i)
    expect(document.querySelector(`.${plannerGridStyles.today}`)).not.toBeNull()
  })

  it('highlights nothing on the Weekend tab for a week that is not the current one', async () => {
    vi.setSystemTime(new Date('2026-10-10T09:00:00')) // a Saturday
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)
    await screen.findByText(/no activities planned for the weekend/i)

    await userEvent.click(screen.getByRole('button', { name: /previous week/i }))

    expect(document.querySelector(`.${plannerGridStyles.today}`)).toBeNull()
  })
})

describe('FRONTEND-015-AC-10: the bucket list is visible on both tabs', () => {
  it('keeps the bucket list panel mounted after switching to Weekdays', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    await userEvent.click(await screen.findByRole('radio', { name: /weekdays/i }))

    expect(screen.getByRole('region', { name: /weekend bucket list/i })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: extend `planLabels.ts`, `PlannerGrid.tsx`/`.module.css`, and
`WeeklyPlanner.tsx`/`.module.css` as specified above until every sketch above (and the remaining ACs
not sketched: AC-04, AC-07, AC-11) passes. AC-11 is verified by a real-browser pass in both Light and
Dark, per `frontend_conventions.md`'s Testing Strategy note.

## Acceptance Criteria Summary

- [x] FRONTEND-015-AC-01 — a Weekdays/Weekend tab control renders above the grid
- [x] FRONTEND-015-AC-02 — Weekdays tab renders the same Monday–Friday layout as today
- [x] FRONTEND-015-AC-03 — Weekend tab renders Saturday/Sunday in the same layout mechanics
- [x] FRONTEND-015-AC-04 — moving an occurrence off-tab never auto-switches the active tab
- [x] FRONTEND-015-AC-05 — default tab matches today's real calendar day on mount
- [x] FRONTEND-015-AC-06 — Previous/Next week never changes the active tab
- [x] FRONTEND-015-AC-07 — active tab does not persist across a remount
- [x] FRONTEND-015-AC-08 — today-highlight applies on the Weekend tab when today is Sat/Sun
- [x] FRONTEND-015-AC-09 — no today-highlight on either tab for a non-current week
- [x] FRONTEND-015-AC-10 — the bucket list stays visible regardless of active tab
- [x] FRONTEND-015-AC-11 — tab control + both grids + today-highlight render correctly in Light and Dark (real-browser check)
