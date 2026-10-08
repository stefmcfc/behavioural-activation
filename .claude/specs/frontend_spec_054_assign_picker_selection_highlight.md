# Visible Selection Highlight in the Assign Activity Picker (Frontend, bug fix)

**Status**: Implemented (2026-10-08)
**Priority**: P3 — bug fix, raised by the user 2026-10-08: clicking an activity/sub-task in the
Assign Activity modal gives no visible confirmation of which row is selected before clicking
"Assign", which is confusing with a long activity list
**Depends on**: `frontend_spec_045_assign_picker_collapsible_subtasks.md` (current
`ActivityPickerList`/`AssignActivityPicker` select-mode layout this spec adds styling to, no
structural change)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish

## Overview

`ActivityPickerList.tsx`'s `select`-mode activity/sub-task buttons already set
`aria-pressed={selected?.activityId === activity.id}` (and the sub-task equivalent) when clicked,
so the selection state is already correctly tracked and exposed to assistive technology. What's
missing is any **visual** styling tied to that state — the selected button looks identical to every
unselected one, so a sighted user has no way to confirm which row they've chosen before clicking
"Assign" in `AssignActivityPicker.tsx`'s footer. With a long activity list this makes it easy to
assign the wrong activity by mistake.

This spec adds a visual highlight for `aria-pressed="true"`, reusing the same accent/accent-ink
treatment this codebase already uses for "this option is the active choice" elsewhere (the
category/type/favourite filter pills' `:has(input:checked)` state, and the global `.primary` button
variant) — no new design token, no new interaction, purely a CSS addition keyed off state that
already exists in the DOM.

## Requirements

### Requirement 1: The selected activity or sub-task is visually distinguishable

**User story**: As a user assigning an activity from a long list, I want to see clearly which row
I've clicked, so I can confirm I'm about to assign the right one before clicking "Assign".

#### FRONTEND-054-AC-01 [AUTO]: Selected activity button is visually highlighted
**Statement**: While `mode` is `"select"` and an activity's select button has
`aria-pressed="true"`, the `ActivityPickerList` component shall render that button with a visually
distinct background/text colour (the same `var(--accent)`/`var(--accent-ink)` pairing already used
by this codebase's other "active choice" indicators), and shall not apply that styling to any
button with `aria-pressed="false"`.

**References**:
- `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx:279-285` (the activity select
  button, `aria-pressed` already set)
- Precedent: `AssignActivityPicker.module.css:94-98` (`.filterGroup label:has(input:checked)`),
  `buttonVariants.module.css` (`.primary`) — both pair `var(--accent)`/`var(--accent-ink)` for
  "this is the active/chosen option"

#### FRONTEND-054-AC-02 [AUTO]: Selected sub-task button is visually highlighted
**Statement**: While `mode` is `"select"` and a sub-task's select button has
`aria-pressed="true"`, the `ActivityPickerList` component shall render that button with the same
highlight treatment as `FRONTEND-054-AC-01`, and shall not apply it to any sub-task button with
`aria-pressed="false"`.

**References**:
- `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx:319-329` (the sub-task select
  button, `aria-pressed` already set)

#### FRONTEND-054-AC-03 [AUTO]: Selecting a different row moves the highlight, it doesn't add to it
**Statement**: When a different activity or sub-task is selected while one is already highlighted,
the `ActivityPickerList` component shall highlight only the newly-selected row — unchanged from
today's existing single-selection `ActivityPickerSelection` state (`AssignActivityPicker.tsx`'s
`selected` state already only ever holds one `activityId` or one `subTaskId` at a time; this AC is
a regression guard confirming the new CSS doesn't change that).

#### FRONTEND-054-AC-04 [AUTO]: `drag` mode is unaffected (regression guard)
**Statement**: While `mode` is `"drag"`, the `ActivityPickerList` component shall render no
selection highlight on any row — `drag`-mode rows are plain `<span>`s with no `aria-pressed`
attribute at all (today's existing behavior), so this is satisfied by construction as long as the
new CSS is scoped to an `aria-pressed` attribute selector rather than a structural one.

## Cross-references

| This spec depends on / contracts against | Why |
|---|---|
| `frontend_spec_045_assign_picker_collapsible_subtasks.md` | Current select-mode markup this spec styles; no structural change |
| `frontend/src/styles/buttonVariants.module.css` | Source of the `var(--accent)`/`var(--accent-ink)` pairing this spec reuses for its own "selected" treatment |
| `frontend/src/components/WeeklyPlanner/AssignActivityPicker.module.css` | File the new CSS rule is added to (shared by both `ActivityPickerList` consumers' `select`-mode markup, per `FRONTEND-028-AC-01`'s existing module-sharing precedent) |

## Implementation notes (for `frontend-dev`)

- **`AssignActivityPicker.module.css`**: add, near the existing `.activityRow`/`.subTaskRow` rules:
  ```css
  .activityRow button[aria-pressed='true'],
  .subTaskRow button[aria-pressed='true'] {
    background: var(--accent);
    color: var(--accent-ink);
  }
  ```
  No change needed in `ActivityPickerList.tsx` itself — `aria-pressed` is already set correctly on
  both buttons (lines 281, 324); this is a pure CSS addition. Scoping via the `[aria-pressed='true']`
  attribute selector (rather than a new conditional `className`) satisfies `FRONTEND-054-AC-04` by
  construction, since `drag`-mode rows render a `<span>`, never a button with `aria-pressed`.
  Global `button:hover` (`index.css`) sets `background: var(--code-bg)`, but
  `.activityRow button[aria-pressed='true']` has higher specificity (`0,2,1` vs. `0,1,1`), so the
  highlight already wins over hover without a separate `:hover` override — confirm this in the
  browser check rather than assuming.

## TDD test case sketches

### ActivityPickerList.test.tsx

```tsx
describe('FRONTEND-054-AC-01/AC-02/AC-03: aria-pressed reflects single selection (existing wiring, re-asserted)', () => {
  it('marks only the newly-selected activity as aria-pressed, not a previously-selected one', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk, jobs])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
    const { rerender } = render(<ActivityPickerList {...selectProps({ selected: { activityId: walk.id, subTaskId: null } })} />)
    await screen.findByText('Go for a walk')
    expect(screen.getByRole('button', { name: 'Go for a walk' })).toHaveAttribute('aria-pressed', 'true')

    rerender(<ActivityPickerList {...selectProps({ selected: { activityId: jobs.id, subTaskId: null } })} />)
    expect(screen.getByRole('button', { name: 'Go for a walk' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Apply for jobs' })).toHaveAttribute('aria-pressed', 'true')
  })
})
```

This spec is CSS-only beyond what `ActivityPickerList.test.tsx` already asserts (`aria-pressed`
wiring predates this spec and is already covered) — jsdom doesn't render CSS, so the actual visual
highlight is verified in a real browser, not a new Vitest assertion, per this project's
`frontend_conventions.md` guidance on CSS-only changes.

**Test Case (Green)**: add the CSS rule above; confirm no existing test regresses (the `aria-pressed`
assertions already in `ActivityPickerList.test.tsx`/`AssignActivityPicker.test.tsx` are unaffected
since no markup changed) and verify the visual highlight in a real browser.

## Acceptance Criteria Summary

- [x] FRONTEND-054-AC-01: Selected activity button is visually highlighted
- [x] FRONTEND-054-AC-02: Selected sub-task button is visually highlighted
- [x] FRONTEND-054-AC-03: Selecting a different row moves the highlight, it doesn't add to it
- [x] FRONTEND-054-AC-04: `drag` mode is unaffected (regression guard)

## Summary

Implemented as specced, no deviations. One CSS rule added to `AssignActivityPicker.module.css`,
keyed off the `aria-pressed` attribute already set in `ActivityPickerList.tsx` — no component
logic changed. Verified in a real browser (both themes): clicking an activity or sub-task row now
visibly highlights it (accent background/text), the highlight moves correctly between rows, hover
doesn't override it, and `drag`-mode rows (Today's activity drawer) remain unaffected since they
have no `aria-pressed` attribute to match.
