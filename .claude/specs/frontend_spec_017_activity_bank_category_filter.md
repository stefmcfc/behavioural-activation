# Activity Bank Category Filter (Frontend)

**Status**: Implemented — all 4 ACs green (4 new Vitest/RTL tests added to `ActivityBank.test.tsx`,
full suite 247/247 passing, `oxlint` clean, `tsc -b`/production build clean). Verified in a real
Chrome browser (headless, via a scratch Puppeteer script driving the actual dev servers) against
live backend data in both light and dark `prefers-color-scheme`: filter pills render and narrow the
list correctly, combine correctly with "Show archived", and the "No activities in this category."
empty state renders distinctly from the generic "No activities yet." state.

**Post-implementation correction (2026-10-01)**: this spec's original AC-03 Statement and test
sketch were wrong and have been corrected below. As first written, they specified that selecting
both a category and "Show archived" should narrow the list to *only* archived activities of that
category — excluding active ones. The first implementation followed that literally, which silently
contradicted `frontend_spec_006_repeatable_activities.md`'s actual "Show archived" semantics
(confirmed in `ActivityService.listForOwner`: `includeArchived=true` returns active **and** archived
together via `findByOwnerOrderByNameAsc`, never archived-only). Fixed by removing the extra
archived-only predicate — the category filter now simply narrows whatever the "Show archived" toggle
already fetched, additive as everywhere else in the app. AC-03's Statement and test sketch below
reflect the corrected behavior; the implementation and its test were updated to match.

**Post-implementation layout tweak (2026-10-01)**: per user feedback on the same PR, the category
filter now renders before "Show archived" (not after), a hairline vertical divider separates the two
filter groups, and "Show archived" is now wrapped in its own `<fieldset>`+`<legend>Filter by
status</legend>` to match the category filter's labeled-group treatment, rather than sitting
unlabeled. No AC changes needed — none of the 4 ACs specify ordering or a label above "Show
archived". Verified in a real browser (light theme) post-change; all 247 tests still green.
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

### FRONTEND-017-AC-03 [AUTO]: Category filter narrows whatever "Show archived" already includes
**Statement**: While a non-`All` category filter is active, the `ActivityBank` component shall
display only activities matching that category from whatever "Show archived" already fetched —
active-only when "Show archived" is off, active-and-archived together when it's on — never
excluding an active activity just because "Show archived" happens to be on.

**Rationale**: `ActivityService.listForOwner`'s `includeArchived=true` returns active **and**
archived activities together (`findByOwnerOrderByNameAsc`), never archived-only
(`frontend_spec_006_repeatable_activities.md`). The category filter must narrow that same additive
list, not silently change what "Show archived" itself means — the two controls narrow
independently (per `AssignActivityPicker`'s combinable-filters precedent, `frontend_spec_009`), they
don't combine into a third, different meaning.

**References**: Related: `FRONTEND-017-AC-02`.

**Test Case (Red)**:
```tsx
it('FRONTEND-017-AC-03: narrows whatever Show archived already includes (active + archived) to the selected category', async () => {
  // seed: "Walk" (ROUTINE, active), "Old walk" (ROUTINE, archived), "Paint" (PLEASURABLE, archived)
  renderActivityBank()
  await userEvent.click(await screen.findByLabelText(/show archived/i))
  await userEvent.click(await screen.findByRole('radio', { name: /^routine$/i }))
  expect(screen.getByText('Walk')).toBeInTheDocument()
  expect(screen.getByText('Old walk')).toBeInTheDocument()
  expect(screen.queryByText('Paint')).not.toBeInTheDocument()
})
```

**Test Case (Green)**: a single `.filter()` on `categoryFilter` alone, applied on top of whatever
`activities` the "Show archived" toggle already fetched — no second predicate referencing
`archived`.

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

- [x] FRONTEND-017-AC-01 [AUTO]: Category filter control renders with All/Routine/Necessary/Pleasurable, defaulting to All
- [x] FRONTEND-017-AC-02 [AUTO]: Selecting a category narrows the list to matching activities
- [x] FRONTEND-017-AC-03 [AUTO]: Category filter combines with "Show archived" using AND logic
- [x] FRONTEND-017-AC-04 [AUTO]: Filtering to an empty result shows a distinct "no activities in this category" message
