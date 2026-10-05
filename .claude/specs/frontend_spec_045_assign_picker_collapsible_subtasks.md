# Collapsible Sub-Tasks + Category Grouping in the Assign Activity Modal (Frontend)

**Status**: Implemented (2026-10-05)
**Priority**: P3 — V1 polish, raised by the user 2026-10-05 after reviewing the Activity Bank's
new category grouping
**Depends on**: `frontend_spec_044_activity_bank_grouping.md` (origin of `CATEGORY_ORDER`/
`CategoryGroupHeading`, reused here unchanged), `frontend_spec_033_bulk_sub_task_fetch.md`
(the bulk `subTaskApi.getAllForOwner()` fetch this spec's per-activity sub-task counts are
computed from), `frontend_spec_009_add_picker_modal.md` (the modal `AssignActivityPicker` renders
inside), `frontend_spec_028_activity_drawer.md`/`frontend_spec_016_today_view.md` (the *other*
consumer of the shared component this spec deliberately does not change — see Overview)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish

## Overview

`ActivityPickerList.tsx` is shared by two different consumers: `AssignActivityPicker.tsx` (the
"Assign an activity or sub-task" modal, `mode="select"`, opened from the Weekly Planner/Today's
"Add" button) and `ActivityDrawer.tsx` (Today's drag-and-drop drawer, `mode="drag"`). Today, in
both modes, every activity's sub-tasks render unconditionally whenever present, and activities
are listed in one flat sequence (whatever order `activityApi.getAll()` returns — favourite-desc,
name-asc, server-side).

This spec, raised by the user after seeing the Activity Bank's new category-grouped display
(`frontend_spec_044`), makes two changes **to `select` mode only**:

1. **Category-grouped, sorted display** — reuse the exact `CATEGORY_ORDER`/`CategoryGroupHeading`
   pattern `frontend_spec_044` already extracted into shared locations, so the modal's activity
   list is grouped into Routine/Necessary/Pleasurable sections the same way "My Activities" is.
2. **Collapsible sub-tasks, collapsed by default** — an activity with at least one (filter-
   matching) sub-task shows a toggle (reusing the Activity Bank's existing "Show sub-tasks (N)"/
   "Hide sub-tasks" label convention, `ActivityBank.tsx`'s `getSubTasksLabel`) instead of always
   rendering its sub-tasks inline. The label itself is the "can be expanded" indicator the user
   asked for — no new icon needed, matching the existing Activity Bank precedent exactly.

**`drag` mode is explicitly untouched** — `ActivityDrawer.tsx`'s drag-and-drop UX on the Today
page keeps today's flat, always-expanded list exactly as-is. The user's request was specifically
about "the assign activity modal"; `frontend_spec_028`'s own Summary already documents that drag
mode's UX is fragile (no auto-scroll, had to be redesigned once already) — changing its layout
wasn't asked for and isn't part of this spec. Both behaviors below are gated on `mode === 'select'`
and have an explicit regression-guard AC confirming `drag` mode is unaffected.

## Requirements

### Requirement 1: Category-grouped display in select mode

**User story**: As a user assigning an activity, I want the picker's activity list grouped the
same way the Activity Bank now is, so the two places I see my activities look and scan the same
way.

#### FRONTEND-045-AC-01 [AUTO]: Activities grouped into fixed category sections
**Statement**: While `mode` is `"select"`, the `ActivityPickerList` component shall render
`visibleActivities` grouped into `CategoryGroupHeading`-labelled sections in
`CATEGORY_ORDER` (`ROUTINE`/`NECESSARY`/`PLEASURABLE`) order, instead of one flat list.

**Rationale**: Direct reuse of `frontend_spec_044`'s pattern — see `ActivityBank.tsx`'s own
`visibleCategories`/grouped-rendering block for the exact shape to mirror.

**References**:
- `frontend/src/utils/categoryLabels.ts` (`CATEGORY_ORDER`)
- `frontend/src/components/CategoryGroupHeading/CategoryGroupHeading.tsx`
- `frontend/src/components/ActivityBank/ActivityBank.tsx` (the precedent implementation)

#### FRONTEND-045-AC-02 [AUTO]: Empty category groups are skipped
**Statement**: While `mode` is `"select"`, the `ActivityPickerList` component shall render no
heading for a category with no matching activities in `visibleActivities` — same precedent as
`FRONTEND-044-AC-03`.

#### FRONTEND-045-AC-03 [AUTO]: Grouping key is the activity's own category, independent of filter match reason
**Statement**: An activity shall always be grouped under its own `activity.category`, even when
it only passed the active category filter because one of its sub-tasks (not the activity itself)
matches that category (the existing cross-match inclusion rule at `ActivityPickerList.tsx:125-128`
is unchanged).

**Rationale**: Avoids an ambiguous/surprising case — e.g. filtering to "Necessary" and seeing a
Routine-categorised activity appear under a "Necessary" heading just because one of its sub-tasks
is Necessary. Grouping always reflects the activity's own category; filtering (which rows are
included at all) is a separate, already-existing concern this spec doesn't change.

#### FRONTEND-045-AC-04 [AUTO]: Within-group order is unchanged (no new sort)
**Statement**: The `ActivityPickerList` component shall partition `visibleActivities` into
category groups using `Array.prototype.filter`, not introduce any new client-side `.sort()` — so
within each group, activities appear in the same order the backend already provides.

**Rationale**: Same no-re-sort guarantee as `FRONTEND-044-AC-04`.

#### FRONTEND-045-AC-05 [AUTO]: `drag` mode is unaffected (regression guard)
**Statement**: While `mode` is `"drag"`, the `ActivityPickerList` component shall continue to
render `visibleActivities` as one flat list in backend-provided order, with no category group
headings.

### Requirement 2: Collapsible sub-tasks in select mode

**User story**: As a user assigning an activity, I want an activity's sub-tasks collapsed by
default, so scanning the list isn't dominated by sub-task rows I don't need to see until I
actually want to drill into one.

#### FRONTEND-045-AC-06 [AUTO]: Sub-tasks collapsed by default when present
**Statement**: While `mode` is `"select"` and an activity has at least one sub-task in its
(category-filtered) `subTasks` list, the `ActivityPickerList` component shall not render that
activity's sub-task rows until its toggle is activated — i.e. collapsed on initial render, for
every activity, with no persisted "last expanded" state across mounts.

**References**:
- `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx:267-296` (today's always-rendered
  sub-task block this replaces)

#### FRONTEND-045-AC-07 [AUTO]: Toggle label indicates expandability and count
**Statement**: While `mode` is `"select"` and an activity has at least one (filtered) sub-task,
the `ActivityPickerList` component shall render a toggle button labelled `Show sub-tasks (N)`
(collapsed) or `Hide sub-tasks` (expanded), where `N` is that activity's filtered `subTasks.length`
— mirroring `ActivityBank.tsx`'s `getSubTasksLabel` convention, adapted to use the locally
filtered count (not `activity.subTaskCount`, which doesn't reflect the active category filter).

**Rationale**: The label itself is the "can be expanded" signal the user asked for — reusing an
already-shipped, already-tested wording convention rather than inventing a new one or a separate
icon.

**References**:
- `frontend/src/components/ActivityBank/ActivityBank.tsx:24-29` (`getSubTasksLabel`, the wording
  precedent — note this spec does not reuse `activity.subTaskCount` itself, only the label
  phrasing, per the Rationale above)

#### FRONTEND-045-AC-08 [AUTO]: No toggle for an activity with zero (filtered) sub-tasks
**Statement**: While `mode` is `"select"` and an activity has zero sub-tasks in its filtered
`subTasks` list, the `ActivityPickerList` component shall render no toggle and no sub-task
section for that activity — unchanged from today's behavior for such activities.

#### FRONTEND-045-AC-09 [AUTO]: Activating the toggle shows that activity's sub-tasks
**Statement**: When the toggle for a collapsed activity is activated, the `ActivityPickerList`
component shall render that activity's sub-task rows, with every existing per-row behavior
unchanged (select button, `CategoryChip`).

#### FRONTEND-045-AC-10 [AUTO]: Only one activity's sub-tasks are expanded at a time
**Statement**: When the toggle for a currently-collapsed activity is activated while a different
activity's sub-tasks are expanded, the `ActivityPickerList` component shall collapse the
previously-expanded activity and expand the newly-activated one.

**Rationale**: Mirrors `ActivityBank.tsx`'s existing `expandedActivityId: string | null`
single-expansion pattern — the picker is a quick-selection UI, not a persistent reference list, so
matching that established interaction (rather than inventing independent multi-expand state) is
the more consistent, lower-risk default.

**References**:
- `frontend/src/components/ActivityBank/ActivityBank.tsx:53` (`expandedActivityId` precedent)

#### FRONTEND-045-AC-11 [AUTO]: Activating the toggle does not select the activity
**Statement**: Clicking an activity's sub-task toggle shall not call `onSelectActivity`, and
clicking the activity's own name/select button shall not expand or collapse its sub-tasks — the
two controls remain fully independent, since the activity name button's existing behavior
(selecting that activity) must not change.

**Rationale**: Explicit regression guard — the activity row's name button already has a
jobs-to-be-done (`onSelectActivity`); the new toggle must be an additional, separate control, not
an overload of the existing one.

#### FRONTEND-045-AC-12 [AUTO]: `drag` mode is unaffected (regression guard)
**Statement**: While `mode` is `"drag"`, the `ActivityPickerList` component shall continue to
render every activity's sub-tasks unconditionally (no collapse, no toggle) — exactly today's
behavior, unchanged.

### Requirement 3: Existing tests updated for the new default-collapsed state, not weakened

#### FRONTEND-045-AC-13 [AUTO]: `AssignActivityPicker.test.tsx`'s sub-task-button assertions are rescoped
**Statement**: Every existing `AssignActivityPicker.test.tsx` test that asserts against a
sub-task's own select button (e.g. `screen.getByRole('button', { name: 'Send invitations' })`)
shall first activate that sub-task's parent activity's "Show sub-tasks" toggle, since the sub-task
row is no longer present in the DOM until expanded. The assertions themselves (category chip
shown, repeatable icon shown/hidden, favourite icon shown/hidden, button present after a
successful selection flow, etc.) are unchanged.

**References**:
- `frontend/src/components/WeeklyPlanner/AssignActivityPicker.test.tsx` (multiple tests around
  lines 98-390 query a sub-task button directly — audit the full file, not just these line
  numbers, since exact lines will have shifted by implementation time)

## Cross-references

| This spec depends on / contracts against | Why |
|---|---|
| `frontend_spec_044_activity_bank_grouping.md` | `CATEGORY_ORDER`/`CategoryGroupHeading`, reused unchanged |
| `frontend_spec_033_bulk_sub_task_fetch.md` | The bulk sub-task fetch this spec's per-activity counts are computed from (no new fetch) |
| `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` | The modal consumer this spec changes (`mode="select"`) |
| `frontend/src/components/WeeklyPlanner/ActivityDrawer.tsx` | The `mode="drag"` consumer explicitly unaffected (`FRONTEND-045-AC-05`/`AC-12`) |
| `frontend/src/components/ActivityBank/ActivityBank.tsx` | Source of both reused patterns: category grouping and the `getSubTasksLabel` wording/single-expand convention |

## Implementation notes (for `frontend-dev`)

- **`ActivityPickerList.tsx`**: add local state `const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null)`, gated entirely behind `mode === 'select'` in the render branch
  (the `drag`-mode render path stays byte-for-byte as it is today — consider literally branching
  on `isDragMode` to pick between the old flat-list JSX and new grouped+collapsible JSX, rather
  than threading new conditionals through one shared block, to keep `FRONTEND-045-AC-05`/`AC-12`
  trivially true by construction).
- Reuse `CATEGORY_ORDER` (`'../../utils/categoryLabels'`) and `CategoryGroupHeading`
  (`'../CategoryGroupHeading/CategoryGroupHeading'`) — same imports `ActivityBank.tsx` already
  uses.
- A local `getSubTasksLabel(count: number, isExpanded: boolean): string` (or inline equivalent) —
  note this spec's version takes a plain `count` (the filtered `subTasks.length`), not an
  `Activity`, unlike `ActivityBank.tsx`'s version which reads `activity.subTaskCount`.
- Toggle button: a new `<button type="button" onClick={...}>{label}</button>` placed in
  `.activityRow` alongside the existing name button/`CategoryChip`/`RepeatableIcon`/
  `FavouriteIcon`, calling
  `setExpandedActivityId((current) => (current === activity.id ? null : activity.id))` — mirrors
  `ActivityBank.tsx`'s own `toggleSubTasks` closure shape.
- The sub-task `<ul className={styles.subTaskList}>` block (currently always rendered when
  `subTasks.length > 0`) becomes conditional on `expandedActivityId === activity.id` as well.

## TDD test case sketches

```tsx
describe('FRONTEND-045-AC-01/AC-02: category-grouped select-mode list', () => {
  it('renders one heading per category with activities, in fixed order', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([read /* Pleasurable */, walk /* Routine */])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
    render(<ActivityPickerList {...selectProps()} />)
    await screen.findByText('Go for a walk')
    const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(headings).toEqual(['Routine', 'Pleasurable'])
  })
})

describe('FRONTEND-045-AC-05: drag mode has no grouping (regression guard)', () => {
  it('renders no category headings in drag mode', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([read, walk])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
    render(<ActivityPickerList {...dragProps()} />)
    await screen.findByText('Go for a walk')
    expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-045-AC-06/AC-07: sub-tasks collapsed by default with a labelled toggle', () => {
  it('shows "Show sub-tasks (N)" and hides sub-task rows until activated', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
    render(<ActivityPickerList {...selectProps()} />)
    await screen.findByText('Organise a leaving party')

    expect(screen.getByRole('button', { name: 'Show sub-tasks (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send invitations' })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-045-AC-09/AC-10: expand/collapse and single-expansion', () => {
  it('expands the clicked activity and collapses a previously-expanded one', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([party, anotherPartyLikeActivity])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations, bookVenue])
    render(<ActivityPickerList {...selectProps()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Show sub-tasks (1)' }))
    expect(screen.getByRole('button', { name: 'Send invitations' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show sub-tasks (1)' })) // the second activity's toggle
    expect(screen.queryByRole('button', { name: 'Send invitations' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book venue' })).toBeInTheDocument()
  })
})

describe('FRONTEND-045-AC-11: toggle and select stay independent', () => {
  it('does not call onSelectActivity when the sub-task toggle is clicked', async () => {
    const onSelectActivity = vi.fn()
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
    render(<ActivityPickerList {...selectProps({ onSelectActivity })} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Show sub-tasks (1)' }))
    expect(onSelectActivity).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-045-AC-12: drag mode sub-tasks stay always-visible (regression guard)', () => {
  it('renders sub-task rows unconditionally in drag mode', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
    render(<ActivityPickerList {...dragProps()} />)
    expect(await screen.findByText('Send invitations')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement the grouping/collapse behavior above, and rescope
`AssignActivityPicker.test.tsx`'s sub-task-button assertions (`FRONTEND-045-AC-13`), until every
sketch and every pre-existing test passes.

## Acceptance Criteria Summary

- [x] FRONTEND-045-AC-01: Activities grouped into fixed category sections
- [x] FRONTEND-045-AC-02: Empty category groups are skipped
- [x] FRONTEND-045-AC-03: Grouping key is the activity's own category, independent of filter match reason
- [x] FRONTEND-045-AC-04: Within-group order is unchanged (no new sort)
- [x] FRONTEND-045-AC-05: `drag` mode is unaffected (regression guard)
- [x] FRONTEND-045-AC-06: Sub-tasks collapsed by default when present
- [x] FRONTEND-045-AC-07: Toggle label indicates expandability and count
- [x] FRONTEND-045-AC-08: No toggle for an activity with zero (filtered) sub-tasks
- [x] FRONTEND-045-AC-09: Activating the toggle shows that activity's sub-tasks
- [x] FRONTEND-045-AC-10: Only one activity's sub-tasks are expanded at a time
- [x] FRONTEND-045-AC-11: Activating the toggle does not select the activity
- [x] FRONTEND-045-AC-12: `drag` mode is unaffected (regression guard)
- [x] FRONTEND-045-AC-13: `AssignActivityPicker.test.tsx`'s sub-task-button assertions are rescoped

## Summary

Implemented 2026-10-05. `ActivityPickerList.tsx`'s `visibleActivities.length > 0` render block was
split into two branches gated on `isDragMode`: the pre-existing flat-list JSX (now rendering a
plain `<span>` for the activity/sub-task name unconditionally, since `mode` is provably always
`'drag'` inside that branch — see Deviations) and a new grouped+collapsible JSX for `select` mode,
reusing `CATEGORY_ORDER`/`CategoryGroupHeading` and a new `getSubTasksToggleLabel(count, isExpanded)`
helper plus `expandedActivityId` state (mirroring `ActivityBank.tsx`'s own pattern).

**Test count**: `ActivityPickerList.test.tsx` grew from 11 to 23 tests (12 new, covering
AC-01/02/03/04/05/06/07/08/09/10/11/12 — several ACs share one test per the spec's sketches, plus
one extra AC-09/AC-10 case and one extra AC-11 case beyond the sketches for symmetry). One
pre-existing test in that file (`FRONTEND-033-AC-04`) and six pre-existing tests in
`AssignActivityPicker.test.tsx` (`FRONTEND-009-AC-24`, `FRONTEND-022-AC-03`, `FRONTEND-022-AC-04`,
`FRONTEND-009-AC-25/AC-26`'s "keeps a non-matching activity visible..." case, `FRONTEND-027-AC-07`,
`FRONTEND-027-AC-15`) were rescoped per AC-13 — each now clicks that sub-task's parent activity's
"Show sub-tasks (N)" toggle before asserting against the sub-task's own button, with no change to
what's actually asserted. One further pre-existing test outside the files the spec named,
`WeeklyPlanner.test.tsx`'s "lists a sub-task and creates a bucket occurrence from it" (which drives
the real `AssignActivityPicker` end-to-end through `WeeklyPlanner`), needed the same one-line
toggle-expand fix for the same reason. Full suite: 636/636 passing (up from 624), `npm run lint`
clean, `npx tsc -b --noEmit` clean.

**Deviation from the spec's implementation notes**: the notes suggested literally branching on
`isDragMode` "to pick between the old flat-list JSX and the new grouped+collapsible JSX" while
leaving the old JSX byte-for-byte as-is. Doing that literally left the old block's
`mode === 'select' ? <button>... : <span>...` ternaries in place — but TypeScript's control-flow
narrowing (correctly) infers `mode` is always `'drag'` inside an `isDragMode &&` guard (since
`isDragMode` is `const isDragMode = mode === 'drag'`), making `mode === 'select'` a compile error
(`TS2367`, no overlap between `"drag"` and `"select"`) rather than a no-op. Resolved by simplifying
that branch's two ternaries to their always-taken `else` case (a plain `<span>`) instead — the
rendered output for `drag` mode is unchanged (confirmed by `FRONTEND-028`/`FRONTEND-045-AC-05`/
`AC-12`'s existing regression-guard tests, all still green), only the now-dead branch of the
ternary was removed.
