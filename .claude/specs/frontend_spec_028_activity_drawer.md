# Activity Drawer — Drag an Unplanned Activity onto the Grid or Bucket

**Status**: Not started
**Priority**: P3 — interaction speed-up, no new capability (assigning an activity already exists via
the "Add" button + `AssignActivityPicker` modal)
**Depends on**: `frontend_spec_025_grid_drag_to_move.md`, `frontend_spec_026_grid_bucket_cross_drag.md`
(the lifted drag-state/busy-gating/drop-target precedents this widens), `frontend_spec_009_add_picker_modal.md`
(the original `AssignActivityPicker` this refactors), `frontend_spec_027_favourite_activities.md`
(the filters/favourite-first ordering this inherits for free), `planner_spec_004_week_planning.md`
(the `POST /api/v1/plan/occurrences` endpoint this reuses — zero backend changes)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V2-ish polish — not tied to a specific `HIGH_LEVEL_DESIGN.md` version theme; the
third and final piece of a drag-and-drop idea split in `.claude/ideas/future_ideas.md`

## Overview

This is the last remaining piece of `.claude/ideas/future_ideas.md`'s "Drag-and-drop in the week
planner" idea, split into three specs over the last few days: `frontend_spec_025` (drag an
already-planned grid occurrence to a different cell, shipped), `frontend_spec_026` (drag between the
grid and the weekend bucket, shipped), and this one — drag an **unplanned** activity or sub-task out
of a new drawer panel directly onto a grid cell or the bucket to assign it, supplementing (not
replacing) the existing click-to-assign flow (the "Add" button → `AssignActivityPicker` modal, which
stays completely unchanged and fully functional alongside this).

**Scope, exactly as confirmed by the user**:
1. **Layout**: a toggle sidebar, closed by default. A "Browse activities" button (in the Weekly
   Planner header, near the week-nav/view-tabs) opens a panel that sits beside the grid/bucket column,
   pushing it narrower — not a modal overlay. This isn't just a style preference: native HTML5
   drag-and-drop requires the drag source and every drop target on-screen at the same time, which an
   overlay `<dialog>` like `AssignActivityPicker`'s can't provide (you can't drag out of a modal onto
   content the modal is covering).
2. **Interaction**: drag-only inside the drawer. No click-to-assign there — clicking a row does
   nothing (no `aria-pressed` select button, unlike the modal). The modal remains the only
   click-based path.
3. **Code reuse**: `AssignActivityPicker`'s fetch-activities + category/repeatable/favourite filter +
   activity/sub-task row rendering logic is extracted into a new shared component (Requirement 1),
   used by both the modal (click-select mode) and this drawer (drag-source mode), rather than
   duplicating it.

**Why zero backend changes are needed**: dropping a drawer item onto a grid cell or the bucket needs
to create a brand-new `PlannedOccurrence` — exactly what `AssignActivityPicker`'s existing "Assign"
button already does via `planApi.create()` → `POST /api/v1/plan/occurrences` (body
`{ activityId, subTaskId, weekStart, dayOfWeek, slot }`, exactly one of `activityId`/`subTaskId` set).
This spec gives that same call a new *trigger path* (a drop, instead of a click), the same way
`frontend_spec_025`/`026` gave the existing move/demote/promote endpoint new trigger paths without
touching it.

**Why the drag-state architecture needs to widen**: as of `frontend_spec_026`, `WeeklyPlanner.tsx`
lifts a single `draggedId: string | null`, shared by `PlannerGrid` and `BucketList`, always assumed
to be an *existing* `PlannedOccurrence` id being moved/demoted/promoted. A drawer-origin drag has no
existing occurrence to reference — there's nothing to look up in `occurrences`. This spec replaces
the bare id with a discriminated union:

```typescript
type DragPayload =
  | { kind: 'occurrence'; id: string }
  | { kind: 'activity'; activityId: string }
  | { kind: 'subtask'; subTaskId: string }
```

**Minimal-diff design for threading this through `PlannerGrid`/`BucketList`**: their existing
`onDragStart: (id: string) => void` / `onDragEnd: () => void` props — called only by their own child
`OccurrenceItem`s — keep their exact current signatures; `OccurrenceItem.tsx` needs **zero changes**.
Only the *type* of the shared state prop widens (renamed `draggedId` → `dragPayload: DragPayload |
null`), and `WeeklyPlanner.tsx`'s own wiring changes: its `onDragStart` passed down to
`PlannerGrid`/`BucketList` becomes `(id) => setDragPayload({ kind: 'occurrence', id })` instead of a
raw `setDraggedId`. The drawer is a separate component tree (not rendered inside `PlannerGrid`/
`BucketList`), so it needs its own two start-callbacks wired directly in `WeeklyPlanner.tsx` —
`onDragStartActivity={(activityId) => setDragPayload({ kind: 'activity', activityId })}` and
`onDragStartSubTask={(subTaskId) => setDragPayload({ kind: 'subtask', subTaskId })}` — both setting
the same shared `dragPayload` state. `PlannerGrid`/`BucketList` gain one new prop each,
`onAssignFromDrawer: (payload: DragPayload, dayOfWeek: PlanDayOfWeek | null, slot: PlanSlot | null) =>
void`, called from their existing drop handlers whenever `dragPayload.kind !== 'occurrence'` — the
`kind === 'occurrence'` branch is exactly the existing `frontend_spec_025`/`026` logic, untouched.

**Busy-gating**: the existing `busyId` state is keyed by an *occurrence* id (used to disable
per-occurrence controls) and doesn't fit a not-yet-existing occurrence being created. A separate
lightweight boolean guard (e.g. `isAssigningFromDrawer`) blocks a second drawer-drop while one is
already in flight — conceptually mirroring `frontend_spec_026`-AC-06's busy-gating, but its own state,
not a repurposing of `busyId`.

**Judgment call, flagged explicitly — the drawer stays open after a successful drop**: dragging
several activities in a row onto different cells is the whole point of a persistent panel: closing it
after every drop would undo that. **This is a judgment call, not a settled product decision** —
redirect if auto-closing turns out to feel better in practice.

## Requirement 1: Extract a shared activity list component, reused by the modal and the drawer

**User story**: As a developer, I want the modal and the drawer to share one implementation of
"fetch activities, filter them, render activity/sub-task rows," so the two don't drift out of sync
and a future filter change only needs to happen once.

### FRONTEND-028-AC-01 [AUTO]: A new shared component renders the activity/sub-task list and its filters
**Statement**: A new `ActivityPickerList` component shall own the activity/sub-task fetch (including
the per-activity sub-task fan-out), the category/repeatable/favourite filter state and pill UI, and
row rendering — parameterized by a `mode: 'select' | 'drag'` prop. `AssignActivityPicker` shall render
`<ActivityPickerList mode="select" .../>` instead of containing this logic itself.

**Rationale**: The extraction this spec's "code reuse" scope decision requires — a pure refactor
underneath an already-shipped component, not a behavior change.

**References**: New component: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`.
Existing: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` (the logic being extracted
from), `frontend/src/components/FavouriteIcon/FavouriteIcon.tsx`, `frontend/src/components/RepeatableIcon/RepeatableIcon.tsx`,
`frontend/src/components/CategoryChip/CategoryChip.tsx` (unchanged, still used by the rows)

### FRONTEND-028-AC-02 [AUTO]: Every existing AssignActivityPicker behavior is unchanged after the extraction
**Statement**: `AssignActivityPicker`'s full existing test suite — category/repeatable/favourite
filtering and their composition, activity/sub-task selection via `aria-pressed`, the Assign/Cancel
footer, create-on-submit, loading/error states, and backend-provided ordering pass-through — shall
continue to pass unmodified after `ActivityPickerList` is extracted.

**Rationale**: Explicit regression guard for a refactor underneath tested, shipped behavior —
`FRONTEND-009`-series, `FRONTEND-017`-series (category filter), and `FRONTEND-027`-AC-06 through
AC-09/AC-13 through AC-16 (favourite indicator/filter) are not restated here, just re-asserted as
still green.

**References**: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.test.tsx` (existing suite,
unmodified assertions)

## Requirement 2: A toggle sidebar, closed by default

**User story**: As a user who wants to drag-assign activities, I want a button that opens a panel
beside my grid, so I can see both at once — and as a user who doesn't use it, I want it out of my way
by default.

### FRONTEND-028-AC-03 [AUTO]: A toggle button opens and closes the drawer, closed by default
**Statement**: `WeeklyPlanner` shall render a "Browse activities" toggle button in its header area.
On mount, the drawer shall be closed. Clicking the button shall open it; clicking it again (or a close
control within the drawer) shall close it.

**References**: Component: `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` (new
`drawerOpen` state), new component: `frontend/src/components/WeeklyPlanner/ActivityDrawer.tsx`

### FRONTEND-028-AC-04 [AUTO]: The existing "Add" button and modal are fully unaffected by the drawer's state
**Statement**: Regardless of whether the drawer is open or closed, the existing "Add" buttons (on
grid cells and the bucket panel) and the `AssignActivityPicker` modal they open shall continue to
function exactly as before this spec.

**Rationale**: Explicit regression guard — the two assignment paths (modal, drawer) coexist
independently; opening one must not disable or alter the other.

**References**: Component: `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx`

### FRONTEND-028-AC-05 [MANUAL]: The open drawer sits beside the grid/bucket column without breaking layout or obscuring drop targets
**Statement**: In a real browser, opening the drawer shall push the grid/bucket column narrower
without any visual overlap, and the grid/bucket panel shall remain fully visible and usable as a drop
target with the drawer open.

**Rationale**: `[MANUAL]` — jsdom doesn't render CSS layout, consistent with this project's
established jsdom-can't-validate-CSS caveat. This is also a *functional* check, not just cosmetic: if
the drawer visually covered the grid, dragging out of it onto a cell would be impossible to verify by
any other means.

**References**: Component: `frontend/src/components/WeeklyPlanner/WeeklyPlanner.module.css`,
`frontend/src/components/WeeklyPlanner/ActivityDrawer.module.css`

## Requirement 3: The drawer is a drag-only activity/sub-task source

**User story**: As a user with the drawer open, I want to pick up an activity or sub-task and drag it
straight onto a day/slot or the bucket, so assigning it is a single gesture instead of opening the
modal, filtering, selecting, and clicking Assign.

### FRONTEND-028-AC-06 [AUTO]: The drawer renders the activity list in drag mode — no click-select
**Statement**: `ActivityDrawer` shall render `<ActivityPickerList mode="drag" .../>`. In `drag` mode,
activity and sub-task rows shall be `draggable` and shall **not** render a click-to-select
`aria-pressed` button — clicking a row shall have no assignment effect.

**References**: Component: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx` (`mode`
branch), `frontend/src/components/WeeklyPlanner/ActivityDrawer.tsx`

### FRONTEND-028-AC-07 [AUTO]: Starting a drag on an activity or sub-task row identifies what's being dragged
**Statement**: When a drag starts on an activity row, `ActivityPickerList` (in `drag` mode) shall call
its `onDragStartActivity(activityId)` prop. When a drag starts on a sub-task row, it shall call
`onDragStartSubTask(subTaskId)` — never both for the same drag.

**References**: Component: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`,
`frontend/src/components/WeeklyPlanner/ActivityDrawer.tsx` (wires these to
`WeeklyPlanner.tsx`'s `setDragPayload`)

### FRONTEND-028-AC-08 [AUTO]: A drag that ends without a valid drop resets cleanly
**Statement**: When a drag started from the drawer ends (`dragend`) without a valid drop onto any
`PlannerGrid` cell or the `BucketList`, the shared `dragPayload` state shall reset to `null`.

**Rationale**: Mirrors `frontend_spec_025`-AC-07/`frontend_spec_026`-AC-07's existing drag-end
cleanup for the new drag source.

**References**: Component: `frontend/src/components/WeeklyPlanner/ActivityDrawer.tsx`,
`frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx`

### FRONTEND-028-AC-09 [AUTO]: The drawer's filters behave identically to the modal's
**Statement**: The category, repeatable, and favourite filters rendered by `ActivityPickerList` in
`drag` mode shall filter the drawer's visible rows using the exact same logic as `select` mode (same
`ActivityPickerList` internals, just a different row-interaction mode).

**Rationale**: Falls out of the Requirement 1 extraction for free — stated as its own AC because it's
a directly user-visible guarantee of the drawer, not just an implementation detail.

**References**: Component: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`

## Requirement 4: Dropping a drawer item onto a grid cell assigns it there

**User story**: As a user dragging an activity out of the drawer, I want to drop it on a specific
day/slot and have it actually get planned there, so the drag is a real shortcut, not just a gesture.

### FRONTEND-028-AC-10 [AUTO]: Dropping a drawer item on a grid cell triggers a new-assignment call, not a move
**Statement**: When `dragPayload.kind` is `'activity'` or `'subtask'` and a drop lands on a
`PlannerGrid` cell, `PlannerGrid` shall call a new `onAssignFromDrawer(payload, dayOfWeek, slot)` prop
with the dropped cell's day and slot — not `onConfirmMove` (which remains exclusively for
`kind: 'occurrence'`).

**References**: Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` (`handleDrop`, new
branch)

### FRONTEND-028-AC-11 [AUTO]: The new-assignment handler creates a real occurrence via the existing endpoint
**Statement**: When `onAssignFromDrawer` is called, `WeeklyPlanner` shall call `planApi.create()` with
`activityId`/`subTaskId` set according to `payload.kind` (exactly one of the two), the current
`weekStart`, and the dropped `dayOfWeek`/`slot` — and on success shall append the returned occurrence
to local `occurrences` state, the same way the existing `handleAssignSuccess` (used by the modal)
already does.

**References**:
- Service: `frontend/src/services/planApi.ts` (`create`, unchanged)
- Endpoint: `POST /api/v1/plan/occurrences` (`API.md`, unchanged)
- Component: `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` (new handler, mirrors
  `handleAssignSuccess`)

### FRONTEND-028-AC-12 [AUTO]: A second drawer-drop while one is already in flight is ignored
**Statement**: While a drawer-triggered `planApi.create()` call is in flight, a second drop of a
drawer item (onto either the grid or the bucket) shall not trigger another `onAssignFromDrawer` call.

**Rationale**: Mirrors `frontend_spec_026`-AC-06's busy-gating for cross-section drops, using a
dedicated in-flight boolean rather than the occurrence-keyed `busyId` (there is no occurrence id yet
to key by).

**References**: Component: `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` (new
`isAssigningFromDrawer` state)

## Requirement 5: Dropping a drawer item onto the bucket assigns it there

**User story**: As a user dragging an activity out of the drawer, I want to drop it directly onto the
weekend bucket list, so I can assign something to the bucket without picking a day/slot at all.

### FRONTEND-028-AC-13 [AUTO]: Dropping a drawer item on the bucket panel triggers a new-assignment call with no day/slot
**Statement**: When `dragPayload.kind` is `'activity'` or `'subtask'` and a drop lands on the
`BucketList` panel (not an existing item), `BucketList` shall call `onAssignFromDrawer(payload, null,
null)`.

**References**: Component: `frontend/src/components/WeeklyPlanner/BucketList.tsx` (`handlePanelDrop`,
new branch)

### FRONTEND-028-AC-14 [AUTO]: Dropping a drawer item on an existing bucket item also assigns it to the bucket, not a reorder
**Statement**: When `dragPayload.kind` is `'activity'` or `'subtask'` and a drop lands on an existing
bucket item, `BucketList` shall call `onAssignFromDrawer(payload, null, null)` — the existing
same-bucket reorder path (`onReorder`) shall not be invoked, since a drawer-origin payload is never
already a member of `idsInOrder`.

**Rationale**: Mirrors `frontend_spec_026`-AC-03's equivalent guard for a grid-origin occurrence
dropped on an existing bucket item — same shape, extended to the new payload kinds.

**References**: Component: `frontend/src/components/WeeklyPlanner/BucketList.tsx` (existing
`handleDrop(targetId)`, new branch alongside the existing `idsInOrder.includes(id)` check)

## Requirement 6: Existing drag and click behaviors are fully unaffected

**User story**: As a user, I want every drag-and-drop and click-based action that already works today
to keep working exactly the same, so this spec is purely additive.

### FRONTEND-028-AC-15 [AUTO]: Grid-internal drag-to-move (frontend_spec_025) is unaffected
**Statement**: Dragging a grid occurrence and dropping it on a different cell within the same visible
grid shall continue to call `onConfirmMove` exactly as `frontend_spec_025` already specifies,
unaffected by the `DragPayload` widening.

**References**: Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx`

### FRONTEND-028-AC-16 [AUTO]: Bucket-internal drag-to-reorder (frontend_spec_010) is unaffected
**Statement**: Dragging a bucket occurrence and dropping it on a different bucket item already present
in the bucket shall continue to call `onReorder` exactly as `frontend_spec_010` already specifies.

**References**: Component: `frontend/src/components/WeeklyPlanner/BucketList.tsx`

### FRONTEND-028-AC-17 [AUTO]: Grid/bucket cross-drag (frontend_spec_026) is unaffected
**Statement**: Dragging an existing occurrence between the grid and the bucket (either direction)
shall continue to behave exactly as `frontend_spec_026` already specifies, unaffected by the
`DragPayload` widening.

**References**: Components: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx`,
`frontend/src/components/WeeklyPlanner/BucketList.tsx`

### FRONTEND-028-AC-18 [AUTO]: The modal's click-based assign flow is unaffected
**Statement**: Opening the modal via "Add", filtering, selecting an activity or sub-task, and clicking
"Assign" shall continue to create and display the occurrence exactly as before, regardless of the
`ActivityPickerList` extraction (Requirement 1) or whether the drawer is open.

**References**: Component: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx`

## Explicitly out of scope (do not implement as part of this spec)

- Touch/mobile drag support — native HTML5 Drag and Drop has no touch support without a polyfill,
  the same accepted limitation as `frontend_spec_025`/`026`.
- Click-to-assign inside the drawer — drag-only, confirmed by the user; the modal remains the only
  click-based path.
- Replacing, hiding, or otherwise altering the existing "Add" button/modal flow — stays fully
  unchanged (Requirement 6).
- Persisting the drawer's open/closed state across page reloads or navigation — it always starts
  closed on mount.
- Any new backend endpoint, or the bulk sub-task fetch optimization logged separately in
  `.claude/SPEC_CANDIDATES.md`'s "Bulk sub-task fetch endpoint" entry — this spec reuses the existing
  N+1-but-parallelized fetch (`activityApi.getAll()` + fanned-out `subTaskApi.getAll()` per activity)
  exactly as `AssignActivityPicker` already does it.
- Any new favourite-related behavior — the drawer inherits `planner_spec_015`'s favourite-first
  ordering and `frontend_spec_027`'s filters for free via the `ActivityPickerList` extraction; nothing
  new to build.

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx` | New shared fetch/filter/render component (this spec), `select`/`drag` modes |
| `frontend/src/components/WeeklyPlanner/ActivityDrawer.tsx` | New toggle sidebar panel (this spec), renders `ActivityPickerList` in `drag` mode |
| `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` | Refactored to render `ActivityPickerList` in `select` mode; Assign/Cancel/selection logic stays here |
| `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx` | `DragPayload` type (replaces bare `draggedId: string \| null`), `drawerOpen` state, new `onAssignFromDrawer` handler, `isAssigningFromDrawer` busy guard |
| `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` | `handleDrop` gains an `onAssignFromDrawer` branch; existing `onConfirmMove` branch unchanged |
| `frontend/src/components/WeeklyPlanner/BucketList.tsx` | `handlePanelDrop`/`handleDrop` gain an `onAssignFromDrawer` branch; existing `onMoveToBucket`/`onReorder` branches unchanged |
| `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` | Unchanged — `onDragStart`/`onDragEnd` signatures stay exactly as `frontend_spec_026` left them |
| `frontend/src/services/planApi.ts` | `create()` → `POST /api/v1/plan/occurrences` (unchanged, reused) |
| `frontend/src/types/plan.ts` | `PlannedOccurrenceInput` (unchanged — the shape `onAssignFromDrawer`'s handler maps `DragPayload` into) |
| `frontend_spec_025_grid_drag_to_move.md` | Grid-internal move; regression-guarded (`FRONTEND-028-AC-15`) |
| `frontend_spec_026_grid_bucket_cross_drag.md` | Cross-section drag, lifted `draggedId` precedent this widens; regression-guarded (`FRONTEND-028-AC-17`) |
| `frontend_spec_009_add_picker_modal.md` | Original `AssignActivityPicker`; regression-guarded (`FRONTEND-028-AC-02`/`AC-18`) |
| `frontend_spec_027_favourite_activities.md` | Filters/favourite-first ordering inherited for free (`FRONTEND-028-AC-09`) |
| `.claude/SPEC_CANDIDATES.md` | The deferred bulk sub-task fetch optimization, not addressed here |

## TDD test case sketches

### FRONTEND-028-AC-01 / AC-02
```typescript
describe('FRONTEND-028: ActivityPickerList extraction', () => {
  it('AC-01: AssignActivityPicker renders ActivityPickerList in select mode', () => {
    render(<AssignActivityPicker {...baseProps} />)
    // activity rows are select buttons, same as before extraction
    expect(screen.getByRole('button', { name: 'Go for a walk' })).toHaveAttribute('aria-pressed')
  })
})

// AC-02 is a regression guard: AssignActivityPicker.test.tsx's full existing suite
// (FRONTEND-009/017/022/027-series) runs unmodified against the refactored component.
```

### FRONTEND-028-AC-03 / AC-04
```typescript
describe('FRONTEND-028: drawer toggle', () => {
  it('AC-03: drawer is closed by default and opens/closes via the toggle', async () => {
    render(<WeeklyPlanner />)
    expect(screen.queryByRole('complementary', { name: /activities/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /browse activities/i }))
    expect(screen.getByRole('complementary', { name: /activities/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('complementary', { name: /activities/i })).not.toBeInTheDocument()
  })

  it('AC-04: the Add button/modal still works with the drawer open', async () => {
    render(<WeeklyPlanner />)
    await userEvent.click(screen.getByRole('button', { name: /browse activities/i }))
    await userEvent.click(screen.getByLabelText('Add to Monday Morning'))
    expect(screen.getByText('Assign an activity or sub-task')).toBeInTheDocument()
  })
})
```

### FRONTEND-028-AC-06 / AC-07 / AC-08
```typescript
describe('FRONTEND-028: ActivityDrawer is drag-only', () => {
  it('AC-06: rows are draggable with no select button', () => {
    render(<ActivityDrawer {...dragProps} />)
    const row = screen.getByText('Go for a walk').closest('li')!
    expect(row).toHaveAttribute('draggable', 'true')
    expect(screen.queryByRole('button', { name: 'Go for a walk', pressed: false })).not.toBeInTheDocument()
  })

  it('AC-07: dragging an activity row calls onDragStartActivity', () => {
    const onDragStartActivity = vi.fn()
    render(<ActivityDrawer {...dragProps} onDragStartActivity={onDragStartActivity} />)
    fireEvent.dragStart(screen.getByText('Go for a walk').closest('li')!)
    expect(onDragStartActivity).toHaveBeenCalledWith('activity-1')
  })

  it('AC-08: a dragend with no drop resets the shared drag state', () => {
    const onDragEnd = vi.fn()
    render(<ActivityDrawer {...dragProps} onDragEnd={onDragEnd} />)
    const row = screen.getByText('Go for a walk').closest('li')!
    fireEvent.dragStart(row)
    fireEvent.dragEnd(row)
    expect(onDragEnd).toHaveBeenCalled()
  })
})
```

### FRONTEND-028-AC-10 / AC-11 / AC-12
```typescript
describe('FRONTEND-028: dropping a drawer item on a grid cell', () => {
  it('AC-10: calls onAssignFromDrawer with the dropped cell\'s day/slot', () => {
    const onAssignFromDrawer = vi.fn()
    render(
      <PlannerGrid
        dragPayload={{ kind: 'activity', activityId: 'activity-1' }}
        onAssignFromDrawer={onAssignFromDrawer}
        {...requiredProps}
      />,
    )
    fireEvent.drop(screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!)
    expect(onAssignFromDrawer).toHaveBeenCalledWith(
      { kind: 'activity', activityId: 'activity-1' },
      'TUESDAY',
      'AFTERNOON',
    )
  })

  it('AC-11: WeeklyPlanner calls planApi.create and appends the result', async () => {
    const created = { id: 'new-occ', activityId: 'activity-1', dayOfWeek: 'TUESDAY', slot: 'AFTERNOON' /* ... */ }
    vi.mocked(planApi.create).mockResolvedValue(created)
    render(<WeeklyPlanner />)
    // simulate drop via harness dispatch
    await waitFor(() => expect(planApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 'activity-1', subTaskId: null, dayOfWeek: 'TUESDAY', slot: 'AFTERNOON' }),
    ))
    expect(await screen.findByText('Go for a walk')).toBeInTheDocument()
  })

  it('AC-12: a second drop while one is in flight does not call onAssignFromDrawer again', async () => {
    // dispatch two drops in quick succession while the first planApi.create is still pending;
    // assert planApi.create called exactly once
  })
})
```

### FRONTEND-028-AC-13 / AC-14
```typescript
describe('FRONTEND-028: dropping a drawer item on the bucket', () => {
  it('AC-13: dropping on the panel calls onAssignFromDrawer with null day/slot', () => {
    const onAssignFromDrawer = vi.fn()
    render(
      <BucketList
        dragPayload={{ kind: 'subtask', subTaskId: 'subtask-1' }}
        onAssignFromDrawer={onAssignFromDrawer}
        {...requiredProps}
      />,
    )
    fireEvent.drop(screen.getByRole('region', { name: 'Weekend bucket list' }))
    expect(onAssignFromDrawer).toHaveBeenCalledWith({ kind: 'subtask', subTaskId: 'subtask-1' }, null, null)
  })

  it('AC-14: dropping on an existing bucket item also assigns to the bucket, not a reorder', () => {
    const onAssignFromDrawer = vi.fn()
    const onReorder = vi.fn()
    render(
      <BucketList
        occurrences={[existingBucketOccurrence]}
        dragPayload={{ kind: 'activity', activityId: 'activity-2' }}
        onAssignFromDrawer={onAssignFromDrawer}
        onReorder={onReorder}
        {...requiredProps}
      />,
    )
    fireEvent.drop(screen.getByText(existingBucketOccurrence.name).closest('li')!)
    expect(onAssignFromDrawer).toHaveBeenCalledWith({ kind: 'activity', activityId: 'activity-2' }, null, null)
    expect(onReorder).not.toHaveBeenCalled()
  })
})
```

### FRONTEND-028-AC-15 / AC-16 / AC-17 / AC-18
```typescript
describe('FRONTEND-028: existing behaviors unaffected', () => {
  it('AC-15: grid-internal move still works (frontend_spec_025 regression guard)', () => {
    // exercises the existing kind: 'occurrence' branch unchanged
  })
  it('AC-16: bucket-internal reorder still works (frontend_spec_010 regression guard)', () => {})
  it('AC-17: grid/bucket cross-drag still works (frontend_spec_026 regression guard)', () => {})
  it('AC-18: modal click-assign still works end to end', () => {})
})
```

## Acceptance Criteria Summary

- [ ] FRONTEND-028-AC-01 — `ActivityPickerList` extracted, `AssignActivityPicker` renders it in `select` mode
- [ ] FRONTEND-028-AC-02 — every existing `AssignActivityPicker` behavior unchanged after extraction
- [ ] FRONTEND-028-AC-03 — toggle button opens/closes the drawer, closed by default
- [ ] FRONTEND-028-AC-04 — the existing Add button/modal fully unaffected by drawer state
- [ ] FRONTEND-028-AC-05 — open drawer sits beside the grid without breaking layout or obscuring drop targets (real-browser check)
- [ ] FRONTEND-028-AC-06 — drawer renders the list in drag mode, no click-select
- [ ] FRONTEND-028-AC-07 — starting a drag identifies the activity or sub-task being dragged
- [ ] FRONTEND-028-AC-08 — a drag ending with no drop resets cleanly
- [ ] FRONTEND-028-AC-09 — the drawer's filters behave identically to the modal's
- [ ] FRONTEND-028-AC-10 — dropping a drawer item on a grid cell calls `onAssignFromDrawer`, not `onConfirmMove`
- [ ] FRONTEND-028-AC-11 — the new-assignment handler calls `planApi.create` and appends the result
- [ ] FRONTEND-028-AC-12 — a second drawer-drop in flight is ignored
- [ ] FRONTEND-028-AC-13 — dropping on the bucket panel calls `onAssignFromDrawer` with null day/slot
- [ ] FRONTEND-028-AC-14 — dropping on an existing bucket item also assigns to the bucket, not a reorder
- [ ] FRONTEND-028-AC-15 — grid-internal drag-to-move (`frontend_spec_025`) unaffected
- [ ] FRONTEND-028-AC-16 — bucket-internal drag-to-reorder (`frontend_spec_010`) unaffected
- [ ] FRONTEND-028-AC-17 — grid/bucket cross-drag (`frontend_spec_026`) unaffected
- [ ] FRONTEND-028-AC-18 — the modal's click-based assign flow unaffected
