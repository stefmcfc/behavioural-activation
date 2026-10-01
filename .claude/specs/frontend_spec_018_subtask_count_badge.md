# Sub-task Count on the "Show sub-tasks" CTA (Frontend)

**Status**: Implemented. All 6 ACs covered by Vitest/RTL tests
(`frontend/src/components/ActivityBank/ActivityBank.test.tsx`,
`frontend/src/components/ActivityBank/SubTaskList.test.tsx`); full frontend suite green (268
tests, 29 files), `npm run lint` clean, `tsc -b --noEmit` clean. Full real-browser pass (light +
dark) against live seeded data confirmed every AC below.

**Design revision (2026-10-01, before merge)**: this spec originally shipped a separate count
badge next to `CategoryChip` (see git history for that version). The user reviewed it on the open
PR and asked for a different design: fold the count into the existing "Show sub-tasks" CTA's own
label instead of adding a new visual element, and clean up several other things in the expanded
sub-task panel while in there. The badge was removed entirely (including its CSS and the
`data-testid="sub-task-count-badge"` test hook) and replaced with the CTA-label approach below.
This revision happened entirely within the same unmerged PR — nothing described by the original
badge design ever reached `main`, so this file documents only the final, shipped design rather
than preserving the superseded one.
**Priority**: P3 — small UX polish, nothing else blocked on it
**Depends on**: `planner_spec_012_subtask_count.md` (`ActivityResponse.subTaskCount`),
`frontend_spec_002_activity_bank.md` (`ActivityBank`'s row rendering),
`frontend_spec_003_sub_tasks.md` (the "Show sub-tasks" expand control and `SubTaskList`'s heading/
empty-state/"Add sub-task" control, all revised by Requirement 2 below)
**Area**: Frontend
**Roadmap version**: N/A — UX polish on the existing V1 Activity Bank, not tied to a V1–V5 theme

## Overview

`planner_spec_012_subtask_count.md` exposes `subTaskCount` on `ActivityResponse`. Rather than add a
new badge element (the original design), this spec surfaces the count by changing the existing
"Show sub-tasks" toggle's own label — no new DOM element, no new accessible-name pattern to
maintain, and the count sits exactly where a user already looks to manage sub-tasks.

`ActivityBank.tsx`'s toggle button (`renderRowActions`) currently reads `'Show sub-tasks'` when
collapsed and `'Hide sub-tasks'` when expanded, regardless of count. This spec changes the
collapsed-state label based on `subTaskCount`:
- `0` → **"Add sub-tasks"** (there's nothing to show, so the verb changes to match the actual
  available action)
- `> 0` → **"Show sub-tasks (N)"**

The expanded-state label stays **"Hide sub-tasks"** unconditionally — once expanded, the user can
see the real content (the list, or "No sub-tasks yet."), so the count no longer needs to live in
the button label.

While making this change, the user also asked for the expanded `SubTaskList` panel itself to be
cleaned up (Requirement 2) — these are bundled into this same spec since they were raised and
implemented together, not because they're conceptually one requirement.

## Requirement 1: Sub-task count moves into the "Show sub-tasks" CTA label

**User story**: As someone scanning my activity bank, I want to see how many sub-tasks an activity
has as part of the control I'd use to view them, rather than as a separate element, so the count
reads as information about that action rather than another thing competing for attention on the
row.

### FRONTEND-018-AC-01 [AUTO]: Collapsed label reads "Add sub-tasks" when subTaskCount is 0
**Statement**: While an activity's `subTaskCount` is `0` and it is not currently expanded, the
`ActivityBank` component shall label its sub-task toggle button "Add sub-tasks".

**Rationale**: "Show sub-tasks" reads oddly for an activity with nothing to show — the relabel
matches the actual next action available (adding the first one).

**References**: `ActivityBank.tsx`'s `renderRowActions`, `subTasksLabel` computation.

**Test Case (Red)**:
```tsx
it('FRONTEND-018-AC-01: labels the toggle "Add sub-tasks" when subTaskCount is 0', async () => {
  vi.mocked(activityApi.getAll).mockResolvedValue([{ ...walk, subTaskCount: 0 }])
  render(<ActivityBank />)
  const row = (await screen.findByText('Walk')).closest('li')!
  expect(within(row).getByRole('button', { name: 'Add sub-tasks' })).toBeInTheDocument()
})
```

**Test Case (Green)**: `activity.subTaskCount === 0 ? 'Add sub-tasks' : ...` in the collapsed
branch of `subTasksLabel`.

### FRONTEND-018-AC-02 [AUTO]: Collapsed label reads "Show sub-tasks (N)" when subTaskCount > 0
**Statement**: While an activity's `subTaskCount` is greater than `0` and it is not currently
expanded, the `ActivityBank` component shall label its sub-task toggle button
`"Show sub-tasks (N)"`, where `N` is the exact count.

**Rationale**: The core feature — the count is visible without expanding.

**References**: Related: `FRONTEND-018-AC-01`.

**Test Case (Red)**:
```tsx
it('FRONTEND-018-AC-02: labels the toggle with the sub-task count when subTaskCount is greater than 0', async () => {
  vi.mocked(activityApi.getAll).mockResolvedValue([{ ...walk, subTaskCount: 3 }])
  render(<ActivityBank />)
  const row = (await screen.findByText('Walk')).closest('li')!
  expect(within(row).getByRole('button', { name: 'Show sub-tasks (3)' })).toBeInTheDocument()
})
```

**Test Case (Green)**: the `else` branch of the same ternary: `` `Show sub-tasks (${activity.subTaskCount})` ``.

### FRONTEND-018-AC-03 [AUTO]: Expanded label always reads "Hide sub-tasks", regardless of count
**Statement**: While an activity is currently expanded, the `ActivityBank` component shall label
its sub-task toggle button "Hide sub-tasks", regardless of `subTaskCount`.

**Rationale**: Regression guard — confirms the expand/collapse state check still takes priority
over the count-based label, including for a zero-count activity that was just expanded via "Add
sub-tasks" (the label must switch to "Hide", not stay "Add sub-tasks" or jump to some zero-count
variant).

**References**: `frontend_spec_003_sub_tasks.md`'s `FRONTEND-003-AC-01`/`AC-02` (the expand/collapse
behavior this label switch is layered on top of, unchanged).

**Test Case (Red)**:
```tsx
it('FRONTEND-018-AC-03: reads "Hide sub-tasks" once expanded, even for a zero-count activity', async () => {
  vi.mocked(activityApi.getAll).mockResolvedValue([{ ...walk, subTaskCount: 0 }])
  vi.mocked(subTaskApi.getAll).mockResolvedValue([])
  render(<ActivityBank />)
  const row = (await screen.findByText('Walk')).closest('li')!
  await userEvent.click(within(row).getByRole('button', { name: 'Add sub-tasks' }))
  expect(within(row).getByRole('button', { name: 'Hide sub-tasks' })).toBeInTheDocument()
})
```

**Test Case (Green)**: the `expandedActivityId === activity.id ? 'Hide sub-tasks' : ...` check
stays the outermost condition in `subTasksLabel`.

## Requirement 2: Clean up the expanded sub-task panel (SubTaskList)

**User story**: As someone who has expanded an activity's sub-tasks, I want the panel to show only
what I need — the list (or an empty-state prompt) and a way to add one — without a redundant
heading restating information already visible from context and styling.

### FRONTEND-018-AC-04 [AUTO]: No "Sub-tasks — {Category}" heading
**Statement**: The `SubTaskList` component shall render no heading.

**Rationale**: The panel is only ever reached by expanding an activity row the user can already see
is a sub-tasks panel (via the "Hide sub-tasks" toggle that opened it) and whose category is already
shown via that activity's own `CategoryChip` one row up — the heading restated both facts with no
new information. Removing it also removes `SubTaskList`'s now-unused `category` prop entirely
(nothing else in the component read it).

**References**: `SubTaskList.tsx` — removed `<h3>Sub-tasks — {CATEGORY_LABELS[category]}</h3>`,
the `category` prop, `CATEGORY_LABELS`, and the now-unused `ActivityCategory` import. Removed the
matching `category={activity.category}` argument from `ActivityBank.tsx`'s `<SubTaskList>` call.

**Test Case (Red)**:
```tsx
it('FRONTEND-018-AC-04: renders no heading', async () => {
  vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
  render(<SubTaskList activityId="a1" />)
  await screen.findByText('Create a guest list')
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
})
```

**Test Case (Green)**: delete the `<h3>` element and its supporting code.

### FRONTEND-018-AC-05 [MANUAL]: "Add sub-task" is right-aligned at the top of the panel
**Statement**: The `SubTaskList` component shall render its "Add sub-task" control right-aligned
within its own row at the top of the panel.

**Rationale**: Matches this project's established right-alignment convention for primary "Add"
actions (`ActivityBank`'s own "Add activity" button, `.addButton { margin-left: auto }`) — applied
here via the same pattern (`SubTaskList.module.css`'s own `.addButton`, inside a `.header` flex
row).

**References**: Flex/`margin-left: auto` is a CSS layout property, not reliably assertable via
jsdom's DOM-only rendering (no real layout engine) — verified instead by a real-browser check,
matching this project's convention for `[MANUAL]` visual-only ACs. Checked in both light and dark
theme: the button sits flush with the panel's right edge whether or not "No sub-tasks yet." is also
present on the same row (`FRONTEND-018-AC-06`).

**Verification performed**: real Chrome session against the live dev server, both themes — screenshot-
confirmed right alignment for an activity with sub-tasks (button alone on its row) and one without
(button alongside "No sub-tasks yet.").

### FRONTEND-018-AC-06 [AUTO]: Empty state shares a row with "Add sub-task"
**Statement**: While an activity has no sub-tasks, the `SubTaskList` component shall render "No
sub-tasks yet." and the "Add sub-task" control in the same container, rather than two separate
rows.

**Rationale**: The two were previously vertically stacked (heading, then the Add button, then
eventually the empty-state paragraph lower down); combining them into one row makes the empty state
read as a single prompt ("nothing here — add one →") instead of two disconnected lines.

**References**: `SubTaskList.tsx`'s `.header` div now conditionally renders the empty-state `<p>`
alongside the (always rendered, unless `readOnly`) "Add sub-task" button, both inside the same
flex container.

**Test Case (Red)**:
```tsx
it('FRONTEND-018-AC-06: renders the empty message and the Add sub-task button in the same container', async () => {
  vi.mocked(subTaskApi.getAll).mockResolvedValue([])
  render(<SubTaskList activityId="a1" />)
  const emptyMessage = await screen.findByText(/no sub-tasks yet/i)
  const addButton = screen.getByRole('button', { name: /add sub-task/i })
  expect(emptyMessage.parentElement).toBe(addButton.parentElement)
})
```

**Test Case (Green)**: render both inside the same `<div className={styles.header}>` wrapper.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `subTaskCount` field this spec consumes | `planner_spec_012_subtask_count.md` (`ActivityResponse.subTaskCount`) |
| `Activity` type | `frontend/src/types/activity.ts` |
| Toggle label logic | `frontend/src/components/ActivityBank/ActivityBank.tsx` (`renderRowActions`) |
| Expand/collapse behavior this label layers on top of (unchanged) | `frontend_spec_003_sub_tasks.md` (`FRONTEND-003-AC-01`/`AC-02`) |
| Panel cleanup | `frontend/src/components/ActivityBank/SubTaskList.tsx`, `SubTaskList.module.css` |
| Right-alignment precedent followed | `ActivityBank.module.css`'s `.addButton { margin-left: auto }` |
| Deferred completion-progress variant | `.claude/SPEC_CANDIDATES.md` ("Sub-task completion progress indicator") |

## Acceptance Criteria Summary

- [x] FRONTEND-018-AC-01 [AUTO]: Collapsed label reads "Add sub-tasks" when `subTaskCount` is 0
- [x] FRONTEND-018-AC-02 [AUTO]: Collapsed label reads "Show sub-tasks (N)" when `subTaskCount` is greater than 0
- [x] FRONTEND-018-AC-03 [AUTO]: Expanded label always reads "Hide sub-tasks", regardless of count
- [x] FRONTEND-018-AC-04 [AUTO]: No "Sub-tasks — {Category}" heading
- [x] FRONTEND-018-AC-05 [MANUAL]: "Add sub-task" is right-aligned at the top of the panel
- [x] FRONTEND-018-AC-06 [AUTO]: Empty state shares a row with "Add sub-task"
