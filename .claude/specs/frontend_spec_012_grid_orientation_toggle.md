# Weekly Grid Orientation Toggle (Frontend)

**Status**: Implemented (2026-10-03). `utils/gridOrientation.ts`, the `Settings` fieldset, and
`PlannerGrid`'s day-rows branch are all in place against the real current `PlannerGrid.tsx` (post-
`frontend_spec_015`/`024`/`025`/`026`/`028`/`016`/`008`), not the stale sketch this spec originally
shipped with — see the amended "Component/type changes" section below. All ACs including the manual
`FRONTEND-012-AC-13` are satisfied; `npm test` (495/495), `npm run lint` (oxlint, clean), and
`tsc -b --noEmit` all pass. `AC-13` verified in a real browser (Weekdays and Weekend views, Light
and Dark) — today-highlight (Saturday, the real current date) renders correctly on both the
day-section heading and its slot cells in day-rows, in both themes.
**Priority**: P2 — same tier as the sibling Weekly Planner UX specs (`frontend_spec_008`–`011`),
but raised independently of that "too much noise" batch; doesn't block V2 backend work.
**Depends on**: `frontend_spec_004_week_planning.md` (origin of `PlannerGrid`/`WeeklyPlanner`),
`frontend_spec_005_navigation_and_theme.md` (origin of the `localStorage`-backed preference +
Settings radio-group mechanism this spec directly replicates — `utils/theme.ts`, `Settings`'
Appearance fieldset), `frontend_spec_007_visual_refresh.md` (CSS Modules + theme custom-properties
convention this spec's new day-rows styles follow), `frontend_spec_008_occurrence_detail_card.md`
(its `FRONTEND-008-AC-18`–`AC-20` today-highlight wording is directly amended by this spec — see
Overview; **not yet implemented**, so this spec is otherwise written against the actual current
`main` state of `PlannerGrid.tsx`, not that spec's not-yet-real `todayColumn` shape, matching the
precedent `frontend_spec_009_add_picker_modal.md`/`frontend_spec_010_bucket_reordering.md` already
established for the same situation). **No paired backend spec** — see Overview.
**Area**: Frontend
**Roadmap version**: V1 (extends the core planner's weekly-grid display from `product.md`'s V1 row
/ US-003 "View a weekly plan" — not V2's tracking/reflection scope, and not AI)

## Overview

Lets the user choose between two layouts for the weekly Monday–Friday grid — today's only layout
("day-columns": Monday–Friday as a shared column-header row, Morning/Afternoon/Evening as the
row-major axis) and a new alternative ("day-rows": each day gets its own stacked section, with that
day's Morning/Afternoon/Evening cells shown side by side within it) — via a new Settings toggle.
This ties back to `.claude/HIGH_LEVEL_DESIGN.md`'s US-003 ("View a weekly plan... so that I can plan
activities around my normal routine") — the same user story `frontend_spec_004_week_planning.md`
delivered the first version of; this spec adds a second, equally valid way to view that same data
without changing what's shown or how planning/completion works.

**Frontend-only, no backend pair.** This is a pure client-side preference — `localStorage`-backed,
read and applied entirely within `PlannerGrid`'s own render, with no new endpoint, no `dto/` shape,
and nothing added to the `User` entity — the exact same scope boundary
`frontend_spec_005_navigation_and_theme.md` already established for the theme and category-colour
preferences it introduced, for the same reason (`product.md`'s multi-user non-goals: no
cross-device preference sync ahead of a concrete second-device need). Confirmed by reading that
spec and `HIGH_LEVEL_DESIGN_FEEDBACK.md` before writing this one — nothing here touches Postgres,
Spring Security, or any `service`/`controller`/`repository` layer, so there is no reason to deviate
from the established pattern.

**One real simplification versus the theme mechanism it replicates**: `theme.ts`'s
`applyStoredTheme()` exists specifically to apply the stored preference *before first paint*
(called synchronously at the top of `main.tsx`), because an unstyled flash of the wrong theme is a
real, visible defect. Grid orientation has no equivalent concern — it only affects `PlannerGrid`'s
own render output the moment `WeeklyPlanner`/`PlannerGrid` mounts, not anything paint-order-sensitive
at the document level (confirmed by reading `main.tsx`: `applyStoredTheme()` is the only such call
there today). So the new `utils/gridOrientation.ts` deliberately does **not** get a
`main.tsx`-level "apply before first paint" counterpart — `PlannerGrid` just reads the preference via
`useState(() => getGridOrientation())` at render time, simpler than `theme.ts`'s shape (Requirement
6).

**Live update, no reload, no cross-component subscription needed**: `frontend_spec_005`'s category
colours use an event-based `subscribeToCategoryColorChanges()` mechanism because `CategoryChip`
instances can be simultaneously mounted in the same component that's changing the preference
(`Settings` itself renders swatches next to the colour pickers). That doesn't apply here: `App.tsx`'s
routing (`frontend_spec_005`) mounts `/planner` and `/settings` as mutually exclusive `<Route>`s, so
`PlannerGrid` and `Settings` are never mounted at the same time. Changing the orientation in
`Settings` and then navigating to the Weekly Planner tab causes `WeeklyPlanner`/`PlannerGrid` to
mount fresh, which already reads the current `localStorage` value with no extra plumbing —
confirmed by reading `App.tsx`'s route table. This spec therefore builds no
`subscribeToGridOrientationChanges()`-style event mechanism (Requirement 6).

**Structural conflict with `frontend_spec_008_occurrence_detail_card.md`, resolved**:
`frontend_spec_008_occurrence_detail_card.md`'s `FRONTEND-008-AC-18` (not yet implemented) states
that `PlannerGrid` highlights today's weekday by highlighting "that weekday's column — its
day-label header cell and every slot cell in that column," written specifically against the
day-columns structure that is, until this spec, the grid's only layout. That wording doesn't hold
for the day-rows layout this spec adds — in day-rows, "today" isn't a column at all, it's one of
the five stacked day-sections. Since neither spec is implemented yet, `FRONTEND-008-AC-18`'s text
(and the "column" wording in the adjacent `AC-19`/`AC-20`) has been directly edited in place — ID
unchanged, per `.claude/steering/ears_format.md`'s "Reference IDs are immutable" rule (only the ID
itself is protected from renumbering/deletion, not the statement text) — to describe the highlight
in terms that hold for both orientations. This is the same direct-edit pattern
`frontend_spec_010_bucket_reordering.md` already used against the same sibling spec's `AC-01`
(and, before that, `frontend_spec_006_repeatable_activities.md`'s `AC-09`), and it's used here
directly rather than adding a second, parallel "additively amends an unedited AC" note, per that
established precedent. `FRONTEND-012-AC-12` below states this spec's own side of that same
contract.

**Out of scope**: the occurrence detail card's own functionality, the parent-activity-name display,
and the completion icon (`frontend_spec_008_occurrence_detail_card.md`, separate — this spec
resolves only the one today-highlight wording conflict described above and touches nothing else in
that spec). The "Add" picker modal (`frontend_spec_009_add_picker_modal.md`). Weekend bucket
drag-and-drop reordering and automatic carry-forward (`planner_spec_010`/`frontend_spec_010`,
`planner_spec_011`/`frontend_spec_011`) — the weekend bucket list has no day/slot axis and is
entirely unaffected by grid orientation (`BucketList.tsx` is not touched by this spec). Any backend
change. The header restructure and button-hierarchy `SPEC_CANDIDATES.md` entries (unrelated,
separate).

## Requirements

### Requirement 1 — Grid-orientation preference storage (mirrors the theme mechanism)

As a user, I want my chosen grid layout to persist across visits, the same way my theme choice
already does.

- **FRONTEND-012-AC-01** [AUTO]: The `getGridOrientation()` utility (`src/utils/gridOrientation.ts`)
  shall return the stored `bap-grid-orientation` value from `localStorage` when it is
  `'day-columns'` or `'day-rows'`, and shall return `'day-columns'` when the stored value is missing
  or not a valid `GridOrientation` — preserving today's only layout as the safe default, matching
  `getThemePreference()`'s missing/invalid-value handling.
- **FRONTEND-012-AC-02** [AUTO]: When `setGridOrientation(orientation)` is called, it shall persist
  `orientation` to `localStorage` under the `bap-grid-orientation` key.

### Requirement 2 — Settings: grid layout toggle

As a user, I want a Settings control to switch between the two grid layouts, matching how I already
switch my theme.

- **FRONTEND-012-AC-03** [AUTO]: `Settings` shall render a labelled two-option group for weekly grid
  layout ("Days across the top" / "Each day as its own section"), reflecting the currently stored
  `bap-grid-orientation` preference and defaulting to "Days across the top" selected when nothing is
  stored yet.
- **FRONTEND-012-AC-04** [AUTO]: When the user selects a grid-layout option, `Settings` shall call
  `setGridOrientation()` with the selected value, persisting it to `localStorage` immediately.

### Requirement 3 — `PlannerGrid`'s data/callback contract is unaffected by orientation

As a developer, I want adding a second layout to be a pure rendering/grouping change, so no other
component needs to change to support it.

- **FRONTEND-012-AC-05** [AUTO]: `PlannerGrid`'s exported prop interface (`occurrences`, `busyId`,
  `confirmingRemoveId`, `movingId`, and its `on*` callbacks) shall remain unchanged by this spec —
  the grid orientation is read internally via `getGridOrientation()`, not threaded through as a prop
  from `WeeklyPlanner`.

### Requirement 4 — Day-columns layout is preserved exactly, unchanged, as the default

As an existing user (or anyone who has never touched this setting), I want to see exactly today's
layout with no visual change until I actively choose otherwise.

- **FRONTEND-012-AC-06** [AUTO]: While the effective grid orientation is `'day-columns'` (the stored
  preference, or its default per `FRONTEND-012-AC-01` when unset/invalid), `PlannerGrid` shall
  render Monday–Friday as a shared day-label header row followed by slot-major grid cells,
  structurally unchanged from its pre-existing implementation.

### Requirement 5 — Day-rows layout

As a user, I want the option to see each day as its own section with Morning/Afternoon/Evening
side by side, instead of one shared grid.

- **FRONTEND-012-AC-07** [AUTO]: While the effective grid orientation is `'day-rows'`, `PlannerGrid`
  shall render one day-section per entry in the `days` prop, in the order given (not a hardcoded
  Monday–Friday list — by the time this spec was implemented, `frontend_spec_015` had already
  generalized `PlannerGrid`'s hardcoded weekday list into a `days` prop shared by the Weekly
  Planner's weekday tab (`WEEKDAY_DAYS`, 5 days), its weekend tab (`WEEKEND_DAYS`, 2 days), and the
  Today view (a single day) — this AC's statement text is amended in place, ID unchanged, to hold
  for all three, per the direct-edit precedent this spec's own Overview already establishes for
  `frontend_spec_008`'s AC text). Each section is headed by that day's label and contains that
  day's three slot cells (Morning, Afternoon, Evening) side by side within it.
- **FRONTEND-012-AC-08** [AUTO]: Each slot cell in the day-rows layout shall render the same slot
  label (shown as small text inside the cell, preserving the existing inside-box treatment), Add
  control, and list of `OccurrenceItem`s — populated from the same `occurrences` data and the same
  `busyId`/`confirmingRemoveId`/`movingId`/callback props — as the equivalent cell in the
  day-columns layout; only the surrounding grouping differs between the two layouts.
- **FRONTEND-012-AC-09** [AUTO]: While the effective grid orientation is `'day-rows'`, `PlannerGrid`
  shall render no shared day-label header row — each day's label appears exactly once, as that
  day's own section heading.

### Requirement 6 — Orientation applies without a page reload, with no cross-component subscription mechanism

As a user, changing the layout in Settings and going back to my weekly planner should just show the
new layout — I shouldn't have to reload the page.

- **FRONTEND-012-AC-10** [AUTO]: `PlannerGrid` shall read the effective grid orientation once via
  `useState(() => getGridOrientation())` at render/mount time — unlike `theme.ts`'s
  `applyStoredTheme()`, this spec adds no `main.tsx`-level pre-paint application, since orientation
  only affects `PlannerGrid`'s own render output, not anything paint-order-sensitive at the document
  level (see Overview).
- **FRONTEND-012-AC-11** [AUTO]: When the user changes the grid-layout preference in `Settings` and
  then navigates to the Weekly Planner tab (`/planner`), `PlannerGrid` shall render using the newly
  selected orientation — satisfied by React Router's route-exclusive mount/unmount of
  `WeeklyPlanner`/`PlannerGrid` (`/planner` and `/settings` are mutually exclusive routes per
  `frontend_spec_005_navigation_and_theme.md`), with no additional cross-component event/
  subscription mechanism required.

### Requirement 7 — Today-highlight consistency across orientations

As a user, I want to still be able to tell which day is today at a glance, no matter which layout
I've chosen.

- **FRONTEND-012-AC-12** [AUTO]: Where the today-highlight described by
  `frontend_spec_008_occurrence_detail_card.md`'s `FRONTEND-008-AC-18` is implemented, `PlannerGrid`
  shall apply one shared highlight class to today's weekday in whichever orientation is active — the
  day-label header cell and every slot cell in that column for `'day-columns'`, or that day's
  section heading and every slot cell in that section for `'day-rows'` — rather than defining two
  independently maintained highlight styles.
- **FRONTEND-012-AC-13** [MANUAL]: The day-rows layout — day-sections stacked vertically, each
  showing its three slot cells side by side with the inside-box slot label preserved — renders
  correctly and matches the existing Quiet Room visual language in both Light and Dark themes,
  verified by a real-browser check, since jsdom cannot render CSS
  (`frontend_conventions.md`'s Testing Strategy note).

## Component/type changes

`frontend/src/utils/gridOrientation.ts` (new):

```typescript
export type GridOrientation = 'day-columns' | 'day-rows'

const STORAGE_KEY = 'bap-grid-orientation'

function isGridOrientation(value: string | null): value is GridOrientation {
  return value === 'day-columns' || value === 'day-rows'
}

/**
 * Reads the stored grid-orientation preference, treating a missing or invalid value as
 * "day-columns" — today's only layout, preserved as the default so existing users see no change.
 */
export function getGridOrientation(): GridOrientation {
  const stored = localStorage.getItem(STORAGE_KEY)
  return isGridOrientation(stored) ? stored : 'day-columns'
}

/**
 * Persists the grid-orientation preference to localStorage. Unlike `theme.ts`, there is no
 * `applyStored...()` counterpart called from `main.tsx` — orientation only affects `PlannerGrid`'s
 * own render output, not anything paint-order-sensitive at the document level, so a mount-time
 * `useState(() => getGridOrientation())` read inside `PlannerGrid` is sufficient (FRONTEND-012-AC-10).
 */
export function setGridOrientation(orientation: GridOrientation): void {
  localStorage.setItem(STORAGE_KEY, orientation)
}
```

`Settings.tsx` (extended) — a new fieldset, reusing the existing `styles.themeList` radio-pill
pattern (already generic — not theme-specific in its actual CSS — so no new list styling is added):

```typescript
import {
  getGridOrientation,
  setGridOrientation,
  type GridOrientation,
} from '../../utils/gridOrientation'

const GRID_ORIENTATION_OPTIONS: readonly { value: GridOrientation; label: string }[] = [
  { value: 'day-columns', label: 'Days across the top' },
  { value: 'day-rows', label: 'Each day as its own section' },
]
```

```tsx
const [gridOrientation, setGridOrientationState] = useState<GridOrientation>(() =>
  getGridOrientation(),
)

const handleGridOrientationChange = (orientation: GridOrientation) => {
  setGridOrientation(orientation)
  setGridOrientationState(orientation)
}
```

```tsx
<fieldset>
  <legend>Weekly grid layout</legend>
  <ul className={styles.themeList}>
    {GRID_ORIENTATION_OPTIONS.map((option) => (
      <li key={option.value}>
        <label>
          <input
            type="radio"
            name="grid-orientation"
            value={option.value}
            checked={gridOrientation === option.value}
            onChange={() => handleGridOrientationChange(option.value)}
          />
          {option.label}
        </label>
      </li>
    ))}
  </ul>
</fieldset>
```

`PlannerGrid.tsx` (restructured internally — **as actually implemented**, against the real current
`main` shape rather than the stale sketch this spec originally shipped with. By implementation time,
`frontend_spec_015`/`024`/`025`/`026`/`028`/`016`/`008` had all landed, so the real
`PlannerGridProps` interface already carries `weekStart`, `days` (not a hardcoded `WEEKDAYS`
constant — also called with `WEEKEND_DAYS` and a single-day array), `heading`, `emptyMessage`,
`todayColumn`, full drag-and-drop (`dragPayload`/`onDragStart`/`onDragEnd`/`onAssignFromDrawer`),
and a day-label header row that already renders `getDayDate()` + `DAY_LABELS[day]` with a `.today`
highlight — none of which existed when this spec's code sketch was first written. Every one of
those props is preserved unchanged, per `FRONTEND-012-AC-05`; cell content is factored into one
shared `renderCell` helper used by both layout branches, since the two layouts differ only in
grouping, not in what a cell renders):

```tsx
import { useState, type CSSProperties, type ReactNode } from 'react'
import { getGridOrientation } from '../../utils/gridOrientation'
// ...existing imports unchanged (ALL_SLOTS, DAY_LABELS, SLOT_LABELS, getDayDate, etc.)

function dayHeadingClassName(isToday: boolean): string {
  return isToday ? `${styles.dayHeading} ${styles.today}` : styles.dayHeading
}

export function PlannerGrid({ weekStart, days, heading, emptyMessage, occurrences, busyId, todayColumn, /* ...all existing props, unchanged */ }: PlannerGridProps) {
  const [orientation] = useState(() => getGridOrientation())
  const scheduled = occurrences.filter(
    (occurrence) => occurrence.dayOfWeek !== null && occurrence.slot !== null,
  )

  const renderCell = (day: PlanDayOfWeek, slot: PlanSlot): ReactNode => {
    // ...unchanged from the pre-existing cell body: cellClassName/today highlight, slot label,
    // Add button + its aria-label, onDragOver/onDrop -> handleDrop, and the OccurrenceItem list --
    // identical in both orientations, which is what AC-08 requires.
  }

  return (
    <section aria-label={heading} className={styles.section}>
      <h3>{heading}</h3>
      {scheduled.length === 0 && <p>{emptyMessage}</p>}
      <div className={styles.scroll}>
        {orientation === 'day-rows' ? (
          <div className={styles.rows}>
            {days.map((day) => {
              const isToday = day === todayColumn
              return (
                <section key={day} className={styles.daySection} aria-label={DAY_LABELS[day]}>
                  <h4 className={dayHeadingClassName(isToday)}>
                    <span>{getDayDate(weekStart, day)}</span>
                    <span>{DAY_LABELS[day]}</span>
                  </h4>
                  <div className={styles.daySlots}>
                    {ALL_SLOTS.map((slot) => renderCell(day, slot))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className={styles.grid} style={{ '--day-count': days.length } as CSSProperties}>
            {days.map((day) => (
              <div key={day} className={dayLabelClassName(day === todayColumn)}>
                <span>{getDayDate(weekStart, day)}</span>
                <span>{DAY_LABELS[day]}</span>
              </div>
            ))}
            {ALL_SLOTS.map((slot) => days.map((day) => renderCell(day, slot)))}
          </div>
        )}
      </div>
    </section>
  )
}
```

Note the day-rows branch iterates `days` directly (whatever order/length it's given — 5 weekdays,
2 weekend days, or a single Today-view day), not a hardcoded weekday list, per the amended
`FRONTEND-012-AC-07` above. The today-highlight (`FRONTEND-012-AC-12`) is applied via the same
pattern `cellClassName`/`dayLabelClassName` already use for the day-columns branch — a new sibling
`dayHeadingClassName` helper appends `styles.today` to `styles.dayHeading` when `day === todayColumn`,
applied to both the section heading and (via the shared `renderCell`) every slot cell in that
section.

`PlannerGrid.module.css` (extended — existing `.grid`/`.dayLabel`/`.cell`/`.slotLabel`/`.list`/
`.today` classes reused unchanged for day-columns; new classes for day-rows, **as actually
implemented** using CSS logical properties for the new rules, per `frontend_conventions.md`'s
newer convention — the sketch below replaces this spec's original `border-top`/`padding-top`/
`margin` physical-property version):

```css
.rows {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.daySection {
  border-block-start: 1px solid var(--border);
  padding-block-start: 0.6rem;
}

.dayHeading {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-family: var(--mono), monospace;
  font-weight: bolder;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.72rem;
  color: var(--text);
  margin-block-end: 0.5rem;
}

.daySlots {
  display: grid;
  grid-template-columns: repeat(3, minmax(8rem, 1fr));
  gap: 0.5rem;
}
```

`.dayHeading` is a flex row of two `<span>`s (date number, day name) mirroring `.dayLabel`'s
existing shape exactly, so the day-rows section heading looks consistent with the day-columns
header cell it replaces.

A single component with an internal orientation-conditional branch (rather than two separate
`PlannerGridColumns`/`PlannerGridRows` sub-components) was chosen because the only real difference
between the layouts is DOM grouping, not cell content — a shared `renderCell` helper keeps that
content defined exactly once, avoiding the risk of the two layouts' cells silently drifting apart
over time. `BucketList.tsx`/`PlannerGrid.tsx`'s existing split exists for a different reason (grid
vs. bucket are different *domains*, with different data filters and different action sets), not a
precedent this spec needs to follow for a purely stylistic variant.

## Cross-references

| This spec | Contracts against |
|---|---|
| `utils/gridOrientation.ts` (new) | `localStorage` key `bap-grid-orientation`; no backend endpoint, nothing on the `User` entity — same client-only scope boundary as `utils/theme.ts` (`frontend_spec_005_navigation_and_theme.md`) |
| `Settings.tsx` | Extended — new "Weekly grid layout" fieldset, reusing `Settings.module.css`'s `.themeList` radio-pill pattern |
| `PlannerGrid.tsx` | Restructured internally — orientation-conditional render via a shared `renderCell` helper; exported prop interface unchanged (`FRONTEND-012-AC-05`) |
| `PlannerGrid.module.css` | Extended — new `.rows`/`.daySection`/`.dayHeading`/`.daySlots` classes for day-rows; existing day-columns classes unchanged |
| `frontend_spec_004_week_planning.md` | Origin of `PlannerGrid`/`WeeklyPlanner` |
| `frontend_spec_005_navigation_and_theme.md` | Origin of the `localStorage`-backed-preference + Settings-radio-group mechanism this spec replicates (`utils/theme.ts`, the Appearance fieldset); origin of the route-exclusive `/planner`/`/settings` navigation this spec's "no reload" contract (`FRONTEND-012-AC-11`) relies on |
| `frontend_spec_007_visual_refresh.md` | CSS Modules + theme custom-properties convention this spec's new day-rows styles follow |
| `frontend_spec_008_occurrence_detail_card.md` | `FRONTEND-008-AC-18`–`AC-20` today-highlight wording directly edited by this spec to hold for both orientations (see Overview); `FRONTEND-012-AC-12` states this spec's own side of that same contract; not yet implemented |
| No paired backend spec | Pure client-side preference — no new endpoint, no `dto/` shape, nothing on the `User` entity (see Overview) |

`PlannerGrid.test.tsx`'s existing `FRONTEND-007-AC-09`/`AC-23` assertions (`styles.dayLabel` on
"Monday", `styles.cell` on the Add-button's ancestor) continue to pass unmodified under the default
`'day-columns'` orientation — a direct regression guard for `FRONTEND-012-AC-06`, not a new AC.

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
// utils/gridOrientation.test.ts

describe('FRONTEND-012-AC-01: getGridOrientation defaults to day-columns', () => {
  it('returns "day-columns" when nothing is stored', () => {
    expect(getGridOrientation()).toBe('day-columns')
  })

  it('returns "day-columns" for an invalid stored value', () => {
    localStorage.setItem('bap-grid-orientation', 'nonsense')
    expect(getGridOrientation()).toBe('day-columns')
  })

  it('returns the stored value when valid', () => {
    localStorage.setItem('bap-grid-orientation', 'day-rows')
    expect(getGridOrientation()).toBe('day-rows')
  })
})

describe('FRONTEND-012-AC-02: setGridOrientation persists the value', () => {
  it('writes "day-rows" to localStorage', () => {
    setGridOrientation('day-rows')
    expect(localStorage.getItem('bap-grid-orientation')).toBe('day-rows')
  })
})
```

```typescript
// Settings.test.tsx additions

describe('FRONTEND-012-AC-03/AC-04: grid layout toggle renders and persists a selection', () => {
  it('defaults to "Days across the top" and persists "Each day as its own section" when chosen', async () => {
    render(<Settings />)

    expect(screen.getByRole('radio', { name: /days across the top/i })).toBeChecked()

    await userEvent.click(screen.getByRole('radio', { name: /each day as its own section/i }))

    expect(localStorage.getItem('bap-grid-orientation')).toBe('day-rows')
  })
})
```

```typescript
// PlannerGrid.test.tsx additions

describe('FRONTEND-012-AC-06: day-columns layout is unchanged when unset', () => {
  it('renders a single shared grid with a day-label header row', () => {
    renderGrid()

    expect(screen.getByText('Monday')).toHaveClass(styles.dayLabel)
    expect(document.querySelectorAll(`.${styles.daySection}`)).toHaveLength(0)
  })
})

describe('FRONTEND-012-AC-07/AC-09: day-rows layout renders five day-sections, no shared header', () => {
  it('renders five day-sections, each with its own heading, and no styles.dayLabel header row', () => {
    localStorage.setItem('bap-grid-orientation', 'day-rows')

    renderGrid()

    expect(document.querySelectorAll(`.${styles.daySection}`)).toHaveLength(5)
    expect(screen.getByRole('heading', { name: 'Monday', level: 4 })).toHaveClass(styles.dayHeading)
    expect(document.querySelectorAll(`.${styles.dayLabel}`)).toHaveLength(0)
  })
})

describe('FRONTEND-012-AC-08: day-rows cells render the same slot label/Add/list content', () => {
  it('renders an inside-box slot label and Add control for each of a day\'s three slots', () => {
    localStorage.setItem('bap-grid-orientation', 'day-rows')

    renderGrid()

    const mondaySection = screen.getByRole('heading', { name: 'Monday', level: 4 }).closest('section')!
    expect(within(mondaySection).getByLabelText('Add to Monday Morning')).toBeInTheDocument()
    expect(within(mondaySection).getByLabelText('Add to Monday Afternoon')).toBeInTheDocument()
    expect(within(mondaySection).getByLabelText('Add to Monday Evening')).toBeInTheDocument()
    expect(within(mondaySection).getByText('Morning')).toHaveClass(styles.slotLabel)
  })
})

describe('FRONTEND-012-AC-11: PlannerGrid reads the preference at mount, reflecting a Settings change on next visit', () => {
  it('renders day-rows on a fresh mount after the preference was changed', () => {
    setGridOrientation('day-rows')

    renderGrid()

    expect(document.querySelectorAll(`.${styles.daySection}`)).toHaveLength(5)
  })
})
```

`FRONTEND-012-AC-05` (prop interface unchanged) has no standalone runtime test — it's enforced by
`tsc -b --noEmit` against `PlannerGrid.test.tsx`'s and `WeeklyPlanner.test.tsx`'s existing call
sites compiling unmodified, plus the fact that every sketch above renders `PlannerGrid` with the
same prop list `PlannerGrid.test.tsx` already uses today. `FRONTEND-012-AC-10` is exercised
implicitly by every sketch above (`PlannerGrid` reading the orientation with no `main.tsx` change
required for any of them to pass).

`FRONTEND-012-AC-12` **does** now have a real test sketch — by implementation time,
`frontend_spec_008`'s `todayColumn` prop (and its `FRONTEND-008-AC-18`/`AC-19` today-highlight) were
already real on `main`, so the "cannot be given a real test sketch yet" note this spec originally
carried no longer applies:

```typescript
describe('FRONTEND-012-AC-12: today-highlight is consistent across orientations', () => {
  it('applies the today class to the day-section heading and its slot cells in day-rows', () => {
    setGridOrientation('day-rows')

    renderGrid({ todayColumn: 'TUESDAY' })

    const tuesdayHeading = screen.getByRole('heading', { name: /tuesday/i, level: 4 })
    expect(tuesdayHeading.closest(`.${styles.today}`)).not.toBeNull()
    const tuesdaySection = tuesdayHeading.closest('section')!
    expect(
      within(tuesdaySection).getByLabelText('Add to Tuesday Morning').closest(`.${styles.today}`),
    ).not.toBeNull()

    const mondayHeading = screen.getByRole('heading', { name: /monday/i, level: 4 })
    expect(mondayHeading.closest(`.${styles.today}`)).toBeNull()
  })
})
```

`FRONTEND-012-AC-13` is verified manually per its own statement.

**Test Case (Green)**: implement `utils/gridOrientation.ts`, extend `Settings.tsx`, and restructure
`PlannerGrid.tsx`/`PlannerGrid.module.css` as specified above until every sketch above (and
`FRONTEND-012-AC-05`/`AC-10`, verified as described above) passes. `FRONTEND-012-AC-13` is verified
by a real-browser pass in both Light and Dark, per `frontend_conventions.md`'s Testing Strategy
note.

## Acceptance Criteria Summary

- [x] FRONTEND-012-AC-01 — `getGridOrientation()` returns the stored value or defaults to `'day-columns'`
- [x] FRONTEND-012-AC-02 — `setGridOrientation()` persists the value to `localStorage`
- [x] FRONTEND-012-AC-03 — `Settings` renders the grid-layout option group, defaulting to "Days across the top"
- [x] FRONTEND-012-AC-04 — selecting an option persists it via `setGridOrientation()`
- [x] FRONTEND-012-AC-05 — `PlannerGrid`'s prop interface is unchanged by this spec
- [x] FRONTEND-012-AC-06 — day-columns layout renders exactly as before, unchanged, as the default
- [x] FRONTEND-012-AC-07 — day-rows layout renders one day-section per entry in the `days` prop, in the order given
- [x] FRONTEND-012-AC-08 — day-rows cells render the same slot label/Add/list content as day-columns cells
- [x] FRONTEND-012-AC-09 — day-rows layout renders no shared day-label header row
- [x] FRONTEND-012-AC-10 — `PlannerGrid` reads the orientation via `useState` at mount, no `main.tsx` change
- [x] FRONTEND-012-AC-11 — a preference change is reflected on the next `/planner` mount, no reload needed
- [x] FRONTEND-012-AC-12 — today-highlight applies via one shared class, consistent in both orientations
- [x] FRONTEND-012-AC-13 — day-rows layout visually correct in Light and Dark (real-browser check)
