# Collapsible Filters in the Activity Picker (Frontend)

**Status**: Implemented (2026-10-02) — all 8 ACs green, including AC-08's real-browser pass (see
Summary)
**Priority**: P3 — UI polish, no new capability (every filter already exists and works; this changes
only how much space they take up before being used).
**Depends on**: `frontend_spec_028_activity_drawer.md` (origin of `ActivityPickerList.tsx`, the single
shared component both consumers below render through), `frontend_spec_009_add_picker_modal.md`
(`AssignActivityPicker`, the Weekly Planner's "Add" modal — one of the two consumers),
`frontend_spec_016_today_view.md` (`ActivityDrawer`, Today's "Browse activities" panel — the other
consumer), `frontend_spec_027_favourite_activities.md`/`frontend_spec_017_activity_bank_category_filter.md`
(origin of the favourite/category filters themselves, unchanged by this spec)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish — not tied to a specific `HIGH_LEVEL_DESIGN.md` version theme

## Summary

All 7 `[AUTO]` ACs implemented and tested as specified, with no deviations from the Overview's
judgment calls. `ActivityPickerList.tsx`'s three filter `<fieldset>`s (category/type/favourite) now
render inside a single `<details className={styles.filtersDisclosure}>` with a
`<summary className={styles.filtersSummary}>Filters</summary>`, no `open` attribute on initial
render — exactly the "one disclosure, not three" shape requested. `AssignActivityPicker.tsx` and
`ActivityDrawer.tsx` needed zero edits, confirming both consumers inherit the change through their
existing `<ActivityPickerList ... />` renders (AC-04/AC-05).

**jsdom `<details>`/`<summary>` finding (the risk flagged in the Overview, confirmed via a
throwaway test before writing the real suite, then deleted)**: jsdom (v30, this project's pinned
version) correctly implements the native toggle mechanics — activating the `<summary>` does flip
the `open` attribute, with no custom JS needed, exactly as expected for this much simpler/older
platform feature than the Popover API gap in `frontend_spec_030`. What jsdom does **not** model is
the browser's own rendering behaviour that excludes a closed `<details>`'s non-`<summary>` content
from the accessibility tree — `getByRole('radio', ...)` still finds a collapsed filter's radio
inputs in jsdom even without opening the disclosure first. This is the same category of gap as this
project's already-documented "jsdom doesn't render CSS" limitation (the hiding is UA-stylesheet/
rendering-driven, not a `hidden`/`aria-hidden` attribute Testing Library's `isInaccessible` check can
detect) — not a new, unrelated discovery. Net effect: AC-01 is cleanly `[AUTO]` as written (it only
asserts the `open` attribute is absent, which is a real, confirmed-working signal). AC-02 was
adjusted to assert the same real signal (the `open` attribute flipping to present on activation)
plus DOM structural containment (`within(disclosure).getByRole('group', ...)` for all three filter
groups, confirming they're descendants of the one `<details>`), rather than asserting on role-query
visibility/absence before vs. after activation — that comparison would have passed in jsdom
regardless of whether real-browser hiding/revealing worked, which is exactly the "test that passes
for the wrong reason" trap flagged in the Overview. Nothing needed downgrading to `[MANUAL]` — the
structural+attribute combination is a meaningful, real assertion of the actual requirement ("one
disclosure wrapping all three, closed by default, opens on activation").

**Test-touch scope matched the Overview's prediction closely but not exactly**: `grep` confirmed
~11 filter-radio-interacting tests across `AssignActivityPicker.test.tsx` (not the ~21 estimated —
the actual count of `userEvent.click(screen.getByRole('radio', ...))`/group-scoped assertions
needing a preceding "open Filters" step was smaller) and 1 in `ActivityPickerList.test.tsx`
(matching the ~1 estimate), each gaining exactly one `await userEvent.click(screen.getByText('Filters'))`
setup line with no assertion changes. **`WeeklyPlanner.test.tsx` needed zero changes** — grepping it
for `radio`/`Filter by`/`categoryFilter` etc. found no filter-radio interactions at all; its only
`radio` role usage is the unrelated Weekdays/Weekend tab control (`frontend_spec_015`), not this
component's filters. This is a mismatch against the Overview's "~4" estimate, most likely because
the activity-filter interaction coverage that estimate was describing already lives in
`AssignActivityPicker.test.tsx`/`ActivityPickerList.test.tsx` rather than `WeeklyPlanner.test.tsx`
by the time this spec was implemented — noted here rather than silently treated as a discrepancy.

**New tests**: 5 added (AC-01, AC-02, AC-07 in `ActivityPickerList.test.tsx`; AC-04 in
`AssignActivityPicker.test.tsx`; AC-05 in `ActivityDrawer.test.tsx`). Full suite: 477 tests across 37
files, up from the 472/37 baseline — 0 regressions. `npm test`, `npm run lint` (oxlint), and
`npm run build` (`tsc -b && vite build`) all clean.

**CSS**: `AssignActivityPicker.module.css` gained `.filtersDisclosure`/`.filtersSummary` (plus a
`::-webkit-details-marker`/`::before` rotating-triangle marker pair for the expand/collapse
affordance) — no bare `button {}` selector, no "primary"/"secondary" text, no non-radio
`input[type=...]` override added, confirmed by re-running `moduleStyles.test.ts` unchanged. The
summary is deliberately plain text + marker, not pill-button-styled, per the Overview's explicit
"a disclosure isn't an action button" call.

**AC-08 — real-browser verification, now done**: confirmed in both Light and Dark theme, in both
consumers. The "▸ Filters" summary renders correctly collapsed, the marker rotates to "▾" on
expansion (the `prefers-reduced-motion`-gated rotation transition added during review — see below —
confirmed not blocking the state change itself), and all three fieldsets appear together underneath.
Filter selection re-confirmed working after expanding (narrowed the Weekly Planner's Add modal list
to "Necessary" category activities only). The drawer is now visibly more compact with the filters
collapsed, which was the actual goal.

**One fix applied during review, beyond what the implementation produced**: the marker-rotation
`transition` in `AssignActivityPicker.module.css` was not gated behind
`@media (prefers-reduced-motion: no-preference)`. This codebase already gates its one other CSS
transition this way (`index.css`'s button hover-shadow lift, from `frontend_spec_007`), and the
`modern-web-guidance` accessibility material consulted for this spec underscores respecting that
preference — a small, non-decorative state-indicator animation is exactly the kind of thing it should
still apply to. Wrapped the `transition` declaration in the same media query; the `transform: rotate`
itself (the actual state change) is unaffected either way, so reduced-motion users still see the
marker point the right direction, just without the animated sweep.

## Overview

Today, `ActivityPickerList.tsx` renders three separate, always-visible `<fieldset>` blocks — "Filter
by category", "Filter by type", "Filter by favourite" — stacked one after another, every time the
component mounts. Because this component is shared, unmodified, by both `AssignActivityPicker`
(the Weekly Planner's "Add" modal, `mode="select"`) and `ActivityDrawer` (Today's "Browse activities"
panel, `mode="drag"`), the same three-block stack appears in both places. In the drawer specifically
(a fixed 320px-wide column, per `frontend_spec_016`), this is a disproportionate amount of vertical
space spent on filters most uses of the picker never touch — the default "All"/"All"/"All" state is
already correct for most activities.

**Request**: consolidate all three filters into a single collapsible area — not a separate disclosure
per filter, one shared disclosure containing all three.

**Researched via the `modern-web-guidance` skill before drafting ACs** (`html` and
`search-hidden-content` guides): the native `<details>`/`<summary>` element is the right primitive —
Baseline **Widely available** (since 2020-01-15, supported back to Chrome 12/Firefox 49/Safari 6, far
older and more broadly supported than the Popover API this codebase already uses elsewhere), zero
custom JavaScript required for toggle behaviour, and it comes with searchable/accessible content by
default (the guide explicitly prefers `<details>` over `hidden="until-found"` unless a case needs
custom show/hide styling or cross-DOM control, neither of which applies here). This matches the
project's established pattern of reaching for a native disclosure/overlay primitive over a hand-rolled
toggle — `Modal.tsx`'s `<dialog>`, `frontend_spec_030`'s Popover-based Settings/Account menus. The
`html` guide's own matrix is explicit about this case: "`<details>`: Inline Disclosure... Accordions,
FAQs" — a plain content-reveal, not a menu or a critical action, so `<dialog>`/`popover` would be the
wrong tool here (consistent with `frontend_spec_030`'s own "disclosure panel, not an ARIA menu"
reasoning for a *different* kind of toggle).

**What was open, and how this spec resolves it** (judgment calls, flagged for easy correction):

1. **One disclosure wrapping all three fieldsets, not three separate ones.** This is the literal
   request — `<details><summary>Filters</summary>` then the three existing `<fieldset>`s, unchanged,
   inside it. No per-filter collapsing.
2. **Closed by default.** Matches this codebase's established "start closed, user opens" pattern
   (`frontend_spec_016`'s drawer toggle, `frontend_spec_030`'s Settings/Account popovers) and actually
   achieves the space-saving goal — defaulting open would just relocate the same three blocks one
   level deeper without reclaiming anything. Confirmed safe: `ActivityPickerList`'s filter state
   (`categoryFilter`/`repeatableFilter`/`favouriteFilter`) already resets to `'ALL'` on every fresh
   mount (no persistence across modal/drawer re-opens — confirmed in the current source), so there's
   never a scenario where a non-default filter is silently hidden behind a closed disclosure the user
   didn't open themselves.
3. **Both consumers fixed by one change**, with zero `AssignActivityPicker.tsx`/`ActivityDrawer.tsx`
   edits — both already render `<ActivityPickerList ... />` unmodified, so wrapping the three
   fieldsets inside `ActivityPickerList.tsx` itself automatically applies everywhere it's used.
4. **`ActivityBank.tsx`'s own filter UI is explicitly out of scope.** It has a different, two-filter
   shape (category + archived/favourite toggles) in a different component, on the full Activity Bank
   page (not a cramped modal/drawer) — not mentioned in the request, and the space-pressure rationale
   that motivates this change for the modal/drawer doesn't apply to a full-width page section.
5. **Summary label is plain "Filters" text, no active-filter-count badge** (e.g., "Filters (1
   active)"). A nice future enhancement, not built here — no concrete need for it yet, and it would
   require tracking "is any filter non-default" as new derived state purely for display, beyond what
   was asked.

**Known risk, flagged for implementation time, not resolved here**: confirm `<details>`/`<summary>`'s
native toggle behaviour (clicking `<summary>` flips the `open` attribute) is usable under this
project's jsdom-based Vitest setup before assuming every AC below is cleanly `[AUTO]`. This is a much
older, simpler platform feature than the Popover API (`frontend_spec_030`'s jsdom gap) — no imperative
JS methods involved, just an attribute and native click handling — so it's likely well supported, but
that should be *confirmed*, not assumed, consistent with this project's reproduce-before-assuming
convention. If jsdom's support turns out to be incomplete, downgrade the affected AC(s) to `[MANUAL]`
rather than writing a test that silently passes for the wrong reason.

**Test-touch expectation, stated up front so it isn't mistaken for scope creep later**: every existing
test that interacts with a filter radio without first opening the disclosure will need a preceding
"open the Filters disclosure" step once it's collapsed by default. Confirmed scope of this by grep:
`AssignActivityPicker.test.tsx` (~21 filter-radio interactions), `WeeklyPlanner.test.tsx` (~4),
`ActivityPickerList.test.tsx` (~1). None of these tests' *assertions* change — only an extra setup
step is added where needed.

## Requirement 1: All three filters live inside one collapsible disclosure, closed by default

**User story**: As a user, I want the filters out of my way by default, so opening the Add picker or
Today's drawer isn't dominated by three rows of filter pills I almost never touch.

### FRONTEND-032-AC-01 [AUTO]: The three filter fieldsets render inside one `<details>`, collapsed on initial render
**Statement**: `ActivityPickerList.tsx` shall wrap its "Filter by category", "Filter by type", and
"Filter by favourite" `<fieldset>` elements inside a single `<details>` element with a `<summary>`
labelled "Filters", with no `open` attribute on initial render (collapsed by default).

**References**: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`

### FRONTEND-032-AC-02 [AUTO]: Expanding the disclosure reveals all three filters together
**Statement**: Activating the "Filters" `<summary>` shall reveal all three filter fieldsets at once —
there is no per-filter collapsing; the `<details>` either shows all three or none.

**References**: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`

### FRONTEND-032-AC-03 [AUTO]: Each filter's own markup, labels, and options are unchanged
**Statement**: The category/type/favourite `<fieldset>`s' internal markup — their `<legend>`s, radio
options, and labels — shall be unchanged from today, relocated inside the new `<details>` wrapper
without altering their own structure.

**Rationale**: Explicit regression guard — this is a wrapper change, not a filter redesign.

**References**: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`

## Requirement 2: Applies identically to both consumers, via the shared component

**User story**: As a user, I want the same decluttered filters whether I'm adding an activity from the
Weekly Planner or dragging one from Today's drawer, since they're the same underlying picker.

### FRONTEND-032-AC-04 [AUTO]: The Weekly Planner's Add modal shows the collapsed filters
**Statement**: `AssignActivityPicker` (rendered inside `Modal`, `mode="select"`) shall show the
"Filters" disclosure collapsed by default, with zero changes to `AssignActivityPicker.tsx` itself —
achieved entirely through its existing, unmodified `<ActivityPickerList mode="select" .../>` render.

**References**: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` (unchanged)

### FRONTEND-032-AC-05 [AUTO]: Today's "Browse activities" drawer shows the collapsed filters
**Statement**: `ActivityDrawer` (`mode="drag"`) shall show the same "Filters" disclosure collapsed by
default, with zero changes to `ActivityDrawer.tsx` itself.

**References**: `frontend/src/components/WeeklyPlanner/ActivityDrawer.tsx` (unchanged)

## Requirement 3: Existing filter behaviour is otherwise unaffected

**User story**: As a user, once I do open the filters, I want them to work exactly as they already
do — this is a layout change, not a behaviour change.

### FRONTEND-032-AC-06 [AUTO]: Selecting a filter still updates the visible activity list
**Statement**: With the disclosure open, selecting a category/type/favourite filter option shall
narrow the visible activity/sub-task list exactly as it does today — regression guard for the
existing filter logic (`frontend_spec_009`/`017`/`022`/`027`'s filter ACs), unchanged by this spec.

**References**: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`

### FRONTEND-032-AC-07 [AUTO]: Filter state still resets to "All" on every fresh mount
**Statement**: `categoryFilter`/`repeatableFilter`/`favouriteFilter` shall continue to initialize to
`'ALL'` on every `ActivityPickerList` mount (modal reopened, drawer reopened) — unchanged from today,
confirming the Overview's "always safe to default the disclosure closed" reasoning holds.

**References**: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`

## Requirement 4: Visual verification

**User story**: As a user, I want the collapsed/expanded disclosure to actually look right, in both
themes, in both places it appears.

### FRONTEND-032-AC-08 [MANUAL]: The disclosure renders correctly in both themes, in both consumers
**Statement**: In a real browser, in both Light and Dark theme, the "Filters" disclosure (collapsed
and expanded states) shall render with a clear, legible expand/collapse affordance in both the Weekly
Planner's Add modal and Today's Browse activities drawer.

**Rationale**: `[MANUAL]` — jsdom doesn't render CSS (this project's established limit, see
`frontend_spec_007`), so marker/affordance styling can only be confirmed by actually looking at it.

**References**: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.module.css` (new
`.filtersDisclosure`/`.filtersSummary` classes)

## Explicitly out of scope (do not implement as part of this spec)

- `ActivityBank.tsx`'s own category/status filter UI — a different, two-filter component on the full
  Activity Bank page, not mentioned in the request, no space-pressure rationale to apply here.
- An active-filter-count badge on the "Filters" summary label — flagged as a future nice-to-have, not
  built now (see Overview, judgment call 5).
- Persisting the disclosure's open/closed state across mounts (e.g., via `localStorage`) — filter
  state itself doesn't persist either, so there's nothing to stay consistent with; always starts
  closed.
- Any change to the filter *options* themselves (category/type/favourite values) — purely a layout
  change.

## Cross-references

| This spec depends on / contracts against | What it provides |
|---|---|
| `frontend_spec_028_activity_drawer.md` | `ActivityPickerList.tsx`, the single component this spec modifies — both consumers inherit the change for free |
| `frontend_spec_009_add_picker_modal.md` | `AssignActivityPicker.tsx` — unchanged, consumer #1 |
| `frontend_spec_016_today_view.md` | `ActivityDrawer.tsx` — unchanged, consumer #2 |
| `frontend_spec_027_favourite_activities.md` / `frontend_spec_017_activity_bank_category_filter.md` | The filter logic/options this spec relocates but does not change |
| `AssignActivityPicker.module.css`'s `moduleStyles.test.ts` guard (`frontend_spec_007`-AC-13/AC-26) | Must still hold: no bare `button {}` selector, no "primary"/"secondary" text, no non-radio `input[type]` override — the new `.filtersDisclosure`/`.filtersSummary` classes must not violate this |

## TDD test case sketches

Following this project's established pattern for CSS-heavy, jsdom-CSS-injection-disabled components
(`frontend_spec_007`/`031`'s precedent): behavioural assertions via Testing Library queries + `toggle`
semantics, CSS-shape assertions via source-file content checks, visual confirmation `[MANUAL]`.

### FRONTEND-032-AC-01 / AC-02
```typescript
describe('FRONTEND-032-AC-01/AC-02: filters live inside one collapsed-by-default disclosure', () => {
  it('AC-01: the Filters disclosure is collapsed on initial render', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([someActivity])
    render(<ActivityPickerList mode="select" selected={null} onSelectActivity={vi.fn()} onSelectSubTask={vi.fn()} />)

    await screen.findByText(someActivity.name)

    const disclosure = screen.getByText('Filters').closest('details')!
    expect(disclosure).not.toHaveAttribute('open')
    // IMPORTANT: confirm during implementation whether jsdom hides collapsed <details> content
    // from accessible queries the way a real browser does -- if getByRole('radio', ...) still
    // finds a collapsed filter in jsdom, that's the gap flagged in the Overview; downgrade this
    // AC's verification approach (or mark [MANUAL]) rather than relying on an assertion that
    // would pass even if the real-browser behaviour were broken.
  })

  it('AC-02: activating the summary reveals all three fieldsets at once', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([someActivity])
    render(<ActivityPickerList mode="select" selected={null} onSelectActivity={vi.fn()} onSelectSubTask={vi.fn()} />)
    await screen.findByText(someActivity.name)

    await userEvent.click(screen.getByText('Filters'))

    expect(screen.getByRole('group', { name: /category/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /type/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /favourite/i })).toBeInTheDocument()
  })
})
```

### FRONTEND-032-AC-03 / AC-06 / AC-07
```typescript
describe('FRONTEND-032-AC-03/AC-06/AC-07: filter behaviour unchanged underneath the new wrapper', () => {
  it('AC-06: selecting a category filter (after opening Filters) narrows the visible list', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([routineActivity, necessaryActivity])
    render(<ActivityPickerList mode="select" selected={null} onSelectActivity={vi.fn()} onSelectSubTask={vi.fn()} />)
    await screen.findByText(routineActivity.name)

    await userEvent.click(screen.getByText('Filters'))
    await userEvent.click(screen.getByRole('radio', { name: 'Necessary' }))

    expect(screen.queryByText(routineActivity.name)).not.toBeInTheDocument()
    expect(screen.getByText(necessaryActivity.name)).toBeInTheDocument()
  })

  it('AC-07: filter state resets to All on a fresh mount', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    const { unmount } = render(<ActivityPickerList mode="select" selected={null} onSelectActivity={vi.fn()} onSelectSubTask={vi.fn()} />)
    unmount()

    vi.mocked(activityApi.getAll).mockResolvedValue([routineActivity])
    render(<ActivityPickerList mode="select" selected={null} onSelectActivity={vi.fn()} onSelectSubTask={vi.fn()} />)
    await userEvent.click(await screen.findByText('Filters'))

    expect(screen.getByRole('radio', { name: 'All', hidden: true })).toBeChecked()
  })
})
```

### FRONTEND-032-AC-04 / AC-05
```typescript
describe('FRONTEND-032-AC-04/AC-05: both consumers show the collapsed disclosure, unmodified', () => {
  it('AC-04: AssignActivityPicker (the Add modal) shows Filters collapsed', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<AssignActivityPicker weekStart="2026-09-28" target={{ dayOfWeek: 'MONDAY', slot: 'MORNING' }} onSuccess={vi.fn()} onCancel={vi.fn()} />)

    const disclosure = (await screen.findByText('Filters')).closest('details')!
    expect(disclosure).not.toHaveAttribute('open')
  })

  it('AC-05: ActivityDrawer (Today\'s panel) shows Filters collapsed', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<ActivityDrawer onDragStartActivity={vi.fn()} onDragStartSubTask={vi.fn()} onDragEnd={vi.fn()} onClose={vi.fn()} />)

    const disclosure = (await screen.findByText('Filters')).closest('details')!
    expect(disclosure).not.toHaveAttribute('open')
  })
})
```

### FRONTEND-032-AC-08 (manual — no automated sketch)
No Vitest sketch — rendered marker/affordance appearance isn't testable without real CSS injection
(see Rationale above). Verify manually in a real browser:
1. Open the Weekly Planner's "Add" modal; confirm "Filters" renders collapsed with a clear
   expand affordance (marker, cursor) in both Light and Dark theme; expand it, confirm all three
   filters appear together and are usable.
2. Repeat for Today's "Browse activities" drawer.

## Acceptance Criteria Summary

- [x] FRONTEND-032-AC-01 — three filter fieldsets wrapped in one `<details>`, collapsed by default
- [x] FRONTEND-032-AC-02 — expanding reveals all three filters together, no per-filter collapsing
- [x] FRONTEND-032-AC-03 — each filter's own markup/labels/options unchanged
- [x] FRONTEND-032-AC-04 — Weekly Planner's Add modal shows the collapsed filters, zero changes to `AssignActivityPicker.tsx`
- [x] FRONTEND-032-AC-05 — Today's drawer shows the collapsed filters, zero changes to `ActivityDrawer.tsx`
- [x] FRONTEND-032-AC-06 — selecting a filter still narrows the visible list correctly
- [x] FRONTEND-032-AC-07 — filter state still resets to "All" on every fresh mount
- [x] FRONTEND-032-AC-08 — collapsed/expanded disclosure renders correctly in both themes, both consumers (confirmed in a real browser)
