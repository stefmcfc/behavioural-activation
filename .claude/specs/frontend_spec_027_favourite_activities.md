# Favourite Activities (Frontend)

**Status**: Implemented (2026-10-02) — all 20 ACs green, including AC-05/AC-09 `[MANUAL]`, confirmed
in a real browser; see "Post-implementation refinement" in Summary
**Priority**: P3 — quality-of-life speed-up for finding commonly-used activities, no new domain
capability
**Depends on**: `planner_spec_015_favourite_activities.md` (the backend endpoints/field this
consumes — must land first), `frontend_spec_002_activity_bank.md` (the `ActivityBank` this extends),
`frontend_spec_009_add_picker_modal.md` (`AssignActivityPicker`, the other surface this touches),
`frontend_spec_019_repeatable_activity_icon.md`/`frontend_spec_022_repeatable_icon_in_assign_picker.md`
(the `RepeatableIcon` read-only-badge pattern this mirrors with a new `FavouriteIcon`)
**Area**: Frontend only
**Roadmap version**: V2-ish polish — not tied to a specific `HIGH_LEVEL_DESIGN.md` version theme

## Summary

Implemented as scoped. `Activity` gained `favourite: boolean`; `activityApi` gained
`markFavourite(id)`/`unmarkFavourite(id)` (POST/DELETE `/activities/{id}/favourite`), mirroring
`archive`/`unarchive` exactly. New shared `FavouriteIcon` component mirrors `RepeatableIcon` (simple
`role="img"` `aria-label="Favourite"` SVG, no props, own CSS module, star path).

`ActivityBank`: a favourite-toggle `<button>` (containing `<FavouriteIcon />`, `aria-pressed`,
label text "Favourite"/"Unfavourite") was added to `renderRowActions`, present on both the archived
and non-archived branches, with its own `favouritingId`/`favouriteError` state mirroring
`handleUnarchive`'s structure exactly. A "Favourites only" checkbox (new `favouriteFilter` state,
styled with the same `.archivedToggle` class as "Show archived") composes as an additional `AND`
condition in `visibleActivities`, purely client-side, no re-fetch.

`AssignActivityPicker`: a read-only `<FavouriteIcon />` renders next to a favourited activity's name
alongside the existing `<CategoryChip>`/`<RepeatableIcon />` badges — no click handler, never
rendered on sub-task rows. A "Favourites only" checkbox fieldset (new `favouriteFilter` state)
composes as an additional `AND` condition alongside the existing category/repeatable filters;
sub-task rendering is untouched, so a shown favourited activity's sub-tasks still render in full.

No client-side `.sort()` was introduced in either component — both `visibleActivities` filters remain
`Array.prototype.filter` only, confirmed by a dedicated regression-guard test in each component
(AC-04/AC-08) asserting the backend's favourite-first order passes through unchanged.

All 14 `[AUTO]` ACs (01–04, 06–08, 10–16) are covered by Vitest/RTL tests and pass. `npm test`
(372/372 across 30 files) and `npm run lint` (oxlint, 0 findings) are green; `npm run build`
(`tsc -b && vite build`) also passes cleanly. AC-05 and AC-09 (`[MANUAL]` real-browser visual checks)
confirmed afterward (Claude in Chrome, against the local dev stack, logged in as the seeded user):
in `ActivityBank`, the star toggle button (text "Favourite"/"Unfavourite") renders cleanly alongside
the category chip and existing row actions with no overlap; toggling it round-trips through the real
`POST`/`DELETE /api/v1/activities/{id}/favourite` endpoints and survives a page reload, with the
favourited activity correctly pinned to the top of the list (`planner_spec_015`-AC-10 observed live).
In `AssignActivityPicker`, the read-only star indicator is legible and clearly distinct from the
category chip and repeatable icon at the picker's denser row size. The "Favourites only" checkbox
filter was also exercised live in both surfaces, styled identically to the existing "Show archived"
toggle as the user specifically asked for.

**Real findings**:
- Adding `favourite: boolean` to the `Activity` interface required updating every existing
  `Activity`-typed object literal across `ActivityBank.test.tsx`, `AssignActivityPicker.test.tsx`,
  `WeeklyPlanner.test.tsx`, `ActivityForm.test.tsx`, and `activityApi.test.ts` (the TypeScript
  compiler, not Vitest/esbuild, is what caught these — `tsc -b` via `npm run build` was the
  authoritative check since Vitest's esbuild transform doesn't type-check).
- An extra (non-AC, but implied by "mirror `handleUnarchive`'s structure") test was added confirming
  a failed `markFavourite` call surfaces an alert and leaves the toggle unchanged, matching the
  existing unarchive-failure precedent.

**Post-implementation refinement (2026-10-02)**: after the above shipped, the user raised four
real-usage issues, addressed in the same change (ACs renumbered/added, not a separate spec, since
this hadn't merged yet):
1. **"Show archived"/"Favourites only" pills were colliding, especially with a visible border.** The
   two `<label>`s sat directly inside the status `<fieldset>` with no flex container, so they had no
   gap between them. Fixed by wrapping both in a new `.statusToggleGroup` (`display:flex;
   flex-wrap:wrap; gap:0.5rem`) — pure CSS, no AC behavior change, not worth a new AC.
2. **The favourite "CTA" (a text button reading "Favourite"/"Unfavourite" in the actions list) became
   an icon-only toggle positioned before the activity name**, not in the actions list. `FavouriteIcon`
   gained an optional `filled` prop (default `true`, so every existing read-only usage — the badge in
   `AssignActivityPicker` — is unaffected) so the toggle can render a filled star when favourited and
   an outline star (`var(--text)`, not `var(--accent)`) when not — a real toggle affordance, not a
   static icon. Amends `FRONTEND-027-AC-01`'s statement (see Requirement 1) rather than adding a new
   AC, since it's the same requirement with a different DOM shape — the ID is unchanged.
3. **New Requirement 5**: the Add/Edit Activity modal (`ActivityForm`) gained its own favourite
   toggle (`FRONTEND-027-AC-17` through `AC-20`) — a checkbox + `FavouriteIcon`, mirroring the
   existing Repeatable field's shape exactly. `favourite` still can't be part of `ActivityRequest`
   (`planner_spec_015`'s orthogonality rule, unchanged) — the form's toggle is local state until
   submit, then applies via the same dedicated `markFavourite`/`unmarkFavourite` endpoints
   immediately after create/update succeeds, only when the toggle actually changed the value (no
   redundant call on a no-op edit).
4. **`AssignActivityPicker`'s favourite filter became a two-option pill group ("All" / "Favourites
   only"), not a checkbox**, to visually match the category/type filter pills. This could **not** be
   done by just extending the existing checkbox-as-hidden-pill CSS trick — `moduleStyles.test.ts`'s
   `FRONTEND-007-AC-26` explicitly guards `AssignActivityPicker.module.css` against hiding any
   `input` type other than `radio` (a deliberate anti-bespoke-styling rule from the visual-refresh
   spec), so a checkbox styled the same way would have violated an existing, tested architectural
   rule. Converting to a real two-option radio group (`FavouriteFilter = 'ALL' | 'FAVOURITES_ONLY'`,
   mirroring `RepeatableFilter`'s shape) reuses the already-blessed radio-pill idiom instead of
   extending a forbidden one. Amends `FRONTEND-027-AC-10`/`AC-11`/`AC-13`/`AC-14`/`AC-16`'s statements
   to reflect "select/not-select a pill option" instead of "check/uncheck a checkbox" — `AC-12`/`AC-15`
   needed no wording change. IDs unchanged throughout.

**Unrelated cosmetic fix bundled into the same pass**: while verifying refinement 4 above in a real
browser, the user separately reported the leftmost filter pill's focus outline getting clipped at the
left edge of the `AssignActivityPicker` modal. Root cause: `.scrollBody`'s `overflow-y: auto` with no
explicit `overflow-x` computes `overflow-x: auto` too (per the CSS2.1 overflow interaction rule), so
any focus outline extending past the content box — even by 2px — gets clipped by the scroll
container, regardless of the dialog's own padding. `ActivityForm.module.css`'s `.scrollBody` already
works around this (`padding: 0 6px; margin: 0 -6px;` — padding reserves room for the outline, the
negative margin cancels the visual shift). Applied the identical fix to
`AssignActivityPicker.module.css`. Not tied to any AC — jsdom doesn't lay out real focus rings, so
there was never a test that could have caught this; confirmed visually in a real browser instead.

## Overview

The frontend half of the "favourite activities" feature split off from `.claude/ideas/future_ideas.md`'s
sidebar/drawer entry — see `planner_spec_015_favourite_activities.md`'s Overview for the full
background and the scope decisions already confirmed by the user (manual toggle, not auto-computed;
Activities only, never sub-tasks; both `ActivityBank` and `AssignActivityPicker` are touched;
favourites are always pinned to the top). **The sidebar/drawer idea itself remains separate and
unspecced** — this spec is a useful precursor to it, not that feature.

**Amendment (2026-10-02, pre-implementation)**: the original draft treated pinned-to-top ordering as
the *only* way favourites surface in a list, explicitly excluding a "favourites only" filter. The
user has since asked for an explicit filter too, on both surfaces — Requirements 3 and 4 below are
new as a result. The two mechanisms are complementary, not alternatives: pinning means you always see
your favourites first without doing anything; the filter is for when the list is long enough that
narrowing it down is worth an extra click — exactly the same relationship the existing "Show archived"
checkbox has to the rest of the Activity Bank list.

**What this spec adds**:
1. A favourite-toggle control in `ActivityBank` (a star button per row), calling the two new backend
   endpoints.
2. A read-only favourite indicator in `AssignActivityPicker`, next to a favourited activity's name —
   no toggle control there, matching how `RepeatableIcon` is already a read-only badge in that
   component.
3. Both surfaces trust the backend's new favourite-first ordering (`planner_spec_015`-AC-10/AC-11)
   rather than re-sorting client-side — the existing category/archived/repeatable filters in both
   components already use `.filter()`, which preserves array order, so no new sort logic is needed;
   this spec's job is to make sure nothing *breaks* that implicit pass-through.
4. An explicit "Favourites only" filter in both `ActivityBank` and `AssignActivityPicker` (Requirements
   3 and 4), composing with each surface's existing filters rather than replacing them — purely
   client-side, like every other filter in both components; no backend change needed.

**New shared component — `FavouriteIcon`**: mirrors `frontend/src/components/RepeatableIcon/RepeatableIcon.tsx`
exactly (a simple `role="img"` `aria-label="Favourite"` SVG, its own `.module.css`, no props, no
interactivity). Used as the *visual* badge in both surfaces; in `ActivityBank` it sits inside a
clickable `<button>` that does the actual toggling, exactly the same relationship `CompletionIcon`
has to its surrounding complete/undo button elsewhere in this codebase — the icon itself stays
dumb and reusable, the interactivity lives in whichever component renders it.

**Judgment call, flagged explicitly — toggle lives only in `ActivityBank`, not in
`AssignActivityPicker`**: the picker shows a read-only star, with no way to favourite/unfavourite an
activity from within it. Reasoning: (a) the picker is a transient, modal, already-filter-heavy
surface (category + repeatable filters already compete for space) — adding a third interactive
control there adds clutter during an already-focused "pick one thing and assign it" flow; (b)
`ActivityBank` is already the place every other activity-management action lives (edit, delete,
archive) — adding favourite-toggle there is consistent, not a new pattern; (c) mirrors how
`RepeatableIcon` itself works today — a property you set once in the Activity Bank/form, then see
reflected read-only everywhere else it matters. **This is a judgment call, not a settled product
decision** — redirect if toggling directly from the picker turns out to matter in practice.

**Judgment call, flagged explicitly — two states, not three**: the new "Favourites only" filter
(Requirements 3/4) is binary (favourite / not-filtered), not a three-state group like the existing
repeatable filter (`ALL`/`REPEATABLE`/`ONE_OFF`). Reasoning: a "show only non-favourites" state has no
obvious use case (unlike "show only one-off activities", which is a real planning question), so a
third state would just be dead weight. **This is a judgment call** — easy to widen to a three-state
filter later if "hide my favourites" turns out to matter. (The *mechanism* for that binary choice
differs between the two surfaces — `ActivityBank` uses a checkbox mirroring its existing "Show
archived" toggle; `AssignActivityPicker` uses a two-option `All`/`Favourites only` radio-pill group,
amended post-implementation — see Summary — to respect that component's existing
`FRONTEND-007-AC-26` guard against styling any input type but `radio` as a hidden pill. Both still
express the same two-state decision, not three.)

## Requirement 1: Activity Bank — toggle and display a favourite status

**User story**: As a user with a long activity bank, I want to mark the activities I plan with often
as favourites with one click, so they're easy to find at the top of my list.

### FRONTEND-027-AC-01 [AUTO]: Each activity row has a favourite-toggle icon button
**Statement**: The `ActivityBank` component shall render a favourite-toggle `<button>` positioned
before the activity's name on every row — archived or not — containing a `<FavouriteIcon
filled={activity.favourite} />` and an `aria-pressed` attribute reflecting `activity.favourite`, with
no separate text label in the row's actions list.

**Rationale**: Available regardless of archived state (unlike Edit/Delete, which are hidden for
archived rows) — there's no reason to block favouriting/unfavouriting an archived activity. **Amended
2026-10-02** (ID unchanged): originally a text button ("Favourite"/"Unfavourite") living in the row's
actions list alongside Edit/Delete; moved to an icon-only toggle before the name, with the icon itself
switching between filled (favourited) and outline (not) via `FavouriteIcon`'s new `filled` prop — a
real toggle affordance, not a static badge next to a text label. See Summary's "Post-implementation
refinement" for why.

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx` (row rendering,
before `<span>{activity.name}</span>`), `frontend/src/components/FavouriteIcon/FavouriteIcon.tsx`
(new `filled` prop)

### FRONTEND-027-AC-02 [AUTO]: Clicking the toggle on a not-favourited activity marks it favourite
**Statement**: When the favourite-toggle button is clicked for an activity with `favourite: false`,
the `ActivityBank` component shall call `activityApi.markFavourite(id)` and, on success, update that
activity's `favourite` to `true` in local state.

**References**:
- Service: `frontend/src/services/activityApi.ts` (new `markFavourite`)
- Component: `frontend/src/components/ActivityBank/ActivityBank.tsx` (new handler, mirroring
  `handleUnarchive`'s structure)

### FRONTEND-027-AC-03 [AUTO]: Clicking the toggle on a favourited activity unmarks it
**Statement**: When the favourite-toggle button is clicked for an activity with `favourite: true`,
the `ActivityBank` component shall call `activityApi.unmarkFavourite(id)` and, on success, update
that activity's `favourite` to `false` in local state.

**References**: Service: `frontend/src/services/activityApi.ts` (new `unmarkFavourite`)

### FRONTEND-027-AC-04 [AUTO]: The Activity Bank list preserves backend-provided order
**Statement**: The `ActivityBank` component's existing category filter (`visibleActivities = (activities
?? []).filter(...)`) shall continue to use only `Array.prototype.filter`, introducing no client-side
`.sort()` — so the favourite-first order `GET /api/v1/activities` now returns
(`planner_spec_015`-AC-10/AC-11) flows through to the rendered list unchanged.

**Rationale**: Explicit regression guard pinning down a "don't do" — it would be easy to
accidentally add a sort when wiring up the new toggle's local-state update and inadvertently disturb
the order the backend already guarantees.

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx`
(`visibleActivities`)

### FRONTEND-027-AC-05 [MANUAL]: The favourite toggle doesn't visually clash with existing row content
**Statement**: In a real browser, the favourite-toggle button/icon shall render legibly alongside the
existing category chip, repeatable icon, and archived label on an activity row, with no visual
overlap or crowding.

**Rationale**: `[MANUAL]` — jsdom doesn't render CSS layout, consistent with this project's
established jsdom-can't-validate-CSS caveat (`.claude/steering/frontend_conventions.md`).

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.module.css`

## Requirement 2: AssignActivityPicker surfaces favourite status read-only

**User story**: As a user assigning an activity to a day/slot, I want to see at a glance which
activities are my favourites, so I can quickly spot the ones I use most without a separate toggle
getting in my way.

### FRONTEND-027-AC-06 [AUTO]: A favourited activity shows a read-only favourite indicator
**Statement**: Where an activity rendered in `AssignActivityPicker` has `favourite: true`, its row
shall render a `<FavouriteIcon />` alongside the existing `<CategoryChip>`/`<RepeatableIcon />`
badges — with no click handler, toggle button, or other interactive affordance attached to it.

**Rationale**: Read-only by design (see Overview's judgment call) — mirrors exactly how
`RepeatableIcon` already appears in this same component today.

**References**: Component: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx`
(activity row rendering, alongside the existing `activity.repeatable && <RepeatableIcon />`)

### FRONTEND-027-AC-07 [AUTO]: Sub-task rows never show a favourite indicator
**Statement**: `AssignActivityPicker` shall not render a `<FavouriteIcon />` on any sub-task row,
regardless of its parent activity's favourite status.

**Rationale**: Pins down `planner_spec_015`'s "Activities only, never sub-tasks" scope decision at
the UI layer — a sub-task has no `favourite` field on its own type at all, so this is really a
"don't accidentally read the parent's flag for a child row" guard.

**References**: Type: `frontend/src/types/subTask.ts` (`SubTask` — no `favourite` field)

### FRONTEND-027-AC-08 [AUTO]: The picker's activity list preserves backend-provided order
**Statement**: `AssignActivityPicker`'s existing filters (`visibleActivities = (activities ??
[]).filter(...)`) shall continue to use only `Array.prototype.filter`, introducing no client-side
`.sort()` — so the favourite-first order flows through unchanged here too.

**Rationale**: Same regression guard as `FRONTEND-027-AC-04`, for the second surface that fetches
from the same `GET /api/v1/activities` endpoint.

**References**: Component: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx`
(`visibleActivities`)

### FRONTEND-027-AC-09 [MANUAL]: The favourite indicator reads clearly at the picker's row density
**Statement**: In a real browser, the favourite indicator shall remain legible and distinct from the
category chip/repeatable icon within `AssignActivityPicker`'s denser row layout (smaller than
`ActivityBank`'s rows).

**Rationale**: `[MANUAL]` — same jsdom limitation as `FRONTEND-027-AC-05`, checked separately because
the picker's layout is meaningfully tighter than the Activity Bank's.

**References**: Component: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.module.css`

## Requirement 3: Activity Bank — an explicit "Favourites only" filter

**User story**: As a user with a long activity bank, I want to narrow the list down to just my
favourites with one click, so I don't have to scroll past non-favourites even though they're already
pinned below my favourites.

### FRONTEND-027-AC-10 [AUTO]: Activity Bank renders a "Favourites only" filter, unchecked by default
**Statement**: The `ActivityBank` component shall render a "Favourites only" checkbox filter,
unchecked by default, alongside the existing category filter and "Show archived" checkbox.

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx` (new
`favouriteFilter` state, new checkbox in `styles.toolbar`, mirroring the existing `showArchived`
checkbox)

### FRONTEND-027-AC-11 [AUTO]: Checking the filter hides non-favourited activities, composing with the existing category filter
**Statement**: While the "Favourites only" filter is checked, `ActivityBank`'s `visibleActivities`
shall include only activities with `favourite: true` — applied as an additional `AND` condition on
top of the existing category filter, not a replacement for it (an activity must satisfy both to
appear).

**Rationale**: Mirrors exactly how the existing repeatable filter composes with the category filter
in `AssignActivityPicker` today — each active filter narrows further, none of them reset or override
another.

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx`
(`visibleActivities`)

### FRONTEND-027-AC-12 [AUTO]: Unchecking the filter restores previously-hidden activities
**Statement**: When the "Favourites only" checkbox is unchecked after being checked, `ActivityBank`
shall restore all activities that satisfy the remaining active filters (i.e. the filter is purely a
view-state toggle over already-fetched data, not a re-fetch).

**References**: Component: `frontend/src/components/ActivityBank/ActivityBank.tsx`

## Requirement 4: AssignActivityPicker — an explicit "Favourites only" filter

**User story**: As a user assigning an activity while planning, I want to narrow the picker down to
just my favourites, so a long activity bank doesn't make finding a common one slower than it needs to
be.

### FRONTEND-027-AC-13 [AUTO]: AssignActivityPicker renders a "Favourites only" filter as a two-option pill group, "All" selected by default
**Statement**: `AssignActivityPicker` shall render a "Filter by favourite" fieldset containing a
two-option radio-pill group (`All` / `Favourites only`, `All` selected by default), styled identically
to the existing category and repeatable-type filter pills.

**Rationale**: **Amended 2026-10-02** (ID unchanged): originally a plain checkbox. Changed to a
two-option radio group — not a checkbox styled as a single pill — because `AssignActivityPicker.module.css`
has an existing, separately-tested architectural guard (`moduleStyles.test.ts`'s
`FRONTEND-007-AC-26`) forbidding the visually-hidden-input-plus-pill-label treatment on any
`input` type other than `radio`. A two-option radio group reuses that already-blessed idiom instead
of extending a forbidden one, and visually achieves exactly the "on/off pill" look the user asked for.
See Summary's "Post-implementation refinement".

**References**: Component: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` (new
`FavouriteFilter = 'ALL' | 'FAVOURITES_ONLY'` type and `FAVOURITE_FILTER_OPTIONS`, mirroring
`RepeatableFilter`/`REPEATABLE_FILTER_OPTIONS`'s shape), `moduleStyles.test.ts` (the guard this design
respects)

### FRONTEND-027-AC-14 [AUTO]: Selecting "Favourites only" hides non-favourited activities, composing with existing filters
**Statement**: While the favourite filter is set to `FAVOURITES_ONLY`, `AssignActivityPicker`'s
`visibleActivities` shall include only activities with `favourite: true` — applied as an additional
`AND` condition alongside the existing category and repeatable filters.

**References**: Component: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx`
(`visibleActivities`)

### FRONTEND-027-AC-15 [AUTO]: A shown favourited activity's sub-tasks are unaffected by the filter
**Statement**: While the favourite filter is set to `FAVOURITES_ONLY` and a favourited activity is
shown, all of that activity's sub-tasks (subject only to the existing category filter, unchanged)
shall still be rendered beneath it — the favourite filter operates at the activity level only, since
sub-tasks are never individually favouritable.

**Rationale**: Mirrors exactly how the existing repeatable filter already behaves — it's an
activity-level filter, and a shown activity's sub-tasks are never separately filtered by it either.

**References**: Component: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` (sub-task
rendering, unchanged)

### FRONTEND-027-AC-16 [AUTO]: Selecting "All" again restores previously-hidden activities
**Statement**: When the favourite filter is set back to `ALL` after being `FAVOURITES_ONLY`,
`AssignActivityPicker` shall restore all activities that satisfy the remaining active filters.

**References**: Component: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx`

## Requirement 5: Add/Edit Activity modal — a favourite toggle (added 2026-10-02)

**User story**: As a user adding or editing an activity, I want to mark it as a favourite right there
in the form, so I don't have to separately find it in the list afterward to star it.

### FRONTEND-027-AC-17 [AUTO]: ActivityForm renders a favourite toggle, prefilled from the activity
**Statement**: `ActivityForm` shall render a "Favourite" checkbox (with a `<FavouriteIcon
filled={favourite} />` reflecting its live state, mirroring the existing Repeatable field's shape),
initialized to `false` in create mode and to `activity.favourite` in edit mode.

**References**: Component: `frontend/src/components/ActivityBank/ActivityForm.tsx` (new `favourite`
state, new field below the existing Repeatable field)

### FRONTEND-027-AC-18 [AUTO]: Turning the toggle on calls markFavourite after create/update succeeds
**Statement**: When the form is submitted with the favourite toggle checked and the resulting
activity's current `favourite` is `false`, `ActivityForm` shall call `activityApi.markFavourite(id)`
immediately after the create/update call succeeds (using the newly created or just-updated activity's
id), and shall pass the resulting favourited activity to `onSuccess`.

**Rationale**: `favourite` is never part of `ActivityRequest` (`planner_spec_015`'s orthogonality
rule) — on create there is no id to call `markFavourite` with until creation succeeds, so this is
necessarily a second call sequenced after the first, not a single combined request.

**References**:
- Service: `frontend/src/services/activityApi.ts` (`markFavourite`)
- Component: `frontend/src/components/ActivityBank/ActivityForm.tsx` (`handleSubmit`)

### FRONTEND-027-AC-19 [AUTO]: Turning the toggle off calls unmarkFavourite after update succeeds
**Statement**: When the form is submitted in edit mode with the favourite toggle unchecked and the
activity's current `favourite` is `true`, `ActivityForm` shall call
`activityApi.unmarkFavourite(id)` immediately after the update call succeeds.

**References**: Service: `frontend/src/services/activityApi.ts` (`unmarkFavourite`)

### FRONTEND-027-AC-20 [AUTO]: An unchanged favourite state calls neither endpoint
**Statement**: When the form is submitted and the toggle's state matches the resulting activity's
current `favourite` value, `ActivityForm` shall call neither `markFavourite` nor `unmarkFavourite`.

**Rationale**: Avoids a redundant request on every ordinary edit that doesn't touch favourite status
— mirrors this project's general idempotence-conscious design (e.g. `planner_spec_015`-AC-04/AC-07's
idempotent mark/unmark endpoints), applied here at the call-site level too.

**References**: Component: `frontend/src/components/ActivityBank/ActivityForm.tsx` (`handleSubmit`)

## Explicitly out of scope (do not implement as part of this spec)

- Any toggle control inside `AssignActivityPicker` — favourite/unfavourite only happens in
  `ActivityBank`'s row toggle or its Add/Edit modal (`ActivityForm`, Requirement 5), see Overview's
  judgment call.
- A favourite indicator, toggle, or filter on sub-task rows anywhere — sub-tasks are never
  favouritable (`planner_spec_015`'s scope decision); the "Favourites only" filter in Requirement 4
  operates at the activity level only (`FRONTEND-027-AC-15`).
- A three-state favourite filter with an explicit "non-favourites only" state — either two states
  (`ActivityBank`'s checkbox, `AssignActivityPicker`'s `All`/`Favourites only` pill pair), never three
  (see Overview's judgment call).
- Any client-side re-sorting logic — both surfaces trust the backend's ordering entirely; the new
  filters narrow the list, they don't reorder it.
- The sidebar/drawer "assign an unplanned activity by dragging it onto the grid" idea — remains a
  separate, unspecced entry in `.claude/ideas/future_ideas.md`.

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/types/activity.ts` | `Activity` gains `favourite: boolean`; `ActivityInput` unchanged |
| `frontend/src/services/activityApi.ts` | New `markFavourite`/`unmarkFavourite`, mirroring `archive`/`unarchive` |
| `frontend/src/components/FavouriteIcon/FavouriteIcon.tsx` | Shared icon with `filled` prop (default `true`) — filled/outline toggle states plus the read-only badge use |
| `frontend/src/components/ActivityBank/ActivityBank.tsx` | Favourite-toggle icon button before each row's name; "Favourites only" filter checkbox; `.statusToggleGroup` flex wrapper (collision fix) |
| `frontend/src/components/ActivityBank/ActivityForm.tsx` | New favourite checkbox field (Requirement 5), applied via `markFavourite`/`unmarkFavourite` after create/update |
| `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` | Read-only favourite indicator on activity rows; "Favourites only" `All`/`Favourites only` radio-pill filter |
| `frontend/src/components/WeeklyPlanner/AssignActivityPicker.module.css` | `.scrollBody` padding/margin fix for the clipped leftmost-pill focus outline (unrelated cosmetic fix, same change) |
| `frontend/src/components/ActivityBank/ActivityForm.module.css` | The `.scrollBody` padding/margin pattern the `AssignActivityPicker` fix above copies |
| `frontend/src/components/RepeatableIcon/RepeatableIcon.tsx` | The read-only-badge pattern `FavouriteIcon` mirrors; the Repeatable form field `ActivityForm`'s new Favourite field mirrors |
| `frontend/src/components/WeeklyPlanner/moduleStyles.test.ts` | `FRONTEND-007-AC-26` — the existing guard that ruled out a checkbox-as-hidden-pill in `AssignActivityPicker.module.css` |
| `planner_spec_015_favourite_activities.md` | The backend endpoints/field/ordering this spec consumes |
| `.claude/ideas/future_ideas.md` | The sidebar/drawer entry this was split from — remains separate, unspecced |

## TDD test case sketches

### FRONTEND-027-AC-01 / AC-02 / AC-03
```typescript
describe('FRONTEND-027: Activity Bank favourite toggle', () => {
  it('AC-01: renders a favourite toggle reflecting favourite state via aria-pressed', () => {
    render(<ActivityBank />)
    // after activities load
    const toggle = screen.getByRole('button', { name: /favourite/i, pressed: false })
    expect(toggle).toBeInTheDocument()
  })

  it('AC-02: clicking an unfavourited toggle calls markFavourite and updates state', async () => {
    const markFavourite = vi.spyOn(activityApi, 'markFavourite').mockResolvedValue({ ...activity, favourite: true })
    render(<ActivityBank />)
    await userEvent.click(screen.getByRole('button', { name: /favourite/i, pressed: false }))
    expect(markFavourite).toHaveBeenCalledWith(activity.id)
    expect(await screen.findByRole('button', { name: /favourite/i, pressed: true })).toBeInTheDocument()
  })

  it('AC-03: clicking a favourited toggle calls unmarkFavourite and updates state', async () => {
    const unmarkFavourite = vi.spyOn(activityApi, 'unmarkFavourite').mockResolvedValue(undefined)
    render(<ActivityBank />) // seeded with a favourited activity
    await userEvent.click(screen.getByRole('button', { name: /favourite/i, pressed: true }))
    expect(unmarkFavourite).toHaveBeenCalledWith(favouritedActivity.id)
    expect(await screen.findByRole('button', { name: /favourite/i, pressed: false })).toBeInTheDocument()
  })
})
```

### FRONTEND-027-AC-04
```typescript
describe('FRONTEND-027-AC-04: Activity Bank preserves backend order', () => {
  it('renders activities in the exact order activityApi.getAll returns, category filter applied', () => {
    vi.spyOn(activityApi, 'getAll').mockResolvedValue([zebraFavourite, appleActivity, mangoActivity])
    render(<ActivityBank />)
    const names = screen.getAllByRole('listitem').map((row) => row.textContent)
    expect(names[0]).toContain('Zebra')
  })
})
```

### FRONTEND-027-AC-06 / AC-07 / AC-08
```typescript
describe('FRONTEND-027: AssignActivityPicker favourite indicator', () => {
  it('AC-06: shows a read-only FavouriteIcon for a favourited activity, no click handler', () => {
    render(<AssignActivityPicker {...propsWithFavouritedActivity} />)
    const icon = screen.getByRole('img', { name: 'Favourite' })
    expect(icon.closest('button')).toBeNull()
  })

  it('AC-07: never renders a FavouriteIcon on a sub-task row', () => {
    render(<AssignActivityPicker {...propsWithFavouritedActivityAndSubTasks} />)
    const subTaskRow = screen.getByText(subTask.name).closest('li')!
    expect(within(subTaskRow).queryByRole('img', { name: 'Favourite' })).toBeNull()
  })

  it('AC-08: preserves backend-provided order through its filters', () => {
    vi.spyOn(activityApi, 'getAll').mockResolvedValue([zebraFavourite, appleActivity])
    render(<AssignActivityPicker {...baseProps} />)
    const buttons = screen.getAllByRole('button', { name: /Zebra|Apple/ })
    expect(buttons[0]).toHaveTextContent('Zebra')
  })
})
```

### FRONTEND-027-AC-10 / AC-11 / AC-12
```typescript
describe('FRONTEND-027: Activity Bank "Favourites only" filter', () => {
  it('AC-10: renders unchecked by default', () => {
    render(<ActivityBank />)
    expect(screen.getByRole('checkbox', { name: /favourites only/i })).not.toBeChecked()
  })

  it('AC-11: checking it hides non-favourites, composes with the category filter', async () => {
    vi.spyOn(activityApi, 'getAll').mockResolvedValue([favouritedRoutine, nonFavouritedRoutine, favouritedPleasurable])
    render(<ActivityBank />)
    await userEvent.click(screen.getByRole('checkbox', { name: /favourites only/i }))
    await userEvent.click(screen.getByRole('radio', { name: 'Routine' }))
    expect(screen.getByText(favouritedRoutine.name)).toBeInTheDocument()
    expect(screen.queryByText(nonFavouritedRoutine.name)).not.toBeInTheDocument()
    expect(screen.queryByText(favouritedPleasurable.name)).not.toBeInTheDocument()
  })

  it('AC-12: unchecking restores previously-hidden activities', async () => {
    vi.spyOn(activityApi, 'getAll').mockResolvedValue([favouritedActivity, nonFavouritedActivity])
    render(<ActivityBank />)
    const checkbox = screen.getByRole('checkbox', { name: /favourites only/i })
    await userEvent.click(checkbox)
    await userEvent.click(checkbox)
    expect(screen.getByText(nonFavouritedActivity.name)).toBeInTheDocument()
  })
})
```

### FRONTEND-027-AC-13 / AC-14 / AC-15 / AC-16
```typescript
describe('FRONTEND-027: AssignActivityPicker "Favourites only" filter', () => {
  it('AC-13: renders a two-option pill group with All selected by default', () => {
    render(<AssignActivityPicker {...baseProps} />)
    const group = screen.getByRole('group', { name: 'Filter by favourite' })
    expect(within(group).getByRole('radio', { name: 'All' })).toBeChecked()
    expect(within(group).getByRole('radio', { name: 'Favourites only' })).not.toBeChecked()
  })

  it('AC-14: selecting Favourites only hides non-favourited activities', async () => {
    render(<AssignActivityPicker {...propsWithMixedFavourites} />)
    const group = screen.getByRole('group', { name: 'Filter by favourite' })
    await userEvent.click(within(group).getByRole('radio', { name: 'Favourites only' }))
    expect(screen.getByText(favouritedActivity.name)).toBeInTheDocument()
    expect(screen.queryByText(nonFavouritedActivity.name)).not.toBeInTheDocument()
  })

  it('AC-15: a shown favourited activity\'s sub-tasks are still rendered', async () => {
    render(<AssignActivityPicker {...propsWithFavouritedActivityAndSubTasks} />)
    const group = screen.getByRole('group', { name: 'Filter by favourite' })
    await userEvent.click(within(group).getByRole('radio', { name: 'Favourites only' }))
    expect(screen.getByText(subTask.name)).toBeInTheDocument()
  })

  it('AC-16: selecting All again restores previously-hidden activities', async () => {
    render(<AssignActivityPicker {...propsWithMixedFavourites} />)
    const group = screen.getByRole('group', { name: 'Filter by favourite' })
    await userEvent.click(within(group).getByRole('radio', { name: 'Favourites only' }))
    await userEvent.click(within(group).getByRole('radio', { name: 'All' }))
    expect(screen.getByText(nonFavouritedActivity.name)).toBeInTheDocument()
  })
})
```

### FRONTEND-027-AC-17 / AC-18 / AC-19 / AC-20
```typescript
describe('FRONTEND-027: ActivityForm favourite toggle', () => {
  it('AC-17: prefilled from activity.favourite in edit mode, false on create', () => {
    render(<ActivityForm mode="edit" activity={{ ...walk, favourite: true }} onSuccess={vi.fn()} />)
    expect(screen.getByLabelText(/^favourite$/i, { selector: 'input' })).toBeChecked()
  })

  it('AC-18: turning it on calls markFavourite after create succeeds', async () => {
    vi.mocked(activityApi.create).mockResolvedValue({ ...walk, favourite: false })
    vi.mocked(activityApi.markFavourite).mockResolvedValue({ ...walk, favourite: true })
    render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
    // ...fill required fields...
    await userEvent.click(screen.getByLabelText(/^favourite$/i, { selector: 'input' }))
    await userEvent.click(screen.getByRole('button', { name: /save activity/i }))
    await waitFor(() => expect(activityApi.markFavourite).toHaveBeenCalledWith('1'))
  })

  it('AC-19: turning it off calls unmarkFavourite after update succeeds', async () => {
    vi.mocked(activityApi.update).mockResolvedValue({ ...walk, favourite: true })
    render(<ActivityForm mode="edit" activity={{ ...walk, favourite: true }} onSuccess={vi.fn()} />)
    await userEvent.click(screen.getByLabelText(/^favourite$/i, { selector: 'input' }))
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(activityApi.unmarkFavourite).toHaveBeenCalledWith('1'))
  })

  it('AC-20: an unchanged favourite state calls neither endpoint', async () => {
    vi.mocked(activityApi.update).mockResolvedValue({ ...walk, favourite: true })
    render(<ActivityForm mode="edit" activity={{ ...walk, favourite: true }} onSuccess={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(activityApi.update).toHaveBeenCalled())
    expect(activityApi.markFavourite).not.toHaveBeenCalled()
    expect(activityApi.unmarkFavourite).not.toHaveBeenCalled()
  })
})
```

## Acceptance Criteria Summary

- [x] FRONTEND-027-AC-01 — each activity row has a favourite-toggle icon button before its name
- [x] FRONTEND-027-AC-02 — clicking an unfavourited toggle marks it favourite
- [x] FRONTEND-027-AC-03 — clicking a favourited toggle unmarks it
- [x] FRONTEND-027-AC-04 — Activity Bank list preserves backend-provided order
- [x] FRONTEND-027-AC-05 — favourite toggle doesn't visually clash with existing row content (confirmed in a real browser)
- [x] FRONTEND-027-AC-06 — a favourited activity shows a read-only favourite indicator in the picker
- [x] FRONTEND-027-AC-07 — sub-task rows never show a favourite indicator
- [x] FRONTEND-027-AC-08 — the picker's activity list preserves backend-provided order
- [x] FRONTEND-027-AC-09 — favourite indicator reads clearly at the picker's row density (confirmed in a real browser)
- [x] FRONTEND-027-AC-10 — Activity Bank renders a "Favourites only" filter, unchecked by default
- [x] FRONTEND-027-AC-11 — checking it hides non-favourites, composes with the category filter
- [x] FRONTEND-027-AC-12 — unchecking it restores previously-hidden activities
- [x] FRONTEND-027-AC-13 — AssignActivityPicker renders a "Favourites only" All/pill filter, "All" selected by default
- [x] FRONTEND-027-AC-14 — selecting "Favourites only" hides non-favourited activities, composes with existing filters
- [x] FRONTEND-027-AC-15 — a shown favourited activity's sub-tasks are unaffected by the filter
- [x] FRONTEND-027-AC-16 — selecting "All" again restores previously-hidden activities
- [x] FRONTEND-027-AC-17 — ActivityForm renders a favourite toggle, prefilled from the activity
- [x] FRONTEND-027-AC-18 — turning the toggle on calls markFavourite after create/update succeeds
- [x] FRONTEND-027-AC-19 — turning the toggle off calls unmarkFavourite after update succeeds
- [x] FRONTEND-027-AC-20 — an unchanged favourite state calls neither endpoint
