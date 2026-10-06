# Item Count on Busy Weekly Planner Slots

**Status**: Not started
**Priority**: P3 — small scannability polish
**Depends on**: `frontend_spec_004_week_planning.md` (`PlannerGrid`'s original slot rendering),
`frontend_spec_012_grid_orientation_toggle.md` (both grid orientations this spec must cover)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 (Weekly Planner)

## Overview

Raised by the user 2026-10-06 during a V1 ideas review, prompted by a real slot (Monday evening)
holding 4 stacked items with nothing but a bare "EVENING" header above them — you have to read the
whole stack to know how full it is. This adds a count to a slot's header once it holds more than one
item, e.g. "Evening (4)".

**Deliberately diverges from the existing `Show sub-tasks (N)` convention** (`ActivityBank.tsx`/
`ActivityPickerList.tsx`), which shows a count starting at 1, not just when there's more than one —
that convention exists because sub-tasks are *collapsed/hidden* until expanded, so the count conveys
information about content you can't currently see. A grid slot's items are already fully visible in
the list beneath the header — a count at `(1)` would be redundant with what's already on screen.
This spec only adds the count once there's enough items that counting them by eye stops being
instant, i.e. more than one.

`PlannerGrid.tsx`'s `renderCell` function is called from both of this app's grid orientations (day-
columns and day-rows, per `frontend_spec_012`) and is shared by both the Weekly Planner and Today
view (both render `<PlannerGrid>`) — one change to this single function covers all four surfaces.

**Out of scope**: the weekend bucket list (`BucketList.tsx`) — it has a single flat heading
("Weekend bucket list"), not per-slot MORNING/AFTERNOON/EVENING headers, so this spec's "per-slot
count" concept doesn't map onto it the same way; adding a count to that one heading, if wanted, is a
separate, simpler change this spec doesn't cover.

## Requirement 1: A slot header shows its item count once it holds more than one item

**User story**: As a user looking at my week, I want to tell at a glance which slots are busy
without reading every row, especially on a day with several things stacked into one slot.

### FRONTEND-052-AC-01 [AUTO]: Slot label includes a count when the slot holds more than one item
**Statement**: When a day/slot cell holds more than one occurrence, `PlannerGrid` shall render that
slot's label as `"{Slot} ({count})"` (e.g. `"Evening (4)"`) instead of the bare slot name.

**References**: `components/WeeklyPlanner/PlannerGrid.tsx`'s `renderCell` — `cellOccurrences.length`
is already computed; append the count to the existing `<span className={styles.slotLabel}>`
content when `cellOccurrences.length > 1`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-052-AC-01: slot label shows a count when it holds more than one item', () => {
  it('renders "Evening (4)" for a slot with four occurrences', () => {
    const occurrences = [
      plannedOccurrence({ id: '1', dayOfWeek: 'MONDAY', slot: 'EVENING' }),
      plannedOccurrence({ id: '2', dayOfWeek: 'MONDAY', slot: 'EVENING' }),
      plannedOccurrence({ id: '3', dayOfWeek: 'MONDAY', slot: 'EVENING' }),
      plannedOccurrence({ id: '4', dayOfWeek: 'MONDAY', slot: 'EVENING' }),
    ]
    render(<PlannerGrid {...baseProps({ occurrences })} />)

    expect(screen.getByText('Evening (4)')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement the conditional count as described in References.

### FRONTEND-052-AC-02 [AUTO]: No count shown for an empty or single-item slot
**Statement**: When a day/slot cell holds zero or exactly one occurrence, `PlannerGrid` shall render
the bare slot label with no count, unchanged from today.

**Rationale**: Regression guard — confirms the `> 1` threshold, not `> 0`, matching this spec's
deliberate divergence from the sub-task-count convention (see Overview).

**Test Case (Red)**:
```typescript
describe('FRONTEND-052-AC-02: no count for an empty or single-item slot', () => {
  it('renders the bare label for zero items', () => {
    render(<PlannerGrid {...baseProps({ occurrences: [] })} />)
    expect(screen.getByText('Morning')).toBeInTheDocument()
  })

  it('renders the bare label for exactly one item', () => {
    const occurrences = [plannedOccurrence({ id: '1', dayOfWeek: 'MONDAY', slot: 'MORNING' })]
    render(<PlannerGrid {...baseProps({ occurrences })} />)
    expect(screen.getByText('Morning')).toBeInTheDocument()
    expect(screen.queryByText(/morning \(/i)).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: the `> 1` conditional from AC-01 already satisfies this.

### FRONTEND-052-AC-03 [AUTO]: The count applies in both grid orientations
**Statement**: The slot-count label shall render identically regardless of which weekly grid
orientation (`frontend_spec_012_grid_orientation_toggle.md`'s "days across the top" vs. "each day as
its own section") is active.

**Rationale**: `renderCell` is one shared function called from both orientation branches — this AC
exists as an explicit regression guard confirming that stays true for this change, not because
separate implementations are expected.

**Test Case (Green)**: extend `PlannerGrid.test.tsx`'s existing per-orientation describe blocks
(`FRONTEND-012-AC-07`/`AC-09`-style) with the same busy-slot fixture from AC-01, asserting the count
renders under both orientations.

## Cross-references

| Reference | What it provides |
|---|---|
| `components/WeeklyPlanner/PlannerGrid.tsx` | AC-01/02/03 target — single shared `renderCell` function |
| `components/WeeklyPlanner/WeeklyPlanner.tsx`, `TodayView.tsx` | Both render `<PlannerGrid>` — covered automatically, no separate change needed |
| `utils/planLabels.ts` | `SLOT_LABELS` — unchanged, count is appended alongside it, not baked into it |
| `frontend_spec_012_grid_orientation_toggle.md` | Both orientations this spec must cover |

## Acceptance Criteria Summary

- [ ] FRONTEND-052-AC-01 — slot label shows "(N)" when it holds more than one item
- [ ] FRONTEND-052-AC-02 — no count shown for zero or one item (regression guard)
- [ ] FRONTEND-052-AC-03 — count applies identically in both grid orientations
