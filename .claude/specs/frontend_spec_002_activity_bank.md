# Activity Bank (Frontend)

**Status**: Implemented and unit/component-tested — `frontend/src/services/{client.ts,activityApi.ts}`,
`frontend/src/types/activity.ts`, `frontend/src/components/ActivityBank/{ActivityBank.tsx,
ActivityForm.tsx,CategoryPicker.tsx}`, wired into `App.tsx`'s authenticated view. All `[AUTO]` ACs
verified by Vitest + RTL specs (`activityApi.test.ts`, `CategoryPicker.test.tsx`,
`ActivityForm.test.tsx`, `ActivityBank.test.tsx`) with `activityApi` mocked throughout — the real
backend from the paired `planner_spec_002_activity_bank.md` wasn't available while this was built, so
end-to-end verification against a live backend is still outstanding and should happen before/at
merge once both halves land.
**Priority**: P1
**Depends on**: `planner_spec_002_activity_bank.md` (paired backend spec), `frontend_spec_001_login.md`
(session-aware client pattern, `ApiError`)
**Area**: Frontend
**Roadmap version**: V1

## Overview

Builds the first real feature UI: `src/components/ActivityBank/` (list, create/edit form, category
picker), `src/services/activityApi.ts`, and `src/types/activity.ts` — all pre-named as V1 targets in
`.claude/steering/frontend_structure.md`. Also extracts a shared axios client module
(`src/services/client.ts`) out of `authApi.ts` so `activityApi.ts` doesn't duplicate the
`withCredentials`/`request<T>()` setup — a small, no-behavior-change diff to `authApi.ts`, the one
place this spec touches already-merged pair-1 code, done deliberately so the two services don't
diverge.

**Out of scope**: per-occurrence category override UI, historical category display, tags/difficulty/
effort UI (none exist in the design), pagination UI, soft-delete/restore UI. See
`planner_spec_002_activity_bank.md`'s Overview for the backend-side rationale — this frontend spec is
a straight 1:1 consumer of that contract.

## Requirements

### Requirement 1 — Shared API client + activity service contract

As a developer, I want `activityApi.ts` to reuse the same session-aware client pattern as
`authApi.ts`, so the two services don't diverge.

- **FRONTEND-002-AC-01** [AUTO]: The axios client instance (`baseURL` + `withCredentials: true`)
  shall be defined once in a shared `src/services/client.ts` module, imported by both `authApi.ts`
  and `activityApi.ts` — extracted from `authApi.ts`'s current inline definition as part of this
  spec.
- **FRONTEND-002-AC-02** [AUTO]: `activityApi.getAll()` shall call `GET /api/v1/activities` and
  unwrap the `{ data, count }` envelope to return `Activity[]`.
- **FRONTEND-002-AC-03** [AUTO]: `activityApi.create(input)` shall call `POST /api/v1/activities`
  with `{ name, category, description }` and return the created `Activity`.
- **FRONTEND-002-AC-04** [AUTO]: `activityApi.update(id, input)` shall call `PUT
  /api/v1/activities/{id}` with `{ name, category, description }` and return the updated `Activity`.
- **FRONTEND-002-AC-05** [AUTO]: `activityApi.remove(id)` shall call `DELETE
  /api/v1/activities/{id}` and resolve with no value on success.
- **FRONTEND-002-AC-06** [AUTO]: If any `activityApi` call rejects, then it shall throw a typed
  `ApiError` (`src/types/api.ts`) via the shared `request<T>()` wrapper, identically to `authApi`.

### Requirement 2 — Render the activity list

As a user, I want to see my activity bank, so that I know what I have to work with.

- **FRONTEND-002-AC-07** [AUTO]: When `ActivityBank` mounts, it shall call `activityApi.getAll()`.
- **FRONTEND-002-AC-08** [AUTO]: While the fetch is in flight, `ActivityBank` shall render a loading
  indicator via `<output>`.
- **FRONTEND-002-AC-09** [AUTO]: If `activityApi.getAll()` resolves with zero activities, then
  `ActivityBank` shall render an empty-state message rather than an unexplained blank list.
- **FRONTEND-002-AC-10** [AUTO]: If `activityApi.getAll()` resolves with one or more activities,
  then `ActivityBank` shall render each activity's name, category, and description (when present).
- **FRONTEND-002-AC-11** [AUTO]: If `activityApi.getAll()` rejects, then `ActivityBank` shall
  display the error in a `role="alert"` element.

### Requirement 3 — Create an activity

As a user, I want to add a new activity to my bank (US-001).

- **FRONTEND-002-AC-12** [AUTO]: When the create form is submitted with a non-blank name and a
  selected category, `ActivityForm` shall call `activityApi.create()`.
- **FRONTEND-002-AC-13** [AUTO]: If the form is submitted with a blank name, then `ActivityForm`
  shall show an inline validation error without calling `activityApi.create()`.
- **FRONTEND-002-AC-14** [AUTO]: If the form is submitted with no category selected, then
  `ActivityForm` shall show an inline validation error without calling `activityApi.create()`.
- **FRONTEND-002-AC-15** [AUTO]: If `activityApi.create()` resolves successfully, then
  `ActivityBank` shall add the new activity to the rendered list and `ActivityForm` shall clear.
- **FRONTEND-002-AC-16** [AUTO]: If `activityApi.create()` rejects, then `ActivityForm` shall
  display the error via `role="alert"` and preserve the entered field values, per the product's
  neutral, non-shaming error language.
- **FRONTEND-002-AC-17** [AUTO]: While a create submission is in flight, `ActivityForm` shall
  disable its submit button and show a loading indicator.

### Requirement 4 — Edit an activity

As a user, I want to edit an existing activity (US-001, US-002).

- **FRONTEND-002-AC-18** [AUTO]: When edit is activated for an activity, `ActivityForm` shall
  prefill its fields from that activity's current `name`, `category`, and `description`.
- **FRONTEND-002-AC-19** [AUTO]: When the edit form is submitted with a non-blank name and a
  selected category, `ActivityForm` shall call `activityApi.update()` with that activity's `id` and
  the edited fields.
- **FRONTEND-002-AC-20** [AUTO]: If `activityApi.update()` resolves successfully, then
  `ActivityBank` shall replace that activity's entry in the rendered list with the updated data.
- **FRONTEND-002-AC-21** [AUTO]: If `activityApi.update()` rejects, then `ActivityForm` shall
  display the error via `role="alert"` and remain in edit mode with the entered values.

### Requirement 5 — Delete an activity

As a user, I want to remove an activity I no longer need, without an intrusive browser dialog.

- **FRONTEND-002-AC-22** [AUTO]: When delete is activated for an activity, `ActivityBank` shall show
  an inline confirmation control (e.g. the row's Delete button becomes a "Confirm delete / Cancel"
  pair) rather than a native `window.confirm()` dialog.
- **FRONTEND-002-AC-23** [AUTO]: When the inline delete confirmation is confirmed, `ActivityBank`
  shall call `activityApi.remove(id)`.
- **FRONTEND-002-AC-24** [AUTO]: When the inline delete confirmation is cancelled, `ActivityBank`
  shall dismiss it without calling `activityApi.remove()`.
- **FRONTEND-002-AC-25** [AUTO]: If `activityApi.remove()` resolves successfully, then
  `ActivityBank` shall remove that activity from the rendered list.
- **FRONTEND-002-AC-26** [AUTO]: If `activityApi.remove()` rejects, then `ActivityBank` shall
  display the error via `role="alert"` and leave the activity in the list — deletion is not applied
  optimistically before server confirmation.

### Requirement 6 — Reusable category picker

As a developer, I want one category-selection component shared by create and edit, so the two forms
can't drift.

- **FRONTEND-002-AC-27** [AUTO]: The `CategoryPicker` component shall render exactly three
  selectable options — Routine, Necessary, Pleasurable — mapped to the `ActivityCategory` values
  `ROUTINE`, `NECESSARY`, `PLEASURABLE`.
- **FRONTEND-002-AC-28** [AUTO]: `CategoryPicker` shall accept the currently selected
  `ActivityCategory | null` and an `onChange` callback as props, and shall be used by `ActivityForm`
  in both its create and edit modes.

## Types and service outline

`types/activity.ts`:

```typescript
export type ActivityCategory = 'ROUTINE' | 'NECESSARY' | 'PLEASURABLE'

export interface Activity {
  id: string
  name: string
  category: ActivityCategory
  description: string | null
  createdAt: string
}

export interface ActivityInput {
  name: string
  category: ActivityCategory | null
  description: string | null
}
```

`services/client.ts` (new, extracted from `authApi.ts`):

```typescript
import axios, { isAxiosError } from 'axios'
import { ApiError, type ApiErrorResponse } from '../types/api'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8420/api/v1'

export const client = axios.create({ baseURL: API_BASE, withCredentials: true })

export async function request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const response = await fn()
    return response.data
  } catch (error) {
    if (isAxiosError<ApiErrorResponse>(error)) {
      const status = error.response?.status ?? 0
      const message = error.response?.data?.message ?? error.message
      const details = error.response?.data?.details ?? null
      throw new ApiError(status, message, details)
    }
    throw error
  }
}
```

`services/activityApi.ts`:

```typescript
import { client, request } from './client'
import type { Activity, ActivityInput } from '../types/activity'

export const activityApi = {
  getAll: (): Promise<Activity[]> =>
    request<{ data: Activity[]; count: number }>(() => client.get('/activities')).then(r => r.data),

  create: (input: ActivityInput): Promise<Activity> =>
    request<Activity>(() => client.post('/activities', input)),

  update: (id: string, input: ActivityInput): Promise<Activity> =>
    request<Activity>(() => client.put(`/activities/${id}`, input)),

  remove: (id: string): Promise<void> =>
    request<void>(() => client.delete(`/activities/${id}`)),
}
```

`authApi.ts` is updated to import `client`/`request` from `services/client.ts` instead of defining
its own axios instance — same exported behavior, no AC change to `frontend_spec_001_login.md`.

## Cross-references

| This spec | Contracts against |
|---|---|
| `activityApi.getAll/create/update/remove` | `GET/POST /api/v1/activities`, `PUT/DELETE /api/v1/activities/{id}` — exact shapes from `planner_spec_002_activity_bank.md` |
| `client.ts` (new) | Extracted from `authApi.ts` (spec 001) — shared by `authApi` and `activityApi` |
| `types/activity.ts` (new) | `Activity`, `ActivityCategory`, `ActivityInput` |
| `ApiError` (`src/types/api.ts`) | Reused unmodified from spec 001 |
| `ActivityBank`, `ActivityForm`, `CategoryPicker` (`src/components/ActivityBank/`) | New components |

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
describe('FRONTEND-002-AC-09: empty bank shows an explanatory empty state', () => {
  it('renders an empty-state message, not a blank list', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<ActivityBank />)
    expect(await screen.findByText(/no activities yet/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-002-AC-15: successful create adds to the list and clears the form', () => {
  it('shows the new activity and resets the form fields', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    vi.mocked(activityApi.create).mockResolvedValue({
      id: '1', name: 'Walk', category: 'ROUTINE', description: null, createdAt: '2026-09-28T00:00:00Z',
    })
    render(<ActivityBank />)

    await userEvent.type(await screen.findByLabelText(/name/i), 'Walk')
    await userEvent.click(screen.getByLabelText(/routine/i))
    await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

    expect(await screen.findByText('Walk')).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toHaveValue('')
  })
})

describe('FRONTEND-002-AC-22/AC-24: delete uses an inline confirm, not window.confirm', () => {
  it('cancelling the inline confirm does not call activityApi.remove', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: '1', name: 'Walk', category: 'ROUTINE', description: null, createdAt: '2026-09-28T00:00:00Z' },
    ])
    render(<ActivityBank />)

    await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(activityApi.remove).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-002-AC-18: edit form prefills from existing activity data', () => {
  it("shows the activity's current values in the form fields", async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: '1', name: 'Walk', category: 'ROUTINE', description: 'Around the block', createdAt: '2026-09-28T00:00:00Z' },
    ])
    render(<ActivityBank />)

    await userEvent.click(await screen.findByRole('button', { name: /edit/i }))

    expect(screen.getByLabelText(/name/i)).toHaveValue('Walk')
    expect(screen.getByLabelText(/description/i)).toHaveValue('Around the block')
  })
})
```

## Acceptance Criteria Summary

- [x] FRONTEND-002-AC-01 — shared `client.ts` extracted, used by both `authApi` and `activityApi`
- [x] FRONTEND-002-AC-02 — `getAll()` unwraps `{data, count}` envelope
- [x] FRONTEND-002-AC-03 — `create()` posts and returns created activity
- [x] FRONTEND-002-AC-04 — `update()` puts and returns updated activity
- [x] FRONTEND-002-AC-05 — `remove()` deletes
- [x] FRONTEND-002-AC-06 — failures throw typed `ApiError`
- [x] FRONTEND-002-AC-07 — list fetched on mount
- [x] FRONTEND-002-AC-08 — loading state via `<output>`
- [x] FRONTEND-002-AC-09 — empty state message
- [x] FRONTEND-002-AC-10 — populated list renders name/category/description
- [x] FRONTEND-002-AC-11 — fetch failure shows `role="alert"`
- [x] FRONTEND-002-AC-12 — valid create submit calls API
- [x] FRONTEND-002-AC-13 — blank name blocks submit
- [x] FRONTEND-002-AC-14 — no category blocks submit
- [x] FRONTEND-002-AC-15 — success adds to list, clears form
- [x] FRONTEND-002-AC-16 — create failure preserves entered values
- [x] FRONTEND-002-AC-17 — in-flight create disables submit + shows loading
- [x] FRONTEND-002-AC-18 — edit form prefills from existing data
- [x] FRONTEND-002-AC-19 — valid edit submit calls API
- [x] FRONTEND-002-AC-20 — success replaces list entry
- [x] FRONTEND-002-AC-21 — edit failure stays in edit mode
- [x] FRONTEND-002-AC-22 — delete uses inline confirm, not `window.confirm()`
- [x] FRONTEND-002-AC-23 — confirm calls `remove()`
- [x] FRONTEND-002-AC-24 — cancel dismisses without calling `remove()`
- [x] FRONTEND-002-AC-25 — success removes from list
- [x] FRONTEND-002-AC-26 — failure shows alert, non-optimistic (activity stays)
- [x] FRONTEND-002-AC-27 — `CategoryPicker` renders exactly 3 options
- [x] FRONTEND-002-AC-28 — `CategoryPicker` shared by create/edit modes
