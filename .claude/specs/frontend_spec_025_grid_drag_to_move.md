# Drag a Grid Occurrence to a Different Slot (Weekly Planner)

**Status**: Implemented (2026-10-02)
**Priority**: P3 — interaction speed-up, no new capability (the move itself already exists via
"Rearrange")
**Depends on**: `planner_spec_004_week_planning.md`/`frontend_spec_004_week_planning.md` (the
`PATCH /api/v1/plan/occurrences/{id}` move endpoint and the existing "Rearrange" flow this
supplements), `frontend_spec_008_occurrence_detail_card.md` (the decluttered-at-rest tile this
spec's whole-tile-draggable decision responds to), `frontend_spec_010_bucket_reordering.md`
(precedent for a component-local HTML5 drag-and-drop implementation this one mirrors),
`frontend_spec_015_weekday_weekend_grid_tabs.md` (the Weekdays/Weekend tab split that makes "only
within the current view" automatic)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V2-ish polish — not tied to a specific `HIGH_LEVEL_DESIGN.md` version theme;
raised as half of a deferred V1-planning idea, see Overview

## Summary

Implemented exactly as scoped: `OccurrenceItem`'s root `<li>` is now `draggable` and fires the
existing `onDragStart` prop when `isBucketItem={false}`, reusing the same prop `BucketList` already
wires to its grip handle; bucket items are unchanged. `PlannerGrid` gained its own local `draggedId`
state (mirroring `BucketList`'s pattern) plus `onDragOver`/`onDrop` on each day/slot cell `<div>`,
looking up the dragged occurrence's current day/slot from its own `occurrences` prop before deciding
whether to call the existing `onConfirmMove`. No changes to `WeeklyPlanner.tsx` or the backend were
needed, confirming the spec's zero-new-plumbing assumption. All AUTO ACs (01, 04–09) are covered by
Vitest/RTL tests and pass; `npm test` (338/338) and `npm run lint` (oxlint, 0 findings) are green.

**Real findings**:
- A new `onDragEnd?: () => void` prop was added to `OccurrenceItem` (not mentioned in the spec's
  cross-reference table) so `PlannerGrid` can reset its local `draggedId` to `null` when a drag ends
  without a valid drop (AC-07's "reset cleanly" clause) — wired only for grid items (`!isBucketItem`),
  mirroring the existing `onDragStart` gating. The AC-07 test sketch as written only asserts
  `onConfirmMove` wasn't called (already true with no reset at all, since a stale `draggedId` is
  overwritten by the next `dragstart`), but the AC's prose statement explicitly requires the reset,
  so it was implemented for correctness beyond the literal test sketch.
- `OccurrenceItem.test.tsx`'s pre-existing `FRONTEND-010-AC-16` test asserted
  `document.querySelector('[draggable="true"]')` is `null` for a grid item — this is now true-false
  (the root `<li>` is draggable) by this spec's own AC-01, so the assertion was narrowed to target
  the dedicated grip-handle element (`.dragHandle`) specifically, which is what that AC's prose
  ("neither a drag handle nor Move up/Move down controls") was actually guarding. No other existing
  test needed changes.
- AC-02/AC-03 completed afterward with a real-browser pass (Claude in Chrome, against the local dev
  stack, logged in as the seeded user): confirmed `cursor: grab` + `draggable="true"` on a grid tile
  via `getComputedStyle`, confirmed a plain click on the tile still opens its detail card correctly
  (AC-02), and went further than the two ACs strictly require — dispatched a real `dragstart`/
  `dragover`/`drop`/`dragend` sequence (via `DragEvent`/`DataTransfer`, since synthetic mouse-drag
  via browser automation doesn't trigger native HTML5 DnD) against the live app and confirmed the
  occurrence actually moved via a real `PATCH /api/v1/plan/occurrences/{id}` call, the moved tile's
  detail card still opened correctly afterward, and "Rearrange" still worked to move it back — full
  end-to-end confirmation beyond what AC-02/AC-03's own wording required, not just the isolated
  cursor/click checks.

## Overview

This specs out one half of the `.claude/ideas/future_ideas.md` entry "Drag-and-drop in the week
planner (assignment, not reordering)", split during a scoping conversation on 2026-10-01. The
other half — a persistent, filterable sidebar/drawer of activities (possibly with a new
"favourites" concept) to drag-*assign* unplanned activities onto the grid — remains an open,
not-yet-specced idea in `future_ideas.md`; it is **not** part of this spec.

This spec is narrower and already fully supported by existing backend/API surface: let the user
drag an **already-planned** grid occurrence directly onto a **different cell within the currently
visible grid** to move it there — a faster, mouse-only alternative to the existing "Rearrange"
flow (`OccurrenceItem.tsx`'s day/slot dropdown + "Confirm rearrange" button), not a replacement
for it.

**Scope, exactly as confirmed by the user**: "user can drag already planned items to another slot
in the CURRENT view, so if a Weekdays view is open, user can only drag to another slot in the
current weekdays view — not to another week or a weekend. Any other moving would be done with the
current functionality." Concretely:
- In scope: dragging a grid-scheduled occurrence from one day/slot cell to a different day/slot
  cell, both within the grid currently rendered (Weekdays grid *or* Weekend grid, whichever tab is
  active).
- Out of scope, unchanged, still done via existing click-based actions: dragging onto/from the
  weekend bucket list (`BucketList.tsx` — "Move to bucket", "Carry forward", and "Rearrange" into a
  bucket item already cover this); moving to a different week; the sidebar/drawer assign-by-drag
  idea mentioned above; touch/mobile drag support.

**Why zero backend changes are needed**: moving an occurrence to a new day/slot already has a
fully-built, already-used code path. `WeeklyPlanner.tsx` passes
`onConfirmMove={(id, dayOfWeek, slot) => handleMove(id, { dayOfWeek, slot })}` into `PlannerGrid`,
which calls `planApi.move()` → `PATCH /api/v1/plan/occurrences/{id}` (`API.md`: body
`{dayOfWeek, slot}`, both-set reschedules to that day/slot, 200 with the updated occurrence) — the
exact endpoint the existing "Rearrange" UI already calls. This spec is a new, faster *trigger path*
to that same call, not a new capability. `PlannerGrid` already receives `onConfirmMove`, `busyId`,
and `occurrences` as props — no new prop needs to flow down from `WeeklyPlanner.tsx` at all.

**Why "only within the current view" needs no extra guard logic**: `WeeklyPlanner.tsx` renders
exactly one `PlannerGrid` instance at a time, with `days={gridTab === 'WEEKDAYS' ? WEEKDAY_DAYS :
WEEKEND_DAYS}` — the inactive tab's cells simply aren't mounted. This falls out of the component
boundary for free, the same way `BucketList`'s already-built drag-to-reorder
(`frontend_spec_010_bucket_reordering.md`) can't interfere with grid dragging: each component
manages its own local `draggedId` React state (not the native `DataTransfer` payload), fully scoped
to its own instance. A drag that starts in `PlannerGrid` and ends over `BucketList` (or vice versa)
simply never fires the other component's drop handler — there is no shared state for it to
corrupt.

**Judgment call, flagged explicitly — whole-tile-draggable, not a dedicated grip handle**:
`BucketList`'s drag-to-reorder uses a persistent, always-visible grip-handle icon (`GripIcon`,
rendered only when `isBucketItem`) as the drag source, separate from the row's click-to-open-detail
target. This spec deliberately does **not** copy that pattern for grid tiles. Reasoning: (a) grid
cells are narrower (`grid-template-columns: repeat(var(--day-count), minmax(8rem, 1fr))`, ~8rem/
128px) and grid tiles were deliberately decluttered at rest by `frontend_spec_008_occurrence_detail_card.md`
— re-adding a persistent icon would undo that; (b) the native HTML5 drag threshold (a few pixels of
pointer movement before `dragstart` fires) already distinguishes an intentional drag from a plain
click, so making the whole at-rest tile `draggable` doesn't break the existing click-to-open-detail
behavior (`handleNameClick`); (c) this mirrors how calendar UIs (Google Calendar, Outlook) let you
drag an event block directly with no separate handle. **This is a judgment call, not a settled
decision** — redirect if a visible handle is actually preferred.

**Accessibility story**: no new keyboard-accessible equivalent is built for this gesture, because
the existing "Rearrange" flow (`onStartMove`/`onCancelMove`/`onConfirmMove`/`movingId`, already
fully keyboard-operable) *is* the equivalent action — same underlying move, a different trigger.
Drag-and-drop here is a mouse-only speed-up layered on top of an already-accessible path, not a
replacement for it (matching this project's explicit confirmation that existing functionality for
other moves stays exactly as-is).

## Requirement 1: A grid-scheduled occurrence's tile is a drag source

**User story**: As a user looking at my Weekly Planner grid, I want to pick up a planned activity
tile and drag it directly onto a different day/slot, so I don't have to open its detail card and
use the Rearrange dropdown for a move I can already see the destination for.

### FRONTEND-025-AC-01 [AUTO]: Grid tiles are draggable; bucket tiles are unaffected
**Statement**: Where an `OccurrenceItem` is grid-scheduled (`isBucketItem={false}`), its root `<li>`
shall carry the `draggable` attribute and fire the existing `onDragStart?.(occurrence.id)` callback
on `dragstart`. Where an `OccurrenceItem` is a bucket item (`isBucketItem={true}`), its existing
grip-handle-based drag source (`frontend_spec_010`) shall be unchanged — the root `<li>` itself
shall not additionally become draggable.

**Rationale**: Reuses the existing `onDragStart?: (id: string) => void` prop already defined on
`OccurrenceItem` (currently only wired by `BucketList`'s grip handle) rather than inventing a new
one — same semantic ("the user started dragging this occurrence"), new trigger element only.

**References**:
- Component: `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` (existing `onDragStart`
  prop, existing `isBucketItem`-gated `<li onDragOver=... onDrop=...>` wiring)

### FRONTEND-025-AC-02 [MANUAL]: Dragging doesn't break click-to-open-detail
**Statement**: When the user clicks a grid tile's name (a plain click, no pointer movement past the
native drag threshold), `OccurrenceItem` shall still call `onOpenDetail`/`onCloseDetail` exactly as
it does today, unaffected by the tile also being `draggable`.

**Rationale**: `[MANUAL]` because jsdom's `fireEvent.click` doesn't model the browser's native
drag-threshold distinction between a click and a drag-start — a real-browser check (per this
project's Definition of Done for UI changes) is the honest way to verify this, not a forced jsdom
assertion that can't actually exercise the behavior being verified.

**References**: Component: `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx`
(`handleNameClick`)

### FRONTEND-025-AC-03 [MANUAL]: Dragging shows a grab cursor, no new icon or button
**Statement**: While hovering a grid tile at rest, the cursor shall indicate it is draggable (e.g.
`cursor: grab`, switching to `grabbing` during an active drag) — no new persistent icon, button, or
other visible element shall be added to the at-rest tile.

**Rationale**: `[MANUAL]` — a CSS cursor affordance has no meaningful jsdom assertion (jsdom doesn't
render or compute cursor styles); verified by a real-browser visual check instead, consistent with
this project's established jsdom-can't-validate-CSS caveat.

**References**: Component: `frontend/src/components/WeeklyPlanner/OccurrenceItem.module.css`

## Requirement 2: Grid cells are valid drop targets that trigger the existing move

**User story**: As a user dragging a planned activity tile, I want to drop it on a different
day/slot in the same grid and have it actually move there, so drag-and-drop is a real shortcut for
"Rearrange", not just a visual gesture with no effect.

### FRONTEND-025-AC-04 [AUTO]: Dropping on a different cell calls the existing onConfirmMove
**Statement**: When a dragged occurrence is dropped on a `PlannerGrid` cell whose day and/or slot
differs from the occurrence's current `dayOfWeek`/`slot`, `PlannerGrid` shall call its existing
`onConfirmMove(id, newDayOfWeek, newSlot)` prop with the dropped cell's day and slot.

**Rationale**: This is the exact same prop `PlannerGrid` already receives and already uses for the
"Rearrange" confirm button — drag-and-drop is a new trigger path to it, not a new code path to the
API.

**References**:
- Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` (existing `onConfirmMove`
  prop, cell `<div className={cellClassName(...)}>` per day/slot)
- Endpoint: `PATCH /api/v1/plan/occurrences/{id}` (`API.md`)
- Service: `frontend/src/services/planApi.ts`'s `move()`, called by `WeeklyPlanner.tsx`'s
  `handleMove`

### FRONTEND-025-AC-05 [AUTO]: Dropping on the occurrence's own current cell is a no-op
**Statement**: When a dragged occurrence is dropped on the `PlannerGrid` cell matching its own
current `dayOfWeek`/`slot`, `PlannerGrid` shall not call `onConfirmMove` and shall leave
`occurrences` unchanged.

**Rationale**: Avoids a wasted `PATCH` call and spurious busy/loading state for a move that changes
nothing. `PlannerGrid` already receives the full `occurrences` list and can look up the dragged
occurrence's current day/slot by id before deciding whether to call `onConfirmMove`.

**References**: Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx`

### FRONTEND-025-AC-06 [AUTO]: Dropping on an already-occupied cell succeeds normally
**Statement**: When a dragged occurrence is dropped on a `PlannerGrid` cell that already contains
one or more other occurrences, `PlannerGrid` shall call `onConfirmMove` the same as for an empty
target cell — no occupancy or collision check shall be introduced.

**Rationale**: Grid cells already support holding multiple occurrences via the existing "Add" and
"Rearrange" flows, with no collision check anywhere in the current implementation — drag-and-drop
must not become stricter than the flows it supplements.

**References**: Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` (`cellOccurrences`
filtering, already renders a `<ul>` of potentially multiple `OccurrenceItem`s per cell)

### FRONTEND-025-AC-07 [AUTO]: A drag that ends outside any grid cell changes nothing
**Statement**: When a drag started on a grid tile ends (`dragend`) without a valid drop onto any
`PlannerGrid` cell, `PlannerGrid` shall leave `occurrences` unchanged and shall reset its internal
drag-tracking state so a subsequent drag starts cleanly.

**References**: Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx`

### FRONTEND-025-AC-08 [AUTO]: A move in flight blocks a new drag-and-drop move
**Statement**: While `busyId` is non-null (another action already in flight — an existing prop
`PlannerGrid` already receives), dropping a dragged occurrence onto a cell shall not call
`onConfirmMove`.

**Rationale**: Reuses the same in-flight gating already applied to other actions in this component
tree (e.g. `WeeklyPlanner.tsx`'s `handleMove` sets `busyId` for the duration of its `planApi.move()`
call) — prevents overlapping moves from racing.

**References**: Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` (existing
`busyId` prop)

## Requirement 3: Existing click-based move functionality is unchanged

**User story**: As a user who prefers clicking over dragging (or is on a touch device, or using a
keyboard), I want "Rearrange" to keep working exactly as it does today, so this new gesture is
purely additive.

### FRONTEND-025-AC-09 [AUTO]: Rearrange, Move to bucket, and Carry forward are unaffected
**Statement**: The existing `onStartMove`/`onCancelMove`/`onConfirmMove`/`movingId`-driven
"Rearrange" flow, `onMoveToBucket`, and `onCarryForward` shall continue to function exactly as
before this spec's changes, for both grid and bucket occurrences.

**Rationale**: Explicit regression guard — this spec confirms drag-and-drop supplements rather than
replaces the existing move flow, per the user's own confirmation during scoping.

**References**: Component: `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx`,
`frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx`

## Explicitly out of scope (do not implement as part of this spec)

- Dragging a grid occurrence onto the weekend bucket list, or a bucket item onto a grid cell —
  existing "Move to bucket"/"Carry forward"/"Rearrange" cover these, unchanged.
- Dragging to a different week (not visible in the current grid, no mechanism to target it).
- Touch/mobile drag support — native HTML5 Drag and Drop has no touch support without a polyfill,
  the same accepted limitation already logged in `.claude/SPEC_CANDIDATES.md`'s "Touch-friendly
  weekend bucket list reordering" entry. Not re-litigated here; the existing "Rearrange" flow
  remains the touch-accessible path.
- The sidebar/drawer "assign an unplanned activity by dragging it onto the grid" idea (possibly with
  a new "favourites" concept) — remains an open, not-yet-specced idea in
  `.claude/ideas/future_ideas.md`.

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` | Drop-target cells; owns the new local drag-tracking state |
| `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` | Drag source (`onDragStart` prop, already defined); `handleNameClick` (unaffected) |
| `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` | Already supplies `onConfirmMove`, `busyId`, `occurrences` to `PlannerGrid` — no new prop needed |
| `frontend/src/services/planApi.ts` | `move()` → `PATCH /api/v1/plan/occurrences/{id}` |
| `API.md` | The move endpoint's contract (body `{dayOfWeek, slot}`, both-set reschedules) |
| `frontend_spec_010_bucket_reordering.md` | Precedent for a component-local HTML5 DnD implementation |
| `frontend_spec_008_occurrence_detail_card.md` | The decluttered-at-rest tile this spec's whole-tile-draggable call responds to |
| `.claude/SPEC_CANDIDATES.md` | Touch-DnD limitation already logged there, not re-litigated here |
| `.claude/ideas/future_ideas.md` | The other, not-yet-specced half of the original idea (sidebar assign-by-drag) |

## TDD test case sketches

### FRONTEND-025-AC-01
```typescript
describe('FRONTEND-025-AC-01: grid tiles are draggable, bucket tiles unaffected', () => {
  it('renders draggable=true on a grid-scheduled occurrence row', () => {
    render(<OccurrenceItem occurrence={gridOccurrence} isBucketItem={false} {...requiredProps} />)
    expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'true')
  })

  it('calls onDragStart with the occurrence id when a grid tile starts dragging', () => {
    const onDragStart = vi.fn()
    render(
      <OccurrenceItem occurrence={gridOccurrence} isBucketItem={false} onDragStart={onDragStart} {...requiredProps} />,
    )
    fireEvent.dragStart(screen.getByRole('listitem'))
    expect(onDragStart).toHaveBeenCalledWith(gridOccurrence.id)
  })

  it('does not add draggable to the bucket item row itself (handle stays the drag source)', () => {
    render(<OccurrenceItem occurrence={bucketOccurrence} isBucketItem onDragStart={vi.fn()} {...requiredProps} />)
    expect(screen.getByRole('listitem')).not.toHaveAttribute('draggable', 'true')
  })
})
```

### FRONTEND-025-AC-04 / AC-05 / AC-06 / AC-07 / AC-08
```typescript
describe('FRONTEND-025: PlannerGrid drag-to-move', () => {
  it('AC-04: calls onConfirmMove with the dropped cell\'s day/slot', () => {
    const onConfirmMove = vi.fn()
    render(<PlannerGrid occurrences={[occurrenceOnMonMorning]} onConfirmMove={onConfirmMove} {...requiredProps} />)
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    const targetCell = screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!
    fireEvent.dragStart(sourceTile)
    fireEvent.dragOver(targetCell)
    fireEvent.drop(targetCell)
    expect(onConfirmMove).toHaveBeenCalledWith(occurrenceOnMonMorning.id, 'TUESDAY', 'AFTERNOON')
  })

  it('AC-05: does not call onConfirmMove when dropped back on its own cell', () => {
    const onConfirmMove = vi.fn()
    render(<PlannerGrid occurrences={[occurrenceOnMonMorning]} onConfirmMove={onConfirmMove} {...requiredProps} />)
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    const ownCell = screen.getByLabelText('Add to Monday Morning').closest('div')!
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(ownCell)
    expect(onConfirmMove).not.toHaveBeenCalled()
  })

  it('AC-06: calls onConfirmMove when the target cell already has an occurrence', () => {
    const onConfirmMove = vi.fn()
    render(
      <PlannerGrid
        occurrences={[occurrenceOnMonMorning, occurrenceOnTueAfternoon]}
        onConfirmMove={onConfirmMove}
        {...requiredProps}
      />,
    )
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    const occupiedCell = screen.getByText(occurrenceOnTueAfternoon.name).closest('div')!
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(occupiedCell)
    expect(onConfirmMove).toHaveBeenCalledWith(occurrenceOnMonMorning.id, 'TUESDAY', 'AFTERNOON')
  })

  it('AC-07: a dragend with no drop leaves occurrences unchanged and resets cleanly', () => {
    const onConfirmMove = vi.fn()
    render(<PlannerGrid occurrences={[occurrenceOnMonMorning]} onConfirmMove={onConfirmMove} {...requiredProps} />)
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    fireEvent.dragStart(sourceTile)
    fireEvent.dragEnd(sourceTile)
    expect(onConfirmMove).not.toHaveBeenCalled()
  })

  it('AC-08: a drop while busyId is set does not call onConfirmMove', () => {
    const onConfirmMove = vi.fn()
    render(
      <PlannerGrid occurrences={[occurrenceOnMonMorning]} busyId={occurrenceOnMonMorning.id} onConfirmMove={onConfirmMove} {...requiredProps} />,
    )
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    const targetCell = screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(targetCell)
    expect(onConfirmMove).not.toHaveBeenCalled()
  })
})
```

### FRONTEND-025-AC-09
```typescript
describe('FRONTEND-025-AC-09: existing move flows unaffected', () => {
  it('Rearrange dropdown + confirm still calls onConfirmMove as before', () => {
    // Exercises the pre-existing onStartMove -> pick day/slot -> onConfirmMove path unchanged;
    // regression guard only, no new behavior under test.
  })
})
```

## Acceptance Criteria Summary

- [x] FRONTEND-025-AC-01 — grid tiles draggable via existing `onDragStart` prop; bucket tiles unaffected
- [x] FRONTEND-025-AC-02 — dragging doesn't break click-to-open-detail (confirmed in a real browser)
- [x] FRONTEND-025-AC-03 — grab cursor affordance, no new icon/button (confirmed in a real browser)
- [x] FRONTEND-025-AC-04 — dropping on a different cell calls the existing `onConfirmMove`
- [x] FRONTEND-025-AC-05 — dropping on the occurrence's own cell is a no-op
- [x] FRONTEND-025-AC-06 — dropping on an already-occupied cell succeeds normally
- [x] FRONTEND-025-AC-07 — a drag ending outside any cell changes nothing, resets cleanly
- [x] FRONTEND-025-AC-08 — a move in flight (`busyId` set) blocks a new drag-and-drop move
- [x] FRONTEND-025-AC-09 — Rearrange/Move to bucket/Carry forward unaffected
