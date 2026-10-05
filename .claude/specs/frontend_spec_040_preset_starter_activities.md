# Preset/Starter Activity Bank for New Users (Frontend)

**Status**: Implemented (2026-10-06)
**Priority**: P3 — V1 polish, lowers the cold-start barrier for a brand-new Activity Bank
**Depends on**: `planner_spec_002_activity_bank.md`/`frontend_spec_002_activity_bank.md` (origin of
`ActivityBank.tsx`, `activityApi.create`, the `Activity`/`ActivityInput` shapes this spec reuses
unchanged), `planner_spec_006_repeatable_activities.md` (the repeatable/one-off distinction this
spec's preset list showcases), `frontend_spec_032_collapsible_filters.md` (established
`<details>`/`<summary>` disclosure pattern this spec follows)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish

## Summary

All 8 ACs implemented and tested (9 new Vitest/RTL tests in `SuggestedActivities.test.tsx`, plus 2
more added to `ActivityBank.test.tsx` for the disclosure's open/closed wiring — 575 total frontend
tests passing, no regressions). `npm run lint` and `npx tsc -b --noEmit` are both clean.

**Real findings**:
- The per-category `<ul>` inside `SuggestedActivities` needed `role="presentation"` (its `<h4>`
  sibling already labels the group) — without it, `ActivityBank.test.tsx`'s existing
  `screen.getByRole('list')` assertions (which expect exactly one list: the activity rows) broke,
  since the suggestion groups' own `<ul>`s were matching too. Same pattern `ActivityBank.tsx`'s own
  category-filter group already uses for the identical reason.
- `getErrorMessage` is duplicated verbatim into `SuggestedActivities.tsx` rather than extracted to a
  shared util — matches this codebase's existing convention of 8 other components each carrying
  their own copy rather than a shared helper module.
- The preset wording/selection in `presetActivities.ts` is used as-sketched in the spec, per the
  user's own note that it's a placeholder to be edited later — not treated as final copy.

**Real-browser verification** (done by the coordinator against the live dev stack, logged in as
the seeded user — no `[MANUAL]` ACs required it, but a sanity pass regardless): confirmed the
disclosure opens closed-by-default against the real account's existing activities (`AC-06`/`AC-08`)
and that "Go for a walk"/"Apply for jobs" — both already real activities in this account — are
correctly absent from their preset groups (`AC-05`, live, not just mocked); clicked "Add Tidy up
for 10 minutes", confirmed it actually created the activity (appeared in the real list) and
immediately disappeared from the suggestions (`AC-01` plus the live-reactivity side of `AC-05`);
deleted it again and confirmed it reappeared in suggestions, matching the spec's "a deleted preset
becomes suggestable again" design decision; confirmed category grouping (`AC-03`) and legible
rendering in both Light and Dark themes. The redundant-visible-text note from this first pass
(name and "Add {name}" sitting right next to each other) is resolved by `AC-10` below.

**Requirement 5 (AC-09–AC-14), based on live styling feedback from the user reviewing the above**:
implemented and verified the same way — category group headings now use `getCategoryColor`/
`getReadableTextColor` (live-updating, confirmed the "Routine"/"Necessary"/"Pleasurable" headings
render in their real category colours with readable text in both themes), the CTA reads "Add to my
activities" right-aligned with the specific name preserved in `aria-label`, the existing category
filter now also filters which suggestion groups render (confirmed live: selecting "Routine" in the
toolbar left only the Routine suggestion group visible), a preamble sentence renders above the
grouped list, and a new "My Activities" heading now precedes the real list with
`SuggestedActivities` moved to render after it instead of before.

**A second, smaller round of live styling feedback** (gap sizing, heading parity, icons) was
folded in during the same review: increased the gap between "My
Activities" and "Suggested activities"; gave both section headings (the real `<h3>` and the
disclosure's `<summary>`) matching bold styling via a duplicated `.sectionHeading` rule in each
component's own CSS module (matching this codebase's established per-component-duplication
convention, e.g. `getErrorMessage`); tightened the margin between each category heading and its
list, and the list's own indentation; added a `RepeatableIcon` next to each repeatable preset
(matching the real activity list's own existing treatment), with a new test confirming it renders
for a repeatable preset and not a one-off one. All reconfirmed live in the real browser (both
themes) after these changes.

**A third round (`AC-15`)**: with both section headings now styled identically bold, the native
browser disclosure marker was the only remaining signal that "Suggested activities" is actually
interactive — flagged by the user as not clear enough. Added a new, reusable
`components/icons/ChevronIcon`, suppressed the native marker (`list-style: none` +
`::-webkit-details-marker`), and rotate the icon 180° via `.details[open] > .sectionHeading svg`.
Verified live: a real `getComputedStyle` check on the icon confirmed `transform:
matrix(-1, 0, 0, -1, 0, 0)` (i.e. `rotate(180deg)`) once the disclosure was opened, matching the
collapsed-state screenshot showing a plain down-pointing chevron beforehand.

**A fourth, CSS-only tweak**: the `AC-12` preamble gained a quote-block treatment (`background:
var(--code-bg)`, a left accent border, rounded corners, padding) at the user's request, so it reads
as a distinct callout rather than plain paragraph text — no change to `AC-12`'s content requirement,
confirmed in both themes. The user also edited the preamble's own wording directly in
`SuggestedActivities.tsx` (now two sentences) — left as their own edit, not reverted.

**Final total**: 16 ACs across four implementation/polish rounds, all implemented and tested
(584/584 frontend tests passing, 0 regressions; `npm run lint`/`npx tsc -b --noEmit` both clean
throughout).

## Overview

Promoted from `.claude/SPEC_CANDIDATES.md`'s "Preset/starter activity bank for new users" entry
(raised 2026-10-03). A brand-new user's Activity Bank starts completely empty today —
`ActivityBank.tsx`'s only empty-state messaging is "No activities yet. Add one below to get
started." — with no faster on-ramp than typing activities in one at a time from a blank page. This
spec adds a curated list of common activities the user can add with one click, lowering that
cold-start barrier. Not a new idea invented from scratch: `.claude/HIGH_LEVEL_DESIGN.md`'s planning-
model section already lists an illustrative weekend example set (go for a walk, go somewhere for
coffee, cook something interesting, see a friend, work on a personal project, watch a film, do one
household task) written as prose for a human reader, never operationalized into the app.

**Storage, decided with the user before writing this spec**: a plain typed TypeScript module
(`frontend/src/utils/presetActivities.ts`), not a JSON/config file — matches this codebase's
existing convention for static reference data (`categoryLabels.ts`, `planLabels.ts` are both typed
consts; there are no JSON data files anywhere in `frontend/src`), and gets compile-time type
checking against `ActivityCategory` that a JSON file wouldn't (a typo in a category value fails the
build, not silently at runtime). No evidence this needs to be editable without a code change — a
personal single-user app — so the lack of runtime configurability a `.ts` module implies is not a
real cost here.

**One array, not three files, decided with the user**: a single `PRESET_ACTIVITIES` array, each
entry carrying its own `category: ActivityCategory` field — matching how `Activity`/`ActivityInput`
already treat category as a field, not a storage-location split. Splitting into three per-category
files would add import/concatenation overhead for a list this small (a dozen or so items) with no
real benefit; category-grouped *display* (Requirement 2) is then just a `.filter()` over one array
in the UI layer, the same way `ActivityBank.tsx`'s own existing category filter already works.

**Judgment calls made while specifying, flagged for easy correction**:
- **Always available, not empty-state-only** — a new `<details>`/`<summary>` disclosure
  (`frontend_spec_032`'s established pattern), closed by default once the bank has activities, but
  rendered with the native `open` attribute set when the bank is completely empty. This single
  mechanism satisfies both framings the candidate's own notes raised ("in the Activity Bank's empty
  state" and "always-available, collapsed once the bank isn't empty") without picking one over the
  other arbitrarily.
- **Adding a preset removes it from the suggestions list** — a preset is hidden once an activity
  with the same name (case-insensitive) already exists (any status: active or archived), rather
  than tracking "already added this session" as separate UI state. This also means a preset a user
  deletes later becomes suggestable again, which reads as correct behavior ("I don't have this
  anymore, suggest it again") rather than a bug.
- **Category-grouped display** — three `<h4>`-headed groups (Routine/Necessary/Pleasurable, fixed
  order, matching `CATEGORY_LABELS`' existing order), mirroring the Activity Bank's own category
  filter rather than one flat list.

**Out of scope**: any backend change (a preset "Add" calls the existing `POST /api/v1/activities`
via `activityApi.create`, exactly as `ActivityForm`'s own create path already does — no new
endpoint); making the preset list user-editable/configurable; sub-tasks on any preset (presets are
plain activities only, matching the simplest on-ramp case).

## Shared building blocks

`frontend/src/utils/presetActivities.ts` (new):

```typescript
import type { ActivityCategory } from '../types/activity'

export interface PresetActivity {
  readonly name: string
  readonly category: ActivityCategory
  readonly repeatable: boolean
}

// Both repeatable and one-off examples per category, so the list itself showcases
// planner_spec_006's repeatable/one-off distinction -- not just a flat list of names.
export const PRESET_ACTIVITIES: readonly PresetActivity[] = [
  { name: 'Go for a walk', category: 'ROUTINE', repeatable: true },
  { name: 'Tidy up for 10 minutes', category: 'ROUTINE', repeatable: true },
  { name: 'Drink a glass of water first thing', category: 'ROUTINE', repeatable: true },
  { name: 'Do the laundry', category: 'NECESSARY', repeatable: true },
  { name: 'Apply for jobs', category: 'NECESSARY', repeatable: false },
  { name: 'Pay a bill', category: 'NECESSARY', repeatable: false },
  { name: 'Watch a film', category: 'PLEASURABLE', repeatable: false },
  { name: 'Call a friend', category: 'PLEASURABLE', repeatable: true },
  { name: 'Work on a personal project', category: 'PLEASURABLE', repeatable: true },
  { name: 'Go somewhere for coffee', category: 'PLEASURABLE', repeatable: false },
] as const
```

*(Implementer note: exact wording/selection above is a starting sketch, not final copy — adjust
freely, but keep at least one repeatable and one one-off entry per category, per the "showcase the
distinction" rationale above.)*

`frontend/src/components/ActivityBank/SuggestedActivities.tsx` (new): the disclosure + grouped
list + one-click "Add" buttons, reading from `PRESET_ACTIVITIES` and the already-fetched
`activities` list (passed as a prop, not re-fetched) to compute which presets to hide.

## Requirements

### Requirement 1 — A one-click "Add" for each suggested activity

**User story**: As a new user with an empty (or still-small) Activity Bank, I want to add a common
activity with one click instead of typing it in from scratch, so getting started is faster.

#### FRONTEND-040-AC-01 [AUTO]: Clicking a suggestion's "Add" creates it via the existing endpoint
**Statement**: When a suggested activity's "Add" button is clicked, `SuggestedActivities` shall
call `activityApi.create({ name, category, description: null, repeatable })` using that preset's
own `name`/`category`/`repeatable`, and on success append the returned `Activity` to
`ActivityBank`'s activity list — the same `POST /api/v1/activities` call and local-state append
`ActivityForm`'s own create path already performs.

**Rationale**: Reuses the existing creation endpoint and contract exactly — no new backend surface,
no divergent local-state-update logic from the form-based create path.

**References**:
- Service: `frontend/src/services/activityApi.ts` (`create`, unchanged)
- Type: `ActivityInput`/`Activity` (`frontend/src/types/activity.ts`, unchanged)
- Component: `frontend/src/components/ActivityBank/ActivityBank.tsx` (passes its existing
  `activities`/`setActivities` down, or an equivalent `onAdded` callback)

#### FRONTEND-040-AC-02 [AUTO]: A suggestion shows a busy state and surfaces a create error
**Statement**: While a suggestion's create request is in flight, its "Add" button shall be
disabled; if the request fails, `SuggestedActivities` shall display an error message (same
`getErrorMessage`-style handling `ActivityBank.tsx` already uses elsewhere) without removing the
suggestion from the list.

**Rationale**: Matches this codebase's established per-row busy/error pattern (e.g.
`unarchivingId`/`unarchiveError`) — a failed add shouldn't silently disappear the suggestion, since
`FRONTEND-040-AC-05`'s "hide once it exists" rule must not fire for a create that didn't actually
succeed.

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx` (existing
`getErrorMessage` helper, reused)

### Requirement 2 — Suggestions are grouped by category

**User story**: As a user browsing suggestions, I want them grouped the same way the rest of the
Activity Bank is (by category), so the list reads consistently with everything else on the page.

#### FRONTEND-040-AC-03 [AUTO]: Suggestions render in three fixed-order category groups
**Statement**: `SuggestedActivities` shall render `PRESET_ACTIVITIES` split into three groups —
Routine, Necessary, Pleasurable, in that fixed order (matching `CATEGORY_LABELS`'s existing
iteration order) — each under its own heading, rather than one flat list.

**Rationale**: Direct implementation of the "should suggestions be category-grouped" open question,
resolved by mirroring the Activity Bank's own existing category-filter grouping.

**References**: `frontend/src/utils/categoryLabels.ts` (`CATEGORY_LABELS`, reused for group
headings and ordering)

#### FRONTEND-040-AC-04 [AUTO]: A category with no remaining suggestions renders no empty group
**Statement**: While every preset in a given category has already been added (per
`FRONTEND-040-AC-05`), that category's group (heading included) shall not render.

**Rationale**: Avoids showing an empty "Routine" heading with nothing under it once a user has
added every routine suggestion — unlike `frontend_spec_039`'s per-category table (which always
shows all three rows, since that's a fixed-shape summary), this is a *suggestion* list, where an
empty group has nothing left to suggest.

**References**: Component: `frontend/src/components/ActivityBank/SuggestedActivities.tsx`

### Requirement 3 — Already-added presets don't stay suggested

**User story**: As a user who's already added a suggested activity (by any means — clicking its
"Add" button, or typing the same name in manually), I don't want to keep seeing it suggested.

#### FRONTEND-040-AC-05 [AUTO]: A preset is hidden once a same-named activity already exists
**Statement**: While an `Activity` with the same `name` (case-insensitive) as a preset already
exists in `ActivityBank`'s current activity list — regardless of that activity's `archived` status
— `SuggestedActivities` shall not render that preset.

**Rationale**: Resolves the "avoid duplicate adds" open question: comparing against existing names
(rather than tracking "added this session" as separate state) means the rule holds correctly
across page reloads and across however the matching activity was actually created (preset-add or
manual entry), and a later-deleted activity correctly becomes suggestable again.

**References**: Component: `frontend/src/components/ActivityBank/SuggestedActivities.tsx` (name
comparison against the `activities` prop); Type: `Activity` (`name`, `archived`)

### Requirement 4 — Visibility: always available, prominent when the bank is empty

**User story**: As a brand-new user with zero activities, I want the suggestions prominently
visible without an extra click; as an existing user with activities already, I still want to be
able to browse suggestions, just not have them take up space by default.

#### FRONTEND-040-AC-06 [AUTO]: Suggestions render inside a closed-by-default disclosure
**Statement**: `SuggestedActivities` shall render inside a `<details>`/`<summary>` disclosure
(`frontend_spec_032`'s established pattern), with no `open` attribute by default.

**Rationale**: Consistent with this codebase's established "start closed, user opens" disclosure
convention for supplementary content that would otherwise take up permanent space.

**References**: `frontend_spec_032_collapsible_filters.md` (precedent)

#### FRONTEND-040-AC-07 [AUTO]: The disclosure defaults open when the Activity Bank is empty
**Statement**: While `ActivityBank`'s activity list is non-null and has zero entries, the
`SuggestedActivities` disclosure rendered in that empty state shall carry the `open` attribute.

**Rationale**: The specific "lower the cold-start barrier" case this spec exists for — a brand-new
user shouldn't need to find and click a disclosure toggle before seeing anything useful.

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx` (existing
`activities !== null && activities.length === 0` empty-state branch)

#### FRONTEND-040-AC-08 [AUTO]: Suggestions remain reachable once the bank has activities
**Statement**: While `ActivityBank`'s activity list has one or more entries, `SuggestedActivities`
shall still render (inside its closed-by-default disclosure, per `FRONTEND-040-AC-06`) — not only
in the empty state.

**Rationale**: Satisfies the candidate's "always-available" framing — suggestions remain a
discoverable on-ramp for adding a few more common activities later, not a one-time-only prompt.

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx`

### Requirement 5 — Visual/structural polish, from real-use styling feedback

Raised by the user 2026-10-06 while reviewing the shipped (but not yet merged) first pass. Two
open questions from that feedback were resolved with the user before writing these ACs: the
already-added treatment stays **hide entirely** (`FRONTEND-040-AC-05`, unchanged — no new AC
needed), and the section's position moves to **below** "My Activities", not above.

#### FRONTEND-040-AC-09 [AUTO]: Category group headers carry that category's background colour
**Statement**: Each category group heading in `SuggestedActivities` shall set its `background-color`
to `getCategoryColor(category)` and its text colour to `getReadableTextColor` of that background —
the same live-updating pattern `CategoryChip` already uses (`useSyncExternalStore` +
`subscribeToCategoryColorChanges`, so a Settings colour change applies immediately, no reload).

**Rationale**: Direct implementation of the user's request; reuses the existing colour/contrast
machinery rather than inventing a second way to apply category colour.

**References**: `frontend/src/utils/categoryColors.ts` (`getCategoryColor`,
`subscribeToCategoryColorChanges`), `frontend/src/utils/contrast.ts` (`getReadableTextColor`),
`frontend/src/components/CategoryChip/CategoryChip.tsx` (the pattern being matched)

#### FRONTEND-040-AC-10 [AUTO]: The add CTA reads "Add to my activities" and sits right-aligned
**Statement**: Each preset's add button's visible text shall read "Add to my activities" (not
`Add ${name}`), right-aligned within its row; the button's accessible name shall still carry the
specific preset's name (e.g. via `aria-label`), so the visible-text change doesn't regress multiple
same-labelled buttons being indistinguishable to assistive tech.

**Rationale**: Direct implementation of the user's request. The `aria-label` carve-out is a11y
necessity, not scope creep — `FRONTEND-040-AC-01`'s existing test sketches query by accessible
name, which must still disambiguate between presets once the visible text is identical across all
of them.

**References**: Component: `frontend/src/components/ActivityBank/SuggestedActivities.tsx`;
precedent: `frontend/src/components/ActivityBank/ActivityBank.tsx`'s own
`aria-label={... Favourite ${activity.name}}` pattern on an icon-only button

#### FRONTEND-040-AC-11 [AUTO]: Suggestions respect the existing category filter
**Statement**: While `ActivityBank`'s existing "Filter by category" control is set to a specific
category (not "All"), `SuggestedActivities` shall render only that category's group (or none, if
every preset in it is already added) — reusing the same `categoryFilter` state, not a second,
independent filter control.

**Rationale**: Consistency — the filter already governs what the real activity list shows;
suggestions staying unfiltered while the user has deliberately narrowed their view would read as
inconsistent. No new UI: this is `ActivityBank`'s existing `categoryFilter` state threaded down as
a prop.

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx` (existing
`categoryFilter` state, `CategoryFilter` type from `utils/categoryFilter.ts`)

#### FRONTEND-040-AC-12 [AUTO]: A short preamble introduces the suggestions
**Statement**: `SuggestedActivities` shall render one short introductory sentence (e.g. "A few
common activities you can add with one click:") above the grouped list, inside the disclosure.

**Rationale**: Direct implementation of the user's request — a bare heading plus a list of names
and buttons, with no explanation, is less clear once this section is always-available rather than
only appearing in an already-self-explanatory empty state.

**References**: Component: `frontend/src/components/ActivityBank/SuggestedActivities.tsx`

#### FRONTEND-040-AC-13 [AUTO]: A "My Activities" heading precedes the real activity list
**Statement**: `ActivityBank` shall render an `<h3>My Activities</h3>` heading directly above its
existing loading/error/empty-state/list block (the real, already-added activities) — a new
heading, not previously present.

**Rationale**: Direct implementation of the user's request — gives the real activity list the same
kind of heading `SuggestedActivities`'s own `<summary>` already gives the suggestions section, so
the page reads as two clearly-labelled sections rather than one headed and one unheaded.

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx`

#### FRONTEND-040-AC-14 [AUTO]: Suggested activities renders below My Activities, not above
**Statement**: `ActivityBank` shall render `SuggestedActivities` *after* the real activity list
block (loading/error/empty-state/list), not before it as originally implemented.

**Rationale**: Resolved with the user: the real activity list is the primary content a returning
user cares about; suggestions are secondary. This also reads better for the empty-state case —
the existing "No activities yet. Add one below to get started." message now literally refers to
something rendered below it.

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx`. Explicit
regression guard: `FRONTEND-040-AC-06`/`AC-07`/`AC-08` (disclosure behavior, open-when-empty,
reachability) are unaffected by this reordering — only position changes, not those mechanics.

#### FRONTEND-040-AC-15 [AUTO]: A chevron icon signals the disclosure is expandable
**Statement**: `SuggestedActivities`'s `<summary>` shall render a chevron icon alongside its text,
visually rotating 180° when the disclosure is open; the native browser disclosure marker shall be
suppressed so exactly one expand/collapse indicator is shown, not two.

**Rationale**: Raised by the user after the heading restyle (`AC-10`'s matching bold style, applied
to both "My Activities" and "Suggested activities") made the two headings visually identical except
for the native marker — which itself wasn't a clear enough affordance that the second one is
actually interactive/collapsible. A dedicated, rotating chevron (new `components/icons/ChevronIcon`,
reusable beyond this one disclosure) makes that difference unambiguous.

**References**: `frontend/src/components/icons/ChevronIcon.tsx` (new); Component:
`frontend/src/components/ActivityBank/SuggestedActivities.tsx`/`.module.css` (native marker
suppression via `list-style: none` + `::-webkit-details-marker`, rotation via `.details[open] >
.sectionHeading svg`)

#### FRONTEND-040-AC-16 [AUTO]: A repeatable preset shows a repeatable icon
**Statement**: While a preset's `repeatable` is `true`, its row in `SuggestedActivities` shall
render `RepeatableIcon`; while `false`, it shall not.

**Rationale**: Matches the real activity list's own existing treatment (`activity.repeatable &&
<RepeatableIcon />` in `ActivityBank.tsx`) — a suggestion showing the same repeatable/one-off
signal as a real activity row keeps the two lists visually consistent.

**References**: Component: `frontend/src/components/ActivityBank/SuggestedActivities.tsx`;
`frontend/src/components/RepeatableIcon/RepeatableIcon.tsx` (reused unchanged)

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/utils/presetActivities.ts` (new) | The static `PRESET_ACTIVITIES` list this entire spec is built around |
| `frontend/src/components/ActivityBank/SuggestedActivities.tsx` (new) | The disclosure, grouping, and one-click-add UI |
| `frontend/src/components/ActivityBank/ActivityBank.tsx` | Renders `SuggestedActivities`, passes `activities`/an add-success callback; existing empty-state branch gains the `open` condition |
| `frontend/src/services/activityApi.ts` | `create` — reused unchanged, no new endpoint |
| `frontend/src/utils/categoryLabels.ts` | `CATEGORY_LABELS` — reused for group headings/order |
| `frontend_spec_032_collapsible_filters.md` | Precedent for the `<details>`/`<summary>` pattern this spec follows |
| `.claude/HIGH_LEVEL_DESIGN.md` | Origin of the illustrative example-activity prose this spec operationalizes |

## Test case sketches (Vitest + RTL, red before implementation)

```tsx
describe('FRONTEND-040-AC-01/AC-02: one-click add', () => {
  it('AC-01: clicking Add calls activityApi.create with the preset\'s own fields and appends the result', async () => {
    vi.mocked(activityApi.create).mockResolvedValue(makeActivity({ name: 'Go for a walk' }))
    render(<SuggestedActivities activities={[]} onAdded={onAdded} />)

    fireEvent.click(await screen.findByRole('button', { name: /add go for a walk/i }))

    await waitFor(() =>
      expect(activityApi.create).toHaveBeenCalledWith({
        name: 'Go for a walk',
        category: 'ROUTINE',
        description: null,
        repeatable: true,
      }),
    )
    expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ name: 'Go for a walk' }))
  })

  it('AC-02: shows an error and keeps the suggestion when create fails', async () => {
    vi.mocked(activityApi.create).mockRejectedValue(new Error('boom'))
    render(<SuggestedActivities activities={[]} onAdded={onAdded} />)

    fireEvent.click(await screen.findByRole('button', { name: /add go for a walk/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add go for a walk/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-040-AC-03/AC-04: category grouping', () => {
  it('AC-03: renders three fixed-order category group headings', () => {
    render(<SuggestedActivities activities={[]} onAdded={onAdded} />)
    const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(headings).toEqual(['Routine', 'Necessary', 'Pleasurable'])
  })

  it('AC-04: omits a category heading once every preset in it is already added', () => {
    const existing = PRESET_ACTIVITIES.filter((p) => p.category === 'ROUTINE').map((p) =>
      makeActivity({ name: p.name }),
    )
    render(<SuggestedActivities activities={existing} onAdded={onAdded} />)
    expect(screen.queryByRole('heading', { name: 'Routine' })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-040-AC-05: already-added presets are hidden', () => {
  it('hides a preset once a same-named activity exists, case-insensitively, including archived', () => {
    render(
      <SuggestedActivities
        activities={[makeActivity({ name: 'go FOR a Walk', archived: true })]}
        onAdded={onAdded}
      />,
    )
    expect(screen.queryByRole('button', { name: /add go for a walk/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-040-AC-06/AC-07/AC-08: disclosure visibility', () => {
  it('AC-06/AC-08: renders closed by default when the bank already has activities', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([makeActivity({})])
    render(<ActivityBank />)
    const details = (await screen.findByText(/suggested activities/i)).closest('details')!
    expect(details).not.toHaveAttribute('open')
  })

  it('AC-07: renders open by default when the bank is empty', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<ActivityBank />)
    const details = (await screen.findByText(/suggested activities/i)).closest('details')!
    expect(details).toHaveAttribute('open')
  })
})
```

**Test Case (Green)**: add `presetActivities.ts`, implement `SuggestedActivities.tsx`, and wire it
into `ActivityBank.tsx` until every sketch above passes.

## Acceptance Criteria Summary

- [x] FRONTEND-040-AC-01 — clicking "Add" creates the preset via the existing `activityApi.create`
- [x] FRONTEND-040-AC-02 — busy state while in flight, error shown (not hidden) on failure
- [x] FRONTEND-040-AC-03 — suggestions grouped into three fixed-order category headings
- [x] FRONTEND-040-AC-04 — a category with no remaining suggestions renders no empty group
- [x] FRONTEND-040-AC-05 — a preset is hidden once a same-named activity already exists (case-insensitive, any archived status)
- [x] FRONTEND-040-AC-06 — suggestions render inside a closed-by-default disclosure
- [x] FRONTEND-040-AC-07 — the disclosure defaults open when the Activity Bank is empty
- [x] FRONTEND-040-AC-08 — suggestions remain reachable (collapsed) once the bank has activities
- [x] FRONTEND-040-AC-09 — category group headers carry that category's background colour
- [x] FRONTEND-040-AC-10 — CTA reads "Add to my activities", right-aligned, `aria-label` keeps the specific name
- [x] FRONTEND-040-AC-11 — suggestions respect the existing category filter
- [x] FRONTEND-040-AC-12 — a short preamble sentence introduces the suggestions
- [x] FRONTEND-040-AC-13 — a "My Activities" heading precedes the real activity list
- [x] FRONTEND-040-AC-14 — Suggested activities renders below My Activities, not above
- [x] FRONTEND-040-AC-15 — a rotating chevron icon signals the disclosure is expandable
- [x] FRONTEND-040-AC-16 — a repeatable preset shows a repeatable icon, a one-off one doesn't
