# Category-Grouped Display for the Activity Bank (Frontend)

**Status**: Implemented (2026-10-05)
**Priority**: P3 — V1 polish, raised by the user 2026-10-06 after the preset/starter activity
bank made "My Activities" noticeably longer and harder to scan
**Depends on**: `frontend_spec_040_preset_starter_activities.md` (origin of the category-grouped
`<h4>` display pattern this spec extracts and reuses — `CATEGORY_ORDER`, `CategoryGroupHeading`),
`frontend_spec_017_activity_bank_category_filter.md`/`frontend_spec_027_favourite_activities.md`
(the existing category/favourite/archived filters this spec's grouping sits alongside, unchanged)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish

## Summary

All 10 ACs implemented and tested. New: 5 tests in `CategoryGroupHeading.test.tsx` (the extracted
component's own live-colour coverage, migrated from `CategoryChip.test.tsx`'s shape) + 3 tests in
`ActivityBank.test.tsx` (`FRONTEND-044-AC-03` fixed-order/empty-category-skip ×2,
`FRONTEND-044-AC-06` no-`<details>` guard ×1). 2 pre-existing `ActivityBank.test.tsx` tests
rescoped, not weakened (`FRONTEND-044-AC-09`/`AC-10`) — 1:1 replacements, no net count change from
those. `SuggestedActivities.test.tsx` needed no behavior changes — all 14 of its existing tests
still pass unchanged against the extracted imports. Full suite: 624 frontend tests passing (up
from 616 pre-change — 8 net new), zero regressions. `npm run lint` (oxlint) clean.

**Real findings**:
- **`FRONTEND-044-AC-10`'s open query-mechanics question resolved by actual red/green, with a
  twist on the spec's own stated assumption**: `role="presentation"` on the grouped `<ul>` does
  *not* demote its child `<li>`s' implicit `listitem` role in this project's jsdom/RTL setup —
  `screen.getAllByRole('listitem')` still finds them. Proven directly: that query was run first and
  it did return every `<li>` on the page (confirmed via a debug dump), so demotion is not what
  breaks it. The real failure mode is different: it's *unscoped*, so it also matches unrelated
  `<li>`s from sibling sections rendered on the same page — the category-filter fieldset's own
  radio options (`All`/`Routine`/`Necessary`/`Pleasurable`) and every row in `SuggestedActivities`'
  preset list (which renders regardless of its `<details>` open/closed state in jsdom — closed
  disclosure content is not hidden from the accessibility tree here). The fix that actually works
  is the class-based fallback the spec flagged as the alternative:
  `document.querySelectorAll(`.${styles.row}`)` using `ActivityBank.module.css`'s own scoped
  `.row` class, which — because CSS Modules hash class names per-module — naturally excludes
  `SuggestedActivities.module.css`'s separate `.row` class and the filter fieldset's `<li>`s (no
  `.row` class at all), with no extra scoping needed.
- `FRONTEND-044-AC-09`'s rescoped test only needed `.closest('li')` on the activity's own name
  text, exactly as the spec sketched — no new issues there.
- `FRONTEND-044-AC-03`'s new "fixed order"/"omits empty category" tests needed one adjustment
  beyond the spec's bare sketch: `screen.getAllByRole('heading', { level: 4 })` unscoped also
  matches `SuggestedActivities`' own `CategoryGroupHeading`s (a sibling section on the same page,
  also using `<h4>`) — same root cause as the AC-10 finding above (closed-`<details>` content
  still present in jsdom's accessibility tree). Scoped by filtering out any heading whose
  `.closest('details')` is non-null, which cleanly isolates "My Activities"' own headings (never
  wrapped in `<details>`, per `FRONTEND-044-AC-06`) from "Suggested activities"' (always wrapped).
- No deviations from the spec's extraction/grouping code — `ActivityBank.tsx`'s new grouped block
  and `categoryLabels.ts`/`CategoryGroupHeading.tsx`'s new locations match the Implementation notes
  verbatim.

## Overview

"My Activities" in the Activity Bank renders as one flat, ungrouped `<ul>`, sorted
favourites-first then alphabetically (server-side, `planner_spec_015`). After the preset/starter
activity bank (`frontend_spec_040`) made it easy to add up to 23 activities in one sitting, the
user reported the resulting list is hard to scan. Rather than building new sort/reorder
infrastructure (a user-selectable sort control, or full manual drag-to-reorder — which would need
a brand-new `position` field on `Activity`, a new backend endpoint, and a drag gesture that
`frontend_spec_010`'s own experience showed can't be verified by automated browser tooling), this
spec reuses the category-grouped display pattern `frontend_spec_040`'s "Suggested activities"
section already built and shipped: fixed `ROUTINE`/`NECESSARY`/`PLEASURABLE` sections with a
live theme-reactive heading per category, skipping empty groups. Two previously-local pieces of
that pattern — the `CATEGORY_ORDER` constant and the `CategoryGroupHeading` component — are
extracted into shared locations so "My Activities" and "Suggested activities" use the identical
implementation, not two copies. Unlike the Suggested Activities disclosure, "My Activities"
stays always-expanded (no `<details>`) — it's the user's own primary data, not a secondary
onboarding aid, so it should never start collapsed/hidden.

## Requirements

### Requirement 1: Extract the shared grouping pieces

**User story**: As a developer, I want the category-grouping pattern defined once, so "My
Activities" and "Suggested activities" can't silently drift into two different-looking
implementations of the same idea.

#### FRONTEND-044-AC-01 [AUTO]: `CATEGORY_ORDER` lives in `categoryLabels.ts`
**Statement**: The `CATEGORY_ORDER` constant (currently local to `SuggestedActivities.tsx:37`)
shall be defined in `frontend/src/utils/categoryLabels.ts`, exported alongside `CATEGORY_LABELS`,
and `SuggestedActivities.tsx` shall import it from there instead of declaring its own copy.

**Rationale**: `CATEGORY_ORDER`'s own existing comment already ties it to `CATEGORY_LABELS`' key
order — they belong in the same file.

**References**:
- `frontend/src/utils/categoryLabels.ts` (existing: `CATEGORY_LABELS`)
- `frontend/src/components/ActivityBank/SuggestedActivities.tsx:37` (moves from here)

#### FRONTEND-044-AC-02 [AUTO]: `CategoryGroupHeading` becomes a shared component
**Statement**: The `CategoryGroupHeading` component (currently local to
`SuggestedActivities.tsx:39-56`, with its `.groupHeading` CSS rule in
`SuggestedActivities.module.css:40-46`) shall move to
`frontend/src/components/CategoryGroupHeading/CategoryGroupHeading.tsx` +
`CategoryGroupHeading.module.css`, matching this codebase's existing pattern for small shared
presentational components (`CategoryChip`, `FavouriteIcon`, `RepeatableIcon`, each in their own
directory). `SuggestedActivities.tsx` shall import it from the new location instead of defining
it locally, with no change to its rendered output (live theme-reactive background/text colour via
`getCategoryColor`/`getReadableTextColor`, unchanged).

**Rationale**: Direct reuse for Requirement 2 — "My Activities" needs the exact same heading, not
a second implementation.

**References**:
- `frontend/src/components/CategoryChip/CategoryChip.tsx` (sibling pattern)
- Related: `FRONTEND-040-AC-09` (the live-colour behavior being preserved, not re-specified)

### Requirement 2: Group "My Activities" by category

**User story**: As a user with a growing Activity Bank, I want my activities visually chunked
into Routine/Necessary/Pleasurable sections, so the list stays scannable as it grows, without
losing anything I can already do (filter, favourite, edit, archive, expand sub-tasks).

#### FRONTEND-044-AC-03 [AUTO]: Renders one heading per non-empty category, in fixed order
**Statement**: While `visibleActivities` is non-empty, the `ActivityBank` component shall render
a `CategoryGroupHeading` for each of `ROUTINE`/`NECESSARY`/`PLEASURABLE` (in that fixed order)
that has at least one matching activity in `visibleActivities`, and shall render no heading for a
category with none.

**Rationale**: Mirrors `FRONTEND-040-AC-03`/`AC-04`'s exact precedent (fixed order, empty groups
skipped) for visual consistency between the two sections on the same page.

**References**:
- `frontend/src/components/ActivityBank/ActivityBank.tsx:328-362` (the flat list this replaces)
- Related: `FRONTEND-040-AC-03`, `FRONTEND-040-AC-04`

#### FRONTEND-044-AC-04 [AUTO]: Row order within each group is unchanged from today
**Statement**: The `ActivityBank` component shall partition `visibleActivities` (the existing
already-filtered, backend-sorted array) into category groups using `Array.prototype.filter`, not
introduce any new client-side `.sort()` — so within each category group, activities appear in the
same favourite-first/alphabetical order the backend already provides.

**Rationale**: `FRONTEND-027-AC-04`'s existing regression guard ("Activity Bank list preserves
backend-provided order") must keep holding — grouping must not become a re-sort in disguise. This
AC exists specifically to prevent that regression.

**References**:
- Related: `FRONTEND-027-AC-04` (test needs rescoping, not logic changes — see Requirement 3)

#### FRONTEND-044-AC-05 [AUTO]: Row content is unchanged
**Statement**: The `ActivityBank` component shall render each activity row with exactly the same
content and behavior as today (favourite-toggle button, name, `CategoryChip`, `RepeatableIcon`
when repeatable, "(Archived)" label when archived, row actions, description, expandable sub-task
panel) — grouping changes only how rows are arranged into sections, not what any individual row
contains or does.

**Rationale**: This is a display reorganization, not a feature change to any per-row
interaction — every existing per-row AC (`FRONTEND-002`, `FRONTEND-006`, `FRONTEND-018`,
`FRONTEND-019`, `FRONTEND-023`, `FRONTEND-027`, `FRONTEND-031`, etc.) must keep passing unchanged.

#### FRONTEND-044-AC-06 [AUTO]: "My Activities" stays always-expanded
**Statement**: The `ActivityBank` component shall render the grouped "My Activities" sections
directly (no `<details>`/`<summary>` disclosure) — unlike `SuggestedActivities`, grouping never
starts collapsed or hidden.

**Rationale**: Confirmed with the user — "My Activities" is the user's own primary data; starting
it collapsed would hide the user's existing activities by default, unlike the Suggested
Activities disclosure (secondary, onboarding-flavoured content).

#### FRONTEND-044-AC-07 [AUTO]: Existing empty-state and filtered-empty messages are unaffected
**Statement**: The `ActivityBank` component shall continue to show "No activities yet. Add one
below to get started." when `activities` is an empty array, and "No activities in this category."
when `visibleActivities` is empty but `activities` is not — both unchanged from today, since both
already key off array length, not list structure.

**Rationale**: Explicit regression guard — grouping must not disturb these two existing
empty-state branches (`ActivityBank.tsx:320-326`).

### Requirement 3: Existing tests updated for the new structure, not weakened

**User story**: As a developer, I want the pre-existing regression tests this change touches
updated to match the new (still correct) DOM shape, not deleted or loosened.

#### FRONTEND-044-AC-08 [AUTO]: Per-category `<ul>` uses `role="presentation"`, matching precedent
**Statement**: Each category group's `<ul>` in `ActivityBank.tsx` shall carry `role="presentation"`
(its `CategoryGroupHeading` sibling already labels the group) — the same treatment
`SuggestedActivities.tsx`'s own per-category `<ul>` already uses, for the same reason
(`frontend_spec_040`'s Summary: "Real findings").

**Rationale**: `frontend_spec_040` discovered this exact failure mode already: rendering more than
one `<ul>` on the page without `role="presentation"` breaks any test using
`screen.getByRole('list')` expecting exactly one match. "My Activities" is about to go from one
`<ul>` to up to three (one per non-empty category) on the same page as `SuggestedActivities`'s own
groups — the identical problem, with the identical fix.

**References**:
- `frontend_spec_040_preset_starter_activities.md`'s Summary (the precedent this AC follows)

#### FRONTEND-044-AC-09 [AUTO]: `FRONTEND-002-AC-10` rescoped, not weakened
**Statement**: The existing test "renders the fetched activities" (`ActivityBank.test.tsx:97-107`,
currently `within(screen.getByRole('list'))`) shall be rewritten to scope its assertions via the
specific activity's own row (e.g. `screen.getByText('Walk').closest('li')`) rather than a singular
`getByRole('list')`, since that query is no longer guaranteed unique once grouping can render
multiple lists. The assertions themselves (category label and description text appear within that
activity's row) are unchanged.

**References**:
- `frontend/src/components/ActivityBank/ActivityBank.test.tsx:97-107`

#### FRONTEND-044-AC-10 [AUTO]: `FRONTEND-027-AC-04` rescoped, not weakened
**Statement**: The existing test "renders activities in the exact order activityApi.getAll
returns" (`ActivityBank.test.tsx:788-803`) shall be rewritten to assert document order across all
rows regardless of grouping — e.g. via `screen.getAllByRole('listitem')` (unscoped) if
`role="presentation"` on the parent `<ul>` does not demote its child `<li>` elements' implicit
role in this project's jsdom/Testing-Library setup, or via a class-based fallback query (this test
file already imports `styles` from `ActivityBank.module.css` for other assertions, e.g.
`styles.row`/`buttonStyles`, so `container.querySelectorAll(`.${styles.row}`)` is an available,
consistent fallback) if it does. Resolve via actual red/green TDD — don't assume which query
works without running it. The underlying assertion (order-preservation across activities) is
unchanged; only the query mechanics may need to adapt to the new grouped DOM shape.

**References**:
- `frontend/src/components/ActivityBank/ActivityBank.test.tsx:788-803`
- `frontend/src/components/ActivityBank/ActivityBank.test.tsx:9` (existing `styles` import,
  available for the class-based fallback)

## Cross-references

| This spec depends on / contracts against | Why |
|---|---|
| `frontend_spec_040_preset_starter_activities.md` | Origin of `CATEGORY_ORDER`/`CategoryGroupHeading`/the `role="presentation"` precedent this spec extracts and reapplies |
| `frontend_spec_017_activity_bank_category_filter.md` | The existing category filter, unchanged — still narrows `visibleActivities` before grouping |
| `frontend_spec_027_favourite_activities.md` | `FRONTEND-027-AC-04`'s order-preservation guard, rescoped not weakened (`FRONTEND-044-AC-10`) |
| `frontend/src/components/CategoryChip/CategoryChip.tsx` | Sibling small-shared-component pattern `CategoryGroupHeading`'s new location follows |

## Implementation notes (for `frontend-dev`)

- **`frontend/src/utils/categoryLabels.ts`**: add
  ```ts
  export const CATEGORY_ORDER: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']
  ```
- **`frontend/src/components/CategoryGroupHeading/CategoryGroupHeading.tsx`** (new): move the
  component verbatim from `SuggestedActivities.tsx:39-56`, importing `ActivityCategory`,
  `CATEGORY_LABELS`, `getCategoryColor`/`subscribeToCategoryColorChanges`, `getReadableTextColor`
  as it already does. New `CategoryGroupHeading.module.css` gets the `.groupHeading` rule moved
  verbatim from `SuggestedActivities.module.css:40-46`.
- **`SuggestedActivities.tsx`**: replace the local `CATEGORY_ORDER` const and
  `CategoryGroupHeading` function with imports from their new locations. Remove the now-unused
  `.groupHeading` rule from `SuggestedActivities.module.css`.
- **`ActivityBank.tsx`**: add
  ```ts
  const visibleCategories =
    categoryFilter === 'ALL' ? CATEGORY_ORDER : CATEGORY_ORDER.filter((c) => c === categoryFilter)
  ```
  and replace the flat `<ul className={styles.list}>...</ul>` block (lines 328-362) with:
  ```tsx
  {visibleCategories.map((category) => {
    const activitiesInCategory = visibleActivities.filter((a) => a.category === category)
    if (activitiesInCategory.length === 0) return null
    return (
      <div key={category}>
        <CategoryGroupHeading category={category} />
        <ul className={styles.list} role="presentation">
          {activitiesInCategory.map((activity) => (
            /* exact existing <li> row JSX, unchanged */
          ))}
        </ul>
      </div>
    )
  })}
  ```
- **Tests**: `ActivityBank.test.tsx:97-107` and `:788-803` rescoped per `FRONTEND-044-AC-09`/
  `AC-10` above. New tests for `FRONTEND-044-AC-03` (headings render in fixed order, empty
  categories skipped — mirroring `SuggestedActivities.test.tsx`'s own
  `FRONTEND-040-AC-03`/`AC-04` test shapes) and `FRONTEND-044-AC-06` (no `<details>` wrapper
  around "My Activities", unlike `SuggestedActivities`). `SuggestedActivities.test.tsx` should
  need no behavior changes, just confirms it still passes against the extracted imports. New
  `CategoryGroupHeading.test.tsx` for the extracted component's own live-colour behavior
  (migrate/duplicate whatever coverage existed implicitly via `SuggestedActivities.test.tsx`
  before the extraction).

## TDD test case sketches

```tsx
describe('FRONTEND-044-AC-03: category-grouped headings in My Activities', () => {
  it('renders one heading per category with activities, in fixed order', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([read, walk, jobs]) // Pleasurable, Routine, Necessary
    render(<ActivityBank />)
    await screen.findByText('Walk')
    const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(headings).toEqual(['Routine', 'Necessary', 'Pleasurable'])
  })

  it('omits a heading for a category with no visible activities', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk]) // Routine only
    render(<ActivityBank />)
    await screen.findByText('Walk')
    expect(screen.queryByRole('heading', { name: 'Necessary' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pleasurable' })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-044-AC-06: My Activities is never collapsed', () => {
  it('renders activity rows with no enclosing <details>', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    render(<ActivityBank />)
    const row = await screen.findByText('Walk')
    expect(row.closest('details')).toBeNull()
  })
})

describe('FRONTEND-044-AC-09: category/description assertions scoped to the activity row', () => {
  it('renders the fetched activity (rescoped from the old singular getByRole("list") query)', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    render(<ActivityBank />)
    const row = (await screen.findByText('Walk')).closest('li')!
    expect(within(row).getByText('Routine')).toBeInTheDocument()
    expect(within(row).getByText('Around the block')).toBeInTheDocument()
  })
})

describe('FRONTEND-044-AC-10: order preservation across the grouped structure', () => {
  it('renders activities in the exact order activityApi.getAll returns, even across categories', async () => {
    const zebraFavourite: Activity = { ...walk, id: '10', name: 'Zebra', favourite: true }
    const appleActivity: Activity = { ...jobs, id: '11', name: 'Apple', favourite: false }
    const mangoActivity: Activity = { ...read, id: '12', name: 'Mango', favourite: false }
    vi.mocked(activityApi.getAll).mockResolvedValue([zebraFavourite, appleActivity, mangoActivity])
    render(<ActivityBank />)
    await screen.findByText('Zebra')
    // Resolve the exact query mechanics (getAllByRole('listitem') vs. a styles.row-based
    // querySelectorAll fallback) via red/green against the real role="presentation" behavior --
    // see FRONTEND-044-AC-10's statement.
  })
})
```

**Test Case (Green)**: implement the extraction and grouped rendering above until every sketch
(and every pre-existing `ActivityBank.test.tsx`/`SuggestedActivities.test.tsx` test) passes.

## Acceptance Criteria Summary

- [x] FRONTEND-044-AC-01: `CATEGORY_ORDER` lives in `categoryLabels.ts`
- [x] FRONTEND-044-AC-02: `CategoryGroupHeading` becomes a shared component
- [x] FRONTEND-044-AC-03: Renders one heading per non-empty category, in fixed order
- [x] FRONTEND-044-AC-04: Row order within each group is unchanged from today
- [x] FRONTEND-044-AC-05: Row content is unchanged
- [x] FRONTEND-044-AC-06: "My Activities" stays always-expanded
- [x] FRONTEND-044-AC-07: Existing empty-state and filtered-empty messages are unaffected
- [x] FRONTEND-044-AC-08: Per-category `<ul>` uses `role="presentation"`, matching precedent
- [x] FRONTEND-044-AC-09: `FRONTEND-002-AC-10` rescoped, not weakened
- [x] FRONTEND-044-AC-10: `FRONTEND-027-AC-04` rescoped, not weakened
