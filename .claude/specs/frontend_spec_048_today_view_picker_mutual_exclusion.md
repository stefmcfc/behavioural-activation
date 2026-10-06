# Today View: Drawer and Assign Modal Are Mutually Exclusive (Bug Fix)

**Status**: Not started
**Priority**: P2 — real violated invariant + a real, avoidable redundant network fetch, but low
severity (no data corruption, no broken functionality today — just wasted work and a documented
assumption silently gone false)
**Depends on**: `frontend_spec_016_today_view.md` (introduced `TodayView`'s `drawerOpen` state and
reintroduced `ActivityDrawer`, the change that broke the invariant this spec restores),
`frontend_spec_028_activity_drawer.md` (original `ActivityDrawer`), `frontend_spec_009_add_picker_modal.md`
(`Modal`, `AssignActivityPicker`), `frontend_spec_033_bulk_sub_task_fetch.md` (the
`Promise.all([activityApi.getAll(), subTaskApi.getAllForOwner()])` fetch this spec reduces
redundant calls to, without changing its shape)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 (Today view / Weekly Planner)

## Overview

Found during research for a pagination spec-scoping conversation (`.claude/audits/audit-2026-10-06.md`
follow-up, 2026-10-06) — not itself about pagination, a distinct bug this research turned up along
the way.

`ActivityPickerList.tsx` carries this comment, written when `frontend_spec_045`/`046` added its
single-expansion sub-task disclosure state:

> "The `select`-mode instance (`AssignActivityPicker`) and `drag`-mode instance (`ActivityDrawer`)
> are never mounted simultaneously, so each has entirely independent local state."

That was true when written. `frontend_spec_016_today_view.md` later reintroduced `ActivityDrawer`
into `TodayView.tsx` alongside its own, independent `Modal`-wrapped `AssignActivityPicker` — and
nothing connects the two. `TodayView` tracks the drawer with its own `drawerOpen` boolean and the
modal with `plan.assignTarget !== null` (from `usePlanActions`); neither closes the other. A user
can open "Browse activities" (the drawer), then click "Add" on any grid cell or the bucket list,
and end up with **both open at once** — directly contradicting the comment above, and mounting two
independent `ActivityPickerList` instances that each independently run
`Promise.all([activityApi.getAll(), subTaskApi.getAllForOwner()])` on mount. Confirmed by reading
`TodayView.tsx`: `drawerOpen` and `plan.assignTarget` are fully independent `useState`/hook state
with no cross-wiring.

This fixes it the simple way: make opening one close the other, restoring the comment's invariant
as actually true again, and eliminating the concurrent-double-fetch case. `WeeklyPlanner.tsx` is
unaffected — it doesn't render `ActivityDrawer` at all (removed from it by `frontend_spec_028`'s
"post-ship correction"), so this is `TodayView.tsx`-only.

**Out of scope**: caching or memoizing the bulk activity/sub-task fetch *across separate* picker
opens (e.g. opening the drawer, closing it, then opening it again seconds later still refetches
fresh). Considered and deliberately not done — refetching on every open gives always-current data
(if a sub-task changed elsewhere since the last open, the picker shows it correctly), and at this
app's real current scale (20 activities, 23 sub-tasks, confirmed via the live dev data during
research) a fresh fetch costs nothing worth trading against staleness risk. This spec only removes
the *simultaneous* double-fetch, not every repeat fetch.

## Requirement 1: Opening one picker closes the other

**User story**: As a user Browse-ing activities in the drawer, if I then tap "Add" on a grid cell
or the bucket list, I want the drawer to get out of the way rather than sit open behind/beside a
modal I can't usefully interact with it alongside.

### FRONTEND-048-AC-01 [AUTO]: Opening the drawer closes an open Assign modal
**Statement**: When "Browse activities" is activated while the Assign Activity modal is open
(`plan.assignTarget !== null`), `TodayView` shall close the Assign Activity modal and open the
drawer.

**Rationale**: The two serve an overlapping purpose (both are ways to pick an activity/sub-task) —
there's no useful reason for both to be visible at once, and leaving both open is exactly the state
that produces the concurrent double-fetch.

**References**: `components/WeeklyPlanner/TodayView.tsx` — the "Browse activities" button's
handler, `usePlanActions`'s `handleCloseAssign`.

**Test Case (Red)**:
```typescript
describe('FRONTEND-048-AC-01: opening the drawer closes an open Assign modal', () => {
  it('closes the Assign modal when Browse activities is clicked', async () => {
    vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<TodayView />)

    await userEvent.click(await screen.findByRole('button', { name: /add to wednesday morning/i }))
    expect(await screen.findByRole('dialog', { name: /assign an activity or sub-task/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /browse activities/i }))

    expect(screen.queryByRole('dialog', { name: /assign an activity or sub-task/i })).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: /activities/i })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: wrap the drawer-toggle handler so opening the drawer also calls
`plan.handleCloseAssign()`.

### FRONTEND-048-AC-02 [AUTO]: Requesting Assign closes an open drawer
**Statement**: When an "Add" control (a grid cell, or the bucket list's "Add") is activated while
the drawer is open, `TodayView` shall close the drawer and open the Assign Activity modal for the
requested target.

**References**: `components/WeeklyPlanner/TodayView.tsx` — the `onAdd` handlers passed to
`PlannerGrid` and `BucketList`, both currently call `plan.setAssignTarget(...)` directly; route both
through one new local handler that also calls `setDrawerOpen(false)` first.

**Test Case (Red)**:
```typescript
describe('FRONTEND-048-AC-02: requesting Assign closes an open drawer', () => {
  it('closes the drawer when Add is clicked on a grid cell', async () => {
    vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<TodayView />)

    await userEvent.click(await screen.findByRole('button', { name: /browse activities/i }))
    expect(screen.getByRole('complementary', { name: /activities/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /add to wednesday morning/i }))

    expect(screen.queryByRole('complementary', { name: /activities/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('dialog', { name: /assign an activity or sub-task/i })).toBeInTheDocument()
  })

  it('closes the drawer when Add is clicked on the bucket list', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<TodayView />)

    await userEvent.click(await screen.findByRole('button', { name: /browse activities/i }))
    expect(screen.getByRole('complementary', { name: /activities/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(screen.queryByRole('complementary', { name: /activities/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('dialog', { name: /assign an activity or sub-task/i })).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement the shared `onAdd` handler described in References.

### FRONTEND-048-AC-03 [AUTO]: No regression to existing single-picker behavior
**Statement**: The drawer's existing open/close toggle behavior, and the Assign modal's existing
open/cancel behavior, shall be unchanged in every case where the other picker was never opened.

**Rationale**: Regression guard — this spec changes what happens when *both* get triggered, not the
existing single-picker interactions `frontend_spec_016_today_view.md`'s own `FRONTEND-016-AC-10`
already covers.

**Test Case (Green)**: `TodayView.test.tsx`'s existing `FRONTEND-016-AC-10` tests (drawer
open/close toggle) and the existing "opens the Add picker modal" test must keep passing unchanged.

## Cross-references

| Reference | What it provides |
|---|---|
| `components/WeeklyPlanner/TodayView.tsx` | AC-01/AC-02 target — the only file needing a code change |
| `components/WeeklyPlanner/ActivityPickerList.tsx` | Carries the comment (lines ~76-80) this spec makes true again — no code change needed there, the comment is already accurate once `TodayView` can no longer violate it |
| `components/WeeklyPlanner/usePlanActions.ts` | `assignTarget`/`setAssignTarget`/`handleCloseAssign` — unchanged, shared with `WeeklyPlanner.tsx` (which has no drawer and is therefore unaffected by this spec) |
| `frontend_spec_016_today_view.md` | `FRONTEND-016-AC-10` (drawer toggle), `FRONTEND-016-AC-08` (independent fetch) — both still hold, unamended |
| `.claude/audits/audit-2026-10-06.md` | Source research this spec came out of (pagination spec-scoping follow-up) |

## Acceptance Criteria Summary

- [ ] FRONTEND-048-AC-01 — opening the drawer closes an open Assign modal
- [ ] FRONTEND-048-AC-02 — requesting Assign closes an open drawer
- [ ] FRONTEND-048-AC-03 — no regression to existing single-picker behavior
