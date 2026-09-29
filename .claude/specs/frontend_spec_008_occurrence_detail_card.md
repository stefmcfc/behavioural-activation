# Occurrence Detail Card (Frontend)

**Status**: Implemented — all 22 ACs verified, including FRONTEND-008-AC-22 (today-highlight visual
contrast confirmed in a real browser, both Light and Dark).
**Priority**: P2 — a direct response to the user's "far too much noise in the calendar" complaint
about the Weekly Planner, raised after `frontend_spec_006_repeatable_activities.md` shipped.
**Depends on**: `planner_spec_008_occurrence_detail_card.md` (paired backend spec —
`parentActivityName`), `frontend_spec_004_week_planning.md` (origin of `OccurrenceItem.tsx`,
`PlannerGrid.tsx`, `BucketList.tsx`, `WeeklyPlanner.tsx`, `planApi`, `types/plan.ts`),
`frontend_spec_006_repeatable_activities.md` (most recent prior state of the activity/sub-task data
these components render), `frontend_spec_007_visual_refresh.md` (CSS Modules + theme
custom-properties convention this spec's new card/icon/highlight styles follow)
**Area**: Frontend
**Roadmap version**: V1 (extends the core planner's weekly-grid display from `product.md`'s V1 row —
not V2's tracking/reflection scope, and not AI)

## Overview

Four requirements were confirmed from a Weekly Planner UX batch raised after
`frontend_spec_006_repeatable_activities.md` shipped, all addressing the same root complaint — "far
too much noise in the calendar." This spec covers all four. It ties back to
`.claude/HIGH_LEVEL_DESIGN.md`'s US-003 (view a weekly plan), US-004 (plan/move/remove an activity),
and US-009 (complete an activity, including undo) — the same user stories
`frontend_spec_004_week_planning.md` delivered the first version of; this spec restyles and
reorganises that same surface without changing its underlying capabilities.

1. **Occurrence detail card replaces the always-visible action row.** `OccurrenceItem.tsx` today
   renders every occurrence's full action set (Move, Move to bucket, Remove, Complete/Undo, Carry
   forward) permanently visible and stacked inside every grid cell and every bucket row. Activating
   the occurrence's own name/tile now opens a small detail card containing Move, Remove (with its
   existing inline confirm step), Move to bucket (grid items only), and Carry forward (bucket items
   only) — relocated, not removed or reworked. **Complete/Undo stays a one-click control directly on
   the tile**, not moved into the card, since it's the single most frequent action in this flow and
   must not gain friction.

   **Ambiguity resolved before writing ACs below**: the requirement's own first sentence lists "Move,
   Move to bucket, Remove, and Undo" as the card's contents, but its immediately-following
   "Confirmed decision" clarifies that the tile's one-click control is Complete/Undo *together*
   (toggling between the two based on completion state) and that only "everything else" — Move, Move
   to bucket, Remove, and (by the same "everything else" logic, since it's equally part of today's
   noisy always-visible row and isn't named as an exception) Carry forward — moves into the card.
   Resolved toward the stricter, later, explicitly-"Confirmed" reading: **Undo stays on the tile
   paired with Complete; the card never contains Undo.**

   This card is deliberately *not* a portal-rendered modal dialog with its own focus-trap
   infrastructure — matching this codebase's existing precedent of inline expandable sections
   (`AssignActivityPicker` renders inline, not as a dialog; `OccurrenceItem`'s own existing
   `confirmingRemoveId`/`movingId` sub-states are inline, not modal). It reuses that same "one
   `WeeklyPlanner`-owned id, toggled open/closed" shape, extended to a third, higher-level piece of
   state (`detailOpenId`) that the existing `confirmingRemoveId`/`movingId` states now nest inside of.
   A future, separate "Add picker modal" spec (`.claude/SPEC_CANDIDATES.md`) may introduce a real
   modal primitive later; this spec doesn't need to invent one to satisfy its own requirement.

2. **Show the parent activity on a sub-task occurrence's tile.** Consumes
   `planner_spec_008_occurrence_detail_card.md`'s new `parentActivityName` field.

3. **Completion as an icon, not text.** Replaces the literal `— Completed` text with an icon-style
   indicator carrying an accessible name, since this app has no icon library dependency — confirmed
   via `frontend/package.json` (`axios`, `react`, `react-dom`, `react-router-dom` only) — an inline
   SVG is used rather than adding one.

4. **Today highlight in the week grid.** `PlannerGrid.tsx` gains a visual distinction for today's
   weekday, only when the displayed week actually contains today's real date — see Requirement 4 for
   the exact per-layout treatment, generalized by `frontend_spec_012_grid_orientation_toggle.md` to
   hold for both the existing day-columns layout and that spec's new day-rows layout.

**Out of scope**: the "Add" picker modal (`frontend_spec_009_add_picker_modal.md`), weekend bucket
drag-and-drop reordering + automatic carry-forward (`frontend_spec_010_bucket_reordering.md`/
`frontend_spec_011_bucket_carry_forward_automation.md`), and the weekly grid orientation toggle
(`frontend_spec_012_grid_orientation_toggle.md`, which directly amends this spec's
`FRONTEND-008-AC-18`–`AC-20` today-highlight wording to hold for both grid orientations — see
Requirement 4) — this spec's card/icon/highlight design is kept orientation-agnostic (no assumption
about day-columns vs day-rows) since the orientation toggle reuses `OccurrenceItem` unmodified
either way, but the toggle itself isn't built here. The completion/category-balance summary strip
(an unconfirmed idea in `.claude/ideas/future_ideas.md`) is not pulled in. No change to the
click-to-assign flow or `AssignActivityPicker.tsx` itself.

## Requirements

### Requirement 1 — At-rest tile shows only name, category, completion, and one-click Complete/Undo

As a user, I want my weekly grid and bucket list to show just enough at a glance — what it is, its
category, whether I've done it, and a one-click way to mark it done — without a wall of buttons on
every single item.

- **FRONTEND-008-AC-01** [AUTO]: While no detail card is open for an occurrence, `OccurrenceItem`
  shall render only: an interactive name control, its `CategoryChip`, a completion indicator
  (Requirement 3), and a one-click Complete/Undo control — Move, Move to bucket, Remove, and Carry
  forward shall not be rendered. (Amended by `frontend_spec_010_bucket_reordering.md`: for a bucket
  item specifically, a drag handle and Move up/Move down controls are also always rendered at rest,
  per that spec's `FRONTEND-010-AC-15` — reordering, like Complete, is frequent enough that it must
  not require opening the card.)
- **FRONTEND-008-AC-02** [AUTO]: When the occurrence's name control is activated, `OccurrenceItem`
  shall call `onOpenDetail(occurrence.id)`.
- **FRONTEND-008-AC-03** [AUTO]: While a detail card is open for an occurrence, `OccurrenceItem`
  shall render Move and Remove controls inside that card (relocated from the previous always-visible
  row, behaviourally unchanged).
- **FRONTEND-008-AC-04** [AUTO]: Where the occurrence is a grid item (`isBucketItem` is `false`) and
  its detail card is open, `OccurrenceItem` shall additionally render a "Move to bucket" control
  inside the card.
- **FRONTEND-008-AC-05** [AUTO]: Where the occurrence is a bucket item (`isBucketItem` is `true`) and
  its detail card is open, `OccurrenceItem` shall additionally render a "Carry forward" control
  inside the card, in place of the row it previously always rendered in.
- **FRONTEND-008-AC-06** [AUTO]: When Remove is activated inside an open detail card, `OccurrenceItem`
  shall enter the existing inline confirm sub-state (a "Confirm remove"/"Cancel" pair) exactly as it
  does today, now rendered inside the card.
- **FRONTEND-008-AC-07** [AUTO]: When Move is activated inside an open detail card, `OccurrenceItem`
  shall enter the existing day/slot-select sub-state (`<select>`s plus a "Confirm move"/"Cancel"
  pair) exactly as it does today, now rendered inside the card.
- **FRONTEND-008-AC-08** [AUTO]: An open detail card shall render an explicit "Close" control; when
  activated, `OccurrenceItem` shall call `onCloseDetail()` and apply no move/remove/carry-forward
  side effect.
- **FRONTEND-008-AC-09** [AUTO]: When the occurrence's name control is activated again while its own
  detail card is already open, `OccurrenceItem` shall call `onCloseDetail()` (toggle behaviour).
- **FRONTEND-008-AC-10** [AUTO]: While `WeeklyPlanner` holds a single `detailOpenId` and a new
  occurrence's name control is activated, at most one occurrence's detail card shall be open at a
  time — opening a second closes the first.
- **FRONTEND-008-AC-11** [AUTO]: If a different occurrence's detail card is opened while another
  occurrence has an in-progress move or remove-confirmation sub-state, then `WeeklyPlanner` shall
  clear that stale sub-state (equivalent to cancelling it) rather than leaving it dangling on a now
  hidden card.
- **FRONTEND-008-AC-12** [AUTO]: The Complete/Undo control shall render directly on the tile and
  remain clickable regardless of whether that occurrence's detail card is open or closed.

### Requirement 2 — Show the parent activity on a sub-task occurrence's tile

As a user, I want to see which activity a planned sub-task belongs to, so I don't have to remember or
guess from the sub-task's own name alone.

- **FRONTEND-008-AC-13** [AUTO]: The `PlannedOccurrence` type shall declare a new
  `parentActivityName: string | null` field, matching `planner_spec_008_occurrence_detail_card.md`'s
  `PlannedOccurrenceResponse.parentActivityName` 1:1.
- **FRONTEND-008-AC-14** [AUTO]: Where `occurrence.subTaskId` is non-null and
  `occurrence.parentActivityName` is non-null, `OccurrenceItem` shall render the parent activity's
  name, visually distinct from (e.g. smaller/muted relative to) the sub-task's own name, on the tile.
- **FRONTEND-008-AC-15** [AUTO]: Where `occurrence.subTaskId` is `null` (a whole-activity occurrence),
  `OccurrenceItem` shall never render parent-activity text, regardless of `parentActivityName`'s
  value.

### Requirement 3 — Completion as an accessible icon, not text

As a user, I want to see at a glance what I've completed without reading a line of text per item, and
as a screen-reader user I still want that state announced clearly.

- **FRONTEND-008-AC-16** [AUTO]: When `occurrence.completed` is `true`, `OccurrenceItem` shall render
  a completion indicator with an accessible name of "Completed" (e.g. `role="img"` +
  `aria-label="Completed"` on an inline SVG), replacing the previous literal `— Completed` text node.
- **FRONTEND-008-AC-17** [AUTO]: When `occurrence.completed` is `false`, `OccurrenceItem` shall render
  no completion indicator (unchanged from today's conditional rendering).

### Requirement 4 — Today-column highlight in the weekly grid

As a user, I want to be able to tell which column is today at a glance when I'm looking at the
current week, so I don't have to cross-reference the date myself.

- **FRONTEND-008-AC-18** [AUTO]: While the displayed week is the current real week (`weekStart`
  equals today's Monday) and today falls on a weekday in the Monday–Friday grid, `PlannerGrid` shall
  render a distinguishing highlight on today's weekday as a whole. (Amended by
  `frontend_spec_012_grid_orientation_toggle.md`: in the day-columns layout — the default — this
  means its day-label header cell and every slot cell in that column; in that spec's new day-rows
  layout, it means that day's section heading and every slot cell within that day's section. Both
  layouts use the same shared highlight treatment applied to structurally different containers, not
  two independently designed highlights — see that spec's `FRONTEND-012-AC-12`.)
- **FRONTEND-008-AC-19** [AUTO]: While the displayed week is not the current real week (a past or
  future week), `PlannerGrid` shall render no today-highlight on any weekday, in either the
  day-columns or day-rows layout (`frontend_spec_012_grid_orientation_toggle.md`).
- **FRONTEND-008-AC-20** [AUTO]: While today falls on a Saturday or Sunday, even during the week that
  contains it, `PlannerGrid` shall render no today-highlight on any weekday, in either layout
  (`frontend_spec_012_grid_orientation_toggle.md`) — the Monday–Friday grid has no weekday to
  highlight in that case, and this does not apply to the weekend bucket list (no day-of-week axis
  there).
- **FRONTEND-008-AC-21** [AUTO]: `WeeklyPlanner` shall compute "is this the current week" via its
  existing `getMondayOfCurrentWeek()`-based check (`weekStart === getMondayOfCurrentWeek()`) and pass
  the resulting today-column (or `null`) to `PlannerGrid` as an explicit prop; `PlannerGrid` shall not
  independently re-derive "today"/"current week" via a second date-comparison helper.
- **FRONTEND-008-AC-22** [MANUAL]: The today-column highlight is visually distinguishable (not merely
  structurally present in the DOM) in both Light and Dark themes — verified by a real-browser check
  against both themes, since jsdom cannot render CSS/contrast (`frontend_conventions.md`).

## Component/type changes

`types/plan.ts` (extended):

```typescript
export interface PlannedOccurrence {
  id: string
  activityId: string | null
  subTaskId: string | null
  name: string
  parentActivityName: string | null
  category: ActivityCategory
  weekStart: string
  dayOfWeek: PlanDayOfWeek | null
  slot: PlanSlot | null
  completed: boolean
  completedAt: string | null
  createdAt: string
}
```

`OccurrenceItem.tsx` — prop shape gains the detail-card state, replacing the always-visible action
row with a tile/card split:

```typescript
interface OccurrenceItemProps {
  readonly occurrence: PlannedOccurrence
  readonly isBucketItem: boolean
  readonly busyId: string | null
  readonly detailOpenId: string | null
  readonly confirmingRemoveId: string | null
  readonly movingId: string | null
  readonly onOpenDetail: (id: string) => void
  readonly onCloseDetail: () => void
  readonly onStartRemove: (id: string) => void
  readonly onConfirmRemove: (id: string) => void
  readonly onCancelRemove: () => void
  readonly onStartMove: (id: string) => void
  readonly onCancelMove: () => void
  readonly onConfirmMove: (id: string, dayOfWeek: PlanDayOfWeek, slot: PlanSlot) => void
  readonly onMoveToBucket: (id: string) => void
  readonly onComplete: (id: string) => void
  readonly onUndo: (id: string) => void
  readonly onCarryForward: (id: string) => void
}
```

Tile (always rendered):

```tsx
<li className={styles.row}>
  <button type="button" onClick={() => handleNameClick()}>
    {occurrence.name}
  </button>
  {occurrence.subTaskId && occurrence.parentActivityName && (
    <span className={styles.parentActivityName}>{occurrence.parentActivityName}</span>
  )}
  <CategoryChip category={occurrence.category} />
  {occurrence.completed && <CompletionIcon />}
  {occurrence.completed ? (
    <button type="button" onClick={() => onUndo(occurrence.id)} disabled={isBusy}>
      Undo
    </button>
  ) : (
    <button type="button" onClick={() => onComplete(occurrence.id)} disabled={isBusy}>
      Complete
    </button>
  )}

  {isDetailOpen && (
    <div className={styles.detailCard} role="group" aria-label={`${occurrence.name} actions`}>
      {/* existing confirmingRemoveId/movingId sub-states, then Move / Move to bucket / Remove /
          Carry forward, then a Close control -- see Requirement 1 ACs */}
    </div>
  )}
</li>
```

`CompletionIcon` — a small inline SVG, no new dependency (per the Overview's package.json check):

```tsx
function CompletionIcon() {
  return (
    <svg
      className={styles.completionIcon}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label="Completed"
    >
      <path
        d="M3 8.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
```

`WeeklyPlanner.tsx` — gains `detailOpenId` state alongside the existing `confirmingRemoveId`/
`movingId`, plus the today-column computation:

```typescript
const [detailOpenId, setDetailOpenId] = useState<string | null>(null)

const handleOpenDetail = (id: string) => {
  if (confirmingRemoveId && confirmingRemoveId !== id) setConfirmingRemoveId(null)
  if (movingId && movingId !== id) setMovingId(null)
  setDetailOpenId(id)
}

function getTodayPlanDayOfWeek(): PlanDayOfWeek | null {
  const byJsDay: Record<number, PlanDayOfWeek | null> = {
    0: null, // Sunday -- outside the Mon-Fri grid
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
    6: null, // Saturday -- outside the Mon-Fri grid
  }
  return byJsDay[new Date().getDay()]
}

const todayColumn = weekStart === getMondayOfCurrentWeek() ? getTodayPlanDayOfWeek() : null
```

`todayColumn` is passed to `PlannerGrid` as a new `readonly todayColumn: PlanDayOfWeek | null` prop;
`PlannerGrid` applies a `styles.today` class (or equivalent) to the day-label header cell and every
slot cell where `day === todayColumn`. `BucketList` is unaffected (no day-of-week axis).

## Cross-references

| This spec | Contracts against |
|---|---|
| `parentActivityName` | `PlannedOccurrenceResponse.parentActivityName` — exact shape from `planner_spec_008_occurrence_detail_card.md` |
| `types/plan.ts` | Extended — `PlannedOccurrence.parentActivityName` |
| `OccurrenceItem.tsx` | Restructured — tile/detail-card split, completion icon, parent activity name |
| `PlannerGrid.tsx` | Extended — `todayColumn` prop, today-highlight rendering |
| `WeeklyPlanner.tsx` | Extended — owns `detailOpenId`, computes `todayColumn`, clears stale move/remove sub-state on open-detail |
| `BucketList.tsx` | Extended — passes `detailOpenId`/`onOpenDetail`/`onCloseDetail` through to `OccurrenceItem` unmodified otherwise |
| `CategoryChip` (`frontend_spec_005_navigation_and_theme.md`) | Reused unmodified |
| CSS Modules + theme custom properties (`frontend_spec_007_visual_refresh.md`) | Reused — new card/icon/highlight styles follow the same `*.module.css` + `var(--...)` convention |
| `AssignActivityPicker.tsx` (`frontend_spec_004_week_planning.md`) | Unmodified — not touched by this spec |
| `planner_spec_008_occurrence_detail_card.md` | Paired backend spec |
| `frontend_spec_012_grid_orientation_toggle.md` (sibling, written later) | Directly amends `FRONTEND-008-AC-18`–`AC-20`'s today-highlight wording to hold for both grid orientations (see Overview/Requirement 4); not yet implemented |

`OccurrenceItem.test.tsx`, `PlannerGrid.test.tsx`, `BucketList.test.tsx`, and
`WeeklyPlanner.test.tsx`'s existing test suites all pass a full prop list to these components today
and will need updating for the new `detailOpenId`/`onOpenDetail`/`onCloseDetail`/`todayColumn` props
during implementation — not a new AC, just an implementation-time consequence of the prop-shape
change noted above.

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
const gridOccurrence: PlannedOccurrence = {
  id: 'o1', activityId: 'a1', subTaskId: null, name: 'Walk', parentActivityName: null,
  category: 'ROUTINE', weekStart: '2026-10-05', dayOfWeek: 'MONDAY', slot: 'MORNING',
  completed: false, completedAt: null, createdAt: '2026-10-01T00:00:00Z',
}

const subTaskOccurrence: PlannedOccurrence = {
  id: 'o2', activityId: null, subTaskId: 's1', name: 'Chapter one',
  parentActivityName: 'Write a novel', category: 'PLEASURABLE', weekStart: '2026-10-05',
  dayOfWeek: 'TUESDAY', slot: 'AFTERNOON', completed: false, completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
}

const noop = () => {}
function baseProps(overrides: Partial<Parameters<typeof OccurrenceItem>[0]> = {}) {
  return {
    occurrence: gridOccurrence, isBucketItem: false, busyId: null, detailOpenId: null,
    confirmingRemoveId: null, movingId: null, onOpenDetail: noop, onCloseDetail: noop,
    onStartRemove: noop, onConfirmRemove: noop, onCancelRemove: noop, onStartMove: noop,
    onCancelMove: noop, onConfirmMove: noop, onMoveToBucket: noop, onComplete: noop,
    onUndo: noop, onCarryForward: noop, ...overrides,
  }
}

describe('FRONTEND-008-AC-01: at-rest tile hides Move/Move to bucket/Remove/Carry forward', () => {
  it('renders only name, category, and Complete when no card is open', () => {
    render(<OccurrenceItem {...baseProps()} />)

    expect(screen.getByRole('button', { name: 'Walk' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^move$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move to bucket/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-02/AC-03/AC-04: activating the tile opens a card with Move/Move to bucket/Remove', () => {
  it('calls onOpenDetail, then renders the relocated actions once open', () => {
    const onOpenDetail = vi.fn()
    const { rerender } = render(<OccurrenceItem {...baseProps({ onOpenDetail })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Walk' }))
    expect(onOpenDetail).toHaveBeenCalledWith('o1')

    rerender(<OccurrenceItem {...baseProps({ onOpenDetail, detailOpenId: 'o1' })} />)
    expect(screen.getByRole('button', { name: /^move$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move to bucket/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^remove$/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-05: an open bucket item card shows Carry forward, not Move to bucket', () => {
  it('renders Carry forward for a bucket item with its card open', () => {
    render(
      <OccurrenceItem
        {...baseProps({ isBucketItem: true, detailOpenId: 'o1' })}
      />,
    )

    expect(screen.getByRole('button', { name: /carry forward/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move to bucket/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-08/AC-09: Close and re-activating the tile both close the card', () => {
  it('calls onCloseDetail from the Close control and from re-activating the name', async () => {
    const onCloseDetail = vi.fn()
    render(<OccurrenceItem {...baseProps({ detailOpenId: 'o1', onCloseDetail })} />)

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onCloseDetail).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Walk' }))
    expect(onCloseDetail).toHaveBeenCalledTimes(2)
  })
})

describe('FRONTEND-008-AC-11: opening a different card clears a stale move/remove sub-state', () => {
  it('cancels an in-progress move for a different occurrence when a new card opens', async () => {
    const onCancelMove = vi.fn()
    const onOpenDetail = vi.fn()
    render(
      <WeeklyPlannerTestHarness
        occurrences={[gridOccurrence, subTaskOccurrence]}
        initialMovingId="o1"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Chapter one' }))

    expect(screen.queryByLabelText(/new day/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-12: Complete/Undo works with the card closed or open', () => {
  it('calls onComplete when the card is closed', async () => {
    const onComplete = vi.fn()
    render(<OccurrenceItem {...baseProps({ onComplete })} />)

    await userEvent.click(screen.getByRole('button', { name: /complete/i }))
    expect(onComplete).toHaveBeenCalledWith('o1')
  })
})

describe('FRONTEND-008-AC-14/AC-15: parent activity name shown only for sub-task occurrences', () => {
  it('renders the parent activity name for a sub-task, not for a whole-activity occurrence', () => {
    const { rerender } = render(<OccurrenceItem {...baseProps({ occurrence: subTaskOccurrence })} />)
    expect(screen.getByText('Write a novel')).toBeInTheDocument()

    rerender(<OccurrenceItem {...baseProps()} />)
    expect(screen.queryByText('Write a novel')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-16/AC-17: completion indicator is an accessible icon, not text', () => {
  it('renders an icon with accessible name Completed only when completed', () => {
    const { rerender } = render(
      <OccurrenceItem {...baseProps({ occurrence: { ...gridOccurrence, completed: true } })} />,
    )
    expect(screen.getByRole('img', { name: /completed/i })).toBeInTheDocument()
    expect(screen.queryByText(/— completed/i)).not.toBeInTheDocument()

    rerender(<OccurrenceItem {...baseProps()} />)
    expect(screen.queryByRole('img', { name: /completed/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-18/AC-19: today-column highlight only appears for the current week', () => {
  it('highlights the current weekday column, and nothing for a different week', () => {
    vi.setSystemTime(new Date('2026-10-06T09:00:00')) // a Tuesday

    const { rerender } = render(
      <PlannerGrid {...baseGridProps({ todayColumn: 'TUESDAY' })} />,
    )
    expect(screen.getByText('Tuesday')).toHaveClass(styles.today)
    expect(screen.getByText('Monday')).not.toHaveClass(styles.today)

    rerender(<PlannerGrid {...baseGridProps({ todayColumn: null })} />)
    expect(screen.getByText('Tuesday')).not.toHaveClass(styles.today)
  })
})

describe('FRONTEND-008-AC-20: no highlight when today is a Saturday or Sunday', () => {
  it('computes a null today-column on a weekend, even during the current week', () => {
    vi.setSystemTime(new Date('2026-10-10T09:00:00')) // a Saturday
    vi.mocked(planApi.getWeek).mockResolvedValue([])

    render(<WeeklyPlanner />)

    expect(document.querySelector(`.${styles.today}`)).toBeNull()
  })
})

describe('FRONTEND-008-AC-21: WeeklyPlanner reuses getMondayOfCurrentWeek(), not a second helper', () => {
  it('passes null todayColumn for a week that is not the current one', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    await userEvent.click(await screen.findByRole('button', { name: /previous week/i }))

    expect(document.querySelector(`.${styles.today}`)).toBeNull()
  })
})
```

**Test Case (Green)**: implement `types/plan.ts`, `OccurrenceItem.tsx`, `PlannerGrid.tsx`,
`BucketList.tsx`, and `WeeklyPlanner.tsx` as specified above until every sketch above (and the
remaining ACs not sketched: AC-06, AC-07, AC-10, AC-13, AC-22) passes. AC-22 is verified by a
real-browser pass in both Light and Dark, per `frontend_conventions.md`'s Testing Strategy note.

## Acceptance Criteria Summary

- [x] FRONTEND-008-AC-01 — at-rest tile hides Move/Move to bucket/Remove/Carry forward
- [x] FRONTEND-008-AC-02 — activating the name control calls `onOpenDetail`
- [x] FRONTEND-008-AC-03 — open card renders Move and Remove
- [x] FRONTEND-008-AC-04 — grid item's open card additionally renders Move to bucket
- [x] FRONTEND-008-AC-05 — bucket item's open card additionally renders Carry forward
- [x] FRONTEND-008-AC-06 — Remove inside the card enters the existing inline confirm sub-state
- [x] FRONTEND-008-AC-07 — Move inside the card enters the existing day/slot-select sub-state
- [x] FRONTEND-008-AC-08 — an open card renders a Close control with no side effect
- [x] FRONTEND-008-AC-09 — re-activating the name while open closes the card (toggle)
- [x] FRONTEND-008-AC-10 — at most one occurrence's card open at a time
- [x] FRONTEND-008-AC-11 — opening a different card clears a stale move/remove sub-state
- [x] FRONTEND-008-AC-12 — Complete/Undo works regardless of card open/closed state
- [x] FRONTEND-008-AC-13 — `PlannedOccurrence.parentActivityName` type field added
- [x] FRONTEND-008-AC-14 — parent activity name shown for a sub-task occurrence when present
- [x] FRONTEND-008-AC-15 — parent activity name never shown for a whole-activity occurrence
- [x] FRONTEND-008-AC-16 — completion icon with accessible name "Completed" when completed
- [x] FRONTEND-008-AC-17 — no completion indicator when not completed
- [x] FRONTEND-008-AC-18 — today's weekday highlighted during the current week (day-columns: column; day-rows: section — amended by `frontend_spec_012`)
- [x] FRONTEND-008-AC-19 — no highlight when viewing a past/future week, in either layout
- [x] FRONTEND-008-AC-20 — no highlight when today is a Saturday/Sunday, in either layout
- [x] FRONTEND-008-AC-21 — today-column check reuses `getMondayOfCurrentWeek()`, no second helper
- [x] FRONTEND-008-AC-22 — highlight visually distinguishable in Light and Dark (real-browser check)
