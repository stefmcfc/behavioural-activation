# Activity Bank Category Filter (Frontend)

**Status**: Not started
**Priority**: P3 — small UX polish, nothing else blocked on it
**Depends on**: `frontend_spec_002_activity_bank.md` (`ActivityBank`'s list + "Show archived" toggle),
`frontend_spec_006_repeatable_activities.md` (the "Show archived" segmented-pill precedent this
spec's filter styling matches), `frontend_spec_009_add_picker_modal.md` (origin of the exact
`CategoryFilter` type + fieldset/radio-pill pattern this spec reuses verbatim from
`AssignActivityPicker.tsx`). **No paired backend spec** — purely a client-side filter over data
`GET /api/v1/activities` already returns.
**Area**: Frontend
**Roadmap version**: N/A — UX polish on the existing V1 Activity Bank, not tied to a V1–V5 theme

## Overview

The Activity Bank list (`ActivityBank.tsx`) currently has one filter control — the "Show archived"
toggle — with no way to narrow the list by category. `AssignActivityPicker.tsx`
(`frontend_spec_009`) already solved this exact problem for its own activity list: a `CategoryFilter`
type (`'ALL' | ActivityCategory`), a `fieldset`+radio-pill control (`.filterFieldset`/`.filterGroup`
in `AssignActivityPicker.module.css`), and simple client-side filtering, since the full activity list
is already fetched.

This spec ports that exact pattern — same type shape, same markup/CSS treatment — onto
`ActivityBank.tsx`, giving it a "Filter by category" control alongside "Show archived". Unlike
`AssignActivityPicker`'s filter (which also matches a sub-task's own category, to support its
eager-fetched cross-activity+sub-task list), this filter matches only each top-level activity's own
`category` — the Activity Bank list renders activities, with sub-tasks nested and collapsed by
default, so filtering by the activity's own category is sufficient and avoids the entity's
known sub-task category drift (`.claude/ideas/future_ideas.md`'s "Sub-task category drift" entry) ever
affecting which activity rows appear.

The filter is local-only (component state), not persisted — it resets to "All" on reload, same as
`AssignActivityPicker`'s filters do each time that modal opens. It combines with "Show archived" using
AND logic, matching `AssignActivityPicker`'s combinable-filters precedent.

## Requirement 1: Filter the Activity Bank list by category

**User story**: As someone with a large activity bank, I want to narrow the list to one category at
a time, so I can review or manage activities in just that category without scrolling past the rest.

### FRONTEND-017-AC-01 [AUTO]: Category filter control renders with all four options
**Statement**: The `ActivityBank` component shall render a "Filter by category" control offering
`All`, `Routine`, `Necessary`, and `Pleasurable` options, defaulting to `All`.

**Rationale**: Mirrors `AssignActivityPicker`'s existing `CATEGORY_FILTER_OPTIONS` exactly — same
labels, same default — so the interaction is already familiar to the user.

**References**:
- Type: reuse `CategoryFilter` (`'ALL' | ActivityCategory`) — extract it from
  `AssignActivityPicker.tsx` into a shared location (e.g. `frontend/src/types/activity.ts` or a new
  small `utils/categoryFilter.ts`) so both components import the same type/options array instead of
  duplicating it.
- Markup/CSS: `AssignActivityPicker.tsx`'s `.filterFieldset`/`.filterGroup` fieldset+radio-pill
  pattern and its module CSS (`AssignActivityPicker.module.css` lines 26–74) — copy into
  `ActivityBank.module.css` as the same pattern, not a new one.

**Test Case (Red)**:
```tsx
it('FRONTEND-017-AC-01: renders a category filter defaulting to All', async () => {
  renderActivityBank()
  await screen.findByRole('group', { name: /filter by category/i })
  expect(screen.getByRole('radio', { name: /all/i })).toBeChecked()
  expect(screen.getByRole('radio', { name: /^routine$/i })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /^necessary$/i })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /^pleasurable$/i })).toBeInTheDocument()
})
```

**Test Case (Green)**: add the fieldset/radio-group control to `ActivityBank.tsx`'s toolbar, with
`categoryFilter` state defaulting to `'ALL'`.

### FRONTEND-017-AC-02 [AUTO]: Selecting a category narrows the list to matching activities
**Statement**: When a non-`All` category option is selected, the `ActivityBank` component shall
display only activities whose own `category` matches the selected option.

**Rationale**: The actual filtering behavior — the point of the control.

**References**: Filtering logic pattern: `AssignActivityPicker.tsx`'s `visibleActivities` (lines
130–141), simplified to compare only `activity.category` (no sub-task category matching — see
Overview).

**Test Case (Red)**:
```tsx
it('FRONTEND-017-AC-02: selecting Pleasurable shows only Pleasurable activities', async () => {
  // seed activities: "Walk" (ROUTINE), "Paint" (PLEASURABLE)
  renderActivityBank()
  await userEvent.click(await screen.findByRole('radio', { name: /^pleasurable$/i }))
  expect(screen.queryByText('Walk')).not.toBeInTheDocument()
  expect(screen.getByText('Paint')).toBeInTheDocument()
})
```

**Test Case (Green)**: derive a `visibleActivities` list (or equivalent `.filter()` inline) gated on
`categoryFilter`, rendered instead of the raw fetched list.

### FRONTEND-017-AC-03 [AUTO]: Category filter combines with "Show archived" using AND logic
**Statement**: While both a non-`All` category filter and "Show archived" are active, the
`ActivityBank` component shall display only activities that are both archived and match the
selected category.

**Rationale**: Matches `AssignActivityPicker`'s existing combinable-filters precedent
(`frontend_spec_009`) — the two controls narrow independently, not exclusively.

**References**: Related: `FRONTEND-017-AC-02`.

**Test Case (Red)**:
```tsx
it('FRONTEND-017-AC-03: category filter and Show archived combine with AND logic', async () => {
  // seed: "Walk" (ROUTINE, active), "Old walk" (ROUTINE, archived), "Paint" (PLEASURABLE, archived)
  renderActivityBank()
  await userEvent.click(await screen.findByLabelText(/show archived/i))
  await userEvent.click(await screen.findByRole('radio', { name: /^routine$/i }))
  expect(screen.getByText('Old walk')).toBeInTheDocument()
  expect(screen.queryByText('Walk')).not.toBeInTheDocument()
  expect(screen.queryByText('Paint')).not.toBeInTheDocument()
})
```

**Test Case (Green)**: chain both filter predicates in the same `.filter()`/derived list.

### FRONTEND-017-AC-04 [AUTO]: Filtering to an empty result shows an explanatory empty state
**Statement**: If the selected category filter (combined with "Show archived") matches no
activities, then the `ActivityBank` component shall display a message distinguishing this from the
"no activities at all" empty state (e.g. "No activities in this category.").

**Rationale**: Without this, an empty filtered list looks identical to a genuinely empty activity
bank, which is confusing for a new vs. filtered-to-nothing state.

**References**: Existing empty-state message in `ActivityBank.tsx` (whatever it currently reads for
zero activities) — this AC adds a second, distinct message, not a replacement.

**Test Case (Red)**:
```tsx
it('FRONTEND-017-AC-04: shows a filtered-empty message, not the generic empty state', async () => {
  // seed only ROUTINE activities
  renderActivityBank()
  await userEvent.click(await screen.findByRole('radio', { name: /^pleasurable$/i }))
  expect(screen.getByText(/no activities in this category/i)).toBeInTheDocument()
})
```

**Test Case (Green)**: branch the empty-state message on whether `categoryFilter !== 'ALL'` (or
`showArchived`) is active when the filtered list is empty but the unfiltered list isn't.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `CategoryFilter` type + options to extract/share | `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` lines 13–20 |
| Fieldset/radio-pill markup + CSS to replicate | `AssignActivityPicker.tsx` lines 150–168, `AssignActivityPicker.module.css` lines 26–74 |
| Existing "Show archived" toggle this sits alongside | `ActivityBank.tsx` lines 181–194, `ActivityBank.module.css` lines 1–46 |
| `ActivityCategory` labels | `frontend/src/utils/categoryLabels.ts` (`CATEGORY_LABELS`) |

## Acceptance Criteria Summary

- [ ] FRONTEND-017-AC-01 [AUTO]: Category filter control renders with All/Routine/Necessary/Pleasurable, defaulting to All
- [ ] FRONTEND-017-AC-02 [AUTO]: Selecting a category narrows the list to matching activities
- [ ] FRONTEND-017-AC-03 [AUTO]: Category filter combines with "Show archived" using AND logic
- [ ] FRONTEND-017-AC-04 [AUTO]: Filtering to an empty result shows a distinct "no activities in this category" message
