# Category Grouping + Collapsible Sub-Tasks in the Activity Drawer (Frontend)

**Status**: Not started
**Priority**: P3 — V1 polish, raised by the user 2026-10-05 to extend `frontend_spec_045`'s
Assign Activity modal treatment to Today's drag drawer
**Depends on**: `frontend_spec_045_assign_picker_collapsible_subtasks.md` (origin of the
grouping/collapsing design this spec ports to `drag` mode — **explicitly supersedes that spec's
`FRONTEND-045-AC-05`/`AC-12`, see Overview**), `frontend_spec_044_activity_bank_grouping.md`
(`CATEGORY_ORDER`/`CategoryGroupHeading`, reused again here), `frontend_spec_016_today_view.md`
(`ActivityDrawer`'s existing `AC-11`/`AC-12`/`AC-13` — drag affordance, grid legibility, bucket
reachability — re-verified here, not re-specified), `frontend_spec_028_activity_drawer.md` (the
drawer's known UX-fragility history this spec is deliberately careful around)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish

## Overview

`frontend_spec_045` gave `ActivityPickerList`'s `select` mode (the Assign Activity modal)
category-grouped sections and collapsible, single-expansion sub-tasks, while leaving `drag` mode
(`ActivityDrawer`, Today's "Browse activities" sidebar) untouched by two explicit regression-guard
ACs — `FRONTEND-045-AC-05` (no grouping in drag mode) and `FRONTEND-045-AC-12` (sub-tasks always
expanded in drag mode). This spec, raised by the user, **deliberately reverses both of those
guarantees**: `drag` mode now gets the identical grouping and collapsing treatment. Those two ACs
remain in `frontend_spec_045`'s own file as an accurate historical record (reference IDs are
immutable — see `.claude/steering/ears_format.md`); this spec supersedes the *behavior* they
described, and their corresponding tests in `ActivityPickerList.test.tsx` must be removed/rewritten
as part of this work (`FRONTEND-046-AC-10` below).

The drawer is a narrow (320px) sidebar beside Today's single-day grid, with a real history of
UX fragility (`frontend_spec_028`'s Summary: no drag affordance, an illegible squeezed grid, and a
bucket list that fell below the fold with no auto-scroll to reach it mid-drag — the last of which
was a measured 1.5px near-miss when `frontend_spec_016` reintroduced the drawer). A shorter drawer
is a genuine win here, not just visual parity — collapsing sub-tasks by default should only *help*
keep the bucket list reachable. But `drag` mode has one problem `select` mode never had: every
activity `<li>` is *entirely* `draggable`, and this spec nests a new clickable toggle inside that
draggable row for the first time. Without care, a click-with-slight-pointer-movement on the toggle
risks the browser starting a native drag of the whole row instead of registering the click —
exactly the class of problem `ActivityPickerList.tsx` already defends against for nested sub-task
rows (`event.stopPropagation()` on drag events, per `frontend_spec_028`'s Summary). This spec's
toggle button is explicitly `draggable={false}` to rule that out, with a dedicated regression test.

## Requirements

### Requirement 1: Category-grouped display in drag mode

**User story**: As a user browsing activities to drag onto today's plan, I want the same
Routine/Necessary/Pleasurable grouping the Assign modal and Activity Bank already have, so all
three places look and scan the same way.

#### FRONTEND-046-AC-01 [AUTO]: Activities grouped into fixed category sections
**Statement**: While `mode` is `"drag"`, the `ActivityPickerList` component shall render
`visibleActivities` grouped into `CategoryGroupHeading`-labelled sections in `CATEGORY_ORDER`
order, instead of one flat list — the same shape `FRONTEND-045-AC-01` already specifies for
`select` mode.

**References**:
- `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx` (the `!isDragMode` branch added
  by `frontend_spec_045`, to be mirrored/shared for `isDragMode` — see Implementation notes)

#### FRONTEND-046-AC-02 [AUTO]: Empty category groups are skipped
**Statement**: Same as `FRONTEND-045-AC-02`, for `drag` mode.

#### FRONTEND-046-AC-03 [AUTO]: Within-group order is unchanged (no new sort)
**Statement**: Same as `FRONTEND-045-AC-04`, for `drag` mode — partition via `.filter()`, never
introduce a `.sort()`.

### Requirement 2: Collapsible sub-tasks in drag mode

**User story**: As a user browsing activities to drag onto today's plan, I want sub-tasks
collapsed by default here too, so the drawer — already a narrow, height-constrained sidebar —
stays as short as possible and the bucket list stays reachable.

#### FRONTEND-046-AC-04 [AUTO]: Sub-tasks collapsed by default when present
**Statement**: Same as `FRONTEND-045-AC-06`, for `drag` mode — an activity with at least one
(category-filtered) sub-task does not render its sub-task rows until its toggle is activated.

#### FRONTEND-046-AC-05 [AUTO]: Toggle label indicates expandability and count
**Statement**: Same as `FRONTEND-045-AC-07` — `Show sub-tasks (N)` / `Hide sub-tasks`, `N` from
the locally filtered `subTasks.length`.

#### FRONTEND-046-AC-06 [AUTO]: Only one activity's sub-tasks are expanded at a time
**Statement**: Same as `FRONTEND-045-AC-10` — single-expansion, same `expandedActivityId`
pattern. The `drag`-mode `ActivityPickerList` instance (`ActivityDrawer`) and the `select`-mode
instance (`AssignActivityPicker`) are never mounted simultaneously (one is a modal, the other a
page sidebar, opened from different entry points) — each has entirely independent local state, so
no cross-mode interaction is possible or needs guarding against.

#### FRONTEND-046-AC-07 [AUTO]: Collapsing a sub-task hides it as a drag source until expanded
**Statement**: While a sub-task row is collapsed (its parent activity's toggle not yet activated),
the `ActivityPickerList` component shall not render that sub-task row at all, and it is therefore
not draggable until the toggle is activated.

**Rationale**: Stated explicitly as intentional, not a gap — a hidden row can't be a drag source
by construction, same tradeoff `select` mode already has (a collapsed sub-task can't be selected
either). Dragging a sub-task still works identically once its parent is expanded.

#### FRONTEND-046-AC-08 [AUTO]: The toggle is not itself draggable (regression guard)
**Statement**: The sub-tasks toggle button shall be rendered with `draggable={false}`, explicitly
overriding its draggable ancestor `<li>`. Activating the toggle (a plain click) shall not call
`onDragStartActivity`.

**Rationale**: The toggle is the first nested clickable control inside a fully-`draggable` row in
this component — without an explicit override, a click with any pointer movement risks the
browser starting a native drag of the whole activity row instead of registering the click. Mirrors
this file's existing `event.stopPropagation()` defensiveness for nested sub-task rows
(`frontend_spec_028`'s Summary), applied to the new nested-interactive-element case.

**References**:
- `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx` (`handleSubTaskDragStart`'s
  `event.stopPropagation()`, the precedent this AC's defensiveness mirrors)

#### FRONTEND-046-AC-09 [AUTO]: Activating the toggle does not start a drag of the activity
**Statement**: Clicking an activity's sub-tasks toggle shall not call `onDragStartActivity` for
that activity, and dragging the activity row itself shall not toggle its sub-tasks open/closed —
the two interactions remain fully independent.

### Requirement 3: Existing tests updated for the new behavior, not weakened

#### FRONTEND-046-AC-10 [AUTO]: `FRONTEND-045-AC-05`/`AC-12`'s drag-mode regression-guard tests are removed/rewritten
**Statement**: The `ActivityPickerList.test.tsx` tests written for `FRONTEND-045-AC-05` ("renders
no category headings in drag mode") and `FRONTEND-045-AC-12` ("renders sub-task rows
unconditionally in drag mode") shall be removed, since they assert the exact opposite of this
spec's new behavior, and replaced by this spec's own `FRONTEND-046-AC-01`/`AC-04` tests covering
the same scenarios with the new, correct expectation.

**Rationale**: An explicit instruction, not an oversight — leaving the old tests in place would
mean the suite permanently fails once this spec is implemented; silently deleting them without
this AC recording *why* would look like weakened coverage instead of a deliberate behavior change.

**References**:
- `frontend/src/components/WeeklyPlanner/ActivityPickerList.test.tsx` (search for `AC-05`/`AC-12`
  in `describe` blocks — exact line numbers will have shifted since `frontend_spec_045` shipped)

### Requirement 4: Re-verify the drawer's known fragile measurements (not re-specify)

#### FRONTEND-046-AC-11 [MANUAL]: Grid legibility and bucket reachability still hold with a shorter drawer
**Statement**: With the drawer open in a real browser, re-measure (via `getBoundingClientRect`,
not visual assumption — matching `frontend_spec_016_today_view.md`'s own established practice for
this exact drawer) that `FRONTEND-016-AC-12` (single-day grid stays legible/usable) and
`FRONTEND-016-AC-13` (bucket list stays reachable without scrolling) still hold, now that a typical
drawer with sub-tasks is likely shorter than before.

**Rationale**: `FRONTEND-016-AC-13` was a measured 1.5px near-miss last time — re-verify rather
than assume a shorter drawer can only help. Not expected to regress (the change only ever reduces
drawer height, never increases it), but this project's own established convention for this exact
component is to measure, not assume.

## Cross-references

| This spec depends on / contracts against | Why |
|---|---|
| `frontend_spec_045_assign_picker_collapsible_subtasks.md` | Origin of the grouping/collapsing design ported here; **this spec supersedes its `FRONTEND-045-AC-05`/`AC-12`** |
| `frontend_spec_044_activity_bank_grouping.md` | `CATEGORY_ORDER`/`CategoryGroupHeading`, reused a third time |
| `frontend_spec_016_today_view.md` | `AC-11`/`AC-12`/`AC-13`, re-verified not re-specified (`FRONTEND-046-AC-11`) |
| `frontend/src/components/WeeklyPlanner/ActivityDrawer.tsx` | The drawer consumer — expected to need zero changes itself, since all logic lives in `ActivityPickerList` |
| `frontend/src/components/WeeklyPlanner/ActivityDrawer.module.css` | Structural `[draggable='true']`/`li > div::before` selectors confirmed compatible with a nested toggle (no CSS changes needed) |

## Implementation notes (for `frontend-dev`)

- **De-duplicate the grouping/collapsing shell now that both modes need it.** `frontend_spec_045`
  deliberately kept `select`/`drag` as two fully separate render blocks so its regression guards
  held "by construction." Now that both modes group and collapse identically, consider extracting
  the shared shape — `CATEGORY_ORDER.map(...)` → skip-if-empty → per-activity `subTasks`/
  `isExpanded`/`toggleSubTasks` derivation — into one pass, parameterized only by a small
  per-row-content renderer (select button + `onSelectActivity` vs. draggable span +
  `onDragStartActivity`/`draggable={false}` toggle). This avoids two ~60-line blocks slowly
  drifting apart, without reintroducing the "mode conditionals threaded through one block" problem
  `frontend_spec_045` avoided — the *data* derivation is now identical; only leaf *row content*
  differs per mode. Use your judgment on the exact shape (a local helper function, an extracted
  sub-component) as long as `FRONTEND-045`'s already-shipped `select`-mode behavior and tests stay
  green throughout.
- **Toggle button**: `<button type="button" draggable={false} onClick={toggleSubTasks}>{label}</button>`,
  placed the same way `FRONTEND-045`'s `select`-mode toggle is (inside a `styles.actions`-wrapped
  span, right-aligned — see that spec's own follow-up fix for the exact CSS class).
- No changes expected to `ActivityDrawer.tsx` or `ActivityDrawer.module.css` — confirm this by the
  end of implementation rather than assuming; flag in the spec's `Summary` if either turns out to
  need a touch.

## TDD test case sketches

```tsx
describe('FRONTEND-046-AC-01/AC-02: category-grouped drag-mode list', () => {
  it('renders one heading per category with activities, in fixed order', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([read /* Pleasurable */, walk /* Routine */])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
    render(<ActivityPickerList {...dragProps()} />)
    await screen.findByText('Go for a walk')
    const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(headings).toEqual(['Routine', 'Pleasurable'])
  })
})

describe('FRONTEND-046-AC-04/AC-05: sub-tasks collapsed by default in drag mode', () => {
  it('shows "Show sub-tasks (N)" and hides sub-task rows until activated', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
    render(<ActivityPickerList {...dragProps()} />)
    await screen.findByText('Organise a leaving party')

    expect(screen.getByRole('button', { name: 'Show sub-tasks (1)' })).toBeInTheDocument()
    expect(screen.queryByText('Send invitations')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-046-AC-07: a collapsed sub-task is not a drag source', () => {
  it('has no draggable "Send invitations" row until expanded', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
    render(<ActivityPickerList {...dragProps()} />)
    await screen.findByText('Organise a leaving party')
    expect(screen.queryByText('Send invitations')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show sub-tasks (1)' }))
    const row = screen.getByText('Send invitations').closest('li')!
    expect(row).toHaveAttribute('draggable', 'true')
  })
})

describe('FRONTEND-046-AC-08/AC-09: toggle and drag stay independent', () => {
  it('the toggle is draggable=false and clicking it does not start a drag', async () => {
    const onDragStartActivity = vi.fn()
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
    render(<ActivityPickerList {...dragProps({ onDragStartActivity })} />)

    const toggle = await screen.findByRole('button', { name: 'Show sub-tasks (1)' })
    expect(toggle).toHaveAttribute('draggable', 'false')

    await userEvent.click(toggle)
    expect(onDragStartActivity).not.toHaveBeenCalled()
  })

  it('dragging the activity row does not toggle its sub-tasks', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
    render(<ActivityPickerList {...dragProps()} />)

    const row = (await screen.findByText('Organise a leaving party')).closest('li')!
    fireEvent.dragStart(row)
    expect(screen.getByRole('button', { name: 'Show sub-tasks (1)' })).toBeInTheDocument() // still collapsed
  })
})
```

**Test Case (Green)**: implement the grouping/collapse behavior above, remove/rewrite the superseded
`FRONTEND-045-AC-05`/`AC-12` tests (`FRONTEND-046-AC-10`), and manually re-verify
`FRONTEND-016-AC-12`/`AC-13` (`FRONTEND-046-AC-11`) until every sketch and every pre-existing test
passes.

## Acceptance Criteria Summary

- [ ] FRONTEND-046-AC-01: Activities grouped into fixed category sections
- [ ] FRONTEND-046-AC-02: Empty category groups are skipped
- [ ] FRONTEND-046-AC-03: Within-group order is unchanged (no new sort)
- [ ] FRONTEND-046-AC-04: Sub-tasks collapsed by default when present
- [ ] FRONTEND-046-AC-05: Toggle label indicates expandability and count
- [ ] FRONTEND-046-AC-06: Only one activity's sub-tasks are expanded at a time
- [ ] FRONTEND-046-AC-07: Collapsing a sub-task hides it as a drag source until expanded
- [ ] FRONTEND-046-AC-08: The toggle is not itself draggable (regression guard)
- [ ] FRONTEND-046-AC-09: Activating the toggle does not start a drag of the activity
- [ ] FRONTEND-046-AC-10: `FRONTEND-045-AC-05`/`AC-12`'s drag-mode regression-guard tests are removed/rewritten
- [ ] FRONTEND-046-AC-11: Grid legibility and bucket reachability still hold with a shorter drawer
