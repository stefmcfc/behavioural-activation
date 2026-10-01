# Refresh an Open Sub-task Panel After Editing Its Activity (Frontend)

**Status**: Implemented (2026-10-01) — all 3 ACs green. `ActivityBank` gained a `refreshKey` state,
bumped in `handleFormSuccess` only when the saved activity is an edit (`formTarget !== 'create' &&
formTarget !== null`) matching the currently-expanded activity (`activity.id ===
expandedActivityId`); `<SubTaskList key={`${activity.id}-${refreshKey}`}>` forces a remount (and
therefore a fresh fetch) exactly when needed. Two of the spec's own test sketches needed a fix
during implementation: `getByRole('radio', { name: /^necessary$/i })` / `/^pleasurable$/i` collided
with the "Filter by category" toolbar's own radio pills (also rendered once the activity list is
non-empty) — scoped both to `within(screen.getByRole('dialog'))` to disambiguate. Full suite: 271
Vitest tests, 0 regressions; `oxlint`/`tsc -b --noEmit` clean. Full real-browser pass (light + dark)
against the live "Test category change" activity confirmed the exact originally-observed scenario is
now fixed: editing an activity's category while its sub-task panel is already open updates the
panel's chips immediately, with no manual collapse/re-expand needed.
**Priority**: P3 — small UX polish, nothing else blocked on it
**Depends on**: `frontend_spec_003_sub_tasks.md` (`SubTaskList`'s fetch-on-mount behavior,
`ActivityBank`'s expand/collapse control), `frontend_spec_013_add_activity_modal.md` (`ActivityForm`
inside a `Modal`, `handleFormSuccess`), `planner_spec_014_subtask_category_cascade.md` (the spec
whose real-browser verification surfaced this gap)
**Area**: Frontend
**Roadmap version**: N/A — UX polish, not tied to a V1–V5 theme

## Overview

`.claude/ideas/future_ideas.md`'s "An already-open sub-task panel doesn't refresh after editing its
parent activity" entry (surfaced 2026-10-01 while real-browser-verifying
`planner_spec_014_subtask_category_cascade.md`): `SubTaskList` fetches its sub-tasks once, on mount,
via a `useEffect` keyed on `[activityId, retryCount]`. If a user expands an activity's sub-task panel
and then edits that same activity (via the Edit modal, without first collapsing the panel),
`activityId` hasn't changed, so the effect never re-runs — the panel keeps showing whatever it
already fetched, stale relative to whatever the edit actually changed. Confirmed cosmetic/transient,
not a data bug: the real stored data is correct immediately; collapsing and re-expanding the panel
(or a reload) always shows the truth, since that forces a fresh mount.

This spec makes `ActivityBank` force `SubTaskList` to refetch when its own currently-expanded
activity is the one just successfully edited — using the same remount-via-`key` pattern this
codebase already uses for `ActivityForm`/`SubTaskForm` inside their modals
(`key={formTarget === 'create' ? 'create' : formTarget.id}`), rather than inventing a new
"refetch signal" prop. `ActivityBank` gains a `refreshKey` counter, bumped only when the edit being
saved belongs to the currently-expanded activity; `SubTaskList`'s own `key` prop includes it, so
React remounts (and therefore re-fetches) the panel exactly when — and only when — it needs to.

Scoped to the expanded panel refreshing after *that same activity's* edit succeeds. Editing a
*different*, non-expanded activity must not cause the currently-expanded one to refetch — there's
nothing stale to fix in that case, and refetching anyway would be a wasted request and (if the
network is slow) a visible flicker for no reason.

## Requirement 1: Refresh the open sub-task panel after its own activity is edited

**User story**: As someone with an activity's sub-task panel open, I want it to reflect my edit to
that activity immediately, without having to manually collapse and re-expand it, so what I see
matches what I just changed.

### FRONTEND-023-AC-01 [AUTO]: Editing the currently-expanded activity refetches its sub-tasks
**Statement**: When the user successfully edits the activity whose sub-task panel is currently
expanded, the `ActivityBank` component shall cause `SubTaskList` to refetch its sub-tasks.

**Rationale**: The core fix — the open panel reflects the just-saved edit without a manual
collapse/re-expand.

**References**:
- `ActivityBank.tsx`'s `handleFormSuccess` — add a `refreshKey` state (number, default `0`),
  incremented when the saved activity's `id` matches `expandedActivityId`.
- `SubTaskList`'s `key` prop (currently absent) — set to
  `` `${activity.id}-${refreshKey}` `` (or similar), so a `refreshKey` bump remounts it, re-running
  its existing fetch-on-mount `useEffect`.

**Test Case (Red)**:
```tsx
it('FRONTEND-023-AC-01: refetches sub-tasks when the currently-expanded activity is successfully edited', async () => {
  vi.mocked(activityApi.getAll).mockResolvedValue([walk])
  vi.mocked(subTaskApi.getAll).mockResolvedValue([])
  vi.mocked(activityApi.update).mockResolvedValue({ ...walk, category: 'NECESSARY' })
  render(<ActivityBank />)

  await userEvent.click(await screen.findByRole('button', { name: /sub-tasks/i }))
  await waitFor(() => expect(subTaskApi.getAll).toHaveBeenCalledTimes(1))

  await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
  await userEvent.click(await screen.findByRole('radio', { name: /^necessary$/i }))
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

  await waitFor(() => expect(subTaskApi.getAll).toHaveBeenCalledTimes(2))
})
```

**Test Case (Green)**: implement the `refreshKey` bump + `key` prop as described in References.
*(Implementer note: verify the exact `ActivityForm` field/button accessible names against its real
current markup — category picker role/labels, submit button text — rather than trusting this
sketch verbatim, per this project's established practice.)*

### FRONTEND-023-AC-02 [AUTO]: Editing a different, non-expanded activity does not refetch the open panel
**Statement**: While one activity's sub-task panel is expanded, when the user successfully edits a
*different* activity, the `ActivityBank` component shall not cause the expanded panel's
`SubTaskList` to refetch.

**Rationale**: Regression guard — the fix must be scoped to the activity actually being edited, not
bump the refresh key (and therefore remount/refetch) for whatever happens to be expanded regardless
of relevance.

**References**: Related: `FRONTEND-023-AC-01`. The `refreshKey` bump's `savedActivity.id ===
expandedActivityId` guard is what this AC tests.

**Test Case (Red)**:
```tsx
it('FRONTEND-023-AC-02: does not refetch the open panel when a different activity is edited', async () => {
  vi.mocked(activityApi.getAll).mockResolvedValue([walk, jobs])
  vi.mocked(subTaskApi.getAll).mockResolvedValue([])
  vi.mocked(activityApi.update).mockResolvedValue({ ...jobs, name: 'Apply for more jobs' })
  render(<ActivityBank />)

  // expand "Walk"'s panel
  const walkRow = (await screen.findByText('Walk')).closest('li')!
  await userEvent.click(within(walkRow).getByRole('button', { name: /sub-tasks/i }))
  await waitFor(() => expect(subTaskApi.getAll).toHaveBeenCalledTimes(1))

  // edit the OTHER activity, "Apply for jobs"
  const jobsRow = (await screen.findByText('Apply for jobs')).closest('li')!
  await userEvent.click(within(jobsRow).getByRole('button', { name: /^edit$/i }))
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

  // give any (incorrect) refetch a chance to happen, then assert it didn't
  await waitFor(() => expect(screen.queryByText('Apply for more jobs')).toBeInTheDocument())
  expect(subTaskApi.getAll).toHaveBeenCalledTimes(1)
})
```

**Test Case (Green)**: the `savedActivity.id === expandedActivityId` guard from `FRONTEND-023-AC-01`
already satisfies this.

### FRONTEND-023-AC-03 [AUTO]: Creating a new activity does not refetch the open panel
**Statement**: While one activity's sub-task panel is expanded, when the user successfully creates a
new activity, the `ActivityBank` component shall not cause the expanded panel's `SubTaskList` to
refetch.

**Rationale**: Regression guard distinguishing the create path (`formTarget === 'create'`, no
existing activity being edited) from the edit path — `handleFormSuccess` handles both, and only the
edit branch should ever consider bumping `refreshKey`.

**References**: Related: `FRONTEND-023-AC-01`. `ActivityBank.tsx`'s existing `formTarget !== 'create'
&& formTarget !== null` check (already used to distinguish create vs. edit in `handleFormSuccess`'s
list-update logic) is the same distinction this AC's guard reuses.

**Test Case (Red)**:
```tsx
it('FRONTEND-023-AC-03: does not refetch the open panel when a new activity is created', async () => {
  vi.mocked(activityApi.getAll).mockResolvedValue([walk])
  vi.mocked(subTaskApi.getAll).mockResolvedValue([])
  vi.mocked(activityApi.create).mockResolvedValue({ ...walk, id: '99', name: 'Read a book' })
  render(<ActivityBank />)

  await userEvent.click(await screen.findByRole('button', { name: /sub-tasks/i }))
  await waitFor(() => expect(subTaskApi.getAll).toHaveBeenCalledTimes(1))

  await userEvent.click(screen.getByRole('button', { name: /add activity/i }))
  // fill minimal required fields...
  await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

  await waitFor(() => expect(screen.getByText('Read a book')).toBeInTheDocument())
  expect(subTaskApi.getAll).toHaveBeenCalledTimes(1)
})
```

**Test Case (Green)**: gate the `refreshKey` bump on `formTarget !== 'create' && formTarget !== null`
(mirroring the existing distinction in `handleFormSuccess`), in addition to the `id ===
expandedActivityId` check from `FRONTEND-023-AC-01`.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| Fetch-on-mount behavior being refreshed | `frontend/src/components/ActivityBank/SubTaskList.tsx` (`useEffect` on `[activityId, retryCount]`) |
| Edit-success handler gaining the refresh logic | `frontend/src/components/ActivityBank/ActivityBank.tsx` (`handleFormSuccess`) |
| Existing remount-via-`key` precedent followed | `ActivityBank.tsx`'s `<ActivityForm key={...}>` |
| Origin of this finding | `planner_spec_014_subtask_category_cascade.md` (real-browser verification) |

## Acceptance Criteria Summary

- [x] FRONTEND-023-AC-01 [AUTO]: Editing the currently-expanded activity refetches its sub-tasks
- [x] FRONTEND-023-AC-02 [AUTO]: Editing a different, non-expanded activity does not refetch the open panel
- [x] FRONTEND-023-AC-03 [AUTO]: Creating a new activity does not refetch the open panel
