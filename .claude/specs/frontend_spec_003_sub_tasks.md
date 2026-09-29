# Split an Activity into Smaller Sub-Tasks (Frontend)

**Status**: Implemented — `types/subTask.ts`, `services/subTaskApi.ts`,
`components/ActivityBank/{SubTaskList.tsx, SubTaskForm.tsx}` (new), `components/ActivityBank/
ActivityBank.tsx` (extended with per-row expand/collapse). All `[AUTO]` ACs verified by Vitest/RTL
specs colocated with each file (`subTaskApi.test.ts`, `SubTaskForm.test.tsx`, `SubTaskList.test.tsx`,
plus two new `describe` blocks in `ActivityBank.test.tsx` for the expand/collapse wiring). Full
frontend suite: 66 tests, 0 failures (`npm test`); `npm run lint` clean (oxlint, 0 warnings after
fixing a `react/set-state-in-effect` warning); `npm run build` and `tsc -b --noEmit` clean. Also
verified end-to-end against the real backend (`gradlew.bat bootRun` + `docker compose up -d`) via
direct HTTP calls matching the exact `subTaskApi` request/response shapes (create, list, rename,
delete, blank-name 400, CORS preflight from the `:4321` origin with credentials) — see
`planner_spec_003_sub_tasks.md`'s Status field for the backend half, now both implemented. This
spec pair (`planner_spec_003_sub_tasks.md` + this file) is fully done as of 2026-09-29. Note: no
in-session browser-automation tool was available to drive an actual Chrome instance for this pass,
so real-browser interaction (click-through of expand/add/rename/delete) was verified via the Vitest/
RTL suite (jsdom) plus a full curl-based API round-trip against the running backend, not a live
screenshot/click-through — flagged for a follow-up manual browser check before this ships.
**Priority**: P1
**Depends on**: `planner_spec_003_sub_tasks.md` (paired backend spec), `frontend_spec_002_activity_bank.md`
(existing `ActivityBank`/`ActivityForm`/`CategoryPicker` components, `client.ts`/`request<T>()`
pattern, `ApiError`)
**Area**: Frontend
**Roadmap version**: V1

## Overview

Lets a user expand any activity in their bank to view and manage a checklist of sub-tasks under it
— add, rename, delete — consuming the endpoints from `planner_spec_003_sub_tasks.md`. This is a
straight 1:1 frontend consumer of that backend contract, following the same interaction patterns
already established by `frontend_spec_002_activity_bank.md`'s `ActivityBank`/`ActivityForm`: inline
add/edit forms and an inline delete-confirm control, never a native `window.confirm()`. New
components `SubTaskList.tsx` (fetch, list, inline delete-confirm, wraps the add/rename form) and
`SubTaskForm.tsx` (create/rename, mirrors `ActivityForm`'s `mode` prop but with a single `name`
field and no category picker) are added under `src/components/ActivityBank/`, wired into the
existing `ActivityBank.tsx` via a per-row expand/collapse control.

**Out of scope**: everything `planner_spec_003_sub_tasks.md`'s Out-of-scope section already
excludes on the backend (completion/mood tracking UI, recursive sub-sub-tasks, drag-and-drop
reordering) has no frontend surface here either. Also out of scope: any UI for changing a
sub-task's category — it's read-only, inherited from the parent at creation time (Requirement 7
below), matching the backend's snapshot-not-editable contract exactly.

## Requirements

### Requirement 1 — Expand an activity to view its sub-task checklist

As a user, I want to expand one of my activities to see its sub-tasks, without navigating away from
the activity bank.

- **FRONTEND-003-AC-01** [AUTO]: When the user activates an activity row's expand control,
  `ActivityBank` shall render a `SubTaskList` for that activity's `id` and `category`.
- **FRONTEND-003-AC-02** [AUTO]: When the user activates the expand control again on an
  already-expanded activity row, `ActivityBank` shall collapse it, unmounting that activity's
  `SubTaskList`.
- **FRONTEND-003-AC-03** [AUTO]: When `SubTaskList` mounts, it shall call
  `subTaskApi.getAll(activityId)`.
- **FRONTEND-003-AC-04** [AUTO]: While the fetch is in flight, `SubTaskList` shall render a loading
  indicator via `<output>`.

### Requirement 2 — Add a sub-task

As a user, I want to add a sub-task under an activity, so I can break it down into smaller steps.

- **FRONTEND-003-AC-05** [AUTO]: When the inline add form is submitted with a non-blank name,
  `SubTaskForm` (in `create` mode) shall call `subTaskApi.create(activityId, { name })`.
- **FRONTEND-003-AC-06** [AUTO]: If the inline add form is submitted with a blank name, then
  `SubTaskForm` shall show an inline validation error without calling `subTaskApi.create()`.
- **FRONTEND-003-AC-07** [AUTO]: If `subTaskApi.create()` resolves successfully, then
  `SubTaskList` shall add the new sub-task to the rendered checklist and `SubTaskForm` shall clear.
- **FRONTEND-003-AC-08** [AUTO]: While a create submission is in flight, `SubTaskForm` shall
  disable its submit button and show a loading indicator.

### Requirement 3 — Rename a sub-task

As a user, I want to rename a sub-task inline, so I can correct or refine its wording without
leaving the checklist.

- **FRONTEND-003-AC-09** [AUTO]: When rename is activated for a sub-task, `SubTaskForm` (in `edit`
  mode) shall prefill its field from that sub-task's current `name`.
- **FRONTEND-003-AC-10** [AUTO]: When the rename form is submitted with a non-blank name,
  `SubTaskForm` shall call `subTaskApi.update(activityId, id, { name })`.
- **FRONTEND-003-AC-11** [AUTO]: If the rename form is submitted with a blank name, then
  `SubTaskForm` shall show an inline validation error without calling `subTaskApi.update()`.
- **FRONTEND-003-AC-12** [AUTO]: If `subTaskApi.update()` resolves successfully, then
  `SubTaskList` shall replace that sub-task's entry in the rendered checklist with the updated data
  and exit rename mode.

### Requirement 4 — Delete a sub-task

As a user, I want to remove a sub-task I no longer need, without an intrusive browser dialog.

- **FRONTEND-003-AC-13** [AUTO]: When delete is activated for a sub-task, `SubTaskList` shall show
  an inline confirmation control (e.g. the row's Delete button becomes a "Confirm delete / Cancel"
  pair) rather than a native `window.confirm()` dialog — matching `ActivityBank`'s existing delete
  pattern exactly.
- **FRONTEND-003-AC-14** [AUTO]: When the inline delete confirmation is confirmed, `SubTaskList`
  shall call `subTaskApi.remove(activityId, id)`.
- **FRONTEND-003-AC-15** [AUTO]: When the inline delete confirmation is cancelled, `SubTaskList`
  shall dismiss it without calling `subTaskApi.remove()`.
- **FRONTEND-003-AC-16** [AUTO]: If `subTaskApi.remove()` resolves successfully, then
  `SubTaskList` shall remove that sub-task from the rendered checklist.

### Requirement 5 — Empty checklist state

As a user, I want a clear indication when an activity has no sub-tasks yet, rather than an
unexplained blank area.

- **FRONTEND-003-AC-17** [AUTO]: If `subTaskApi.getAll()` resolves with zero sub-tasks, then
  `SubTaskList` shall render an explanatory empty-state message (e.g. "No sub-tasks yet.") rather
  than a blank checklist.

### Requirement 6 — Error states

As a user, I want to be told clearly, without shaming language, when something goes wrong, and be
able to try again.

- **FRONTEND-003-AC-18** [AUTO]: If `subTaskApi.getAll()` rejects, then `SubTaskList` shall display
  the error in a `role="alert"` element together with a Retry control; activating Retry shall call
  `subTaskApi.getAll(activityId)` again.
- **FRONTEND-003-AC-19** [AUTO]: If `subTaskApi.create()` rejects, then `SubTaskForm` shall display
  the error via `role="alert"` and preserve the entered name — resubmitting the unchanged form is
  the retry path, per the product's neutral, non-shaming error language.
- **FRONTEND-003-AC-20** [AUTO]: If `subTaskApi.update()` rejects, then `SubTaskForm` shall display
  the error via `role="alert"` and remain in rename mode with the entered value — resubmitting is
  the retry path.
- **FRONTEND-003-AC-21** [AUTO]: If `subTaskApi.remove()` rejects, then `SubTaskList` shall display
  the error via `role="alert"` and leave the sub-task in the checklist — deletion is not applied
  optimistically before server confirmation, and re-activating Delete is the retry path.

### Requirement 7 — Category is displayed, not editable

As a user, I want to see which category a sub-task inherited, without being able to change it
per sub-task.

- **FRONTEND-003-AC-22** [AUTO]: `SubTaskList` shall render each sub-task's `category` as a
  read-only inherited badge (reusing the same category label mapping `ActivityBank` already uses),
  never inside an editable control — `SubTaskForm` shall render no `CategoryPicker` in either
  `create` or `edit` mode.

## Types and service outline

`types/subTask.ts` (new):

```typescript
import type { ActivityCategory } from './activity'

export interface SubTask {
  id: string
  activityId: string
  name: string
  category: ActivityCategory
  createdAt: string
}

export interface SubTaskInput {
  name: string
}
```

`services/subTaskApi.ts` (new, mirrors `activityApi.ts`'s exact pattern — shared `client`/`request<T>()`
from `services/client.ts`, no raw axios/fetch):

```typescript
import type { SubTask, SubTaskInput } from '../types/subTask'
import { client, request } from './client'

export const subTaskApi = {
  getAll: (activityId: string): Promise<SubTask[]> =>
    request<{ data: SubTask[]; count: number }>(() =>
      client.get(`/activities/${activityId}/sub-tasks`),
    ).then((r) => r.data),

  create: (activityId: string, input: SubTaskInput): Promise<SubTask> =>
    request<SubTask>(() => client.post(`/activities/${activityId}/sub-tasks`, input)),

  update: (activityId: string, id: string, input: SubTaskInput): Promise<SubTask> =>
    request<SubTask>(() => client.patch(`/activities/${activityId}/sub-tasks/${id}`, input)),

  remove: (activityId: string, id: string): Promise<void> =>
    request<void>(() => client.delete(`/activities/${activityId}/sub-tasks/${id}`)),
}
```

`ActivityBank.tsx` gains per-row expand state (e.g. `expandedActivityId: string | null`) and, when
an activity row is expanded, renders `<SubTaskList activityId={activity.id} category={activity.category} />`
beneath it — no other change to its existing create/edit/delete behaviour from
`frontend_spec_002_activity_bank.md`.

## Cross-references

| This spec | Contracts against |
|---|---|
| `subTaskApi.getAll/create/update/remove` | `GET/POST /api/v1/activities/{activityId}/sub-tasks`, `PATCH/DELETE /api/v1/activities/{activityId}/sub-tasks/{id}` — exact shapes from `planner_spec_003_sub_tasks.md` |
| `client.ts`, `request<T>()` | Reused unmodified from `frontend_spec_002_activity_bank.md` |
| `types/subTask.ts` (new) | `SubTask`, `SubTaskInput` — `SubTask.category` typed as the existing `ActivityCategory` from `types/activity.ts` |
| `ApiError` (`src/types/api.ts`) | Reused unmodified |
| `SubTaskList`, `SubTaskForm` (`src/components/ActivityBank/`) | New components |
| `ActivityBank` (`src/components/ActivityBank/ActivityBank.tsx`) | Extended — adds per-row expand/collapse wiring to `SubTaskList`; no change to its existing create/edit/delete ACs from `frontend_spec_002_activity_bank.md` |

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
describe('FRONTEND-003-AC-01/AC-02: expand/collapse toggles the sub-task checklist', () => {
  it('renders SubTaskList on expand and removes it on collapse', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: '1', name: 'Organise a birthday party', category: 'PLEASURABLE', description: null, createdAt: '2026-09-29T00:00:00Z' },
    ])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    render(<ActivityBank />)

    await userEvent.click(await screen.findByRole('button', { name: /expand|show sub-tasks/i }))
    expect(await screen.findByText(/no sub-tasks yet/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /collapse|hide sub-tasks/i }))
    expect(screen.queryByText(/no sub-tasks yet/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-003-AC-07: successful create adds to the checklist and clears the form', () => {
  it('shows the new sub-task and resets the name field', async () => {
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    vi.mocked(subTaskApi.create).mockResolvedValue({
      id: 's1', activityId: 'a1', name: 'Create a guest list', category: 'PLEASURABLE', createdAt: '2026-09-29T00:00:00Z',
    })
    render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

    await userEvent.type(await screen.findByLabelText(/sub-task name/i), 'Create a guest list')
    await userEvent.click(screen.getByRole('button', { name: /add sub-task/i }))

    expect(await screen.findByText('Create a guest list')).toBeInTheDocument()
    expect(screen.getByLabelText(/sub-task name/i)).toHaveValue('')
  })
})

describe('FRONTEND-003-AC-13/AC-15: delete uses an inline confirm, not window.confirm', () => {
  it('cancelling the inline confirm does not call subTaskApi.remove', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    vi.mocked(subTaskApi.getAll).mockResolvedValue([
      { id: 's1', activityId: 'a1', name: 'Create a guest list', category: 'PLEASURABLE', createdAt: '2026-09-29T00:00:00Z' },
    ])
    render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

    await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(subTaskApi.remove).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-003-AC-18: fetch failure shows an alert with a working Retry control', () => {
  it('re-fetches when Retry is activated', async () => {
    vi.mocked(subTaskApi.getAll)
      .mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Please try again.'))
      .mockResolvedValueOnce([])
    render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByText(/no sub-tasks yet/i)).toBeInTheDocument()
    expect(subTaskApi.getAll).toHaveBeenCalledTimes(2)
  })
})

describe('FRONTEND-003-AC-22: category is shown read-only, never inside a picker', () => {
  it('renders the category label but no CategoryPicker in the add form', async () => {
    vi.mocked(subTaskApi.getAll).mockResolvedValue([
      { id: 's1', activityId: 'a1', name: 'Create a guest list', category: 'PLEASURABLE', createdAt: '2026-09-29T00:00:00Z' },
    ])
    render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

    expect(await screen.findByText(/pleasurable/i)).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})
```

## Acceptance Criteria Summary

- [x] FRONTEND-003-AC-01 — expand control renders `SubTaskList` for that activity
- [x] FRONTEND-003-AC-02 — activating expand again collapses/unmounts it
- [x] FRONTEND-003-AC-03 — `SubTaskList` fetches on mount
- [x] FRONTEND-003-AC-04 — loading state via `<output>`
- [x] FRONTEND-003-AC-05 — valid add submit calls `create()`
- [x] FRONTEND-003-AC-06 — blank name blocks add submit
- [x] FRONTEND-003-AC-07 — successful create adds to checklist, clears form
- [x] FRONTEND-003-AC-08 — in-flight create disables submit + shows loading
- [x] FRONTEND-003-AC-09 — rename form prefills from existing sub-task name
- [x] FRONTEND-003-AC-10 — valid rename submit calls `update()`
- [x] FRONTEND-003-AC-11 — blank name blocks rename submit
- [x] FRONTEND-003-AC-12 — successful rename replaces checklist entry, exits rename mode
- [x] FRONTEND-003-AC-13 — delete uses inline confirm, not `window.confirm()`
- [x] FRONTEND-003-AC-14 — confirm calls `remove()`
- [x] FRONTEND-003-AC-15 — cancel dismisses without calling `remove()`
- [x] FRONTEND-003-AC-16 — successful delete removes from checklist
- [x] FRONTEND-003-AC-17 — empty checklist shows explanatory message
- [x] FRONTEND-003-AC-18 — fetch failure shows alert + working Retry control
- [x] FRONTEND-003-AC-19 — create failure shows alert, preserves entered name
- [x] FRONTEND-003-AC-20 — rename failure shows alert, stays in rename mode
- [x] FRONTEND-003-AC-21 — delete failure shows alert, non-optimistic (sub-task stays)
- [x] FRONTEND-003-AC-22 — category shown as read-only badge, never in an editable picker
