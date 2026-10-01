# Repeatable-activity Icon on Activity Bank Rows (Frontend)

**Status**: Not started
**Priority**: P3 — small UX polish, nothing else blocked on it
**Depends on**: `frontend_spec_006_repeatable_activities.md` (`Activity.repeatable`,
`ActivityForm`'s checkbox — this spec only surfaces an existing field, it adds no new data),
`frontend_spec_002_activity_bank.md` (`ActivityBank`'s row markup, the "(Archived)" indicator
precedent this spec's "implicit, true-only" treatment matches), `frontend_spec_004_week_planning.md`
(origin of `OccurrenceItem.tsx`'s `CompletionIcon`, the inline-SVG icon pattern this spec reuses).
**Area**: Frontend
**Roadmap version**: N/A — UX polish on the existing V1 Activity Bank, not tied to a V1–V5 theme

## Overview

`Activity.repeatable` has existed since `frontend_spec_006_repeatable_activities.md` — set via a
checkbox in `ActivityForm`, and already filterable in `AssignActivityPicker`'s repeatable/one-off
filter — but nothing in the Activity Bank list itself (`ActivityBank.tsx`) visually indicates
whether a given row is repeatable or one-off. The only row-level indicator today is
`{activity.archived && <span className={styles.archivedLabel}>(Archived)</span>}` — shown only for
the true case, with no counterpart label for the (far more common) false case.

This spec adds a small icon next to each repeatable activity's `CategoryChip`, following that same
implicit, true-only treatment: the icon appears only when `repeatable` is `true`; one-off activities
(the default) get no icon and no replacement label, exactly as non-archived activities get no
"(Active)" label today.

The icon itself is a new `RepeatableIcon` component, built the same way `OccurrenceItem.tsx`'s
existing `CompletionIcon` is — a small inline SVG (16×16, `role="img"`, `aria-label`,
`stroke="currentColor"` so it follows the surrounding text color in both light and dark theme) —
not an emoji, icon font, or new dependency. This is this codebase's second icon, not its first; it
should look and behave like the first, not invent a new convention.

Row markup order becomes: activity name → `CategoryChip` → `RepeatableIcon` (if repeatable) →
`(Archived)` label (if archived) — appending the new icon at the same point in the row the archived
label already occupies, just earlier in the sequence.

Scope is deliberately narrow: `ActivityBank.tsx`'s own rows only. `SubTaskList`'s rows are
unaffected — `SubTask` has no `repeatable` field at all (sub-tasks don't carry their own
repeatable/one-off state, only their parent activity does). `AssignActivityPicker` is also
unaffected — it already has a repeatable/one-off *filter*, which is a different, already-shipped
affordance; adding the icon there too is not part of this spec and would need its own scoping if
wanted later.

## Requirement 1: Show a repeatable-activity icon on the Activity Bank list

**User story**: As someone scanning my activity bank, I want to see at a glance which activities are
repeatable (recur week after week) versus one-off, without opening each one, so I can judge my
weekly routine's shape from the list alone.

### FRONTEND-019-AC-01 [AUTO]: Icon renders next to CategoryChip when repeatable is true
**Statement**: While an activity's `repeatable` is `true`, the `ActivityBank` component shall render
a `RepeatableIcon` immediately after that activity's `CategoryChip` in its row.

**Rationale**: The core feature — visibility without opening the activity.

**References**:
- Icon pattern to replicate: `OccurrenceItem.tsx`'s `CompletionIcon` function
  (`frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` lines 29–49) — same inline-SVG
  structure (`viewBox="0 0 16 16"`, `width="16"` `height="16"`, `role="img"`, `aria-label`,
  `stroke="currentColor"`), new glyph (a looping/circular-arrows "repeat" path, not a checkmark).
- Placement: `ActivityBank.tsx`'s row markup, directly after `<CategoryChip category={activity.category} />`
  and before the existing `{activity.archived && ...}` block.

**Test Case (Red)**:
```tsx
it('FRONTEND-019-AC-01: shows a repeatable icon for a repeatable activity', async () => {
  // seed activity "Walk" with repeatable: true
  renderActivityBank()
  const row = (await screen.findByText('Walk')).closest('li')!
  expect(within(row).getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
})
```

**Test Case (Green)**: add a `RepeatableIcon` component (new file, e.g.
`frontend/src/components/ActivityBank/RepeatableIcon.tsx`, or colocated in `ActivityBank.tsx` if
this codebase's convention is to colocate small single-use icons — check `CompletionIcon`'s own
file placement and match it), rendered as `{activity.repeatable && <RepeatableIcon />}` in the row.

### FRONTEND-019-AC-02 [AUTO]: No icon renders for a one-off activity
**Statement**: While an activity's `repeatable` is `false`, the `ActivityBank` component shall
render no `RepeatableIcon` for that activity's row.

**Rationale**: Matches the "(Archived)" precedent — an implicit, true-only indicator with no
explicit counterpart for the default/false case, avoiding visual noise on the common case (most
activities are repeatable by default per `frontend_spec_006`, but one-off activities should read as
plainly as archived-vs-active already does).

**References**: Related: `FRONTEND-019-AC-01`.

**Test Case (Red)**:
```tsx
it('FRONTEND-019-AC-02: shows no repeatable icon for a one-off activity', async () => {
  // seed activity "Renew passport" with repeatable: false
  renderActivityBank()
  const row = (await screen.findByText('Renew passport')).closest('li')!
  expect(within(row).queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
})
```

**Test Case (Green)**: the `activity.repeatable &&` guard from `FRONTEND-019-AC-01` already satisfies
this — this AC is the explicit regression guard for that guard, matching this project's established
pattern (`frontend_spec_018_subtask_count_badge.md`'s `AC-02` for its own "false case" guard).

### FRONTEND-019-AC-03 [AUTO]: Icon has an accessible name distinguishing it from decoration
**Statement**: The `RepeatableIcon` shall carry `role="img"` and an `aria-label` stating what it
means (e.g. "Repeatable"), not render as an unlabeled decorative graphic.

**Rationale**: Matches `CompletionIcon`'s existing accessibility treatment exactly — a screen reader
user needs the same information a sighted user gets from the glyph itself.

**References**: `CompletionIcon`'s `role="img" aria-label="Completed"` — same shape, different label
text.

**Test Case (Red)**:
```tsx
it('FRONTEND-019-AC-03: icon has an accessible name', async () => {
  renderActivityBank()
  const row = (await screen.findByText('Walk')).closest('li')!
  expect(within(row).getByLabelText('Repeatable')).toBeInTheDocument()
})
```

**Test Case (Green)**: `<svg role="img" aria-label="Repeatable" ...>` on the `RepeatableIcon`'s root
element.

### FRONTEND-019-AC-04 [AUTO]: Icon renders between CategoryChip and the archived label
**Statement**: While an activity is both repeatable and archived, the `ActivityBank` component shall
render the row in the order: name, `CategoryChip`, `RepeatableIcon`, `(Archived)` label.

**Rationale**: A deterministic, testable DOM order avoids an ambiguous or visually inconsistent
row layout when both indicators are present on the same activity — a real combination, since
archiving doesn't change an activity's `repeatable` value.

**References**: Related: `FRONTEND-019-AC-01`, `FRONTEND-019-AC-02`.

**Test Case (Red)**:
```tsx
it('FRONTEND-019-AC-04: renders RepeatableIcon before the (Archived) label when both apply', async () => {
  // seed activity "Old routine" with repeatable: true, archived: true
  renderActivityBank()
  await userEvent.click(await screen.findByLabelText(/show archived/i))
  const row = (await screen.findByText('Old routine')).closest('li')!
  const icon = within(row).getByRole('img', { name: /repeatable/i })
  const archivedLabel = within(row).getByText('(Archived)')
  expect(icon.compareDocumentPosition(archivedLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
```

**Test Case (Green)**: place `{activity.repeatable && <RepeatableIcon />}` before
`{activity.archived && <span className={styles.archivedLabel}>(Archived)</span>}` in the row's JSX,
both after `<CategoryChip />`.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `Activity.repeatable` (already exists, no change) | `frontend/src/types/activity.ts` |
| Icon pattern replicated | `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` (`CompletionIcon`) |
| Row markup this icon attaches to | `frontend/src/components/ActivityBank/ActivityBank.tsx` |
| "(Archived)" implicit-indicator precedent | `ActivityBank.tsx`'s `archivedLabel` span + `.archivedLabel` CSS (`ActivityBank.module.css`) |
| Out of scope (not touched by this spec) | `frontend/src/components/ActivityBank/SubTaskList.tsx` (no `repeatable` field on `SubTask`), `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` (already has a repeatable/one-off filter; no icon added there by this spec) |

## Acceptance Criteria Summary

- [ ] FRONTEND-019-AC-01 [AUTO]: Icon renders next to `CategoryChip` when `repeatable` is `true`
- [ ] FRONTEND-019-AC-02 [AUTO]: No icon renders when `repeatable` is `false`
- [ ] FRONTEND-019-AC-03 [AUTO]: Icon carries `role="img"` and an accessible name ("Repeatable")
- [ ] FRONTEND-019-AC-04 [AUTO]: Icon renders between `CategoryChip` and the `(Archived)` label when both apply
