# Drag-and-Drop Between the Grid and the Weekend Bucket List

**Status**: Implemented (2026-10-02) — all ACs implemented, test-covered, and (AC-04) verified in a
real browser
**Priority**: P3 — interaction speed-up, no new capability (both moves already exist via "Send to
bucket" and "Rearrange")
**Depends on**: `frontend_spec_025_grid_drag_to_move.md` (the grid-internal drag-to-move this
extends across a section boundary; precedent for whole-tile-draggable, AC numbering, and test-sketch
style), `frontend_spec_010_bucket_reordering.md` (the existing bucket-internal drag-to-reorder this
must not regress), `frontend_spec_004_week_planning.md` (the underlying move/send-to-bucket endpoint
and existing "Rearrange"/"Send to bucket" UI this supplements), `frontend_spec_008_occurrence_detail_card.md`
(the detail card housing "Send to bucket"/"Rearrange" this is a faster trigger path to)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V2-ish polish — not tied to a specific `HIGH_LEVEL_DESIGN.md` version theme;
the third and final piece of a deferred V1-planning idea, see Overview

## Summary

Implemented exactly as scoped in the Overview's architecture decision: `draggedId` was lifted out
of `PlannerGrid.tsx` and `BucketList.tsx`'s own local `useState` calls into `WeeklyPlanner.tsx` as a
single `draggedId`/`setDraggedId` pair, passed to both components as `draggedId`/`onDragStart`/
`onDragEnd` props. `PlannerGrid.tsx` needed no new drop logic beyond the state lift itself — its
existing `handleDrop` already worked for a bucket-origin drag once `draggedId` was shared, confirmed
by `FRONTEND-026-AC-05`'s test. `BucketList.tsx` gained the two additions the Overview called out: a
new `onMoveToBucket` prop plus a panel-level `onDragOver`/`onDrop` on the `<section>` itself
(`handlePanelDrop`), and an `idsInOrder.includes(draggedId)` guard in the existing per-item
`handleDrop` that routes a not-yet-bucketed id to `onMoveToBucket` instead of splicing it into a
reorder. `OccurrenceItem.tsx`'s bucket drag handle now also wires `onDragEnd` (previously only wired
for grid items), closing the drag-end reset gap described in the Overview. `onDragStart`/`onDragEnd`
prop *signatures* on `OccurrenceItem` are unchanged, as the architecture decision required — only
their wiring at the `PlannerGrid`/`BucketList` level changed.

`npm test` (353/353 across all 30 test files — one new file, `CrossSectionDrag.test.tsx`, plus
`PlannerGrid.test.tsx`/`BucketList.test.tsx`/`OccurrenceItem.test.tsx` extended with new/updated
cases) and `npm run lint` (oxlint, 0 findings) are both green. `npm run build` (`tsc -b && vite
build`) also succeeds with no type errors.

**Real findings**:
- **A drop on an existing bucket item would have double-fired without an explicit
  `stopPropagation()`.** Once the bucket panel's `<section>` got its own `onDrop` handler
  (`handlePanelDrop`), a drop landing on a per-item `<li>` (which has its own `onDrop`) would bubble
  up to the section and fire both handlers — e.g. `onMoveToBucket` would have been called twice for
  the `FRONTEND-026-AC-03` case (once correctly from the item handler, once again from the bubbled
  panel handler). Fixed by adding `event.stopPropagation()` to `OccurrenceItem.tsx`'s bucket-item
  `onDrop` wiring. This wasn't called out explicitly in the spec's Overview/cross-reference table,
  but follows directly from adding a second, nested drop target over the same DOM subtree.
- **`busyId` gating was deliberately scoped to only the two new cross-section `onMoveToBucket` call
  sites, not the pre-existing same-bucket `onReorder` path.** `FRONTEND-026-AC-06`'s statement is
  specific to "`onMoveToBucket` or `onConfirmMove`"; the existing `frontend_spec_010` drag-to-reorder
  path was never gated by `busyId` (it has its own separate `reorderInFlight` flag, driven by
  `WeeklyPlanner.tsx`'s `bucketReorderInFlight`), and gating it now would have been unrequested scope
  creep beyond this spec's stated boundary of "this spec adds a faster drag-based trigger path to
  moves that already exist; it does not replace or alter the existing click-based paths" (and, by the
  same logic, shouldn't alter the existing drag-based reorder path's gating either).
- **Test harnesses needed, not anticipated as literal code in the spec's test sketches.** The
  sketches reference an unparented `WeeklyPlannerHarness` and bare `onMoveToBucket`/`onConfirmMove`
  spies without showing how they're wired to a rendered tree. Implemented as: (1) a
  `WeeklyPlannerHarness` in a new `CrossSectionDrag.test.tsx`, mounting real `PlannerGrid` +
  `BucketList` side by side with a local `useState` mirroring `WeeklyPlanner.tsx`'s exact lift (used
  for the genuinely cross-component ACs — 01, 02, 03, 05, 06, 07 — since e.g. `AC-05`'s bucket drag
  handle only exists inside `BucketList`, not `PlannerGrid`, so a bucket-to-grid drop test structurally
  needs both mounted); and (2) lighter `DraggableGridHarness`/`DraggableBucketHarness` wrappers added
  to each component's own existing test file, used only to keep the pre-existing `frontend_spec_025`/
  `frontend_spec_010` drag tests exercising real `dragstart`→`drop` behavior now that `draggedId` is a
  controlled prop rather than local state (previously the component's own `useState` picked this up
  for free). `BucketList.tsx`'s own new-logic tests (`AC-02`/`AC-03`/`AC-06` bucket-side) pass
  `draggedId` directly as a static prop instead, since those are pure unit tests of `BucketList`'s own
  guard logic and don't need a real drag gesture or a mounted `PlannerGrid`.
- `FRONTEND-026-AC-04` verified in a real browser (Claude in Chrome, against the local dev stack,
  logged in as the seeded user): `getComputedStyle` on a grid tile and on a bucket item's drag
  handle both report `cursor: grab`, confirming no new, section-specific visual drag-affordance was
  introduced. Went further than AC-04 strictly requires: dispatched real `dragstart`/`dragover`/
  `drop`/`dragend` sequences (via `DragEvent`/`DataTransfer`, since synthetic mouse-drag via browser
  automation doesn't trigger native HTML5 DnD — same limitation `frontend_spec_025` hit) in both
  directions against the live app, confirmed real `PATCH /api/v1/plan/occurrences/{id}` calls fired
  (200, correct body each time) and the occurrence visibly moved — a grid-scheduled "Go for a walk"
  dropped onto the bucket panel appeared in the Weekend bucket list; a bucket "Apply for jobs"
  dropped onto a grid cell appeared on that exact day/slot. One timing finding along the way: the
  first attempt dispatched all four drag events back-to-back with no delay and silently did nothing
  — React hadn't flushed the `dragstart`-triggered `setDraggedId` state update (a continuous-priority
  event) before the `drop` handler's closure read the still-stale `draggedId`. Spacing the dispatched
  events ~100-150ms apart let React flush between them and the drop fired correctly. Not a bug in the
  shipped code — the real pointer-driven drag a user performs always has this much latency between
  `dragstart` and `drop` — but worth recording here since it isn't obvious from reading the component
  code, and would bite anyone else scripting a real-browser drag test against this feature.
- `FRONTEND-026-AC-10` (existing click-based "Send to bucket"/"Rearrange" unaffected) needed no new
  test — it's already covered by the pre-existing `WeeklyPlanner.test.tsx` suite
  (`FRONTEND-004-AC-23`/`AC-24` and surrounding describes), which passed unchanged throughout this
  change with no modification needed.

## Overview

This specs out the drag-and-drop idea explicitly carved out as out-of-scope by
`frontend_spec_025_grid_drag_to_move.md`'s Overview ("Out of scope, unchanged, still done via
existing click-based actions: dragging onto/from the weekend bucket list"). `frontend_spec_025`
covers only dragging a grid-scheduled occurrence to a *different grid cell within the same visible
grid*; `frontend_spec_010_bucket_reordering.md` covers only dragging a bucket occurrence to a
different position *within the bucket list*. This spec is the third, final piece: dragging an
occurrence **between** those two already-visible sections of the same Weekly Planner page.

**Scope**: let the user drag a grid-scheduled occurrence directly onto the weekend bucket list to
demote it (today's equivalent: opening the detail card and clicking "Send to bucket"), and drag a
bucket occurrence directly onto a grid cell to promote it to that day/slot (today's equivalent:
opening the detail card, clicking "Rearrange", picking a day/slot, and confirming). Both are new
*trigger paths* to moves that already exist and already work — this is not a new capability.

**Why zero backend/API changes are needed**: `PATCH /api/v1/plan/occurrences/{id}` (`API.md`) already
handles both directions via the exact same body shape `{ dayOfWeek, slot }` the existing UI already
sends: both `null` demotes the occurrence to the bucket (today's "Send to bucket" button), both set
promotes/reschedules it to that day/slot, including promoting a bucket item into *any* day, not just
Saturday/Sunday (today's "Rearrange" flow). `frontend/src/services/planApi.ts`'s `move()` already
wraps this call, and `WeeklyPlanner.tsx` already has both call sites wired
(`handleMove(id, { dayOfWeek: null, slot: null })` passed to `PlannerGrid` as `onMoveToBucket`;
`handleMove(id, { dayOfWeek, slot })` passed to both `PlannerGrid` and `BucketList` as
`onConfirmMove`). This spec is entirely about giving drag-and-drop a path to those same two calls
across the section boundary — no new endpoint, no new service method, no new `WeeklyPlanner.tsx`
handler.

**Why this needs more than extending either existing drag implementation**: today, `PlannerGrid.tsx`
and `BucketList.tsx` each own a fully independent, component-local `draggedId` `useState` — a drag
that starts in one component is invisible to the other; there is no shared state for a cross-section
drop to read. (This isolation was itself a deliberate, explicitly-flagged design choice in
`frontend_spec_025` — safe for *that* spec's narrower scope, but it is exactly what has to change
for this one.)

**Architecture decision — confirmed, not re-litigated by this spec**: lift the shared drag state up
into `WeeklyPlanner.tsx` (a single `draggedId: string | null` plus its setter), passed down to both
`PlannerGrid` and `BucketList` as a prop, replacing each component's own local `useState`. This was
chosen over an alternative (encoding the dragged occurrence in the native HTML5 `DataTransfer`
payload instead of React state) because it's a smaller, more mechanical change — one `useState` call
moves up one level, the existing `onDragStart`/`onDragEnd` prop *signatures* on `OccurrenceItem` are
unchanged, only their wiring at the parent level changes — versus rewriting both components' drag
plumbing around `DataTransfer` reads/writes.

**What falls out of the state lift for free (grid side)**: `PlannerGrid.tsx`'s existing `handleDrop`
already looks the dragged occurrence up in its full `occurrences` prop (not just its own `scheduled`
subset) and already calls `onConfirmMove(id, targetDay, targetSlot)` whenever the dragged
occurrence's current `dayOfWeek`/`slot` differs from the target cell's — which is unconditionally
true for a bucket-origin occurrence (`null`/`null` can never equal a grid cell's non-null day/slot).
Once `draggedId` is shared, dropping a dragged bucket occurrence onto a grid cell already works
exactly like the existing `frontend_spec_025`-AC-04 case, with no new grid-side logic beyond the
state lift itself.

**What needs real new logic (bucket side)**: `BucketList.tsx` currently has no drop target except
each individual `OccurrenceItem`'s own row (`onDropOnItem`), and that handler unconditionally treats
any drop as a same-bucket reorder — it splices `draggedId` into `idsInOrder` and calls `onReorder`,
which assumes `draggedId` is already a member of the bucket. A grid-origin occurrence is not. Two
additions are needed:
1. A drop target on the bucket panel as a whole (not just existing items) that accepts a
   not-currently-bucketed occurrence and calls a new `onMoveToBucket(id)` prop — the same prop name
   and semantics `PlannerGrid` already has, wired the same way from `WeeklyPlanner.tsx`'s
   existing `handleMove(id, { dayOfWeek: null, slot: null })`. `BucketList` does not currently receive
   this prop; it is new plumbing, not a reuse of an existing one (unlike the grid side).
2. A guard in the existing per-item drop handler: `idsInOrder.includes(draggedId)` — true means
   same-bucket reorder, unchanged behavior (`frontend_spec_010`); false means the dragged occurrence
   is grid-origin, and the drop should call `onMoveToBucket`, not splice into a reorder.

**Judgment call, flagged explicitly — where a grid-origin drop onto an existing bucket item lands**:
when a dragged grid occurrence is dropped directly onto an existing bucket item (case 2 above, not
onto empty panel space), this spec resolves it to the same outcome as dropping anywhere else in the
bucket: call `onMoveToBucket`, landing wherever the backend already places a newly-demoted occurrence
(the same place "Send to bucket" already lands it today — this spec does not change or specify that
placement, since it's pre-existing, unchanged backend behavior). It deliberately does **not** attempt
to insert the dragged occurrence at the hovered item's position — that would require treating a
not-yet-bucketed occurrence as already having a `bucketPosition` to splice by, which it doesn't.
**This is a judgment call, not a settled product decision** — redirect to a true insert-at-position
behavior if landing-at-the-backend-default position feels wrong once this is used.

**Drag-end cleanup gap, fixed as part of this spec**: `OccurrenceItem.tsx` today only wires
`onDragEnd` for grid items (`!isBucketItem` — this is what `frontend_spec_025`-AC-07 covers). A
bucket item's drag handle has no `onDragEnd` at all; `BucketList.tsx`'s own `handleDrop` resets
`draggedId` to `null` after a successful drop, but a bucket-origin drag that ends with no valid drop
anywhere (e.g. released outside both the grid and the bucket) never resets. This was a latent,
harmless gap while drag state was component-local (the next `dragstart` simply overwrites the stale
value) — it stops being harmless once state is shared and read by a second component, so this spec
wires `onDragEnd` for the bucket drag handle too, resetting through the same lifted `WeeklyPlanner.tsx`
handler the grid side already uses.

**Explicitly unchanged**: `frontend_spec_025`'s grid-internal move (dragging within the same visible
grid) and `frontend_spec_010`'s bucket-internal reorder (dragging within the bucket list) are both
regression-guarded by this spec, not modified — see Requirement 3.

## Requirement 1: A grid-scheduled occurrence can be dropped onto the bucket list to demote it

**User story**: As a user looking at a planned activity tile in my grid, I want to drag it straight
onto the weekend bucket list, so I don't have to open its detail card and click "Send to bucket" for
a move I can already see the destination for.

### FRONTEND-026-AC-01 [AUTO]: Drag state is shared between `PlannerGrid` and `BucketList`
**Statement**: The `WeeklyPlanner` component shall own a single `draggedId: string | null` piece of
state, passed to both `PlannerGrid` and `BucketList` as props, replacing each component's own
local `draggedId` state.

**Rationale**: The architectural precondition for every other AC in this spec — without shared
state, a drag starting in one section is structurally invisible to the other.

**References**:
- Component: `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` (new `draggedId` state)
- Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` (local `draggedId` `useState`
  removed, becomes a prop)
- Component: `frontend/src/components/WeeklyPlanner/BucketList.tsx` (local `draggedId` `useState`
  removed, becomes a prop)

### FRONTEND-026-AC-02 [AUTO]: Dropping a grid occurrence onto the bucket panel calls `onMoveToBucket`
**Statement**: When a dragged grid-scheduled occurrence is dropped onto the `BucketList` panel
(anywhere that is not an existing bucket item — including the empty-list state), `BucketList` shall
call a new `onMoveToBucket(id)` prop with the dragged occurrence's id.

**Rationale**: New plumbing mirroring `PlannerGrid`'s existing `onMoveToBucket` prop and its existing
`WeeklyPlanner.tsx` wiring (`handleMove(id, { dayOfWeek: null, slot: null })`) — same semantic, new
trigger element.

**References**:
- Component: `frontend/src/components/WeeklyPlanner/BucketList.tsx` (new `onMoveToBucket` prop, new
  panel-level `onDragOver`/`onDrop`)
- Component: `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` (wires
  `onMoveToBucket={(id) => handleMove(id, { dayOfWeek: null, slot: null })}` to `BucketList`,
  mirroring its existing wiring to `PlannerGrid`)
- Endpoint: `PATCH /api/v1/plan/occurrences/{id}` (`API.md`, both-null case)

### FRONTEND-026-AC-03 [AUTO]: Dropping a grid occurrence onto an existing bucket item also demotes it, not reorders
**Statement**: When a dragged occurrence is dropped onto an existing bucket item, and the dragged
occurrence's id is not already present in the bucket's current ordering, `BucketList` shall call
`onMoveToBucket(id)` — the existing same-bucket reorder path (`onReorder`) shall not be invoked.

**Rationale**: Guards the pre-existing per-item drop handler (`frontend_spec_010`), which today
unconditionally assumes any dropped id is already a bucket member. See Overview's "judgment call" on
where the moved occurrence lands.

**References**: Component: `frontend/src/components/WeeklyPlanner/BucketList.tsx` (existing
`handleDrop(targetId)`, new `idsInOrder.includes(draggedId)` guard)

### FRONTEND-026-AC-04 [MANUAL]: Dragging a grid tile toward the bucket shows the same drag affordance as grid-internal drag
**Statement**: While dragging a grid tile, the cursor/visual drag affordance already established by
`frontend_spec_025`-AC-03 shall be unchanged regardless of whether the tile is ultimately dropped on
another grid cell or on the bucket list.

**Rationale**: `[MANUAL]` — a CSS cursor/drag-affordance check has no meaningful jsdom assertion,
consistent with `frontend_spec_025`-AC-03's own justification. This AC exists to confirm no new,
section-specific visual state was accidentally introduced.

**References**: Component: `frontend/src/components/WeeklyPlanner/OccurrenceItem.module.css`

## Requirement 2: A bucket occurrence can be dropped onto a grid cell to promote it

**User story**: As a user looking at an item in my weekend bucket list, I want to drag it straight
onto a day/slot in the grid, so I don't have to open its detail card, click "Rearrange", and pick a
day/slot for a move I can already see the destination for.

### FRONTEND-026-AC-05 [AUTO]: Dropping a bucket occurrence on a grid cell calls the existing `onConfirmMove`
**Statement**: When a dragged bucket occurrence is dropped on a `PlannerGrid` cell, `PlannerGrid`
shall call its existing `onConfirmMove(id, dayOfWeek, slot)` prop with the dropped cell's day and
slot — the same call `frontend_spec_025`-AC-04 already makes for a grid-origin drag, now also
reachable from a bucket-origin drag now that `draggedId` is shared.

**Rationale**: No new grid-side logic is required beyond `FRONTEND-026-AC-01`'s state lift — this AC
exists to pin down and test the cross-section case explicitly, not to describe new code.

**References**:
- Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` (existing `handleDrop`,
  existing `onConfirmMove` prop)
- Endpoint: `PATCH /api/v1/plan/occurrences/{id}` (`API.md`, both-set case, promotes from bucket)

### FRONTEND-026-AC-06 [AUTO]: A move in flight blocks a new cross-section drop
**Statement**: While `busyId` is non-null, dropping a dragged occurrence — in either direction —
shall not call `onMoveToBucket` or `onConfirmMove`.

**Rationale**: Reuses the same in-flight gating `frontend_spec_025`-AC-08 already established for
grid-internal drops; extends it to both new cross-section drop paths so overlapping moves can't race.

**References**:
- Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` (existing `busyId` prop/check)
- Component: `frontend/src/components/WeeklyPlanner/BucketList.tsx` (new `busyId`-aware check in the
  new panel-level drop handler)

## Requirement 3: Drag-end cleanup is shared, and existing drag behaviors are unaffected

**User story**: As a user, I want a drag I abandon (release outside any valid target) to reset
cleanly regardless of where it started, and I want existing grid-internal and bucket-internal
drag-and-drop to keep working exactly as before, so this spec is purely additive.

### FRONTEND-026-AC-07 [AUTO]: A bucket-origin drag that ends without a drop resets shared state
**Statement**: When a drag started on a bucket item's drag handle ends (`dragend`) without a valid
drop onto any `PlannerGrid` cell or the `BucketList` panel, the shared `draggedId` state in
`WeeklyPlanner` shall reset to `null`.

**Rationale**: Closes the pre-existing drag-end gap described in the Overview — today only grid-origin
drags reset on `dragend`; bucket-origin drags rely on a successful drop to reset, which silently
fails to reset on an abandoned drag. Mirrors `frontend_spec_025`-AC-07 for the other direction.

**References**:
- Component: `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` (new `onDragEnd` wiring on
  the bucket drag handle, alongside the existing grid-item wiring)
- Component: `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` (shared reset handler)

### FRONTEND-026-AC-08 [AUTO]: Grid-internal drag-to-move (`frontend_spec_025`) is unaffected
**Statement**: Dragging a grid occurrence and dropping it on a different cell within the same visible
grid shall continue to call `onConfirmMove` exactly as `frontend_spec_025`-AC-04 through AC-08
already specify, unaffected by the `draggedId` state lift.

**Rationale**: Explicit regression guard — the state lift changes *where* `draggedId` lives, not how
`PlannerGrid`'s own drop logic behaves for a same-grid drop.

**References**: Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx`

### FRONTEND-026-AC-09 [AUTO]: Bucket-internal drag-to-reorder (`frontend_spec_010`) is unaffected
**Statement**: Dragging a bucket occurrence and dropping it on a different bucket item already present
in the bucket (`idsInOrder.includes(draggedId)` true) shall continue to call `onReorder` exactly as
`frontend_spec_010` already specifies, unaffected by the `draggedId` state lift or the new
`FRONTEND-026-AC-03` guard.

**Rationale**: Explicit regression guard — the new guard in `handleDrop` must route the *existing*
same-bucket case down the unchanged `onReorder` path, only the new cross-section case is new.

**References**: Component: `frontend/src/components/WeeklyPlanner/BucketList.tsx` (existing
`handleDrop`, `handleMoveUp`/`handleMoveDown` keyboard-accessible equivalents)

### FRONTEND-026-AC-10 [AUTO]: Existing click-based "Send to bucket" and "Rearrange" are unaffected
**Statement**: The existing detail-card "Send to bucket" button (`onMoveToBucket`, grid items only)
and "Rearrange" flow (`onStartMove`/`onCancelMove`/`onConfirmMove`/`movingId`) shall continue to
function exactly as before this spec's changes, for both grid and bucket occurrences.

**Rationale**: Explicit regression guard — this spec adds a faster drag-based trigger path to moves
that already exist; it does not replace or alter the existing click-based paths, matching this
project's established pattern (`frontend_spec_025`-AC-09).

**References**: Component: `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx`,
`frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx`

## Explicitly out of scope (do not implement as part of this spec)

- Dragging to a different week (not visible in the current grid, no mechanism to target it) — same
  exclusion as `frontend_spec_025`.
- Touch/mobile drag support — native HTML5 Drag and Drop has no touch support without a polyfill,
  the same accepted limitation already logged in `.claude/SPEC_CANDIDATES.md`'s "Touch-friendly
  weekend bucket list reordering" entry and excluded by `frontend_spec_025`. Not re-litigated here.
- The sidebar/drawer "assign an unplanned activity by dragging it onto the grid" idea (possibly with
  a new "favourites" concept) — remains an open, not-yet-specced idea in
  `.claude/ideas/future_ideas.md`.
- Inserting a grid-origin drop at a specific position within the bucket's order — see the Overview's
  "judgment call"; it lands wherever the existing demote-to-bucket backend behavior already places it.
- Any change to the `PATCH /api/v1/plan/occurrences/{id}` endpoint's contract, or to `bucketPosition`
  assignment logic — both are pre-existing, unchanged.

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` | New shared `draggedId` state and reset handler; existing `handleMove`, new `onMoveToBucket` wiring to `BucketList` |
| `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` | Existing drop-target cells and `handleDrop`; `draggedId` becomes a prop, not local state |
| `frontend/src/components/WeeklyPlanner/BucketList.tsx` | New panel-level drop target and `onMoveToBucket` prop; new guard in existing `handleDrop`; `draggedId` becomes a prop |
| `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` | Existing `onDragStart`/`onDragEnd` props (unchanged signatures); new `onDragEnd` wiring for the bucket drag handle |
| `frontend/src/services/planApi.ts` | `move()` → `PATCH /api/v1/plan/occurrences/{id}` (already used by both directions) |
| `API.md` | The move endpoint's contract — both-null demotes, both-set promotes (unchanged by this spec) |
| `frontend_spec_025_grid_drag_to_move.md` | Grid-internal drag-to-move; precedent for whole-tile-draggable, AC style, and the `busyId`/`onDragEnd` patterns this spec extends |
| `frontend_spec_010_bucket_reordering.md` | Bucket-internal drag-to-reorder; regression-guarded, not modified, by `FRONTEND-026-AC-09` |
| `.claude/ideas/future_ideas.md` | The other, still not-yet-specced piece of the original idea (sidebar assign-by-drag) |

## TDD test case sketches

### FRONTEND-026-AC-01
```typescript
describe('FRONTEND-026-AC-01: drag state lifted to WeeklyPlanner', () => {
  it('passes a shared draggedId down to both PlannerGrid and BucketList', () => {
    // Render WeeklyPlanner with seeded occurrences (one grid-scheduled, one bucket).
    // Start a drag on the grid tile, then assert the bucket panel's drop handler
    // (via a drop event) can see and act on that same dragged id — i.e. exercised
    // indirectly through AC-02/AC-05 rather than asserting internal state directly.
  })
})
```

### FRONTEND-026-AC-02 / AC-03
```typescript
describe('FRONTEND-026: dragging a grid occurrence onto the bucket demotes it', () => {
  it('AC-02: dropping on empty bucket space calls onMoveToBucket with the dragged id', () => {
    const onMoveToBucket = vi.fn()
    render(<WeeklyPlannerHarness occurrences={[gridOccurrence]} />)
    const sourceTile = screen.getByText(gridOccurrence.name).closest('li')!
    const bucketPanel = screen.getByRole('region', { name: 'Weekend bucket list' })
    fireEvent.dragStart(sourceTile)
    fireEvent.dragOver(bucketPanel)
    fireEvent.drop(bucketPanel)
    expect(onMoveToBucket).toHaveBeenCalledWith(gridOccurrence.id)
  })

  it('AC-03: dropping on an existing bucket item also calls onMoveToBucket, not onReorder', () => {
    const onMoveToBucket = vi.fn()
    const onReorder = vi.fn()
    render(<WeeklyPlannerHarness occurrences={[gridOccurrence, bucketOccurrence]} />)
    const sourceTile = screen.getByText(gridOccurrence.name).closest('li')!
    const bucketItem = screen.getByText(bucketOccurrence.name).closest('li')!
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(bucketItem)
    expect(onMoveToBucket).toHaveBeenCalledWith(gridOccurrence.id)
    expect(onReorder).not.toHaveBeenCalled()
  })
})
```

### FRONTEND-026-AC-05 / AC-06
```typescript
describe('FRONTEND-026: dragging a bucket occurrence onto a grid cell promotes it', () => {
  it('AC-05: dropping on a grid cell calls onConfirmMove with that cell\'s day/slot', () => {
    const onConfirmMove = vi.fn()
    render(<WeeklyPlannerHarness occurrences={[bucketOccurrence]} />)
    const bucketDragHandle = screen.getByText(bucketOccurrence.name)
      .closest('li')!
      .querySelector('[draggable="true"]')!
    const targetCell = screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!
    fireEvent.dragStart(bucketDragHandle)
    fireEvent.dragOver(targetCell)
    fireEvent.drop(targetCell)
    expect(onConfirmMove).toHaveBeenCalledWith(bucketOccurrence.id, 'TUESDAY', 'AFTERNOON')
  })

  it('AC-06: a drop while busyId is set does not call onMoveToBucket or onConfirmMove', () => {
    const onMoveToBucket = vi.fn()
    const onConfirmMove = vi.fn()
    render(<WeeklyPlannerHarness occurrences={[gridOccurrence]} busyId={gridOccurrence.id} />)
    const sourceTile = screen.getByText(gridOccurrence.name).closest('li')!
    const bucketPanel = screen.getByRole('region', { name: 'Weekend bucket list' })
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(bucketPanel)
    expect(onMoveToBucket).not.toHaveBeenCalled()
    expect(onConfirmMove).not.toHaveBeenCalled()
  })
})
```

### FRONTEND-026-AC-07
```typescript
describe('FRONTEND-026-AC-07: abandoned bucket-origin drag resets shared state', () => {
  it('a dragend with no drop leaves occurrences unchanged and resets cleanly', () => {
    const onMoveToBucket = vi.fn()
    const onConfirmMove = vi.fn()
    render(<WeeklyPlannerHarness occurrences={[bucketOccurrence]} />)
    const bucketDragHandle = screen.getByText(bucketOccurrence.name)
      .closest('li')!
      .querySelector('[draggable="true"]')!
    fireEvent.dragStart(bucketDragHandle)
    fireEvent.dragEnd(bucketDragHandle)
    expect(onMoveToBucket).not.toHaveBeenCalled()
    expect(onConfirmMove).not.toHaveBeenCalled()
    // A subsequent, unrelated drag/drop should behave as a fresh drag, proving state was reset.
  })
})
```

### FRONTEND-026-AC-08 / AC-09 / AC-10
```typescript
describe('FRONTEND-026: existing drag/click behaviors unaffected', () => {
  it('AC-08: grid-internal drag-to-move still calls onConfirmMove between two grid cells', () => {
    // Exercises the pre-existing frontend_spec_025 path unchanged; regression guard only.
  })

  it('AC-09: bucket-internal drag-to-reorder still calls onReorder between two bucket items', () => {
    // Exercises the pre-existing frontend_spec_010 path unchanged; regression guard only.
  })

  it('AC-10: Send to bucket button and Rearrange dropdown still work via click', () => {
    // Exercises the pre-existing click-based paths unchanged; regression guard only.
  })
})
```

## Acceptance Criteria Summary

- [x] FRONTEND-026-AC-01 — shared `draggedId` state lifted to `WeeklyPlanner`, passed to both `PlannerGrid` and `BucketList`
- [x] FRONTEND-026-AC-02 — dropping a grid occurrence on the bucket panel calls new `onMoveToBucket`
- [x] FRONTEND-026-AC-03 — dropping a grid occurrence on an existing bucket item also demotes it, not a reorder
- [x] FRONTEND-026-AC-04 — drag affordance toward the bucket matches grid-internal drag (confirmed in a real browser)
- [x] FRONTEND-026-AC-05 — dropping a bucket occurrence on a grid cell calls existing `onConfirmMove`
- [x] FRONTEND-026-AC-06 — a move in flight (`busyId` set) blocks a new cross-section drop, either direction
- [x] FRONTEND-026-AC-07 — an abandoned bucket-origin drag resets shared state cleanly
- [x] FRONTEND-026-AC-08 — grid-internal drag-to-move (`frontend_spec_025`) unaffected
- [x] FRONTEND-026-AC-09 — bucket-internal drag-to-reorder (`frontend_spec_010`) unaffected
- [x] FRONTEND-026-AC-10 — existing click-based "Send to bucket"/"Rearrange" unaffected
