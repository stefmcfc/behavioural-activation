# Filter the Weekly Planner by Category and Completion Status (Frontend)

**Status**: Implemented (2026-10-03) — one shared `<details>`/`<summary>` "Filters" disclosure
(category + status), positioned between the View tab fieldset and the grid/bucket list per review
feedback; `computeDimmedIds` (extracted into `weeklyPlannerFilters.ts`, see Implementer note below)
drives a new `dimmedOccurrenceIds` prop threaded through `PlannerGrid`/`BucketList` into
`OccurrenceItem`, which applies a new `styles.dimmed` (`opacity: 0.55`) class without touching any
existing action. `npm test` 511/511, `npm run lint` clean, `npx tsc -b --noEmit` clean. `AC-10`
verified in a real browser, both themes: filtered to "Necessary" category in the Weekend bucket
list, confirmed the non-matching "Go for a walk" (Pleasurable) row rendered visibly dimmed relative
to the matching "Apply for jobs" (Necessary) row in both Light and Dark, remained fully legible (not
disabled-looking), and stayed fully interactive — clicking Complete on the dimmed row registered
normally.
**Priority**: P2 — V1 polish, same tier as `frontend_spec_032_collapsible_filters.md`
**Depends on**: `frontend_spec_004_week_planning.md` (origin of `WeeklyPlanner`/`PlannerGrid`/
`BucketList`/`OccurrenceItem`), `frontend_spec_017_activity_bank_category_filter.md` (origin of
`utils/categoryFilter.ts`'s `CategoryFilter` type/`CATEGORY_FILTER_OPTIONS`, reused directly by this
spec, and `ActivityBank.tsx`'s radio-pill filter fieldset markup this spec's status filter mirrors),
`frontend_spec_032_collapsible_filters.md` (origin of the `<details>`/`<summary>` collapsible-
disclosure pattern this spec reuses for the same reason — Baseline **Widely available**, zero custom
JS, this codebase's established answer to "collapsible filters"), `frontend_spec_012_grid_
orientation_toggle.md`/`frontend_spec_034_grid_orientation_live_update.md` (most recent precedent
for `PlannerGrid`'s real current prop shape — read before sketching this spec's own prop additions)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish — not tied to a specific `HIGH_LEVEL_DESIGN.md` version theme (same
classification as `frontend_spec_032`)

## Overview

Today, the Weekly Planner's grid and weekend bucket list always show every planned occurrence for
the week, with no way to narrow the view. `ActivityBank.tsx` already has this exact pattern for its
own list (a category filter via `utils/categoryFilter.ts`'s `CATEGORY_FILTER_OPTIONS`, plus a status
toggle), so this spec extends the same idea to the planner rather than inventing new filtering UI —
confirmed as a candidate in `.claude/SPEC_CANDIDATES.md`, now written up with its previously-open
design questions resolved below.

**One shared collapsible control, not two.** A single `<details>`/`<summary>` "Filters" disclosure
(mirroring `frontend_spec_032_collapsible_filters.md`'s exact shape — closed by default, no custom
JS, Baseline-safe) sits above both the grid and the bucket list, containing two filter groups — by
`ActivityCategory` and by completion status — that apply to both sections simultaneously, filtering
the same `plan.occurrences` array both already render from. Two independent per-section filters
were considered and rejected: the grid and bucket list already share one data source, and a single
control is simpler for the user to reason about ("what am I filtering" has one answer, not two).

**Dim, don't hide.** Unlike `ActivityBank`'s category filter and `ActivityPickerList`'s filters
(both of which remove non-matching items from the list entirely), a filtered-out occurrence here
stays visible — rendered at reduced opacity, fully interactive — rather than disappearing. This is a
deliberate departure from that precedent, not an oversight: the Weekly Planner's grid is spatially
meaningful (a cell's position encodes day + time slot), so an occurrence vanishing from its cell
reads ambiguously as either "nothing is planned here" or "something is planned here but currently
filtered out" — exactly the risk `.claude/SPEC_CANDIDATES.md`'s original candidate entry flagged as
unresolved. Dimming keeps every cell's real planned/empty state visually honest regardless of the
active filter, at the cost of the grid staying visually "full" rather than shrinking — judged the
better trade-off for a spatial grid, where the bucket list (a plain list, not a grid) would have
been fine either way.

**Dimmed is not disabled.** `OccurrenceItem.module.css` already uses `opacity: 0.4` for a genuinely
disabled `.moveButton:disabled` — this spec deliberately uses a different value (proposed `0.55`,
tunable during the real-browser pass, `FRONTEND-035-AC-10`) so a dimmed-but-filtered occurrence
doesn't visually read as broken/inactive. Every action on a dimmed occurrence (Complete/Undo,
Rearrange, Remove, drag) keeps working exactly as before — filtering here is purely a rendering
concern, never a functional gate (`FRONTEND-035-AC-07`).

**Prop-interface cost, unlike `frontend_spec_012`'s zero-prop-change precedent.** `frontend_spec_
012`'s `FRONTEND-012-AC-05` kept grid orientation entirely internal to `PlannerGrid` (read from
`localStorage`, no prop needed). Dimming can't follow that precedent — which occurrences are dimmed
is state owned by `WeeklyPlanner` (the two filter selections), not a self-contained per-component
concern, and it needs to reach `OccurrenceItem` instances rendered by both `PlannerGrid` and
`BucketList`. Both therefore gain one new prop, `dimmedOccurrenceIds: ReadonlySet<string>`, threaded
straight through to each `OccurrenceItem` they render.

**Out of scope**: any change to what the two filters can select (just category + completed/not), any
persistence of the filter selection across visits (resets to "All"/"All" on every `WeeklyPlanner`
mount — no `localStorage`, unlike `frontend_spec_012`'s grid-orientation preference, since there's no
evidence yet that this needs to survive a visit the way a layout preference does), and the Weekdays/
Weekend `View` tab control (`frontend_spec_015_weekday_weekend_grid_tabs.md`, unrelated and
untouched — the new Filters disclosure sits directly *below* the View tab fieldset and above
`PlannerGrid`/`BucketList`, per the user's explicit placement request during review — the Overview's
original "directly above it" ordering, proposed as an adjustable judgment call, was flipped once
seen in practice).

## Requirements

### Requirement 1 — Filter controls render in a shared collapsible disclosure

As a user, I want a way to narrow what I'm looking at in the Weekly Planner by category or
completion status, tucked away when I'm not using it — matching how filters already work elsewhere
in this app.

- **FRONTEND-035-AC-01** [AUTO]: `WeeklyPlanner` shall render one `<details>`/`<summary>` "Filters"
  disclosure, with no `open` attribute on initial render (closed by default), positioned above the
  existing Weekdays/Weekend `View` tab fieldset.
- **FRONTEND-035-AC-02** [AUTO]: The disclosure shall contain a "Filter by category" fieldset,
  reusing `utils/categoryFilter.ts`'s existing `CategoryFilter` type and `CATEGORY_FILTER_OPTIONS`
  (All/Routine/Necessary/Pleasurable) and `ActivityBank.tsx`'s radio-pill fieldset markup/CSS classes
  — not a new filter-control visual style.
- **FRONTEND-035-AC-03** [AUTO]: The disclosure shall contain a "Filter by status" fieldset with
  three mutually-exclusive options — All / Completed / Not completed — using the same radio-pill
  markup pattern as the category fieldset (a 3-way radio group, not `ActivityBank`'s independent
  checkbox-toggle pattern, since these three states are mutually exclusive).
- **FRONTEND-035-AC-04** [AUTO]: Selecting a category filter option updates `WeeklyPlanner`'s
  category filter state to that value; selecting a status filter option updates its status filter
  state to that value — both default to "All" on mount.

### Requirement 2 — Filtering dims, rather than hides, non-matching occurrences

As a user, I want to narrow my view by category or status without losing my sense of what's
actually planned where — a filtered-out activity should look de-emphasized, not vanish.

- **FRONTEND-035-AC-05** [AUTO]: `WeeklyPlanner` shall compute `dimmedOccurrenceIds` (a
  `ReadonlySet<string>`) from `plan.occurrences`, the active category filter, and the active status
  filter — an occurrence's id is included when it fails to match either active filter (category
  filter is not "All" and differs from the occurrence's `category`; or status filter is "Completed"
  and the occurrence is not completed; or status filter is "Not completed" and the occurrence is
  completed).
- **FRONTEND-035-AC-06** [AUTO]: `WeeklyPlanner` shall pass `dimmedOccurrenceIds` to both
  `PlannerGrid` and `BucketList` as a new prop, which each thread through unchanged to every
  `OccurrenceItem` they render.
- **FRONTEND-035-AC-07** [AUTO]: `OccurrenceItem` shall apply a new `styles.dimmed` class to its root
  element when its own `occurrence.id` is present in `dimmedOccurrenceIds` — visual only; every
  existing action (Complete/Undo, Rearrange, Remove, Carry forward, drag-to-move/reorder) shall
  continue to function identically regardless of dimmed state.
- **FRONTEND-035-AC-08** [AUTO]: While both filters are at their default "All" value,
  `dimmedOccurrenceIds` shall be empty, and no occurrence shall render with `styles.dimmed` —
  regression guard ensuring existing `PlannerGrid.test.tsx`/`BucketList.test.tsx` assertions continue
  to pass unmodified.

### Requirement 3 — One shared control filters both the grid and the bucket list together

As a user, changing a filter should update what I see everywhere in the Weekly Planner at once, not
just in one section.

- **FRONTEND-035-AC-09** [AUTO]: When either filter selection changes, `WeeklyPlanner` shall
  recompute `dimmedOccurrenceIds` once and pass the same updated set to both `PlannerGrid` and
  `BucketList` — an occurrence matching the active filters is never dimmed in one section while
  un-dimmed in the other, since both read from the same computed set.

### Requirement 4 — Dimmed state is visually legible in both themes

As a user, I want to be able to tell a dimmed activity apart from a normal one, in whichever theme
I'm using, without it looking broken or disabled.

- **FRONTEND-035-AC-10** [MANUAL]: The dimmed visual treatment (reduced opacity, distinct from the
  existing `0.4`-opacity `:disabled` convention in `OccurrenceItem.module.css`) is visually
  distinguishable from the normal state and does not read as disabled/broken, verified by a
  real-browser check in both Light and Dark themes, since jsdom cannot render CSS
  (`frontend_conventions.md`'s Testing Strategy note).

## Component/type changes

`WeeklyPlanner.tsx` (extended):

```tsx
import { type CategoryFilter, CATEGORY_FILTER_OPTIONS } from '../../utils/categoryFilter'

type StatusFilter = 'ALL' | 'COMPLETED' | 'NOT_COMPLETED'

const STATUS_FILTER_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NOT_COMPLETED', label: 'Not completed' },
]

function computeDimmedIds(
  occurrences: readonly PlannedOccurrence[],
  categoryFilter: CategoryFilter,
  statusFilter: StatusFilter,
): ReadonlySet<string> {
  const dimmed = new Set<string>()
  for (const occurrence of occurrences) {
    const categoryMismatch = categoryFilter !== 'ALL' && occurrence.category !== categoryFilter
    const statusMismatch =
      (statusFilter === 'COMPLETED' && !occurrence.completed) ||
      (statusFilter === 'NOT_COMPLETED' && occurrence.completed)
    if (categoryMismatch || statusMismatch) {
      dimmed.add(occurrence.id)
    }
  }
  return dimmed
}
```

```tsx
const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL')
const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

const dimmedOccurrenceIds = useMemo(
  () => computeDimmedIds(plan.occurrences ?? [], categoryFilter, statusFilter),
  [plan.occurrences, categoryFilter, statusFilter],
)
```

```tsx
<details className={styles.filtersDisclosure}>
  <summary className={styles.filtersSummary}>Filters</summary>

  <fieldset className={activityBankStyles.filterFieldset}>
    <legend>Filter by category</legend>
    <ul className={activityBankStyles.filterGroup} role="presentation">
      {CATEGORY_FILTER_OPTIONS.map((option) => (
        <li key={option.value}>
          <label>
            <input
              type="radio"
              name="weekly-planner-category-filter"
              value={option.value}
              checked={categoryFilter === option.value}
              onChange={() => setCategoryFilter(option.value)}
            />
            {option.label}
          </label>
        </li>
      ))}
    </ul>
  </fieldset>

  <fieldset className={activityBankStyles.filterFieldset}>
    <legend>Filter by status</legend>
    <ul className={activityBankStyles.filterGroup} role="presentation">
      {STATUS_FILTER_OPTIONS.map((option) => (
        <li key={option.value}>
          <label>
            <input
              type="radio"
              name="weekly-planner-status-filter"
              value={option.value}
              checked={statusFilter === option.value}
              onChange={() => setStatusFilter(option.value)}
            />
            {option.label}
          </label>
        </li>
      ))}
    </ul>
  </fieldset>
</details>
```

*(Implementer note: importing `ActivityBank.module.css`'s classes cross-component is unusual for
this codebase — check during implementation whether `.filterFieldset`/`.filterGroup` should instead
be lifted into a shared location (e.g. a small shared CSS module, or duplicated into
`WeeklyPlanner.module.css` if lifting proves awkward) rather than reaching into another feature's
CSS Module. Either is acceptable; don't import across feature folders by habit if this project
doesn't already do that elsewhere — confirm by checking for an existing cross-component CSS Module
import before deciding.)*

*(Implementer resolution, 2026-10-03: went with neither of the two options above.
`ActivityPickerList.tsx` — a sibling already living in this same `WeeklyPlanner/` folder — already
imports `AssignActivityPicker.module.css` for this exact
`filtersDisclosure`/`filtersSummary`/`filterFieldset`/`filterGroup` set, established by
`frontend_spec_032`. That's a real, same-folder precedent for sharing this filter-disclosure CSS
across sibling components (unlike reaching into `ActivityBank/`, a different feature folder with no
such precedent), so `WeeklyPlanner.tsx` imports `AssignActivityPicker.module.css` the same way
rather than duplicating the CSS a third time or inventing a new shared module. Separately,
`computeDimmedIds`/`StatusFilter`/`STATUS_FILTER_OPTIONS` were pulled out of `WeeklyPlanner.tsx`
into a new sibling `weeklyPlannerFilters.ts` — not for a design reason, but because co-locating a
second named export alongside the `WeeklyPlanner` component in the same file trips oxlint's
`react(only-export-components)` fast-refresh rule; `WeeklyPlanner.test.tsx` imports
`computeDimmedIds` from that module directly for the AC-05 unit tests.)*

`PlannerGrid.tsx` / `BucketList.tsx` (both extended with one new prop):

```tsx
readonly dimmedOccurrenceIds: ReadonlySet<string>
```

passed straight through to every `OccurrenceItem` each renders.

`OccurrenceItem.tsx` (extended):

```tsx
readonly dimmed: boolean
```

```tsx
<li
  className={
    isBucketItem
      ? dimmed ? `${styles.row} ${styles.dimmed}` : styles.row
      : dimmed ? `${styles.row} ${styles.gridDraggable} ${styles.dimmed}` : `${styles.row} ${styles.gridDraggable}`
  }
  ...
>
```

`OccurrenceItem.module.css` (new class):

```css
.dimmed {
  opacity: 0.55;
}
```

## Cross-references

| This spec | Contracts against |
|---|---|
| `utils/categoryFilter.ts` | Reused unchanged (`CategoryFilter`, `CATEGORY_FILTER_OPTIONS`) — origin: `frontend_spec_017_activity_bank_category_filter.md` |
| `WeeklyPlanner.tsx` | Extended — new filter state, `dimmedOccurrenceIds` computation, new Filters disclosure |
| `PlannerGrid.tsx` | Extended — new `dimmedOccurrenceIds` prop, threaded to `OccurrenceItem` |
| `BucketList.tsx` | Extended — new `dimmedOccurrenceIds` prop, threaded to `OccurrenceItem` |
| `OccurrenceItem.tsx` / `.module.css` | Extended — new `dimmed` prop, new `.dimmed` CSS class |
| `frontend_spec_032_collapsible_filters.md` | `<details>`/`<summary>` pattern reused unchanged |
| `.claude/SPEC_CANDIDATES.md` | "Filter the Weekly Planner by completed status and by category" candidate, now spec'd here — removed from that file in the same change as this spec's creation |

## Test case sketches (Vitest + RTL, red before implementation)

```tsx
// utils/gridOrientation-style computeDimmedIds unit coverage, likely inline in WeeklyPlanner.test.tsx
// since computeDimmedIds is a local helper, not a separate utils module

describe('FRONTEND-035-AC-05: computeDimmedIds', () => {
  it('dims an occurrence whose category does not match an active category filter', () => {
    const ids = computeDimmedIds([necessaryOccurrence, pleasurableOccurrence], 'PLEASURABLE', 'ALL')
    expect(ids.has(necessaryOccurrence.id)).toBe(true)
    expect(ids.has(pleasurableOccurrence.id)).toBe(false)
  })

  it('dims a completed occurrence when the status filter is "Not completed"', () => {
    const ids = computeDimmedIds([completedOccurrence, incompleteOccurrence], 'ALL', 'NOT_COMPLETED')
    expect(ids.has(completedOccurrence.id)).toBe(true)
    expect(ids.has(incompleteOccurrence.id)).toBe(false)
  })

  it('FRONTEND-035-AC-08: dims nothing when both filters are "All"', () => {
    const ids = computeDimmedIds([necessaryOccurrence, completedOccurrence], 'ALL', 'ALL')
    expect(ids.size).toBe(0)
  })
})
```

```tsx
// WeeklyPlanner.test.tsx additions

describe('FRONTEND-035-AC-01/AC-02/AC-03/AC-04: Filters disclosure renders closed, selecting options updates filter state', () => {
  it('renders the Filters disclosure closed by default, with category and status fieldsets', async () => {
    render(<WeeklyPlanner />)
    const disclosure = (await screen.findByText('Filters')).closest('details')!
    expect(disclosure).not.toHaveAttribute('open')

    await userEvent.click(screen.getByText('Filters'))
    expect(within(disclosure).getByRole('group', { name: /filter by category/i })).toBeInTheDocument()
    expect(within(disclosure).getByRole('group', { name: /filter by status/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-035-AC-06/AC-07/AC-09: selecting a filter dims non-matching occurrences in both the grid and bucket list, without disabling them', () => {
  it('dims a Necessary occurrence when the Pleasurable category filter is selected, and Complete still works', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([necessaryGridOccurrence, pleasurableBucketOccurrence])
    render(<WeeklyPlanner />)
    await userEvent.click(await screen.findByText('Filters'))
    await userEvent.click(screen.getByRole('radio', { name: /^pleasurable$/i }))

    const necessaryRow = screen.getByText(necessaryGridOccurrence.name).closest('li')!
    expect(necessaryRow).toHaveClass(styles.dimmed)

    const pleasurableRow = screen.getByText(pleasurableBucketOccurrence.name).closest('li')!
    expect(pleasurableRow).not.toHaveClass(styles.dimmed)

    await userEvent.click(within(necessaryRow).getByRole('button', { name: /complete/i }))
    expect(planApi.complete).toHaveBeenCalledWith(necessaryGridOccurrence.id)
  })
})
```

```tsx
// PlannerGrid.test.tsx / BucketList.test.tsx additions (both components)

describe('FRONTEND-035-AC-06: dimmedOccurrenceIds threads through to OccurrenceItem', () => {
  it('applies styles.dimmed when the occurrence id is in dimmedOccurrenceIds', () => {
    renderGrid({ dimmedOccurrenceIds: new Set([occurrenceOnMonMorning.id]) })
    expect(screen.getByText(occurrenceOnMonMorning.name).closest('li')).toHaveClass(
      occurrenceItemStyles.dimmed,
    )
  })
})
```

**Test Case (Green)**: implement `computeDimmedIds`, the Filters disclosure, the `dimmedOccurrenceIds`
prop threading, and `OccurrenceItem`'s `.dimmed` class until every sketch above passes.
`FRONTEND-035-AC-10` is verified manually, per its own statement, in both Light and Dark.

## Acceptance Criteria Summary

- [x] FRONTEND-035-AC-01 — Filters disclosure renders closed by default, above the View tab fieldset
- [x] FRONTEND-035-AC-02 — category fieldset reuses `CATEGORY_FILTER_OPTIONS`/`ActivityBank`'s markup
- [x] FRONTEND-035-AC-03 — status fieldset offers All/Completed/Not completed as a 3-way radio group
- [x] FRONTEND-035-AC-04 — selecting an option updates the corresponding filter state
- [x] FRONTEND-035-AC-05 — `dimmedOccurrenceIds` computed correctly from occurrences + both filters
- [x] FRONTEND-035-AC-06 — `dimmedOccurrenceIds` passed to `PlannerGrid`/`BucketList`, threaded to `OccurrenceItem`
- [x] FRONTEND-035-AC-07 — dimmed occurrences stay fully interactive (visual-only filtering)
- [x] FRONTEND-035-AC-08 — default "All"/"All" dims nothing; existing tests stay green unmodified
- [x] FRONTEND-035-AC-09 — one filter change updates dimming in both grid and bucket list together
- [x] FRONTEND-035-AC-10 — dimmed state visually legible, not disabled-looking, in both themes (real-browser check)
