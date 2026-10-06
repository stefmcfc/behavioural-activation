# Sub-task Manual Reordering (Frontend)

**Status**: Implemented (2026-10-06) — `frontend/src/types/subTask.ts`,
`frontend/src/services/subTaskApi.ts`, `frontend/src/components/ActivityBank/SubTaskList.tsx`,
`frontend/src/components/ActivityBank/SubTaskList.module.css`
**Priority**: P2 — UX improvement raised directly by the user (2026-10-06), not blocking any
existing V1 flow. Mirrors `frontend_spec_010_bucket_reordering.md`'s already-shipped pattern for a
different list.
**Depends on**: `planner_spec_023_subtask_reordering.md` (paired backend spec — `position`,
`PUT /api/v1/activities/{activityId}/sub-tasks/order`), `frontend_spec_003_sub_tasks.md` (origin of
`SubTaskList.tsx`, `subTaskApi`, `types/subTask.ts`), `frontend_spec_010_bucket_reordering.md` (the
Move up/Move down + shared reorder-action pattern this spec mirrors, minus drag-and-drop — see
Overview), `frontend_spec_006_repeatable_activities.md` (origin of `SubTaskList`'s `readOnly` prop,
which this spec's new controls are gated by, same as the existing Rename/Delete controls),
`frontend_spec_046_activity_drawer_collapsible_subtasks.md` (most recent sub-task-related frontend
spec; confirms `ActivityPickerList.tsx` — out of scope here — is a separate component from
`SubTaskList.tsx`)
**Area**: Frontend
**Roadmap version**: V1 (extends Activity management / sub-tasks from `product.md`'s V1 row)

## Overview

Consumes `planner_spec_023_subtask_reordering.md`'s new `position` field and `PUT
.../sub-tasks/order` endpoint to let a user rearrange a sub-task checklist's order from the
Activities page (`ActivityBank.tsx` → `SubTaskList.tsx`) — not the Activity Drawer or Assign
Activity modal (`ActivityPickerList.tsx`), which are separate drag/select pickers used during weekly
planning and are explicitly out of scope (see Scope below).

**Deliberately buttons-only, no drag-and-drop** (confirmed with the user, 2026-10-06) — unlike
`frontend_spec_010_bucket_reordering.md`'s bucket list, which offers both a drag handle and Move
up/Move down buttons. Two reasons converge on this:
1. `.claude/SPEC_CANDIDATES.md` already tracks an open, confirmed-but-not-yet-specced gap: the
   bucket list's native HTML5 drag-and-drop has no touch support, deferred only because current
   usage is desktop-only. Reproducing that same drag implementation in a second, independent
   component would multiply that exact gap rather than containing it.
2. A sub-task checklist is smaller and flatter than the weekend bucket (no cross-category drop
   zones, no cross-list drag like grid↔bucket) — accessible Move up/Move down buttons alone fully
   cover the use case without the UX loss that dropping drag-and-drop would otherwise justify.

**Scope**: reordering applies within one activity's sub-task checklist only, from `SubTaskList.tsx`
on the Activities page. `ActivityPickerList.tsx` (the Activity Drawer and Assign Activity modal)
also displays sub-tasks, fetched via `subTaskApi.getAllForOwner()` — once the backend switches from
`createdAt` to `position` ordering (`planner_spec_023_subtask_reordering.md`), that component's
displayed order will passively change too, with **no new UI there and no code change required**.
This is called out explicitly here so it isn't later mistaken for a missed requirement.

**Out of scope**: drag-and-drop (see above). Any change to `ActivityPickerList.tsx`,
`ActivityBank.tsx`'s show/hide toggle, or `ActivityBank.tsx`'s category grouping — none of those are
touched by this spec.

## Requirements

### Requirement 1 — Sub-tasks render in their persisted manual order

As a user, I want my sub-task checklist to show up in the order I last arranged it, not whatever
order the API happens to return it in.

### FRONTEND-047-AC-01 [AUTO]: `SubTaskList` renders sub-tasks ordered by `position`
**Statement**: `SubTaskList` shall render sub-tasks ordered by `position` ascending, not by the raw
array order its `subTasks` state happens to hold.

**Rationale**: Defensive — `SubTaskList`'s local state is mutated in place after create/rename/
delete (not refetched each time), so a client-side sort guards against any ordering drift, mirroring
`BucketList.tsx`'s identical `FRONTEND-010-AC-01` precedent.

**References**: `components/ActivityBank/SubTaskList.tsx` — sort `subTasks` by `position` ascending
before mapping to rows, same `.slice().sort((a, b) => a.position - b.position)` shape as
`BucketList.tsx`'s existing `bucketPosition` sort (non-null here, so no `?? 0` fallback needed).

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-01: sub-tasks render ordered by position, not array order', () => {
  it('renders items in position order', async () => {
    vi.spyOn(subTaskApi, 'getAll').mockResolvedValue([
      { id: 'b', activityId: 'a1', name: 'Second', category: 'PLEASURABLE', createdAt: '…', position: 1 },
      { id: 'a', activityId: 'a1', name: 'First', category: 'PLEASURABLE', createdAt: '…', position: 0 },
    ])
    render(<SubTaskList activityId="a1" />)

    const items = await screen.findAllByRole('listitem')
    const texts = items.map((li) => li.textContent)
    expect(texts.findIndex((t) => t?.includes('First'))).toBeLessThan(
      texts.findIndex((t) => t?.includes('Second')),
    )
  })
})
```

**Test Case (Green)**: implement the sort as described in References.

### Requirement 2 — Move up/Move down controls, one shared reorder action

As a user, I want to rearrange my sub-task checklist by nudging an item up or down with a button.

### FRONTEND-047-AC-02 [AUTO]: Move up/Move down buttons render per row, gated by `readOnly`
**Statement**: While `readOnly` is `false`, `SubTaskList` shall render "Move up" and "Move down"
buttons for each sub-task row, each with an accessible name identifying the item (`Move {name} up`
/ `Move {name} down`).

**References**: `components/ActivityBank/SubTaskList.tsx` — new buttons added inline in the existing
`<li>`, inside the same `{!readOnly && (...)}` block that already gates Rename/Delete. No new
`SubTaskItem`/`ReorderControls` sub-component — there's no drag handle to justify extracting one,
and `SubTaskList` isn't currently split the way `BucketList`/`OccurrenceItem` are.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-02: Move up/down buttons render with accessible names', () => {
  it('renders Move up/down buttons for each sub-task', async () => {
    vi.spyOn(subTaskApi, 'getAll').mockResolvedValue([
      { id: 'a', activityId: 'a1', name: 'Read', category: 'PLEASURABLE', createdAt: '…', position: 0 },
    ])
    render(<SubTaskList activityId="a1" />)

    expect(await screen.findByRole('button', { name: 'Move Read up' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move Read down' })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement the buttons as described in References.

### FRONTEND-047-AC-03 [AUTO]: Move up is disabled/no-op for the first item
**Statement**: The "Move up" button shall be disabled, and a no-op if activated regardless, for the
first item in the checklist's current order.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-03/AC-04: Move up/down disabled at the boundaries', () => {
  it('disables Move up on the first item and Move down on the last', async () => {
    vi.spyOn(subTaskApi, 'getAll').mockResolvedValue([
      { id: 'a', activityId: 'a1', name: 'First', category: 'PLEASURABLE', createdAt: '…', position: 0 },
      { id: 'b', activityId: 'a1', name: 'Second', category: 'PLEASURABLE', createdAt: '…', position: 1 },
    ])
    render(<SubTaskList activityId="a1" />)

    expect(await screen.findByRole('button', { name: 'Move First up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Second down' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move First down' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Second up' })).not.toBeDisabled()
  })
})
```

**Test Case (Green)**: disable based on index within the sorted list.

### FRONTEND-047-AC-04 [AUTO]: Move down is disabled/no-op for the last item
**Statement**: The "Move down" button shall be disabled, and a no-op if activated regardless, for
the last item in the checklist's current order.

**Test Case**: covered by the shared sketch under `FRONTEND-047-AC-03` above.

### FRONTEND-047-AC-05 [AUTO]: Activating Move up/down calls the reorder API with the full swapped order
**Statement**: When "Move up" or "Move down" is activated for a sub-task, `SubTaskList` shall
compute the full new order (that item swapped with its immediate neighbour in the requested
direction) and call `subTaskApi.reorder(activityId, subTaskIds)` with the complete ordered id list.

**References**: `services/subTaskApi.ts` — new `reorder(activityId, subTaskIds)` method
(`FRONTEND-047-AC-11`). `handleMoveUp`/`handleMoveDown` in `SubTaskList.tsx` mirror
`BucketList.tsx`'s identical index-swap logic (`FRONTEND-010-AC-06`), operating on the
position-sorted id list.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-05: Move up/down calls subTaskApi.reorder with the full swapped order', () => {
  it('swaps the activated item with its neighbour above', async () => {
    vi.spyOn(subTaskApi, 'getAll').mockResolvedValue([
      { id: 'a', activityId: 'a1', name: 'First', category: 'PLEASURABLE', createdAt: '…', position: 0 },
      { id: 'b', activityId: 'a1', name: 'Second', category: 'PLEASURABLE', createdAt: '…', position: 1 },
      { id: 'c', activityId: 'a1', name: 'Third', category: 'PLEASURABLE', createdAt: '…', position: 2 },
    ])
    const reorderSpy = vi.spyOn(subTaskApi, 'reorder').mockResolvedValue([])
    render(<SubTaskList activityId="a1" />)

    await userEvent.click(await screen.findByRole('button', { name: 'Move Second up' }))

    expect(reorderSpy).toHaveBeenCalledWith('a1', ['b', 'a', 'c'])
  })
})
```

**Test Case (Green)**: implement `handleMoveUp`/`handleMoveDown` as described in References.

### FRONTEND-047-AC-06 [AUTO]: Reorder controls are disabled while a reorder request is in flight
**Statement**: While a reorder request is in flight, `SubTaskList` shall disable every row's Move
up/Move down buttons — a single shared in-flight flag covering the whole checklist (mirroring
`BucketList.tsx`'s `reorderInFlight` pattern, `FRONTEND-010-AC-11`), preventing overlapping reorder
requests.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-06: reorder controls disabled while a reorder request is in flight', () => {
  it('disables every Move up/down button once a reorder is triggered, until it resolves', async () => {
    vi.spyOn(subTaskApi, 'getAll').mockResolvedValue([
      { id: 'a', activityId: 'a1', name: 'First', category: 'PLEASURABLE', createdAt: '…', position: 0 },
      { id: 'b', activityId: 'a1', name: 'Second', category: 'PLEASURABLE', createdAt: '…', position: 1 },
    ])
    let resolveReorder: (value: SubTask[]) => void
    vi.spyOn(subTaskApi, 'reorder').mockReturnValue(
      new Promise((resolve) => { resolveReorder = resolve }),
    )
    render(<SubTaskList activityId="a1" />)

    await userEvent.click(await screen.findByRole('button', { name: 'Move Second up' }))

    expect(screen.getByRole('button', { name: 'Move First down' })).toBeDisabled()
    resolveReorder([])
  })
})
```

**Test Case (Green)**: wrap the reorder call in a shared `reorderInFlight` state flag.

### FRONTEND-047-AC-07 [AUTO]: A successful reorder replaces the displayed checklist with the response
**Statement**: When `subTaskApi.reorder(...)` resolves, `SubTaskList` shall replace its displayed
sub-tasks with the response, in their new order.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-07: a successful reorder updates the displayed checklist', () => {
  it('replaces the list with the reordered response', async () => {
    vi.spyOn(subTaskApi, 'getAll').mockResolvedValue([
      { id: 'a', activityId: 'a1', name: 'First', category: 'PLEASURABLE', createdAt: '…', position: 0 },
      { id: 'b', activityId: 'a1', name: 'Second', category: 'PLEASURABLE', createdAt: '…', position: 1 },
    ])
    vi.spyOn(subTaskApi, 'reorder').mockResolvedValue([
      { id: 'b', activityId: 'a1', name: 'Second', category: 'PLEASURABLE', createdAt: '…', position: 0 },
      { id: 'a', activityId: 'a1', name: 'First', category: 'PLEASURABLE', createdAt: '…', position: 1 },
    ])
    render(<SubTaskList activityId="a1" />)

    await userEvent.click(await screen.findByRole('button', { name: 'Move Second up' }))

    const items = await screen.findAllByRole('listitem')
    expect(items[0].textContent).toContain('Second')
    expect(items[1].textContent).toContain('First')
  })
})
```

**Test Case (Green)**: `setSubTasks(response)` on success, matching the existing `handleFormSuccess`/
`handleConfirmDelete` state-update pattern already in `SubTaskList.tsx`.

### FRONTEND-047-AC-08 [AUTO]: A rejected reorder surfaces an error and leaves the previous order displayed
**Statement**: If `subTaskApi.reorder()` rejects, then `SubTaskList` shall surface the error via the
same `role="alert"` pattern as the existing delete-error handling, and continue rendering the
checklist in its previous (pre-attempted-reorder) order.

**References**: `getErrorMessage(...)` (existing helper in `SubTaskList.tsx`); the existing
`deleteError`-style `role="alert"` rendering.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-08: a rejected reorder surfaces an error and keeps the previous order', () => {
  it('shows an alert and leaves the list unchanged on failure', async () => {
    vi.spyOn(subTaskApi, 'getAll').mockResolvedValue([
      { id: 'a', activityId: 'a1', name: 'First', category: 'PLEASURABLE', createdAt: '…', position: 0 },
      { id: 'b', activityId: 'a1', name: 'Second', category: 'PLEASURABLE', createdAt: '…', position: 1 },
    ])
    vi.spyOn(subTaskApi, 'reorder').mockRejectedValue(new Error('Conflict'))
    render(<SubTaskList activityId="a1" />)

    await userEvent.click(await screen.findByRole('button', { name: 'Move Second up' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items[0].textContent).toContain('First')
    expect(items[1].textContent).toContain('Second')
  })
})
```

**Test Case (Green)**: catch the rejection, set an error state rendered via the existing
`role="alert"` element, and leave `subTasks` state untouched on failure.

### Requirement 3 — Reorder controls respect `readOnly` (archived activities)

As a user, I don't want to be able to rearrange the checklist of an activity I've archived, the same
way I already can't rename or delete its sub-tasks.

### FRONTEND-047-AC-09 [AUTO]: No reorder controls render for a `readOnly` checklist
**Statement**: While `readOnly` is `true`, `SubTaskList` shall render neither "Move up" nor "Move
down" buttons for any sub-task row — mirroring the existing Rename/Delete gating
(`FRONTEND-006-AC-15`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-09: readOnly hides Move up/down controls', () => {
  it('renders no Move up/down buttons when readOnly', async () => {
    vi.spyOn(subTaskApi, 'getAll').mockResolvedValue([
      { id: 'a', activityId: 'a1', name: 'First', category: 'PLEASURABLE', createdAt: '…', position: 0 },
    ])
    render(<SubTaskList activityId="a1" readOnly />)

    await screen.findByText('First')
    expect(screen.queryByRole('button', { name: /move .* up/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move .* down/i })).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: the existing `{!readOnly && (...)}` block already gates this once the new
buttons are placed inside it (`FRONTEND-047-AC-02`) — no separate conditional needed.

### Requirement 4 — Type and service contract

As a developer, I want the frontend's `SubTask` type to match the backend's response shape exactly,
so a manual order can round-trip without drift.

### FRONTEND-047-AC-10 [AUTO]: `SubTask` type declares `position`
**Statement**: The `SubTask` type shall declare a new `position: number` field, matching
`planner_spec_023_subtask_reordering.md`'s `SubTaskResponse.position` 1:1.

**References**: `types/subTask.ts`.

**Test Case (Green)**: exercised implicitly by every fixture in the sketches above compiling
against the extended type — no standalone test needed, matching `FRONTEND-010-AC-14`'s identical
treatment.

### FRONTEND-047-AC-11 [AUTO]: `subTaskApi` exposes `reorder`
**Statement**: `subTaskApi` shall expose `reorder(activityId, subTaskIds)`, calling `PUT
/activities/{activityId}/sub-tasks/order` with `{ subTaskIds }` and resolving with the updated
`SubTask[]`.

**References**: `services/subTaskApi.ts`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-11: subTaskApi.reorder calls the new endpoint', () => {
  it('PUTs subTaskIds and resolves with the updated list', async () => {
    const putSpy = vi.spyOn(client, 'put').mockResolvedValue({
      data: { data: [{ id: 'a', activityId: 'a1', name: 'A', category: 'PLEASURABLE', createdAt: '…', position: 0 }], count: 1 },
    })

    const result = await subTaskApi.reorder('a1', ['a'])

    expect(putSpy).toHaveBeenCalledWith('/activities/a1/sub-tasks/order', { subTaskIds: ['a'] })
    expect(result).toEqual([{ id: 'a', activityId: 'a1', name: 'A', category: 'PLEASURABLE', createdAt: '…', position: 0 }])
  })
})
```

**Test Case (Green)**:
```typescript
reorder: (activityId: string, subTaskIds: string[]): Promise<SubTask[]> =>
  request<{ data: SubTask[]; count: number }>(() =>
    client.put(`/activities/${activityId}/sub-tasks/order`, { subTaskIds }),
  ).then((r) => r.data),
```

### Requirement 5 — Buttons-only, no drag-and-drop (explicit decision, regression guard)

As a user who may be on a touch device, I don't want this checklist's reordering to carry the same
touch-support gap the weekend bucket list's drag-and-drop still has.

### FRONTEND-047-AC-12 [AUTO]: No drag handle or `draggable` element renders for sub-task reordering
**Statement**: `SubTaskList` shall render no drag handle and no element with a `draggable`
attribute for the purpose of reordering sub-tasks — reordering is reachable only via the Move
up/Move down buttons (`FRONTEND-047-AC-02`).

**Rationale**: Regression guard confirming the deliberate buttons-only decision (see Overview) —
without this, a future change could silently reintroduce the bucket list's drag-and-drop pattern
here without anyone noticing the scope had shifted.

**Test Case (Red)**:
```typescript
describe('FRONTEND-047-AC-12: no drag-and-drop affordance renders for sub-task reordering', () => {
  it('renders no draggable element', async () => {
    vi.spyOn(subTaskApi, 'getAll').mockResolvedValue([
      { id: 'a', activityId: 'a1', name: 'First', category: 'PLEASURABLE', createdAt: '…', position: 0 },
    ])
    const { container } = render(<SubTaskList activityId="a1" />)

    await screen.findByText('First')
    expect(container.querySelector('[draggable="true"]')).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement Move up/Move down only, with no `draggable` markup anywhere in
`SubTaskList.tsx`.

## Component/type changes

`types/subTask.ts` (extended):

```typescript
export interface SubTask {
  id: string
  activityId: string
  name: string
  category: ActivityCategory
  createdAt: string
  position: number
}
```

`services/subTaskApi.ts` (extended, new method appended):

```typescript
reorder: (activityId: string, subTaskIds: string[]): Promise<SubTask[]> =>
  request<{ data: SubTask[]; count: number }>(() =>
    client.put(`/activities/${activityId}/sub-tasks/order`, { subTaskIds }),
  ).then((r) => r.data),
```

`SubTaskList.tsx` — sorts by `position`, adds a shared `reorderInFlight` flag, and Move up/Move down
buttons inline in the existing row markup:

```typescript
const sortedSubTasks = (subTasks ?? []).slice().sort((a, b) => a.position - b.position)
const [reorderInFlight, setReorderInFlight] = useState(false)
const [reorderError, setReorderError] = useState<string | null>(null)

const handleReorder = async (subTaskIds: string[]) => {
  setReorderError(null)
  setReorderInFlight(true)
  try {
    const updated = await subTaskApi.reorder(activityId, subTaskIds)
    setSubTasks(updated)
  } catch (error) {
    setReorderError(getErrorMessage(error))
  } finally {
    setReorderInFlight(false)
  }
}

const handleMoveUp = (id: string) => {
  const ids = sortedSubTasks.map((subTask) => subTask.id)
  const index = ids.indexOf(id)
  if (index <= 0) return
  const next = [...ids]
  ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
  handleReorder(next)
}

const handleMoveDown = (id: string) => {
  const ids = sortedSubTasks.map((subTask) => subTask.id)
  const index = ids.indexOf(id)
  if (index === -1 || index >= ids.length - 1) return
  const next = [...ids]
  ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
  handleReorder(next)
}
```

Row markup addition, inside the existing `{!readOnly && (...)}` block, alongside Rename/Delete:

```tsx
<button
  type="button"
  className={styles.moveButton}
  onClick={() => handleMoveUp(subTask.id)}
  disabled={index === 0 || reorderInFlight}
  aria-label={`Move ${subTask.name} up`}
>
  ↑
</button>
<button
  type="button"
  className={styles.moveButton}
  onClick={() => handleMoveDown(subTask.id)}
  disabled={index === sortedSubTasks.length - 1 || reorderInFlight}
  aria-label={`Move ${subTask.name} down`}
>
  ↓
</button>
```

`SubTaskList.module.css` (extended) — `.moveButton`/`.moveButton:disabled`, copied from
`OccurrenceItem.module.css`'s existing equivalent rule (same small-inline-button treatment: `--code-bg`
background, `--accent-bg`/`--accent-border` on hover/focus-visible, `opacity: 0.4` disabled).

**No change needed** in `ActivityBank.tsx` (`SubTaskList` is self-contained/self-fetching) or
`ActivityPickerList.tsx` (confirmed out of scope — see Overview).

## Cross-references

| This spec | Contracts against |
|---|---|
| `position` | `SubTaskResponse.position` — exact shape from `planner_spec_023_subtask_reordering.md` |
| `PUT .../sub-tasks/order` | `SubTaskController.reorder(...)` — exact request/response shape from `planner_spec_023_subtask_reordering.md` |
| `types/subTask.ts` | Extended — `SubTask.position` |
| `services/subTaskApi.ts` | Extended — `reorder(...)` |
| `SubTaskList.tsx` | Extended — sorts by `position`, Move up/Move down controls, `reorderInFlight` state |
| `SubTaskList.module.css` | Extended — `.moveButton` rule |
| `frontend_spec_003_sub_tasks.md` | Origin of `SubTaskList`/`subTaskApi`/`types/subTask.ts` |
| `frontend_spec_006_repeatable_activities.md` | Origin of the `readOnly` prop this spec's controls are gated by |
| `frontend_spec_010_bucket_reordering.md` | Pattern precedent (Move up/down + shared reorder action), minus drag-and-drop |
| `planner_spec_023_subtask_reordering.md` | Paired backend spec |
| `ActivityPickerList.tsx` | Unmodified — out of scope, passively inherits the new ordering (see Overview) |

`SubTaskList.test.tsx`'s existing test suite mocks `subTaskApi` per-test via `vi.spyOn` and will need
new fixtures including `position` on every `SubTask` object — not a new AC, just an implementation-
time consequence of the type-shape change, matching `frontend_spec_010_bucket_reordering.md`'s
equivalent note for its own prop-shape change.

## Acceptance Criteria Summary

- [x] FRONTEND-047-AC-01 — sub-tasks render ordered by `position`, not array order
- [x] FRONTEND-047-AC-02 — Move up/Move down buttons with accessible names render per row (gated by `readOnly`)
- [x] FRONTEND-047-AC-03 — Move up disabled/no-op on the first item
- [x] FRONTEND-047-AC-04 — Move down disabled/no-op on the last item
- [x] FRONTEND-047-AC-05 — Move up/down computes the full swapped order and calls `subTaskApi.reorder`
- [x] FRONTEND-047-AC-06 — all reorder controls disabled while a reorder request is in flight
- [x] FRONTEND-047-AC-07 — a successful reorder replaces the displayed checklist with the response
- [x] FRONTEND-047-AC-08 — a rejected reorder surfaces an alert and keeps the previous order
- [x] FRONTEND-047-AC-09 — `readOnly` hides Move up/down controls
- [x] FRONTEND-047-AC-10 — `SubTask.position` type field added
- [x] FRONTEND-047-AC-11 — `subTaskApi.reorder(...)` calls `PUT .../sub-tasks/order`
- [x] FRONTEND-047-AC-12 — no drag-and-drop affordance renders (regression guard for the buttons-only decision)

## Summary

Implemented exactly as specced, no deviations. `SubTask.position: number` added to the type;
`subTaskApi.reorder(activityId, subTaskIds)` added (`PUT /activities/:id/sub-tasks/order`);
`SubTaskList.tsx` sorts by `position`, adds Move up/Move down buttons inline in the existing
`{!readOnly && (...)}` actions block (no new sub-component, no drag/`draggable` markup), with a
shared `reorderInFlight` flag and a `reorderError` alert mirroring the existing `deleteError`
pattern.

- **Tests**: 9 new test blocks added to `SubTaskList.test.tsx` (one per AC-01/02/03-04/05/06/07/
  08/09/12) plus 1 new test in `subTaskApi.test.ts` (AC-11). `SubTaskList.test.tsx` went from 25 to
  32 tests and `subTaskApi.test.ts` from 6 to 7 (net +8 — the AC-09 and AC-12 sketches were already
  trivially true before the Move buttons existed, since "no buttons render" and "no draggable
  renders" both held either way, so those two didn't move from red to green the way the other seven
  did; all nine are still present as explicit regression coverage). Full frontend suite: 652 passed
  (44 test files), up from 644 before this change, zero regressions. `npm run lint` (oxlint) clean,
  `npx tsc -b --noEmit` clean after also adding `position` to five pre-existing `SubTask` fixtures
  in other test files (`ActivityBank.test.tsx`, `SubTaskForm.test.tsx`, `ActivityPickerList.test.tsx`,
  `AssignActivityPicker.test.tsx`, `WeeklyPlanner.test.tsx`) that construct `SubTask` objects inline
  — a mechanical consequence of the type change, not a new requirement.
- **Real-browser verification** (completed in a follow-up pass, Chrome automation): logged into the
  live app at `:4321` against the real `:8420` backend, added three sub-tasks to "Go for a walk"
  (Put on shoes / Walk around the block / Take off shoes), and confirmed visually that the first
  row's Move-up and the last row's Move-down render greyed-out/disabled (zoomed screenshot), while
  the middle row has both enabled. Clicked Move up on the last item — "Put on shoes" and "Walk
  around the block" swapped immediately. **Reloaded the page from scratch** and re-expanded the
  checklist: the new order ("Walk around the block" first) was still there, confirming the real
  `PUT .../sub-tasks/order` round-trip persists server-side, not just client state. Confirmed the
  `readOnly` gate works in the live app by expanding an archived activity ("Renew passport") and
  observing its checklist panel renders no "Add sub-task" button either — the same `{!readOnly &&
  ...}` gate the new Move buttons sit inside — corroborating `FRONTEND-047-AC-09`'s automated
  coverage with a real-app check of the underlying mechanism. All three test sub-tasks were deleted
  afterward, leaving the activity bank as found. No deviations from the spec's embedded code
  sketches were needed.
- **Post-ship polish (user feedback, same PR)**: the plain "↑"/"↓" text glyphs (from this spec's
  own embedded sketches) were swapped for the shared `components/icons/ChevronIcon` component
  (extended with an optional `direction: 'up' | 'down'` prop, default `'down'` — a no-behavior-
  change extension for its pre-existing disclosure-triangle callers in `SuggestedActivities.tsx`).
  Applied to both `SubTaskList.tsx`'s new buttons and the already-shipped
  `frontend_spec_010_bucket_reordering.md`'s `OccurrenceItem.tsx` Move buttons, for visual
  consistency between the two near-identical patterns — the latter is a cosmetic, no-behavior-
  change touch-up (no AC there constrains the glyph), not a reopening of that spec. Also
  repositioned `SubTaskList`'s Move up/down buttons from the trailing actions group (alongside
  Rename/Delete) to a leading `.moveControls` span before the name/category chip, matching
  `OccurrenceItem`'s `ReorderControls` layout exactly (per user request). All 652 frontend tests
  still pass with no changes needed (every assertion targets `aria-label`, never the glyph or DOM
  position); real-browser re-verified in both locations.
