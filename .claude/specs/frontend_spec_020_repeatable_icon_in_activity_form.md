# Repeatable Icon in the Add/Edit Activity Modal (Frontend)

**Status**: Not started
**Priority**: P3 — small UX polish, nothing else blocked on it
**Depends on**: `frontend_spec_019_repeatable_activity_icon.md` (origin of `RepeatableIcon`, which
this spec reuses as-is — no new icon), `frontend_spec_013_add_activity_modal.md` (`ActivityForm`'s
"Repeatable" checkbox + hint paragraph)
**Area**: Frontend
**Roadmap version**: N/A — UX polish, not tied to a V1–V5 theme

## Overview

`frontend_spec_019_repeatable_activity_icon.md` added a `RepeatableIcon` next to each repeatable
activity's `CategoryChip` in the Activity Bank list. This spec extends the same icon into the
Add/Edit activity modal (`ActivityForm.tsx`), so the icon the user now associates with "repeatable"
in the list also appears where that property is actually set — visually tying the written word
"Repeatable" to the glyph used everywhere else.

`ActivityForm.tsx`'s existing "Repeatable" checkbox (lines ~120–137) is:

```tsx
<div className={styles.repeatableField}>
  <label htmlFor={repeatableId}>
    <input id={repeatableId} name="repeatable" type="checkbox" checked={repeatable}
      onChange={(event) => setRepeatable(event.target.checked)} />{' '}
    Repeatable
  </label>
  <p className={styles.repeatableHint}>...</p>
</div>
```

The icon renders inside that same `<label>`, immediately after the "Repeatable" text, and is
**live-reactive to the checkbox** — it appears and disappears as the user toggles the checkbox
during both create and edit, not just on initial load. This differs from
`frontend_spec_019`'s read-only list context (where `repeatable` only ever reflects a saved
activity): here it's local form state (`repeatable`, from `useState`), so the icon doubles as
live visual feedback for what the control actually controls, not just a static label decoration.

No backend change — `ActivityForm` already reads/writes `repeatable` as local component state; this
spec only adds a render, it doesn't touch any API contract.

## Requirement 1: Show the repeatable icon live in the Add/Edit activity form

**User story**: As someone creating or editing an activity, I want to see the same repeatable icon
I'll later see in the Activity Bank list right where I'm setting that property, so the connection
between the checkbox and the list indicator is obvious.

### FRONTEND-020-AC-01 [AUTO]: Icon renders inside the label when the checkbox is checked
**Statement**: While the "Repeatable" checkbox is checked, the `ActivityForm` component shall render
a `RepeatableIcon` immediately after the "Repeatable" label text.

**Rationale**: The core feature — visual confirmation tied directly to the control.

**References**:
- Component reused as-is: `RepeatableIcon` (currently colocated in
  `frontend/src/components/ActivityBank/ActivityBank.tsx` per `frontend_spec_019`) — export it from
  that file (or extract to its own module if colocation makes an unused-import/circular-import
  problem for `ActivityForm.tsx` to import from `ActivityBank.tsx`; check which is cleaner at
  implementation time and match whatever precedent `CategoryChip`'s own extraction already set for
  a shared small component).
- Markup: `ActivityForm.tsx`'s existing `<label htmlFor={repeatableId}>...Repeatable</label>` —
  icon goes inside this label, after the text.

**Test Case (Red)**:
```tsx
it('FRONTEND-020-AC-01: shows the repeatable icon when the checkbox is checked', async () => {
  render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
  // repeatable defaults to true per frontend_spec_006
  expect(screen.getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
})
```

**Test Case (Green)**: render `{repeatable && <RepeatableIcon />}` inside the label, after the text
node.

### FRONTEND-020-AC-02 [AUTO]: Icon disappears when the checkbox is unchecked
**Statement**: While the "Repeatable" checkbox is unchecked, the `ActivityForm` component shall
render no `RepeatableIcon`.

**Rationale**: Matches `frontend_spec_019`'s implicit, true-only treatment — and confirms the icon
is genuinely reactive to the control, not a static decoration shown regardless of state.

**References**: Related: `FRONTEND-020-AC-01`.

**Test Case (Red)**:
```tsx
it('FRONTEND-020-AC-02: hides the repeatable icon when the checkbox is unchecked', async () => {
  render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
  await userEvent.click(screen.getByLabelText(/repeatable/i))
  expect(screen.queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
})
```

**Test Case (Green)**: the `repeatable &&` guard from `FRONTEND-020-AC-01` already satisfies this —
explicit regression guard, matching this project's established "false case" AC pattern.

### FRONTEND-020-AC-03 [AUTO]: Icon reacts live to toggling, not just initial render
**Statement**: When the user toggles the "Repeatable" checkbox, the `ActivityForm` component shall
show or hide the `RepeatableIcon` in the same interaction, without requiring a re-render triggered
by anything else (e.g. re-opening the modal).

**Rationale**: Distinguishes this spec from `frontend_spec_019`'s read-only list rendering — this is
genuinely live form feedback, the main reason this spec exists rather than relying on the list's
icon alone.

**References**: Related: `FRONTEND-020-AC-01`, `FRONTEND-020-AC-02`.

**Test Case (Red)**:
```tsx
it('FRONTEND-020-AC-03: toggling the checkbox live-updates the icon in one interaction', async () => {
  render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
  expect(screen.getByRole('img', { name: /repeatable/i })).toBeInTheDocument()

  await userEvent.click(screen.getByLabelText(/repeatable/i))
  expect(screen.queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()

  await userEvent.click(screen.getByLabelText(/repeatable/i))
  expect(screen.getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
})
```

**Test Case (Green)**: since the icon is derived directly from the same `repeatable` state the
checkbox's `onChange` already updates, this falls out of `FRONTEND-020-AC-01`/`AC-02`'s
implementation with no extra code — this AC exists to make the live-reactivity requirement explicit
and tested, not to require new logic.

### FRONTEND-020-AC-04 [AUTO]: Edit mode prefills the icon from the activity being edited
**Statement**: When `ActivityForm` is opened in edit mode for an activity with `repeatable: true`,
the component shall render the `RepeatableIcon` on initial render, before any user interaction.

**Rationale**: Edit mode's checkbox already prefills from `activity.repeatable`
(`frontend_spec_006_repeatable_activities.md`'s `FRONTEND-006-AC-03`) — the icon must prefill
consistently with it, not just work correctly once the user starts toggling.

**References**: `FRONTEND-006-AC-03` (existing prefill behavior this AC extends).

**Test Case (Red)**:
```tsx
it('FRONTEND-020-AC-04: shows the icon on initial render in edit mode for a repeatable activity', () => {
  render(<ActivityForm mode="edit" activity={{ ...walk, repeatable: true }} onSuccess={vi.fn()} />)
  expect(screen.getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
})
```

**Test Case (Green)**: covered automatically since `repeatable`'s initial `useState` value already
derives from `activity?.repeatable ?? true` — no new logic, this AC is a regression guard confirming
the icon's render guard reads the same initial state the checkbox does.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `RepeatableIcon` component (reused, not reinvented) | `frontend/src/components/ActivityBank/ActivityBank.tsx` (per `frontend_spec_019`) |
| `repeatable` checkbox + local state | `frontend/src/components/ActivityBank/ActivityForm.tsx` |
| Edit-mode prefill behavior this extends | `frontend_spec_006_repeatable_activities.md` (`FRONTEND-006-AC-03`) |

## Acceptance Criteria Summary

- [ ] FRONTEND-020-AC-01 [AUTO]: Icon renders inside the label when the checkbox is checked
- [ ] FRONTEND-020-AC-02 [AUTO]: Icon disappears when the checkbox is unchecked
- [ ] FRONTEND-020-AC-03 [AUTO]: Icon reacts live to toggling in one interaction
- [ ] FRONTEND-020-AC-04 [AUTO]: Edit mode prefills the icon correctly on initial render
