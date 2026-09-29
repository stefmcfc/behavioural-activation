# Week Planning (Frontend)

**Status**: Implemented — all 40 ACs verified (2026-09-29). 98 Vitest tests, 0 failures, 0
regressions to existing auth/activity-bank/sub-task suites; `npm run lint` clean (0 warnings).
Verified end-to-end against the real backend (Postgres, this branch's `feature/week-planning`
build) via a full `curl` session-cookie walkthrough of every `planApi` call the components make
(login → create scheduled + bucket occurrences from both an activity and a sub-task → move →
complete → undo → carry-forward → cascade-delete cleanup) — no interactive browser-automation tool
was available in this session (despite being expected per the task brief), so this replaces the
usual in-browser click-through as the "real backend, real entities" verification pass; every
`data-testid`/role/copy string the frontend renders was cross-checked against the actual JSON each
call returned. One real backend gap found and fixed during this pass: `GET /api/v1/plan`
(and `move`/`complete`/`carryForward`) 500'd with `LazyInitializationException` once occurrences
existed, because `open-in-view: false` closes the Hibernate session at the end of each
`@Transactional` `PlanService` method, but `PlanController.toResponse()` reads
`occurrence.getActivity()/getSubTask()` (LAZY associations) afterwards — masked in
`PlanControllerSpec` because it mocks `PlanService` with plain in-memory (non-proxy) entities.
Fixed with `Hibernate.initialize()` calls inside the transactional service methods; all 155 backend
Spock tests still pass after the fix (0 regressions). See `PlanService.java` and
`ROADMAP.md`/`CHANGELOG.md` — not yet updated by this pass per the task's explicit instruction to
report back instead.
**Priority**: P1 — last of the 4 V1 spec pairs.
**Depends on**: `planner_spec_004_week_planning.md` (paired backend spec),
`frontend_spec_002_activity_bank.md` (`activityApi`, `client.ts`/`request<T>()` pattern, `ApiError`,
category label mapping), `frontend_spec_003_sub_tasks.md` (`subTaskApi`, sub-task list shape — the
assign picker below builds on both)
**Area**: Frontend
**Roadmap version**: V1

## Overview

Builds the weekly planner UI: a Monday–Friday × Morning/Afternoon/Evening grid, a weekend bucket
list section, and week navigation, consuming the endpoints from
`planner_spec_004_week_planning.md`. This is the frontend half of Epics 2–4 in
`.claude/HIGH_LEVEL_DESIGN.md` — US-003 (view a weekly plan), US-004 (plan/move/remove an
activity), US-006 (plan a weekday in advance, edit without penalty), US-007 (weekend bucket list,
including carry-forward), US-008 (balance weekend activities), and US-009 (complete an activity,
including undo). New components under `src/components/WeeklyPlanner/` (`WeeklyPlanner.tsx`
container, `PlannerGrid.tsx`, `BucketList.tsx`, `AssignActivityPicker.tsx`), a new
`src/types/plan.ts`, and a new `src/services/planApi.ts` — all backend calls go through this
service layer, per the project's hard rule (no raw `axios`/`fetch` in components).

Assigning an activity or sub-task to the plan uses one shared picker
(`AssignActivityPicker`) that lists both — reusing `activityApi.getAll()` for the activity list and
`subTaskApi.getAll(activityId)` per activity for its sub-tasks, per the already-settled "sub-tasks
OR activity" design from `planner_spec_003_sub_tasks.md`'s forward-contract note. This is an N+1
fetch pattern (one call per activity to list its sub-tasks), accepted deliberately at this app's
personal/single-user scale — see `frontend_conventions.md`'s Performance section ("not a real
concern at this app's scale... don't over-optimize prematurely").

The weekend-bucket "balance" signal (US-008) is computed entirely client-side from the same `GET
/api/v1/plan` response already fetched for the grid: `BucketList` flags a category with zero
occurrences in the current bucket while at least one other category has ≥1. There is no numeric
ratio, no threshold, and no backend involvement — this mirrors the exact assumption recorded in
`planner_spec_004_week_planning.md`'s Overview.

**Out of scope**: mood/pleasure/achievement rating UI (US-010/US-011, V2); recurring-activity UI
(US-012, V2); a dedicated history page — `weekStart` navigation on this same grid/bucket view
satisfies "basic activity history" (see the backend spec's Overview); drag-and-drop assignment
(already a deferred idea in `future_ideas.md`); any work-block-specific UI — work is just a regular
activity, assigned and completed through the exact same flow as anything else (per
`planner_spec_004_week_planning.md`'s US-005 note).

## Requirements

### Requirement 1 — `planApi` service contract

As a developer, I want `planApi.ts` to follow the same `client`/`request<T>()` pattern as
`activityApi.ts`/`subTaskApi.ts`, so the three services don't diverge.

- **FRONTEND-004-AC-01** [AUTO]: `planApi.getWeek(weekStart)` shall call `GET
  /api/v1/plan?weekStart={weekStart}` and unwrap the `{ data, count }` envelope to return
  `PlannedOccurrence[]`.
- **FRONTEND-004-AC-02** [AUTO]: `planApi.create(input)` shall call `POST
  /api/v1/plan/occurrences` with the given `PlannedOccurrenceInput` and return the created
  `PlannedOccurrence`.
- **FRONTEND-004-AC-03** [AUTO]: `planApi.move(id, input)` shall call `PATCH
  /api/v1/plan/occurrences/{id}` with the given `PlannedOccurrenceMoveInput` and return the updated
  `PlannedOccurrence`.
- **FRONTEND-004-AC-04** [AUTO]: `planApi.remove(id)` shall call `DELETE
  /api/v1/plan/occurrences/{id}` and resolve with no value on success.
- **FRONTEND-004-AC-05** [AUTO]: `planApi.complete(id)` shall call `POST
  /api/v1/plan/occurrences/{id}/completion` and return the updated `PlannedOccurrence`.
- **FRONTEND-004-AC-06** [AUTO]: `planApi.undoCompletion(id)` shall call `DELETE
  /api/v1/plan/occurrences/{id}/completion` and resolve with no value on success.
- **FRONTEND-004-AC-07** [AUTO]: `planApi.carryForward(id)` shall call `POST
  /api/v1/plan/occurrences/{id}/carry-forward` and return the updated `PlannedOccurrence`.
- **FRONTEND-004-AC-08** [AUTO]: If any `planApi` call rejects, then it shall throw a typed
  `ApiError` (`src/types/api.ts`) via the shared `request<T>()` wrapper, identically to
  `activityApi`/`subTaskApi`.

### Requirement 2 — Render the weekly grid

As a user, I want to see my week divided into Morning/Afternoon/Evening per weekday, with planned
activities clearly visible and completed ones visually distinguishable, so I can plan around my
routine (US-003).

- **FRONTEND-004-AC-09** [AUTO]: When `WeeklyPlanner` mounts, it shall call
  `planApi.getWeek(weekStart)` for the Monday of the current week.
- **FRONTEND-004-AC-10** [AUTO]: While the fetch is in flight, `WeeklyPlanner` shall render a
  loading indicator via `<output>`.
- **FRONTEND-004-AC-11** [AUTO]: `PlannerGrid` shall render one cell per weekday (Monday–Friday) ×
  slot (Morning/Afternoon/Evening), placing each scheduled `PlannedOccurrence` (non-null
  `dayOfWeek`/`slot`) into its matching cell.
- **FRONTEND-004-AC-12** [AUTO]: Where more than one `PlannedOccurrence` shares the same
  `dayOfWeek`+`slot`, `PlannerGrid` shall render all of them as a list within that cell, not just
  the most recent one.
- **FRONTEND-004-AC-13** [AUTO]: While a `PlannedOccurrence` has `completed: true`, `PlannerGrid`
  and `BucketList` shall render it visually distinguishable from incomplete occurrences (e.g. a
  "Completed" label), matching the product's neutral, non-shaming visual language — never a
  red/urgent styling for the incomplete state.

### Requirement 3 — Navigate between weeks

As a user, I want to move between weeks, so I can plan ahead or look back at what I did (US-003,
and — combined with completion state — "basic activity history").

- **FRONTEND-004-AC-14** [AUTO]: When the user activates "Previous week", `WeeklyPlanner` shall
  set `weekStart` to 7 days earlier and re-fetch via `planApi.getWeek`.
- **FRONTEND-004-AC-15** [AUTO]: When the user activates "Next week", `WeeklyPlanner` shall set
  `weekStart` to 7 days later and re-fetch via `planApi.getWeek`.
- **FRONTEND-004-AC-16** [AUTO]: `WeeklyPlanner` shall display the Monday date of the currently
  viewed week, so the user always knows which week they're looking at.

### Requirement 4 — Weekend bucket list and balance highlight

As a user, I want a flexible list of weekend activities, and to see if it's skewed heavily toward
one category, without it being treated as a failure (US-007, US-008).

- **FRONTEND-004-AC-17** [AUTO]: `BucketList` shall render every `PlannedOccurrence` for the
  current week with `dayOfWeek`/`slot` both null (weekend-bucket items), separately from
  `PlannerGrid`.
- **FRONTEND-004-AC-18** [AUTO]: Where the bucket list has at least one occurrence overall and at
  least one `ActivityCategory` has zero occurrences in it while another category has one or more,
  `BucketList` shall visually highlight the zero-count category as a neutral, non-judgemental
  signal (e.g. "No Pleasurable activities in your bucket list yet") — never phrased as a failure or
  paired with a numeric ratio/threshold.
- **FRONTEND-004-AC-19** [AUTO]: If the bucket list has zero occurrences, then `BucketList` shall
  render an explanatory empty-state message and shall not render the balance highlight from AC-18.

### Requirement 5 — Assign an activity or sub-task to the plan

As a user, I want to pick an activity or one of its sub-tasks from my bank and place it in a day's
slot or the weekend bucket, so I can build out my week (US-004, US-006, US-007).

- **FRONTEND-004-AC-20** [AUTO]: When the user activates "Add" on a grid cell or on the bucket
  list, `WeeklyPlanner` shall open `AssignActivityPicker`, which shall fetch and list both
  `activityApi.getAll()`'s activities and, per activity, its sub-tasks via
  `subTaskApi.getAll(activityId)`.
- **FRONTEND-004-AC-21** [AUTO]: When the user selects an activity or a sub-task in
  `AssignActivityPicker` and confirms, it shall call `planApi.create()` with the corresponding
  `activityId`/`subTaskId`, the current `weekStart`, and either the target cell's `dayOfWeek`+`slot`
  (grid) or neither (bucket).
- **FRONTEND-004-AC-22** [AUTO]: If `planApi.create()` resolves successfully, then the new
  occurrence shall appear immediately in its target grid cell or the bucket list, and
  `AssignActivityPicker` shall close.

### Requirement 6 — Move or reschedule an occurrence

As a user, I want to move a planned activity to a different day/slot, promote a bucket item into a
slot, or send a scheduled item back to the bucket, without the app penalising me for changing my
mind (US-004, US-006).

- **FRONTEND-004-AC-23** [AUTO]: When the user activates "Move" on an occurrence and selects a new
  day and slot, `WeeklyPlanner` shall call `planApi.move(id, { dayOfWeek, slot })`.
- **FRONTEND-004-AC-24** [AUTO]: When the user activates "Move to bucket" on a scheduled
  occurrence, `WeeklyPlanner` shall call `planApi.move(id, { dayOfWeek: null, slot: null })`.
- **FRONTEND-004-AC-25** [AUTO]: If `planApi.move()` resolves successfully, then the occurrence
  shall re-render in its new location (grid cell or bucket list) without a page reload.

### Requirement 7 — Remove an occurrence

As a user, I want to remove a planned activity from my week without an intrusive browser dialog and
without deleting it from my activity bank (US-004).

- **FRONTEND-004-AC-26** [AUTO]: When the user activates "Remove" on an occurrence, `WeeklyPlanner`
  shall show an inline confirmation control rather than a native `window.confirm()` dialog —
  matching `ActivityBank`/`SubTaskList`'s existing delete pattern exactly.
- **FRONTEND-004-AC-27** [AUTO]: When the inline removal is confirmed, `WeeklyPlanner` shall call
  `planApi.remove(id)`.
- **FRONTEND-004-AC-28** [AUTO]: When the inline removal is cancelled, `WeeklyPlanner` shall
  dismiss it without calling `planApi.remove()`.
- **FRONTEND-004-AC-29** [AUTO]: If `planApi.remove()` resolves successfully, then the occurrence
  shall disappear from the grid cell or bucket list.

### Requirement 8 — Complete and undo

As a user, I want to mark a planned activity as done, and undo that if I tapped it by mistake
(US-009).

- **FRONTEND-004-AC-30** [AUTO]: When the user activates "Complete" on an incomplete occurrence,
  `WeeklyPlanner` shall call `planApi.complete(id)`.
- **FRONTEND-004-AC-31** [AUTO]: If `planApi.complete()` resolves successfully, then the occurrence
  shall re-render as completed (per AC-13).
- **FRONTEND-004-AC-32** [AUTO]: When the user activates "Undo" on a completed occurrence,
  `WeeklyPlanner` shall call `planApi.undoCompletion(id)`.
- **FRONTEND-004-AC-33** [AUTO]: If `planApi.undoCompletion()` resolves successfully, then the
  occurrence shall re-render as not completed.

### Requirement 9 — Carry a bucket item forward

As a user, I want to carry an unfinished weekend item forward to next week instead of losing it
(US-007).

- **FRONTEND-004-AC-34** [AUTO]: `BucketList` shall render a "Carry forward" control only for
  weekend-bucket occurrences (`dayOfWeek`/`slot` both null) — never for a scheduled grid occurrence.
- **FRONTEND-004-AC-35** [AUTO]: When the user activates "Carry forward" on a bucket occurrence,
  `WeeklyPlanner` shall call `planApi.carryForward(id)`.
- **FRONTEND-004-AC-36** [AUTO]: If `planApi.carryForward()` resolves successfully, then the
  occurrence shall be removed from the currently viewed week's bucket list (its `weekStart` has
  moved to next week, so it no longer belongs in the current view).

### Requirement 10 — Empty week state

As a user, I want a clear indication when I haven't planned anything yet for a given week, rather
than an unexplained blank grid.

- **FRONTEND-004-AC-37** [AUTO]: If `planApi.getWeek()` resolves with zero scheduled occurrences
  for the week, then `PlannerGrid` shall render an explanatory empty-state message in addition to
  rendering the (empty) grid structure, rather than an unexplained blank area.

### Requirement 11 — Error states

As a user, I want to be told clearly, without shaming language, when something goes wrong, and be
able to try again.

- **FRONTEND-004-AC-38** [AUTO]: If `planApi.getWeek()` rejects, then `WeeklyPlanner` shall display
  the error in a `role="alert"` element together with a Retry control; activating Retry shall call
  `planApi.getWeek(weekStart)` again.
- **FRONTEND-004-AC-39** [AUTO]: If `planApi.create()` rejects, then `AssignActivityPicker` shall
  display the error via `role="alert"`, keep the picker open, and preserve the user's current
  selection — resubmitting is the retry path.
- **FRONTEND-004-AC-40** [AUTO]: If `planApi.move()`, `planApi.remove()`, `planApi.complete()`,
  `planApi.undoCompletion()`, or `planApi.carryForward()` rejects, then `WeeklyPlanner` shall
  display the error via `role="alert"` and leave the affected occurrence in its prior state/
  location — none of these actions are applied optimistically before server confirmation, and
  re-activating the same control is the retry path.

## Types and service outline

`types/plan.ts` (new):

```typescript
import type { ActivityCategory } from './activity'

export type PlanDayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export type PlanSlot = 'MORNING' | 'AFTERNOON' | 'EVENING'

export interface PlannedOccurrence {
  id: string
  activityId: string | null
  subTaskId: string | null
  name: string
  category: ActivityCategory
  weekStart: string
  dayOfWeek: PlanDayOfWeek | null
  slot: PlanSlot | null
  completed: boolean
  completedAt: string | null
  createdAt: string
}

export interface PlannedOccurrenceInput {
  activityId: string | null
  subTaskId: string | null
  weekStart: string
  dayOfWeek: PlanDayOfWeek | null
  slot: PlanSlot | null
}

export interface PlannedOccurrenceMoveInput {
  dayOfWeek: PlanDayOfWeek | null
  slot: PlanSlot | null
}
```

`services/planApi.ts` (new, mirrors `activityApi.ts`/`subTaskApi.ts`'s exact pattern — shared
`client`/`request<T>()` from `services/client.ts`, no raw axios/fetch):

```typescript
import type {
  PlannedOccurrence,
  PlannedOccurrenceInput,
  PlannedOccurrenceMoveInput,
} from '../types/plan'
import { client, request } from './client'

export const planApi = {
  getWeek: (weekStart: string): Promise<PlannedOccurrence[]> =>
    request<{ data: PlannedOccurrence[]; count: number }>(() =>
      client.get('/plan', { params: { weekStart } }),
    ).then((r) => r.data),

  create: (input: PlannedOccurrenceInput): Promise<PlannedOccurrence> =>
    request<PlannedOccurrence>(() => client.post('/plan/occurrences', input)),

  move: (id: string, input: PlannedOccurrenceMoveInput): Promise<PlannedOccurrence> =>
    request<PlannedOccurrence>(() => client.patch(`/plan/occurrences/${id}`, input)),

  remove: (id: string): Promise<void> =>
    request<void>(() => client.delete(`/plan/occurrences/${id}`)),

  complete: (id: string): Promise<PlannedOccurrence> =>
    request<PlannedOccurrence>(() => client.post(`/plan/occurrences/${id}/completion`)),

  undoCompletion: (id: string): Promise<void> =>
    request<void>(() => client.delete(`/plan/occurrences/${id}/completion`)),

  carryForward: (id: string): Promise<PlannedOccurrence> =>
    request<PlannedOccurrence>(() => client.post(`/plan/occurrences/${id}/carry-forward`)),
}
```

`WeeklyPlanner.tsx` owns `weekStart` state (defaulting to the current week's Monday, computed
client-side), fetches via `planApi.getWeek`, and renders `PlannerGrid` + `BucketList` beneath week
navigation controls — the same container/presentational split `ActivityBank`/`SubTaskList` already
establish. `AssignActivityPicker` is opened from either `PlannerGrid` (with a target
`dayOfWeek`+`slot`) or `BucketList` (with no target), and reports the created occurrence back up to
`WeeklyPlanner` via an `onSuccess` callback, matching `ActivityForm`/`SubTaskForm`'s existing prop
shape.

## Cross-references

| This spec | Contracts against |
|---|---|
| `planApi.getWeek/create/move/remove/complete/undoCompletion/carryForward` | `GET /api/v1/plan`, `POST/PATCH/DELETE /api/v1/plan/occurrences[/{id}]`, `POST/DELETE /api/v1/plan/occurrences/{id}/completion`, `POST /api/v1/plan/occurrences/{id}/carry-forward` — exact shapes from `planner_spec_004_week_planning.md` |
| `client.ts`, `request<T>()` | Reused unmodified from `frontend_spec_002_activity_bank.md` |
| `types/plan.ts` (new) | `PlannedOccurrence`, `PlannedOccurrenceInput`, `PlannedOccurrenceMoveInput`, `PlanDayOfWeek`, `PlanSlot` — `PlannedOccurrence.category` typed as the existing `ActivityCategory` from `types/activity.ts` |
| `ApiError` (`src/types/api.ts`) | Reused unmodified |
| `activityApi.getAll()`, `subTaskApi.getAll(activityId)` | Reused unmodified, called by `AssignActivityPicker` to build the combined activity+sub-task list |
| `WeeklyPlanner`, `PlannerGrid`, `BucketList`, `AssignActivityPicker` (`src/components/WeeklyPlanner/`) | New components |
| `ActivityBank`, `SubTaskList` (`src/components/ActivityBank/`) | Referenced pattern only — inline delete-confirm, `<output>` loading, `role="alert"` errors; no code change to either |

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
describe('FRONTEND-004-AC-09/AC-10: fetches the current week on mount, shows a loading indicator', () => {
  it('calls planApi.getWeek with this week\'s Monday and shows <output> while pending', () => {
    vi.mocked(planApi.getWeek).mockReturnValue(new Promise(() => {}))
    render(<WeeklyPlanner />)

    expect(planApi.getWeek).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('FRONTEND-004-AC-11/AC-12: grid cells render every occurrence in their day+slot, not just the last', () => {
  it('renders two occurrences in the same Monday/Morning cell', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      { id: '1', activityId: 'a1', subTaskId: null, name: 'Walk', category: 'ROUTINE',
        weekStart: '2026-10-05', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: false,
        completedAt: null, createdAt: '2026-10-01T00:00:00Z' },
      { id: '2', activityId: 'a2', subTaskId: null, name: 'Stretch', category: 'ROUTINE',
        weekStart: '2026-10-05', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: false,
        completedAt: null, createdAt: '2026-10-01T00:01:00Z' },
    ])
    render(<WeeklyPlanner />)

    expect(await screen.findByText('Walk')).toBeInTheDocument()
    expect(screen.getByText('Stretch')).toBeInTheDocument()
  })
})

describe('FRONTEND-004-AC-14/AC-15: week navigation re-fetches with a shifted weekStart', () => {
  it('moves weekStart back 7 days on Previous week', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)
    await screen.findByText(/no activities planned/i)

    await userEvent.click(screen.getByRole('button', { name: /previous week/i }))

    expect(planApi.getWeek).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    )
    expect(planApi.getWeek).toHaveBeenCalledTimes(2)
  })
})

describe('FRONTEND-004-AC-18/AC-19: bucket balance highlight vs empty state', () => {
  it('highlights a category with zero occurrences when another has at least one', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      { id: '1', activityId: 'a1', subTaskId: null, name: 'Paint', category: 'PLEASURABLE',
        weekStart: '2026-10-05', dayOfWeek: null, slot: null, completed: false,
        completedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    ])
    render(<WeeklyPlanner />)

    expect(await screen.findByText(/no routine activities in your bucket list/i)).toBeInTheDocument()
  })

  it('shows the empty-state message and no highlight when the bucket is empty', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    expect(await screen.findByText(/bucket list is empty/i)).toBeInTheDocument()
    expect(screen.queryByText(/in your bucket list yet/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-004-AC-20/AC-21/AC-22: assign picker lists activities+sub-tasks, creates on confirm', () => {
  it('creates a scheduled occurrence from a picked activity and closes the picker', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: 'a1', name: 'Go for a walk', category: 'ROUTINE', description: null, createdAt: '2026-09-01T00:00:00Z' },
    ])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    vi.mocked(planApi.create).mockResolvedValue({
      id: '1', activityId: 'a1', subTaskId: null, name: 'Go for a walk', category: 'ROUTINE',
      weekStart: '2026-10-05', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: false,
      completedAt: null, createdAt: '2026-10-01T00:00:00Z',
    })
    render(<WeeklyPlanner />)

    await userEvent.click(await screen.findByRole('button', { name: /add.*monday.*morning/i }))
    await userEvent.click(await screen.findByRole('button', { name: /go for a walk/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm|assign/i }))

    expect(planApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 'a1', dayOfWeek: 'MONDAY', slot: 'MORNING' }),
    )
    expect(await screen.findByText('Go for a walk')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-004-AC-26/AC-28: remove uses an inline confirm, not window.confirm', () => {
  it('cancelling the inline confirm does not call planApi.remove', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    vi.mocked(planApi.getWeek).mockResolvedValue([
      { id: '1', activityId: 'a1', subTaskId: null, name: 'Go for a walk', category: 'ROUTINE',
        weekStart: '2026-10-05', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: false,
        completedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    ])
    render(<WeeklyPlanner />)

    await userEvent.click(await screen.findByRole('button', { name: /remove/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(planApi.remove).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-004-AC-30/AC-32: complete and undo call the matching planApi methods', () => {
  it('calls complete then undoCompletion in turn', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      { id: '1', activityId: 'a1', subTaskId: null, name: 'Go for a walk', category: 'ROUTINE',
        weekStart: '2026-10-05', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: false,
        completedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    ])
    vi.mocked(planApi.complete).mockResolvedValue({
      id: '1', activityId: 'a1', subTaskId: null, name: 'Go for a walk', category: 'ROUTINE',
      weekStart: '2026-10-05', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: true,
      completedAt: '2026-10-05T09:00:00Z', createdAt: '2026-10-01T00:00:00Z',
    })
    render(<WeeklyPlanner />)

    await userEvent.click(await screen.findByRole('button', { name: /^complete$/i }))
    expect(planApi.complete).toHaveBeenCalledWith('1')
    expect(await screen.findByText(/completed/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(planApi.undoCompletion).toHaveBeenCalledWith('1')
  })
})

describe('FRONTEND-004-AC-34: carry-forward control only appears on bucket items', () => {
  it('does not render Carry forward for a scheduled occurrence', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      { id: '1', activityId: 'a1', subTaskId: null, name: 'Go for a walk', category: 'ROUTINE',
        weekStart: '2026-10-05', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: false,
        completedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    ])
    render(<WeeklyPlanner />)

    await screen.findByText('Go for a walk')
    expect(screen.queryByRole('button', { name: /carry forward/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-004-AC-38: fetch failure shows an alert with a working Retry control', () => {
  it('re-fetches when Retry is activated', async () => {
    vi.mocked(planApi.getWeek)
      .mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Please try again.'))
      .mockResolvedValueOnce([])
    render(<WeeklyPlanner />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(await screen.findByText(/no activities planned/i)).toBeInTheDocument()
    expect(planApi.getWeek).toHaveBeenCalledTimes(2)
  })
})
```

## Acceptance Criteria Summary

- [x] FRONTEND-004-AC-01 — `getWeek()` calls GET /api/v1/plan, unwraps envelope
- [x] FRONTEND-004-AC-02 — `create()` calls POST /api/v1/plan/occurrences
- [x] FRONTEND-004-AC-03 — `move()` calls PATCH /api/v1/plan/occurrences/{id}
- [x] FRONTEND-004-AC-04 — `remove()` calls DELETE /api/v1/plan/occurrences/{id}
- [x] FRONTEND-004-AC-05 — `complete()` calls POST .../occurrences/{id}/completion
- [x] FRONTEND-004-AC-06 — `undoCompletion()` calls DELETE .../occurrences/{id}/completion
- [x] FRONTEND-004-AC-07 — `carryForward()` calls POST .../occurrences/{id}/carry-forward
- [x] FRONTEND-004-AC-08 — any rejected call throws a typed `ApiError`
- [x] FRONTEND-004-AC-09 — `WeeklyPlanner` fetches the current week on mount
- [x] FRONTEND-004-AC-10 — loading state via `<output>`
- [x] FRONTEND-004-AC-11 — grid renders Mon–Fri × Morning/Afternoon/Evening cells, occurrences in matching cells
- [x] FRONTEND-004-AC-12 — multiple occurrences in the same cell render as a list
- [x] FRONTEND-004-AC-13 — completed occurrences visually distinguishable, non-shaming for incomplete
- [x] FRONTEND-004-AC-14 — Previous week shifts weekStart back 7 days, re-fetches
- [x] FRONTEND-004-AC-15 — Next week shifts weekStart forward 7 days, re-fetches
- [x] FRONTEND-004-AC-16 — currently viewed week's Monday date is displayed
- [x] FRONTEND-004-AC-17 — bucket list renders occurrences with no dayOfWeek/slot, separate from the grid
- [x] FRONTEND-004-AC-18 — zero-count category highlighted when another category has ≥1, non-judgemental, no ratio
- [x] FRONTEND-004-AC-19 — empty bucket shows empty-state message, no balance highlight
- [x] FRONTEND-004-AC-20 — Add opens the picker, listing activities + their sub-tasks
- [x] FRONTEND-004-AC-21 — confirming a selection calls `planApi.create()` with the right target
- [x] FRONTEND-004-AC-22 — successful create shows the occurrence immediately, closes the picker
- [x] FRONTEND-004-AC-23 — Move + picking a new day/slot calls `planApi.move()`
- [x] FRONTEND-004-AC-24 — "Move to bucket" calls `planApi.move()` with both cleared
- [x] FRONTEND-004-AC-25 — successful move re-renders in the new location
- [x] FRONTEND-004-AC-26 — Remove uses inline confirm, not `window.confirm()`
- [x] FRONTEND-004-AC-27 — confirm calls `planApi.remove()`
- [x] FRONTEND-004-AC-28 — cancel dismisses without calling `remove()`
- [x] FRONTEND-004-AC-29 — successful remove removes the occurrence from view
- [x] FRONTEND-004-AC-30 — Complete calls `planApi.complete()`
- [x] FRONTEND-004-AC-31 — successful complete re-renders as completed
- [x] FRONTEND-004-AC-32 — Undo calls `planApi.undoCompletion()`
- [x] FRONTEND-004-AC-33 — successful undo re-renders as not completed
- [x] FRONTEND-004-AC-34 — Carry forward control shown only for bucket items
- [x] FRONTEND-004-AC-35 — activating it calls `planApi.carryForward()`
- [x] FRONTEND-004-AC-36 — successful carry-forward removes the item from the current week's bucket view
- [x] FRONTEND-004-AC-37 — empty week shows explanatory grid empty-state message
- [x] FRONTEND-004-AC-38 — fetch failure shows alert + working Retry control
- [x] FRONTEND-004-AC-39 — create failure shows alert in the picker, preserves selection
- [x] FRONTEND-004-AC-40 — move/remove/complete/undo/carry-forward failure shows alert, non-optimistic (prior state/location kept)
