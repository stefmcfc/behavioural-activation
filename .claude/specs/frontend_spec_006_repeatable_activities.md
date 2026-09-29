# Mark Activities as Repeatable vs One-off (Frontend)

**Status**: Implemented
**Priority**: P2
**Depends on**: `planner_spec_006_repeatable_activities.md` (paired backend spec),
`frontend_spec_002_activity_bank.md` (`ActivityBank`/`ActivityForm`, `client.ts`/`request<T>()`
pattern, `ApiError`), `frontend_spec_004_week_planning.md` (`AssignActivityPicker` — this spec adds
a regression-guard requirement to it)
**Area**: Frontend
**Roadmap version**: V1 (matches the paired backend spec's roadmap placement)

## Overview

Lets a user mark an activity as repeatable or one-off from the existing create/edit form, see which
of their activities have auto-archived (and why they've disappeared from the everyday list), and
manually bring one back — consuming the endpoints from `planner_spec_006_repeatable_activities.md`.
This is a straight 1:1 frontend consumer of that backend contract, following the same interaction
patterns already established by `frontend_spec_002_activity_bank.md`'s `ActivityBank`/`ActivityForm`
(inline controls, no native `window.confirm()`) and `frontend_spec_003_sub_tasks.md`'s inline
show/hide toggle precedent. `ActivityBank.tsx` gains a "Show archived" toggle and, when an activity
is archived, an "Unarchive" action; `ActivityForm.tsx` gains a "Repeatable" checkbox.
`AssignActivityPicker.tsx` (from `frontend_spec_004_week_planning.md`) gets an explicit
regression-guard requirement, since it currently calls `activityApi.getAll()` with no filtering at
all and must never start surfacing archived activities as pickable.

If `frontend_spec_005_navigation_and_theme.md` (in progress elsewhere this session) has landed a
reusable `CategoryChip` component by the time this spec is implemented, the Activity Bank's category
display should pick up that styling automatically — this spec doesn't introduce a second, competing
way of rendering category, it extends whatever markup `ActivityBank.tsx` is already using for it at
implementation time.

**Out of scope**: a manual "Archive" action — per the paired backend spec, archiving is only ever
the automatic side effect of completing a one-off activity (or its last remaining sub-task) in the
weekly planner; this spec's UI surface for archiving is read-only (the "Archived" indicator) plus
the one reversing action, "Unarchive". No toast/real-time notification when an activity auto-archives
mid-session — a user only discovers it next time `ActivityBank`/`AssignActivityPicker` re-fetches.
No bulk archive management (multi-select archive/unarchive). No UI for a `SubTask`'s own
repeatable/archived state — sub-tasks don't have one, per the backend spec's Out-of-scope section.

## Requirements

### Requirement 1 — Mark an activity repeatable or one-off

As a user, I want to say whether an activity is repeatable or one-off when I create or edit it, so
the app knows whether it should ever tidy itself away.

- **FRONTEND-006-AC-01** [AUTO]: `ActivityForm` shall render a "Repeatable" checkbox, checked by
  default in `create` mode.
- **FRONTEND-006-AC-02** [AUTO]: When the create form is submitted, `ActivityForm` shall include the
  checkbox's current checked state as `repeatable` in the payload passed to `activityApi.create()`.
- **FRONTEND-006-AC-03** [AUTO]: In `edit` mode, `ActivityForm` shall prefill the checkbox from that
  activity's current `repeatable` value.
- **FRONTEND-006-AC-04** [AUTO]: When the edit form is submitted, `ActivityForm` shall include the
  checkbox's current checked state as `repeatable` in the payload passed to `activityApi.update()`.

### Requirement 2 — Archived activities are hidden from the everyday list by default

As a user, I want my activity bank to show only what I'm actively using, without archived one-offs
cluttering it.

- **FRONTEND-006-AC-05** [AUTO]: On mount, while the "Show archived" toggle (Requirement 3) is off,
  `ActivityBank` shall fetch via `activityApi.getAll()` with no `includeArchived` argument (i.e. the
  default, excluding archived activities), and shall render only the returned, non-archived
  activities.

### Requirement 3 — Reveal archived activities on demand

As a user, I want to be able to see my archived activities when I want to, without them being gone
for good.

- **FRONTEND-006-AC-06** [AUTO]: `ActivityBank` shall render a "Show archived" toggle, off by
  default.
- **FRONTEND-006-AC-07** [AUTO]: When the "Show archived" toggle is switched on, `ActivityBank`
  shall re-fetch via `activityApi.getAll(true)` and render each returned archived activity with a
  distinguishing "Archived" indicator.
- **FRONTEND-006-AC-08** [AUTO]: When the "Show archived" toggle is switched back off, `ActivityBank`
  shall re-fetch via `activityApi.getAll()` (equivalently, `includeArchived=false`), removing
  archived activities from the rendered list again.

### Requirement 4 — Unarchive an activity

As a user, I want to bring an archived activity back into active use if I decide I need it again.

- **FRONTEND-006-AC-09** [AUTO]: While "Show archived" is on, for an activity whose `archived` is
  `true`, `ActivityBank` shall render an "Unarchive" action alongside a "Show sub-tasks"/"Hide
  sub-tasks" toggle, in place of that row's normal Edit/Delete actions — an archived activity is not
  editable or deletable while archived, but its sub-tasks remain viewable (Requirement 4a).
- **FRONTEND-006-AC-10** [AUTO]: When "Unarchive" is activated for an activity, `ActivityBank` shall
  call `activityApi.unarchive(id)`.
- **FRONTEND-006-AC-11** [AUTO]: If `activityApi.unarchive()` resolves successfully, then
  `ActivityBank` shall update that activity's rendered state to no-longer-archived — its normal
  Edit/Delete/Show sub-tasks actions reappear, and, if "Show archived" is off, it drops out of the
  rendered list on the next fetch/state update.

### Requirement 4a — View (but not edit) an archived activity's sub-tasks

As a user, I want to check what was in an activity's checklist after it's archived, without having
to unarchive it first just to look.

- **FRONTEND-006-AC-15** [AUTO]: Activating "Show sub-tasks" on an archived activity shall expand
  the same `SubTaskList` used for non-archived activities, rendered in a read-only mode: it fetches
  and displays the existing sub-tasks (name + category), but renders no create form and no
  Rename/Delete actions on any sub-task row.

### Requirement 5 — Archived activities never appear in the weekly planner's picker

As a user, I don't want to accidentally re-plan an activity I've already finished with and archived.

- **FRONTEND-006-AC-12** [AUTO]: `AssignActivityPicker` shall call `activityApi.getAll()` with no
  `includeArchived` argument (equivalently, an explicit `false`) — an archived activity shall never
  appear as a selectable activity or sub-task parent in `AssignActivityPicker`, regardless of how
  many activities are archived.

### Requirement 6 — Error states

As a user, I want to be told clearly, without shaming language, when something goes wrong, and be
able to try again.

- **FRONTEND-006-AC-13** [AUTO]: If the "Show archived" re-fetch (`activityApi.getAll(true)`)
  rejects, then `ActivityBank` shall display the error in a `role="alert"` element together with a
  Retry control; activating Retry shall call `activityApi.getAll(true)` again, and the "Show
  archived" toggle shall remain on.
- **FRONTEND-006-AC-14** [AUTO]: If `activityApi.unarchive()` rejects, then `ActivityBank` shall
  display the error via `role="alert"` and leave that activity's rendered `archived` state
  unchanged — unarchiving is not applied optimistically before server confirmation, and
  re-activating "Unarchive" is the retry path.

## Types and service outline

`types/activity.ts` (extended):

```typescript
export type ActivityCategory = 'ROUTINE' | 'NECESSARY' | 'PLEASURABLE'

export interface Activity {
  id: string
  name: string
  category: ActivityCategory
  description: string | null
  repeatable: boolean
  archived: boolean
  createdAt: string
}

export interface ActivityInput {
  name: string
  category: ActivityCategory | null
  description: string | null
  repeatable: boolean
}
```

`services/activityApi.ts` (extended, same `client`/`request<T>()` pattern, no raw axios/fetch):

```typescript
import type { Activity, ActivityInput } from '../types/activity'
import { client, request } from './client'

export const activityApi = {
  getAll: (includeArchived = false): Promise<Activity[]> =>
    request<{ data: Activity[]; count: number }>(() =>
      client.get('/activities', includeArchived ? { params: { includeArchived: true } } : undefined),
    ).then((r) => r.data),

  create: (input: ActivityInput): Promise<Activity> =>
    request<Activity>(() => client.post('/activities', input)),

  update: (id: string, input: ActivityInput): Promise<Activity> =>
    request<Activity>(() => client.put(`/activities/${id}`, input)),

  remove: (id: string): Promise<void> => request<void>(() => client.delete(`/activities/${id}`)),

  archive: (id: string): Promise<Activity> =>
    request<Activity>(() => client.post(`/activities/${id}/archive`)),

  unarchive: (id: string): Promise<void> =>
    request<void>(() => client.delete(`/activities/${id}/archive`)),
}
```

`activityApi.getAll()`'s default parameter (`includeArchived = false`) means
`AssignActivityPicker`'s existing, unchanged call site (`activityApi.getAll()`, no arguments) keeps
behaving correctly for FRONTEND-006-AC-12 with no code change required there beyond this type/
service update — the regression guard is enforced by the default itself, verified by a dedicated
test rather than by relying on that being self-evident.

`ActivityForm.tsx` gains one `useState<boolean>` for the checkbox (`repeatable`, initialised from
`activity?.repeatable ?? true`), included in the `input` object passed to `create`/`update`
alongside the existing `name`/`category`/`description` fields.

`ActivityBank.tsx` gains `showArchived: boolean` state (default `false`) that both drives the
fetch's `includeArchived` argument and is passed to the re-fetch effect's dependency array, plus an
`unarchivingId`/`unarchiveError` pair mirroring the existing `deletingId`/`deleteError` pattern for
delete. An archived activity's row renders the existing name/category/description markup plus a
plain-text "(Archived)" indicator, and swaps its action buttons for a single "Unarchive" button in
place of Edit/Delete/Show sub-tasks (Requirement 4).

## Cross-references

| This spec | Contracts against |
|---|---|
| `activityApi.getAll/archive/unarchive` | `GET /api/v1/activities?includeArchived`, `POST`/`DELETE /api/v1/activities/{id}/archive` — exact shapes from `planner_spec_006_repeatable_activities.md` |
| `client.ts`, `request<T>()` | Reused unmodified from `frontend_spec_002_activity_bank.md` |
| `types/activity.ts` | Extended — `Activity.repeatable`/`archived`, `ActivityInput.repeatable` |
| `ApiError` (`src/types/api.ts`) | Reused unmodified |
| `ActivityForm` (`src/components/ActivityBank/ActivityForm.tsx`) | Extended — adds the "Repeatable" checkbox; no change to its existing name/category/description validation ACs from `frontend_spec_002_activity_bank.md` |
| `ActivityBank` (`src/components/ActivityBank/ActivityBank.tsx`) | Extended — adds "Show archived" toggle, "Archived" indicator, "Unarchive" action; no change to its existing create/edit/delete/expand-sub-tasks ACs from `frontend_spec_002_activity_bank.md`/`frontend_spec_003_sub_tasks.md` |
| `AssignActivityPicker` (`src/components/WeeklyPlanner/AssignActivityPicker.tsx`, `frontend_spec_004_week_planning.md`) | Regression-guarded, not functionally changed — must keep calling `activityApi.getAll()` with no `includeArchived` argument |
| `CategoryChip` (`frontend_spec_005_navigation_and_theme.md`, if landed by implementation time) | Optional pickup — see Overview |

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
describe('FRONTEND-006-AC-01/AC-02: repeatable checkbox defaults checked and is sent on create', () => {
  it('submits repeatable: true by default', async () => {
    vi.mocked(activityApi.create).mockResolvedValue({
      id: 'a1', name: 'Go for a walk', category: 'PLEASURABLE', description: null,
      repeatable: true, archived: false, createdAt: '2026-09-29T00:00:00Z',
    })
    render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

    expect(screen.getByLabelText(/repeatable/i)).toBeChecked()

    await userEvent.type(screen.getByLabelText(/^name$/i), 'Go for a walk')
    await userEvent.click(screen.getByRole('radio', { name: /pleasurable/i }))
    await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

    expect(activityApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ repeatable: true }),
    )
  })
})

describe('FRONTEND-006-AC-04: unchecking repeatable on edit sends repeatable: false', () => {
  it('submits the unchecked state', async () => {
    const activity = {
      id: 'a1', name: 'Apply for jobs', category: 'NECESSARY', description: null,
      repeatable: true, archived: false, createdAt: '2026-09-29T00:00:00Z',
    }
    vi.mocked(activityApi.update).mockResolvedValue({ ...activity, repeatable: false })
    render(<ActivityForm mode="edit" activity={activity} onSuccess={vi.fn()} />)

    await userEvent.click(screen.getByLabelText(/repeatable/i))
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(activityApi.update).toHaveBeenCalledWith(
      'a1', expect.objectContaining({ repeatable: false }),
    )
  })
})

describe('FRONTEND-006-AC-05/AC-07/AC-08: Show archived toggles which activities are fetched and rendered', () => {
  it('fetches without includeArchived by default, then with it once toggled on', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: 'a1', name: 'Go for a walk', category: 'PLEASURABLE', description: null, repeatable: true, archived: false, createdAt: '2026-09-29T00:00:00Z' },
    ])
    render(<ActivityBank />)

    await screen.findByText('Go for a walk')
    expect(activityApi.getAll).toHaveBeenCalledWith(false)

    vi.mocked(activityApi.getAll).mockResolvedValueOnce([
      { id: 'a1', name: 'Go for a walk', category: 'PLEASURABLE', description: null, repeatable: true, archived: false, createdAt: '2026-09-29T00:00:00Z' },
      { id: 'a2', name: 'Apply for jobs', category: 'NECESSARY', description: null, repeatable: false, archived: true, createdAt: '2026-09-29T00:00:00Z' },
    ])
    await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))

    expect(activityApi.getAll).toHaveBeenLastCalledWith(true)
    expect(await screen.findByText(/archived/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-006-AC-09/AC-10/AC-11: Unarchive replaces the normal actions and restores the activity', () => {
  it('calls unarchive and shows the normal actions again on success', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: 'a2', name: 'Apply for jobs', category: 'NECESSARY', description: null, repeatable: false, archived: true, createdAt: '2026-09-29T00:00:00Z' },
    ])
    vi.mocked(activityApi.unarchive).mockResolvedValue(undefined)
    render(<ActivityBank />)

    await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
    expect(await screen.findByRole('button', { name: /unarchive/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /unarchive/i }))

    expect(activityApi.unarchive).toHaveBeenCalledWith('a2')
    expect(await screen.findByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-006-AC-15: archived activity sub-tasks are viewable but read-only', () => {
  it('shows sub-tasks with no create form and no Rename/Delete actions', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: 'a2', name: 'Apply for jobs', category: 'NECESSARY', description: null, repeatable: false, archived: true, createdAt: '2026-09-29T00:00:00Z' },
    ])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([
      { id: 's1', activityId: 'a2', name: 'Update CV', category: 'NECESSARY', createdAt: '2026-09-29T00:00:00Z' },
    ])
    render(<ActivityBank />)

    await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
    await userEvent.click(await screen.findByRole('button', { name: /show sub-tasks/i }))

    expect(await screen.findByText('Update CV')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-006-AC-12: AssignActivityPicker never fetches with includeArchived', () => {
  it('calls activityApi.getAll with no arguments', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    render(
      <AssignActivityPicker
        weekStart="2026-09-28"
        target={{ dayOfWeek: 'MONDAY', slot: 'MORNING' }}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    await waitFor(() => expect(activityApi.getAll).toHaveBeenCalledWith())
  })
})

describe('FRONTEND-006-AC-14: unarchive failure shows an alert and leaves the activity archived', () => {
  it('keeps the Unarchive action visible after a rejected call', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: 'a2', name: 'Apply for jobs', category: 'NECESSARY', description: null, repeatable: false, archived: true, createdAt: '2026-09-29T00:00:00Z' },
    ])
    vi.mocked(activityApi.unarchive).mockRejectedValue(new ApiError(500, 'Something went wrong. Please try again.'))
    render(<ActivityBank />)

    await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
    await userEvent.click(await screen.findByRole('button', { name: /unarchive/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unarchive/i })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement `types/activity.ts`, `services/activityApi.ts`, `ActivityForm.tsx`,
`ActivityBank.tsx` as specified above until every sketch above (and the remaining ACs not sketched:
AC-03, AC-06, AC-13) passes.

## Acceptance Criteria Summary

- [x] FRONTEND-006-AC-01 — "Repeatable" checkbox, checked by default in create mode
- [x] FRONTEND-006-AC-02 — create submit includes `repeatable` from the checkbox
- [x] FRONTEND-006-AC-03 — edit mode prefills the checkbox from the activity's current value
- [x] FRONTEND-006-AC-04 — edit submit includes `repeatable` from the checkbox
- [x] FRONTEND-006-AC-05 — default mount fetch excludes archived activities
- [x] FRONTEND-006-AC-06 — "Show archived" toggle, off by default
- [x] FRONTEND-006-AC-07 — toggling on re-fetches with `includeArchived=true`, shows an "Archived" indicator
- [x] FRONTEND-006-AC-08 — toggling off re-fetches excluding archived again
- [x] FRONTEND-006-AC-09 — archived activity shows "Unarchive" + Show sub-tasks instead of Edit/Delete
- [x] FRONTEND-006-AC-10 — activating "Unarchive" calls `activityApi.unarchive(id)`
- [x] FRONTEND-006-AC-11 — successful unarchive restores the normal actions/list state
- [x] FRONTEND-006-AC-12 — `AssignActivityPicker` never fetches with `includeArchived=true` (regression guard)
- [x] FRONTEND-006-AC-13 — "Show archived" re-fetch failure shows alert + working Retry, toggle stays on
- [x] FRONTEND-006-AC-14 — unarchive failure shows alert, non-optimistic (activity stays archived)
- [x] FRONTEND-006-AC-15 — "Show sub-tasks" on an archived activity renders `SubTaskList` read-only (no create form, no Rename/Delete)
