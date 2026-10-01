# Sub-task Count Badge on Activity Bank Rows (Frontend)

**Status**: Not started
**Priority**: P3 — small UX polish, nothing else blocked on it
**Depends on**: `planner_spec_012_subtask_count.md` (adds `subTaskCount` to `ActivityResponse` — this
spec cannot be implemented ahead of that one landing), `frontend_spec_002_activity_bank.md`
(`ActivityBank`'s row rendering), `frontend_spec_003_sub_tasks.md` (`CategoryChip` usage in the
activity row, "Show sub-tasks" expand control)
**Area**: Frontend
**Roadmap version**: N/A — UX polish on the existing V1 Activity Bank, not tied to a V1–V5 theme

## Overview

Once `planner_spec_012_subtask_count.md` exposes `subTaskCount` on `ActivityResponse`, this spec
surfaces it in the Activity Bank list so a sub-task count is visible without expanding "Show
sub-tasks" first.

`CategoryChip` (`frontend/src/components/CategoryChip/CategoryChip.tsx`) is shared across
`ActivityBank`, `SubTaskList`, and `AssignActivityPicker`, none of which have any count semantics
today. Rather than widen `CategoryChip`'s own prop contract (and touch every call site), this spec
adds the count as a small sibling badge next to the chip, in `ActivityBank.tsx` only — the lowest-
blast-radius option, per the investigation that grounded this spec.

The badge only appears when `subTaskCount > 0` — an activity with zero sub-tasks shows no badge at
all (not "0"), since a count of zero conveys nothing a user needs and would add visual noise to the
common case of a simple activity with no sub-tasks.

## Requirement 1: Show a sub-task count badge on each activity row

**User story**: As someone managing an activity with several sub-tasks, I want to see how many it
has from the list view, so I can gauge its size without expanding it.

### FRONTEND-018-AC-01 [AUTO]: Badge renders next to the CategoryChip when subTaskCount > 0
**Statement**: While an activity's `subTaskCount` is greater than zero, the `ActivityBank` component
shall render a badge showing that count next to the activity's `CategoryChip`.

**Rationale**: The core feature — visibility without expanding.

**References**:
- Type: `Activity` (`frontend/src/types/activity.ts`) gains `subTaskCount: number`, matching the
  backend's new `ActivityResponse.subTaskCount` (`planner_spec_012_subtask_count.md`).
- Placement: sibling `<span>` next to `<CategoryChip>` in `ActivityBank.tsx`'s row markup (not a
  `CategoryChip` prop) — see Overview.

**Test Case (Red)**:
```tsx
it('FRONTEND-018-AC-01: shows a count badge for an activity with sub-tasks', async () => {
  // seed activity "Walk" with subTaskCount: 3
  renderActivityBank()
  const row = await screen.findByText('Walk')
  expect(within(row.closest('li')!).getByText('3')).toBeInTheDocument()
})
```

**Test Case (Green)**: render `{activity.subTaskCount > 0 && <span className={styles.subTaskCount}>{activity.subTaskCount}</span>}`
next to `<CategoryChip category={activity.category} />` in the row markup.

### FRONTEND-018-AC-02 [AUTO]: No badge renders for an activity with zero sub-tasks
**Statement**: While an activity's `subTaskCount` is zero, the `ActivityBank` component shall render
no sub-task count badge for that activity.

**Rationale**: Avoids showing a meaningless "0" on the common case of a simple activity — see
Overview.

**References**: Related: `FRONTEND-018-AC-01`.

**Test Case (Red)**:
```tsx
it('FRONTEND-018-AC-02: shows no badge for an activity with no sub-tasks', async () => {
  // seed activity "Read" with subTaskCount: 0
  renderActivityBank()
  const row = await screen.findByText('Read')
  expect(within(row.closest('li')!).queryByTestId('sub-task-count-badge')).not.toBeInTheDocument()
})
```

**Test Case (Green)**: the `activity.subTaskCount > 0 &&` guard from `FRONTEND-018-AC-01` already
satisfies this — this AC is the explicit regression guard for that guard.

### FRONTEND-018-AC-03 [AUTO]: Badge has an accessible label distinguishing it from the category label
**Statement**: The sub-task count badge shall carry an accessible name that states what the number
means (e.g. "3 sub-tasks"), not a bare digit with no context for assistive technology.

**Rationale**: A bare "3" next to a colored chip is meaningless out of visual context; screen reader
users need the same information sighted users get from proximity/layout.

**References**: Existing accessible-naming precedent: `CategoryChip`'s own `data-testid` convention
and this app's general pattern of pairing a visual label with an `aria-label` where the visible text
alone is ambiguous (e.g. icon-only controls elsewhere in the app, if any exist — otherwise this is
this component's own first instance of the pattern).

**Test Case (Red)**:
```tsx
it('FRONTEND-018-AC-03: badge has an accessible label stating what the count means', async () => {
  renderActivityBank()
  const row = await screen.findByText('Walk')
  expect(within(row.closest('li')!).getByLabelText('3 sub-tasks')).toBeInTheDocument()
})
```

**Test Case (Green)**: render the badge as
`<span className={styles.subTaskCount} aria-label={`${activity.subTaskCount} sub-tasks`}>{activity.subTaskCount}</span>`.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `subTaskCount` field this spec consumes | `planner_spec_012_subtask_count.md` (`ActivityResponse.subTaskCount`) |
| `Activity` type | `frontend/src/types/activity.ts` |
| Row markup this badge attaches to | `frontend/src/components/ActivityBank/ActivityBank.tsx` |
| `CategoryChip` (unchanged by this spec) | `frontend/src/components/CategoryChip/CategoryChip.tsx` |
| Deferred completion-progress variant | `.claude/SPEC_CANDIDATES.md` ("Sub-task completion progress indicator") |

## Acceptance Criteria Summary

- [ ] FRONTEND-018-AC-01 [AUTO]: Badge renders next to the `CategoryChip` when `subTaskCount > 0`
- [ ] FRONTEND-018-AC-02 [AUTO]: No badge renders when `subTaskCount` is zero
- [ ] FRONTEND-018-AC-03 [AUTO]: Badge carries an accessible label stating what the count means
