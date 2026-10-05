# Weekly Summary Reorganization (Frontend)

**Status**: Implemented (2026-10-05)
**Priority**: P2 — V1 polish, refining `frontend_spec_036`/`frontend_spec_037`'s just-shipped Weekly
Summary tab based on real-use feedback from the user (2026-10-05)
**Depends on**: `frontend_spec_036_weekly_summary.md` (origin of `WeeklySummary.tsx`,
`weeklySummaryStats.ts`'s `computeStats`), `frontend_spec_037_weekly_summary_visualizations.md`
(origin of `CompletionMark`, the segmented completion bar, the lite grid/bucket list, and the
location × category breakdown chart — all three reorganized or restyled by this spec, none removed
in substance), `planner_spec_020_prevent_completed_occurrence_bucket_move.md` /
`frontend_spec_038_prevent_completed_occurrence_bucket_move.md` (related bug fix raised in the same
review, specced separately since it changes `PlanService`/`OccurrenceItem` behavior rather than the
Weekly Summary page itself)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish

## Summary

All 17 ACs implemented and verified (17 new/updated Vitest tests across
`weeklySummaryStats.test.ts` and `WeeklySummary.test.tsx`; 566/566 total frontend tests pass, 0
regressions). `npm run lint` (oxlint) and `npx tsc -b --noEmit` both clean.

**Real-browser verification** (all three `[MANUAL]` ACs), done by the coordinator against the live
dev stack with a realistic mixed week (completed/not-completed occurrences across all three
categories, a scheduled item and bucket items in the same category):
- `AC-14`/`AC-15`: confirmed in both Light and Dark themes — the lite grid reads as a bordered
  table with monospace day/slot headers, the merged per-category table groups and orders marks
  correctly, and both renamed headings/section order match the spec.
- `AC-16`: navigated to a week two weeks before the real current date (system clock, not an
  injected test date) and confirmed the scheduled/bucket line is hidden there while still showing
  for the current week.

**Post-review polish, based on the user's live feedback while reviewing the above**: four CSS-only
refinements to the lite grid, none changing any AC's substance — (1) `.liteGridCell` had two
separate rule blocks for the same class (one from this spec's edit, one pre-existing); merged into
one and added `align-items: center` so a single mark centers in its cell instead of sitting
top-left; (2) `.circle` (`CompletionMark.module.css`) sized up from `0.65rem` to `0.85rem` for
better legibility against the now-bordered cells; (3) `.liteGrid`'s `grid-template-columns` changed
from `auto repeat(7, 1fr)` to `repeat(8, 1fr)` so the slot-label column matches the day columns'
width; (4) `.liteGridDayLabel`/`.liteGridSlotLabel`/`.liteGridCell` gained `background:
var(--code-bg)` so each cell reads as its own distinct box against the page background (tried
`var(--surface)` and a `.liteGrid`-level card background first; neither gave enough contrast in
Light theme). Also added one more behavior based on the same live review: the "Weekend bucket"
sub-heading and its marks no longer render under "This week's placement" when the bucket is empty
for the viewed week (new `FRONTEND-039-AC-17`, one new test, verified live by temporarily clearing
and restoring the dev bucket's occurrences).

**Implementation notes**:
- Added an optional `initialWeekStart` prop to `WeeklySummary` (defaulting to
  `getMondayOfCurrentWeek()` when omitted, preserving `FRONTEND-036-AC-03`'s existing behavior) so
  `isPastWeek`'s past/current/future branches are directly testable without depending on the real
  system clock.
- `weeklySummaryStats.ts`'s top-level `WeeklyStats.byCategory` field was confirmed unused once the
  old numeric "By category" table was removed (its only consumer was `WeeklySummary.tsx`'s own old
  table) and removed; `byCategoryFor()`'s internal call from `computeByLocation()` (used by the
  unchanged breakdown chart) was left untouched, as was the exported `CategoryStat` type (still used
  by `LocationStat`/`BreakdownSegment`).
- Requirement 4 (lite grid border + monospace headers) needed **CSS-only** changes —
  `.liteGridDayLabel`/`.liteGridSlotLabel`/`.liteGridCell` already existed as the exact class hooks
  applied in `WeeklySummary.tsx`'s JSX, so no component changes were needed, only new rules in
  `WeeklySummary.module.css` (border on all three; `font-family: var(--mono)` — this project's
  existing monospace stack from `index.css` — on the two header-label classes only).
- `"This week's placement"`'s enclosing `<section>`'s `aria-label` was changed from the old
  `"Where this week's activities landed"` to `"This week's placement"` (matching its new heading
  text) rather than keeping the old wording verbatim — the AC's "both updated consistently" phrasing
  was read as "heading and aria-label should say the same tense-neutral thing," not "keep the old
  aria-label string." Similarly, the first section's `aria-label` changed from `"Completion for the
  week"` to `"This week at a glance"`, since that section now wraps the completion count, the
  conditional scheduled/bucket line, and the merged table together, not just the (now-removed) flat
  completion bar alone.
- Several `frontend_spec_037`-era tests that exercised the now-removed flat completion bar
  (`FRONTEND-037-AC-01`–`AC-04`) were rewritten in place to exercise the same underlying behaviors
  (mark ordering, full `aria-label` detail, border class regardless of fill colour) against the new
  merged table instead, rather than deleted outright — the contracts they guarded
  (`CompletionMark`'s own rendering, completed-first ordering) still apply, just inside a different
  container.

## Overview

Real-use feedback on the just-shipped Weekly Summary tab (2026-10-05) identified three changes,
confirmed with the user before writing this spec:

1. **Reorder and merge**: "This week at a glance" should come first and absorb both the completion
   count and a new per-category grouped view of the week's activity marks — replacing both the
   existing flat completion bar *and* the existing plain-text "By category" numeric table with one
   combined, no-header table (one row per category, each row showing that category's own marks,
   giving the page the appearance of a bar graph without introducing a new chart type).
2. **Conditional scheduled/bucket line**: "X scheduled, Y in the weekend bucket" is only meaningful
   for the current or a future week — for a week that's already fully ended, any bucket items still
   incomplete by week's end have already auto-migrated forward (`frontend_spec_011_bucket_carry_
   forward_automation.md`), so the count is stale by the time you look back. **Confirmed with the
   user**: hide the line entirely for a past week rather than reword or always show it — "the point
   of the bucket is to take things from when you have free time."
3. **Two section renames + one visual polish pass**: "Where things landed" reads fine for a past
   week but not a current/future one (nothing has "landed" yet) — renamed to a tense-neutral heading
   that reads correctly regardless of when the week falls. "By location and category" reads as if
   "location" means a physical place — renamed to "By schedule and category". The lite weekly grid
   underneath the (renamed) placement section gains visible grid lines and a monospace font for its
   day/slot headers, so it reads more clearly as a compact table.

**A related bug surfaced during this same review, specced separately**: reviewing the scheduled/
bucket line's meaning led to checking whether a *completed* occurrence can currently be moved back
into the bucket — confirmed yes, via both the "Send to bucket" button and drag-and-drop, with no
guard on either the frontend or backend. Fixed by `planner_spec_020`/`frontend_spec_038`, not this
spec — kept separate because it changes `PlanService`/`OccurrenceItem` behavior used outside the
Summary page, not the Summary page's own presentation.

**Out of scope**: any new data/computation beyond what `frontend_spec_036`/`037` already fetch and
compute (no backend change); any change to `BreakdownChart`'s internal rendering beyond its heading
text (segment order, labelling, and the surface-gap/border treatment all stay exactly as
`frontend_spec_037` specified); any change to the lite bucket list's own rendering (only the lite
*grid* above it gets the border/monospace treatment); persisting any of this as a user preference.

## Requirements

### Requirement 1 — Section order and renamed headings

**User story**: As a user, I want the Weekly Summary page's sections in the order I actually read
them (overview first, then placement, then breakdown), with headings that read correctly whether I'm
looking at a past, current, or future week.

#### FRONTEND-039-AC-01 [AUTO]: Sections render in the new fixed order
**Statement**: `WeeklySummary` shall render its three major sections in the order: "This week at a
glance" (Requirement 2 + 3's content), then the renamed placement section (Requirement 4), then the
renamed breakdown section (unchanged `BreakdownChart`).

**Rationale**: Direct implementation of the user's requested reordering.

**References**: Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx`

#### FRONTEND-039-AC-02 [AUTO]: "Where things landed" is renamed to a tense-neutral heading
**Statement**: The section currently headed "Where things landed" shall be renamed "This week's
placement" (or an equivalent tense-neutral wording) — one heading used for past, current, and future
weeks alike, with no date-comparison logic required to pick it.

**Rationale**: **Confirmed with the user**: a single tense-neutral heading was chosen over computing
and swapping three past/current/future-specific variants, as the simpler option that's still accurate
regardless of when the viewed week falls.

**References**: Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx` (the `<h3>` and
its `aria-label="Where this week's activities landed"` on the enclosing `<section>`, both updated
consistently)

#### FRONTEND-039-AC-03 [AUTO]: "By location and category" is renamed to "By schedule and category"
**Statement**: The section currently headed "By location and category" (and its enclosing
`<section aria-label="Breakdown by location and category">`) shall be renamed "By schedule and
category" / `aria-label="Breakdown by schedule and category"`.

**Rationale**: **Confirmed with the user**: "location" reads as a physical place; "schedule" clearly
means where in the week structure (weekday grid / weekend grid / weekend bucket) the activity was
placed.

**References**: Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx`. No change to
`weeklySummaryStats.ts`'s `SummaryLocation`/`LocationStat` type names or values — this is a display
label change only, not a data-model rename.

### Requirement 2 — The scheduled/bucket split only renders for the current or a future week

**User story**: As a user looking back at a week that's already over, I don't want to see a bucket
count that no longer reflects reality, since any items still incomplete at week's end have already
moved to a later week.

#### FRONTEND-039-AC-04 [AUTO]: A week-is-past helper is added
**Statement**: `weeklySummaryStats.ts` (or a sibling module) shall export a function determining
whether a given `weekStart` is a past week — its last day (`weekStart` + 6 days, the Sunday) is
strictly before the current date — accepting an optional reference date so it's testable without
depending on the real system clock.

**Rationale**: The underlying predicate Requirement 2's two ACs below both depend on.

**References**: New export, e.g. `isPastWeek(weekStart: string, today: Date = new Date()): boolean`
in `frontend/src/components/WeeklySummary/weeklySummaryStats.ts`, built on the existing
`parseWeekStart` from `planLabels.ts`.

#### FRONTEND-039-AC-05 [AUTO]: The scheduled/bucket line renders for the current or a future week
**Statement**: While the viewed week is not a past week (per `FRONTEND-039-AC-04`), `WeeklySummary`
shall render the existing "X scheduled, Y in the weekend bucket" line exactly as today.

**Rationale**: Explicit regression guard — the line stays exactly as useful as it already is for the
weeks where it's actually meaningful.

**References**: Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx`

#### FRONTEND-039-AC-06 [AUTO]: The scheduled/bucket line does not render for a past week
**Statement**: While the viewed week is a past week (per `FRONTEND-039-AC-04`), `WeeklySummary`
shall not render the "X scheduled, Y in the weekend bucket" line.

**Rationale**: **Confirmed with the user**: hide entirely rather than reword, since the bucket's
whole point is capturing not-yet-done free-time activities for weeks still in progress.

**References**: Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx`

#### FRONTEND-039-AC-07 [AUTO]: The completion-count line is unaffected
**Statement**: The "X of Y activities completed (Z%)" line shall continue to render for every week
— past, current, or future — regardless of `FRONTEND-039-AC-04`'s result.

**Rationale**: Explicit regression guard — only the scheduled/bucket split is time-sensitive; the
completion count remains accurate for any week regardless of when it's viewed.

**References**: Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx`

### Requirement 3 — "This week at a glance" becomes one merged, per-category table of marks

**User story**: As a user, I want to see each category's activities as a row of marks I can scan at
a glance — completed ones first — instead of a flat bar of every activity mixed together plus a
separate numeric table repeating the same information as plain counts.

#### FRONTEND-039-AC-08 [AUTO]: The flat completion bar and the numeric category table are both replaced by one grouped table
**Statement**: `WeeklySummary` shall no longer render the existing flat, ungrouped completion bar
(`frontend_spec_037`'s Requirement 1) or the existing plain-text "By category" table
(`frontend_spec_036`'s `Category`/`Planned`/`Completed` columns). In their place, "This week at a
glance" shall render one `<table>` with no column-header row (`<thead>`) and exactly three body rows
— Routine, Necessary, Pleasurable, in that fixed order — each row's `<th scope="row">` naming the
category and its data cell containing that category's occurrence marks.

**Rationale**: Direct implementation of the user's "combine this with the table" request — one
visualization doing the job of two, reading as a de facto bar graph via the marks themselves rather
than a separate chart type.

**References**:
- Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx` (new table, replacing both
  the removed `<table className={styles.categoryTable}>` and the removed `.completionBar` section)
- Reused unchanged: `frontend/src/components/WeeklySummary/CompletionMark.tsx` (shape `"block"`)
- *Implementer note*: `weeklySummaryStats.ts`'s top-level `WeeklyStats.byCategory`/`CategoryStat`
  numeric aggregation becomes unused by this component once the old table is removed — grep for any
  other consumer before deleting; `computeByLocation`'s own internal `byCategoryFor` call (for the
  unchanged breakdown chart) is a separate, still-used code path and must not be touched.

#### FRONTEND-039-AC-09 [AUTO]: Marks within a category row are ordered completed-first, then by schedule position
**Statement**: Within each category's row, marks shall order: all completed occurrences before all
not-completed occurrences (matching the removed flat bar's existing ordering rule); within each of
those two groups, scheduled occurrences (non-null `dayOfWeek`/`slot`) order by day (`ALL_DAYS`'s
Monday→Sunday order) then slot (`ALL_SLOTS`'s Morning→Evening order), followed by any weekend-bucket
occurrences for that category ordered by `bucketPosition` ascending.

**Rationale**: **Confirmed with the user**: scheduled items first (in their natural week order),
bucket items last within each row — keeps the row's reading order aligned with how the week is
actually structured, consistent with how `bucketOrder` already sorts the lite bucket list below.

**References**: Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx` (new per-category
ordering function, following the same pattern as the existing `completionOrder`/`bucketOrder` local
computations)

#### FRONTEND-039-AC-10 [AUTO]: Each mark keeps its existing contract
**Statement**: Every mark rendered in the new per-category table shall use the exact same
`CompletionMark` component, shape `"block"`, with the same colour/opacity/icon/tooltip/`aria-label`
behavior `frontend_spec_037` already established — unchanged by this spec.

**Rationale**: Explicit regression guard — this spec changes grouping and placement only, not the
mark's own rendering contract.

**References**: Component: `frontend/src/components/WeeklySummary/CompletionMark.tsx` (unchanged)

#### FRONTEND-039-AC-11 [AUTO]: A category with no occurrences this week still renders its row
**Statement**: A category with zero occurrences this week shall still render its `<th scope="row">`
label with an empty data cell — all three category rows always appear, none hidden or skipped.

**Rationale**: Consistent, predictable table shape regardless of the week's content — matches the
existing (now-removed) numeric table's behavior of always showing all three categories, even at
zero.

**References**: Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx`

### Requirement 4 — "This week's placement" visual polish

**User story**: As a user looking at the compact lite weekly grid, I want it to visually read as a
clear table — with grid lines and easily scannable day/slot headers — rather than loosely spaced
cells.

#### FRONTEND-039-AC-12 [AUTO]: Lite grid cells and header cells carry visible grid-line styling
**Statement**: The lite grid's day-label cells, slot-label cells, and occurrence cells
(`.liteGridDayLabel`/`.liteGridSlotLabel`/`.liteGridCell`) shall carry a CSS class applying a visible
border on all sides, so the grid as a whole reads as a bordered table rather than loosely spaced
cells.

**Rationale**: Direct implementation of "add grid to the table" — testable at the class-application
level; actual rendered appearance is confirmed by `FRONTEND-039-AC-14`, since jsdom doesn't render
CSS (`frontend_conventions.md`'s Testing Strategy note, same split `frontend_spec_037`-AC-18/AC-19
already established for this codebase).

**References**: `frontend/src/components/WeeklySummary/WeeklySummary.module.css`

#### FRONTEND-039-AC-13 [AUTO]: Day/slot header labels carry a monospace font class
**Statement**: `.liteGridDayLabel` and `.liteGridSlotLabel` shall carry a CSS class setting
`font-family` to this project's monospace stack.

**Rationale**: Direct implementation of "change the font to the monospace font for row and column
headers" — scoped to the header labels only, not the occurrence marks inside each cell.

**References**: `frontend/src/components/WeeklySummary/WeeklySummary.module.css`. *Implementer
note*: check `index.css`/the design-system steering doc for an existing monospace font-stack
variable before hardcoding a new one — reuse it if present.

#### FRONTEND-039-AC-14 [MANUAL]: The lite grid visually reads as a bordered, monospace-headed table
**Statement**: Confirmed by a real-browser check in both Light and Dark themes: the lite grid under
"This week's placement" shows visible grid lines around its cells and headers, and its day/slot
header labels render in a monospace font — legible and not visually broken in either theme.

**Rationale**: `[MANUAL]` — CSS rendering can't be verified in jsdom.

**References**: `frontend_conventions.md`'s Testing Strategy note

#### FRONTEND-039-AC-17 [AUTO]: The lite bucket area does not render when the bucket is empty
**Statement**: While the viewed week's weekend bucket has zero occurrences, `WeeklySummary` shall
not render the "Weekend bucket" sub-heading or its (empty) marks container under "This week's
placement" — the lite grid above it is unaffected and continues to render regardless.

**Rationale**: Raised by the user while reviewing this spec's other changes live — an empty
"Weekend bucket" sub-section with nothing under it reads as visual clutter once the grid itself
already carries visible structure (borders). Scoped narrowly to the bucket sub-section only; the
lite grid itself always renders (`FRONTEND-039-AC-12`), matching its existing all-cells-always-
present behavior.

**References**: Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx` (existing
`bucketOrder` array, new `bucketOrder.length > 0` guard around the heading + marks container)

### Requirement 5 — Full-page visual verification

#### FRONTEND-039-AC-15 [MANUAL]: The reorganized page renders correctly end-to-end
**Statement**: Confirmed by a real-browser check in both Light and Dark themes, against a week with
a realistic mix of categories, completion states, scheduled occurrences, and at least one bucket
item: section order matches `FRONTEND-039-AC-01`, both renamed headings read correctly
(`AC-02`/`AC-03`), the scheduled/bucket line's presence matches the viewed week's past/current/future
status (`AC-05`/`AC-06`), the merged per-category table renders all three rows with correctly ordered
marks (`AC-08`–`AC-11`), and the lite grid's visual polish (`AC-14`) is in place.

**Rationale**: `[MANUAL]` — an end-to-end sanity pass across every requirement in this spec rendered
together on the real page, catching any interaction between them a unit-level test wouldn't.

**References**: `frontend_conventions.md`'s Testing Strategy note

#### FRONTEND-039-AC-16 [MANUAL]: A definitively past week hides the scheduled/bucket line in the real app
**Statement**: Confirmed by a real-browser check: navigating to a week at least two weeks before the
current date hides the scheduled/bucket line, while the current week still shows it — using the
real system clock, not an injected test date.

**Rationale**: `[MANUAL]` sanity check against the real system clock, complementing
`FRONTEND-039-AC-05`/`AC-06`'s unit-level coverage (which inject a fixed reference date).

**References**: Component: `frontend/src/components/WeeklySummary/WeeklySummary.tsx`

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/components/WeeklySummary/WeeklySummary.tsx` | Reordered sections, renamed headings, new merged per-category table, conditional scheduled/bucket line |
| `frontend/src/components/WeeklySummary/weeklySummaryStats.ts` | New `isPastWeek` export; `byCategory`/`CategoryStat` likely becomes dead code (implementer to verify and remove) |
| `frontend/src/components/WeeklySummary/CompletionMark.tsx` | Reused unchanged (shape `"block"`) |
| `frontend/src/components/WeeklySummary/WeeklySummary.module.css` | New border/grid-line classes and monospace font class for the lite grid's cells/headers |
| `frontend_spec_036_weekly_summary.md` | Origin of the completion-count line and the now-removed numeric category table |
| `frontend_spec_037_weekly_summary_visualizations.md` | Origin of `CompletionMark`, the now-removed flat completion bar, the lite grid/bucket list, and the (renamed-heading-only) breakdown chart |
| `frontend_spec_011_bucket_carry_forward_automation.md` | Why a past week's bucket count is stale — the mechanism `FRONTEND-039-AC-06` responds to |
| `planner_spec_020_prevent_completed_occurrence_bucket_move.md` / `frontend_spec_038_...md` | Related bug fix from the same review, specced separately |

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
// weeklySummaryStats.test.ts additions

describe('FRONTEND-039-AC-04: isPastWeek', () => {
  it('returns true when the week\'s last day is before the reference date', () => {
    expect(isPastWeek('2026-09-21', new Date('2026-10-05'))).toBe(true) // ended 2026-09-27
  })

  it('returns false for the current week', () => {
    expect(isPastWeek('2026-09-29', new Date('2026-10-05'))).toBe(false) // Mon-Sun spans today
  })

  it('returns false for a future week', () => {
    expect(isPastWeek('2026-10-12', new Date('2026-10-05'))).toBe(false)
  })
})
```

```tsx
// WeeklySummary.test.tsx additions

describe('FRONTEND-039-AC-01/AC-02/AC-03: section order and renamed headings', () => {
  it('renders sections in order: glance, placement, breakdown, with renamed headings', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({})])
    render(<WeeklySummary />)
    const headings = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent)
    expect(headings).toEqual([
      'This week at a glance',
      "This week's placement",
      'By schedule and category',
    ])
  })
})

describe('FRONTEND-039-AC-05/AC-06/AC-07: scheduled/bucket line respects past-week status', () => {
  it('AC-06: hides the scheduled/bucket line for a past week', async () => {
    vi.setSystemTime(new Date('2026-10-05'))
    vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({})])
    render(<WeeklySummary initialWeekStart="2026-09-21" />)
    expect(await screen.findByText(/activities completed/i)).toBeInTheDocument()
    expect(screen.queryByText(/in the weekend bucket/i)).not.toBeInTheDocument()
  })

  it('AC-05: shows the scheduled/bucket line for the current week', async () => {
    vi.setSystemTime(new Date('2026-10-05'))
    vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({})])
    render(<WeeklySummary initialWeekStart="2026-09-29" />)
    expect(await screen.findByText(/in the weekend bucket/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-039-AC-08/AC-09/AC-11: merged per-category table', () => {
  it('AC-08: renders one table with no column headers and three category rows', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({ category: 'ROUTINE' })])
    render(<WeeklySummary />)
    const table = await screen.findByRole('table')
    expect(within(table).queryByRole('columnheader')).not.toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: /routine/i })).toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: /necessary/i })).toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: /pleasurable/i })).toBeInTheDocument()
  })

  it('AC-09: orders a category\'s marks completed-first, then scheduled-before-bucket', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      makeOccurrence({ name: 'Bucket item', category: 'ROUTINE', dayOfWeek: null, slot: null, completed: false, bucketPosition: 0 }),
      makeOccurrence({ name: 'Tue walk', category: 'ROUTINE', dayOfWeek: 'TUESDAY', slot: 'MORNING', completed: false }),
      makeOccurrence({ name: 'Mon walk', category: 'ROUTINE', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: true }),
    ])
    render(<WeeklySummary />)
    const routineRow = (await screen.findByRole('rowheader', { name: /routine/i })).closest('tr')!
    const marks = within(routineRow).getAllByRole('button')
    expect(marks[0]).toHaveAccessibleName(/mon walk.*completed/i)
    expect(marks[1]).toHaveAccessibleName(/tue walk.*not completed/i)
    expect(marks[2]).toHaveAccessibleName(/bucket item.*weekend bucket.*not completed/i)
  })

  it('AC-11: a category with no occurrences still renders its row', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({ category: 'ROUTINE' })])
    render(<WeeklySummary />)
    const necessaryRow = (await screen.findByRole('rowheader', { name: /necessary/i })).closest('tr')!
    expect(within(necessaryRow).queryAllByRole('button')).toHaveLength(0)
  })
})

describe('FRONTEND-039-AC-12/AC-13: lite grid styling classes applied', () => {
  it('applies the border class to grid/header cells and the monospace class to header labels', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({ dayOfWeek: 'MONDAY', slot: 'MORNING' })])
    render(<WeeklySummary />)
    const dayLabel = await screen.findByText('Mon')
    expect(dayLabel).toHaveClass(styles.liteGridDayLabel)
    // the .liteGridDayLabel/.liteGridSlotLabel/.liteGridCell classes themselves carry the
    // border/font-family rules in WeeklySummary.module.css -- a real-browser pass (AC-14)
    // confirms actual rendered appearance, since jsdom doesn't render CSS.
  })
})
```

**Test Case (Green)**: implement `isPastWeek`, the reordered/renamed sections, the merged
per-category table and its ordering function, and the lite grid's new CSS classes until every
sketch above passes. `FRONTEND-039-AC-14`/`AC-15`/`AC-16` are verified manually, per their own
statements, in a real browser.

## Acceptance Criteria Summary

- [x] FRONTEND-039-AC-01 — sections render in the new order: glance, placement, breakdown
- [x] FRONTEND-039-AC-02 — "Where things landed" renamed to a tense-neutral heading
- [x] FRONTEND-039-AC-03 — "By location and category" renamed to "By schedule and category"
- [x] FRONTEND-039-AC-04 — `isPastWeek` helper added, testable with an injected reference date
- [x] FRONTEND-039-AC-05 — scheduled/bucket line renders for the current or a future week
- [x] FRONTEND-039-AC-06 — scheduled/bucket line does not render for a past week
- [x] FRONTEND-039-AC-07 — completion-count line unaffected, renders for every week
- [x] FRONTEND-039-AC-08 — flat completion bar + numeric category table replaced by one merged, no-header table
- [x] FRONTEND-039-AC-09 — marks ordered completed-first, then scheduled-before-bucket within each group
- [x] FRONTEND-039-AC-10 — each mark keeps its existing `CompletionMark` contract, unchanged
- [x] FRONTEND-039-AC-11 — a category with no occurrences still renders its row
- [x] FRONTEND-039-AC-12 — lite grid cells/headers carry visible grid-line styling classes
- [x] FRONTEND-039-AC-13 — lite grid day/slot header labels carry a monospace font class
- [x] FRONTEND-039-AC-14 — lite grid visually reads as bordered/monospace-headed (real-browser check)
- [x] FRONTEND-039-AC-15 — full reorganized page verified end-to-end (real-browser check)
- [x] FRONTEND-039-AC-16 — a definitively past week hides the line in the real app (real-browser check)
- [x] FRONTEND-039-AC-17 — the "Weekend bucket" sub-section does not render when the bucket is empty
