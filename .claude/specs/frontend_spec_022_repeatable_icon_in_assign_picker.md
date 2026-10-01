# Repeatable Icon in the Assign Activity Picker (Frontend)

**Status**: Implemented — `RepeatableIcon` rendered next to `CategoryChip` on activity rows only
(gated on `activity.repeatable`), in `AssignActivityPicker.tsx`. All 4 ACs covered by new tests in
`AssignActivityPicker.test.tsx` (263 Vitest tests total, 0 regressions; `oxlint`/`tsc -b --noEmit`
clean). Full real-browser pass (light + dark) against live dev data confirmed repeatable activities
show the icon, one-off ones don't, and no sub-task row ever shows it regardless of its parent's
value. **Post-implementation correction (2026-10-01)**: the first pass also showed the icon on
sub-task rows (resolved from the parent, since `SubTask` has no independent value) — the user asked
for a second opinion on this before merging. On reflection, sub-task-level repetition was the wrong
call: unlike `category` (which genuinely can differ per sub-task — see the Overview's note on
category drift), `repeatable` has no possibility of independent variation, so repeating it on every
sub-task underneath an activity added pure visual noise with no new information, worse the more
sub-tasks an activity has. Removed from sub-task rows; AC-03/AC-04 rewritten as regression guards
for this scoping decision. The same correction was applied to the weekend bucket list
(`frontend_spec_021`'s `FRONTEND-021-AC-04`), the only other place a sub-task-sourced item could
show the icon.
**Priority**: P3 — small UX polish, nothing else blocked on it
**Depends on**: `frontend_spec_019_repeatable_activity_icon.md` (origin of `RepeatableIcon`, reused
as-is), `frontend_spec_009_add_picker_modal.md` (`AssignActivityPicker`'s row markup, its existing
repeatable/one-off filter)
**Area**: Frontend
**Roadmap version**: N/A — UX polish, not tied to a V1–V5 theme

## Overview

`AssignActivityPicker` (the "Add" picker modal opened from a weekly grid cell or the bucket list)
was explicitly scoped *out* of `frontend_spec_019_repeatable_activity_icon.md`'s original rollout —
that spec's Overview noted it "already has a repeatable/one-off *filter*... adding the icon there
too is not part of this spec." Having since added the icon to the Activity Bank list
(`frontend_spec_019`), the Add/Edit modal (`frontend_spec_020`), and the weekend bucket list
(`frontend_spec_021`), its absence from this picker is now a visible gap — raised directly by the
user while reviewing those changes.

`AssignActivityPicker.tsx` already eagerly fetches full `Activity` objects for every row (unlike
`OccurrenceItem`, which only ever sees a `PlannedOccurrence` — see `frontend_spec_021`'s Overview for
why that one needed a backend change). `Activity.repeatable` is therefore already available
client-side with no new data required — **frontend-only, no backend change**.

Current row markup (`AssignActivityPicker.tsx` lines 200–231):

```tsx
<li key={activity.id} className={styles.activityGroup}>
  <div className={styles.activityRow}>
    <button type="button" aria-pressed={...} onClick={...}>{activity.name}</button>
    <CategoryChip category={activity.category} />
  </div>
  {subTasks.length > 0 && (
    <ul className={styles.subTaskList}>
      {subTasks.map((subTask) => (
        <li key={subTask.id} className={styles.subTaskRow}>
          <button type="button" aria-pressed={...} onClick={...}>{subTask.name}</button>
          <CategoryChip category={subTask.category} />
        </li>
      ))}
    </ul>
  )}
</li>
```

The icon renders next to `CategoryChip` on the **activity row only**, gated on `activity.repeatable`
— **never on a sub-task row**, regardless of the parent activity's `repeatable` value. This is a
deliberate asymmetry with `CategoryChip`, which *does* render on both row types: a sub-task's
`category` is a genuinely independent, separately-stored value that can differ from its parent's
(the known category-drift issue in `.claude/ideas/future_ideas.md` — a sub-task's category is
copied from the parent once, at creation time, and can diverge afterward), so showing it per-row is
showing real, independently-meaningful information. `repeatable` has no such independence — a
`SubTask` has no `repeatable` field of its own at all (confirmed across the backend entity, DTO, and
frontend type); it is *always* identical to its parent's value, by construction. Repeating it on
every sub-task row underneath an already-visible parent row adds no new information, only visual
noise that scales with how many sub-tasks an activity has.

## Requirement 1: Show the repeatable icon on activity rows only, never on sub-task rows

**User story**: As someone assigning an activity or sub-task to a day/slot or the bucket list, I
want to see which ones are repeatable without leaving the picker, consistent with every other place
this icon now appears.

### FRONTEND-022-AC-01 [AUTO]: Icon renders on a repeatable activity's row
**Statement**: While an activity's `repeatable` is `true`, the `AssignActivityPicker` component
shall render a `RepeatableIcon` next to that activity's `CategoryChip` in its own row.

**Rationale**: The core feature for the activity-row case.

**References**:
- Component reused as-is: `RepeatableIcon` (`frontend/src/components/RepeatableIcon/`).
- Markup: `AssignActivityPicker.tsx`'s `.activityRow` div (line 202).

**Test Case (Red)**:
```tsx
it('FRONTEND-022-AC-01: shows the repeatable icon for a repeatable activity row', async () => {
  // seed activity "Walk" with repeatable: true
  renderPicker()
  const row = (await screen.findByText('Walk')).closest('li')!
  expect(within(row).getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
})
```

**Test Case (Green)**: render `{activity.repeatable && <RepeatableIcon />}` next to
`<CategoryChip category={activity.category} />` in `.activityRow`.

### FRONTEND-022-AC-02 [AUTO]: No icon for a one-off activity's row
**Statement**: While an activity's `repeatable` is `false`, the `AssignActivityPicker` component
shall render no `RepeatableIcon` for that activity's row.

**Rationale**: Matches the established implicit, true-only treatment.

**References**: Related: `FRONTEND-022-AC-01`.

**Test Case (Red)**:
```tsx
it('FRONTEND-022-AC-02: shows no repeatable icon for a one-off activity row', async () => {
  // seed activity "Renew passport" with repeatable: false
  renderPicker()
  const row = (await screen.findByText('Renew passport')).closest('li')!
  expect(within(row).queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
})
```

**Test Case (Green)**: the `activity.repeatable &&` guard from `FRONTEND-022-AC-01` already
satisfies this — explicit regression guard, matching this project's established "false case" AC
pattern.

### FRONTEND-022-AC-03 [AUTO]: No icon on a sub-task row, even when its parent activity is repeatable
**Statement**: While a sub-task's parent activity has `repeatable: true`, the
`AssignActivityPicker` component shall render no `RepeatableIcon` on that sub-task's own row.

**Rationale**: This is the AC that actually encodes the activity-only scoping decision as a test,
not just prose in the Overview — without it, a future change could silently reintroduce the icon on
sub-task rows (e.g. someone "simplifying" by copying the activity row's render logic) with no test
catching the regression. See the Overview for why: `repeatable` has no independent per-sub-task
value to display, unlike `category`.

**References**: Related: `FRONTEND-022-AC-01`. Same scoping-decision-as-regression-guard pattern as
`frontend_spec_021_repeatable_icon_in_bucket_list.md`'s `FRONTEND-021-AC-03`/`AC-04`.

**Test Case (Red)**:
```tsx
it('FRONTEND-022-AC-03: never shows the repeatable icon on a sub-task row, even when its parent activity is repeatable', async () => {
  // seed activity "Walk" (repeatable: true) with sub-task "Stretch first"
  renderPicker()
  const row = (await screen.findByText('Stretch first')).closest('li')!
  expect(within(row).queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
})
```

**Test Case (Green)**: no `RepeatableIcon` render in `.subTaskRow` at all — only
`<CategoryChip category={subTask.category} />`.

### FRONTEND-022-AC-04 [AUTO]: No icon on a sub-task row when its parent activity is one-off
**Statement**: While a sub-task's parent activity has `repeatable: false`, the
`AssignActivityPicker` component shall render no `RepeatableIcon` for that sub-task's row.

**Rationale**: Regression guard confirming the sub-task row has no icon in either parent state —
redundant with `FRONTEND-022-AC-03` in outcome (both assert absence), but kept as a distinct AC for
symmetry with every other "true case / false case" pair in this project's specs, and because it
guards against a different hypothetical regression (an always-false parent read) than AC-03 does
(an always-true one).

**References**: Related: `FRONTEND-022-AC-03`.

**Test Case (Red)**:
```tsx
it('FRONTEND-022-AC-04: shows no repeatable icon on a sub-task row when its parent activity is one-off', async () => {
  // seed activity "Big project" (repeatable: false) with sub-task "Step one"
  renderPicker()
  const row = (await screen.findByText('Step one')).closest('li')!
  expect(within(row).queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
})
```

**Test Case (Green)**: no `RepeatableIcon` render in `.subTaskRow` at all, satisfied by the same
absence as `FRONTEND-022-AC-03`.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `RepeatableIcon` component (reused, not reinvented) | `frontend/src/components/RepeatableIcon/RepeatableIcon.tsx` |
| Row markup this icon attaches to | `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` |
| `Activity.repeatable` (already available, no new data) | `frontend/src/types/activity.ts` |
| Category-drift precedent for the row-level asymmetry this spec deliberately does NOT follow | `.claude/ideas/future_ideas.md` ("Sub-task category drift") |
| Same scoping-decision-as-regression-guard pattern | `frontend_spec_021_repeatable_icon_in_bucket_list.md` (`FRONTEND-021-AC-03`/`AC-04`) |

## Acceptance Criteria Summary

- [x] FRONTEND-022-AC-01 [AUTO]: Icon renders on a repeatable activity's row
- [x] FRONTEND-022-AC-02 [AUTO]: No icon for a one-off activity's row
- [x] FRONTEND-022-AC-03 [AUTO]: No icon on a sub-task row, even when its parent activity is repeatable
- [x] FRONTEND-022-AC-04 [AUTO]: No icon on a sub-task row when its parent activity is one-off
