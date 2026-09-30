# Visual Refresh — "Quiet Room" Design System (Frontend)

**Status**: Implemented — all 32 ACs verified, including AC-32. AC-32 (the closing `[MANUAL]`
real-browser pass) completed 2026-09-29 across Light and Dark themes on Login, Activity Bank
(incl. nested sub-task row), Weekly Planner (grid, occurrence actions, weekend bucket), and
Settings (incl. category colour swatches). Confirmed: warm sage palette renders correctly in both
themes (not the old purple), pill buttons/chips with soft shadow throughout, hairline-bordered flat
rows/cells (no card shadows on content panels), uppercase/mono day-of-week labels, centered
layout shell, and a visible `:focus-visible` outline on keyboard Tab. One minor, non-blocking
observation: in the weekly grid's narrower day columns, the vertically-stacked action buttons
(Move/Move to bucket/Remove/Complete) on an occurrence take up a fair amount of vertical space at
full pill width — functional and consistent with the approved uniform-button design, not a defect,
but worth keeping in mind for a future density pass if it ever feels cramped in practice.
**Priority**: P2 — visual/UX polish on top of the fully-delivered V1 feature set; doesn't block V2
backend work, but the app currently reads as unstyled/dated and this is the approved fix.
**Depends on**: `frontend_spec_001_login.md` (restyles `LoginPage`), `frontend_spec_002_activity_bank.md`
(restyles `ActivityBank`, `ActivityForm`, `CategoryPicker`), `frontend_spec_003_sub_tasks.md`
(restyles `SubTaskList`, `SubTaskForm`), `frontend_spec_004_week_planning.md` (restyles
`PlannerGrid`, `BucketList`, `OccurrenceItem`, `AssignActivityPicker`), `frontend_spec_005_navigation_and_theme.md`
(restyles `TabNav`, `Settings`, `CategoryChip`, and owns the `theme.css`/CSS-Modules architecture this
spec's token changes build directly on top of). No paired backend spec — this is frontend-only, pure
CSS/JSX styling with zero API/data-shape changes.
**Area**: Frontend
**Roadmap version**: V1 (cross-cutting visual polish on top of the already-delivered V1 feature set —
same framing as `frontend_spec_005_navigation_and_theme.md` — not a new V1 user story of its own, no
V2+ scope pulled forward)

## Overview

Replaces the app's current default/dated look (cool grey-purple palette, zero button/input styling,
full-viewport-width content) with the approved "Quiet Room" hybrid direction, explored and confirmed
against an HTML mockup outside this repo: **Quiet Room** as the base palette (warm off-white/sage,
hairline dividers, no shadows on content rows/panels) + **Clear Structure** typography (system-sans,
tighter tracking, tabular numerals, a monospace touch on day labels) + **Soft Focus** button/chip
shapes (fully-rounded pill buttons with a soft shadow, moderate-radius inputs). This is a pure
visual/CSS pass — no component's data flow, props, state, or business logic changes, and no backend
endpoint is touched. It isn't tied to a specific numbered user story in `.claude/HIGH_LEVEL_DESIGN.md`
(same as `frontend_spec_005`) — it's cross-cutting UX polish in service of `product.md`'s "calm,
non-gamified UI" goal, closing a real, verified gap: today almost every button, text input, textarea,
select, and radio in the app renders with zero styling (bare browser chrome), and `theme.css`'s
existing tokens are the scaffold-era placeholder palette, not a deliberately chosen one.

**Out of scope**:
- **Primary/secondary button visual hierarchy.** Every button in this pass gets the identical pill+
  shadow treatment (Requirement 3). The current codebase has zero `className` on any button anywhere;
  introducing a primary/secondary distinction would mean touching every component's JSX to add a
  variant class, which is a separate, larger piece of work than "modernize the look." A uniform
  treatment is achievable as pure CSS with no JSX changes to button call sites, which is what's
  actually specced here. A future spec can layer variants on top once there's a concrete need.
- **Any change to category chip colours**, or to the colour-customization feature itself
  (`frontend_spec_005_navigation_and_theme.md`'s `Settings` colour pickers, `frontend_spec_006_repeatable_activities.md`'s
  usage of the same `input[type="color"]` pattern). Category tokens (`--category-routine`/
  `--category-necessary`/`--category-pleasurable`) are explicitly unchanged — still user-customizable,
  still defaulting to the Okabe–Ito values.
- **Any animation/motion beyond a simple hover-shadow transition on buttons**, itself gated behind
  `@media (prefers-reduced-motion: no-preference)`. No page-load sequences, no scroll effects.
- **Mobile/responsive breakpoint work** beyond what already exists (`index.css`'s existing
  `@media (max-width: 1024px)` font-size step). A full responsive pass is a separate future concern.
- **`ActivityForm.tsx`, `CategoryPicker.tsx`, and `SubTaskForm.tsx` do not get a dedicated
  `.module.css` in this pass.** They render only native `<input>`/`<textarea>`/`<select>`/`<button>`/
  `<fieldset>` elements with no bespoke layout beyond a plain `<div>` per field, so they inherit
  Requirement 3's global element base styles automatically with no component-specific work needed.
  If a future pass wants dedicated field-grouping/spacing for these forms, that's a separate, later
  change, not silently bundled into "modernize the look."
- **Any backend change of any kind** — no new endpoint, no `dto/` shape, nothing on `User`. Same
  deliberate deviation from the usual "all backend calls through `services/`" framing as
  `frontend_spec_005`, because this spec makes zero backend calls, full stop.

## A note on how the [AUTO] ACs below are actually verified

This project's `vitest.config.ts` doesn't set `test.css: true`, and jsdom's CSS engine doesn't
reliably resolve `var(--token)`-based computed styles even when CSS injection is enabled — this
design is built almost entirely on custom properties, so a naive `getComputedStyle(el).borderRadius`-
style assertion would not be a trustworthy foundation here (confirmed by checking: no test in this
codebase today asserts a real stylesheet-derived computed style — `CategoryChip.test.tsx`'s
`toHaveStyle` calls only check *inline* `style={{...}}` props, which is a different mechanism). Given
that, `[AUTO]` verification in this spec uses two concrete, reliable mechanisms instead:
1. **CSS Module class assertions** (`toHaveClass(styles.foo)` / `closest('.foo')`) — Vite's CSS
   Modules transform generates the real hashed class-name mapping regardless of whether the
   underlying rules are injected into jsdom, so this reliably verifies a component's JSX is wired to
   the right class.
2. **Source-file content assertions** (`readFileSync` + substring/regex match against the actual
   `.css`/`.module.css` file) — verifies the CSS declaration itself was actually written as specified.

Together these verify "the right class is applied" and "the right rule exists," which is everything
that's actually testable without a real browser. Genuine rendered-appearance judgement (perceived
contrast, shadow softness, whether the whole thing "reads as calm") is `[MANUAL]`, per AC-32 below —
this is a deliberate, flagged deviation from this spec's originating brief, which suggested
`getComputedStyle` directly; that approach doesn't hold up against this project's actual test config.

## Requirements

### Requirement 1 — Design tokens

As a user, I want the app's colour palette to read as calm and warm rather than the current cool
grey-purple scaffold palette, so the interface matches the approved "Quiet Room" direction.

- **FRONTEND-007-AC-01** [AUTO]: `theme.css`'s `:root` block and its `[data-theme='light']` override
  block shall together define the Light-theme custom properties as `--text: #706c64`,
  `--text-h: #2b2a28`, `--bg: #faf8f5`, `--border: #e4dfd7`, `--code-bg: #f2efe9`,
  `--accent: #5f7a5e`, `--accent-bg: rgba(95, 122, 94, 0.12)`, `--accent-border: rgba(95, 122, 94, 0.45)`,
  and `--shadow: rgba(43, 42, 40, 0.07) 0 1px 2px, rgba(43, 42, 40, 0.22) 0 4px 10px -6px`, replacing
  their current purple-tinted values, with the two blocks kept identical to each other.
- **FRONTEND-007-AC-02** [AUTO]: `theme.css`'s `@media (prefers-color-scheme: dark)` block and its
  `[data-theme='dark']` override block shall together define the Dark-theme custom properties as
  `--text: #b3ac9f`, `--text-h: #f1ede6`, `--bg: #211f1c`, `--border: #3c3833`, `--code-bg: #2f2c27`,
  `--accent: #93b28e`, `--accent-bg: rgba(147, 178, 142, 0.15)`, `--accent-border: rgba(147, 178, 142, 0.5)`,
  and `--shadow: rgba(0, 0, 0, 0.35) 0 1px 2px, rgba(0, 0, 0, 0.5) 0 4px 10px -6px`, replacing their
  current purple-tinted values, with the two blocks kept identical to each other.
- **FRONTEND-007-AC-03** [AUTO]: `theme.css` shall define a new `--surface` custom property in all
  four blocks (`:root` → `#ffffff`, `@media (prefers-color-scheme: dark)` → `#2a2825`,
  `[data-theme='light']` → `#ffffff`, `[data-theme='dark']` → `#2a2825`), distinct from `--bg`, for
  panels/cards/inputs to sit on while the page itself sits on `--bg`.
- **FRONTEND-007-AC-04** [AUTO]: `theme.css` shall retain the pre-existing `--category-routine`
  (`#0072b2`), `--category-necessary` (`#e69f00`), and `--category-pleasurable` (`#009e73`) values
  unchanged across all four blocks — this spec makes no change to category colours (see Out of
  scope).

### Requirement 2 — Typography

As a user, I want tighter, more deliberate typography — bold balanced headings, aligned numerals, a
distinct monospace touch on day labels — so the app reads as considered rather than default browser
styling.

- **FRONTEND-007-AC-05** [AUTO]: `index.css`'s `--sans` and `--heading` custom properties shall equal
  `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (adding `-apple-system`, verified absent
  from the current stack).
- **FRONTEND-007-AC-06** [AUTO]: `index.css`'s `h1, h2` rule shall set `font-weight: 700` (currently
  `500`) and `letter-spacing: -0.01em`.
- **FRONTEND-007-AC-07** [AUTO]: `index.css`'s `h1, h2` rule shall additionally set
  `text-wrap: balance`.
- **FRONTEND-007-AC-08** [AUTO]: `index.css` shall apply `font-variant-numeric: tabular-nums`
  globally (on `:root` or `body`), so dates, counts, and day labels use fixed-width numerals.
- **FRONTEND-007-AC-09** [AUTO]: `PlannerGrid`'s day-of-week heading (currently a bare
  `<h4>{DAY_LABELS[day]}</h4>`) shall render with a new `PlannerGrid.module.css` `dayLabel` class
  applying `font-family: var(--mono)`, `text-transform: uppercase`, `letter-spacing: 0.06em`, and
  `font-size: 0.72rem`.

### Requirement 3 — Global button/input/radio base styles

As a user, I want every button, text field, and radio control to have a deliberate, consistent
appearance instead of unstyled browser chrome, so the app looks and feels like one considered
product rather than a scaffold.

- **FRONTEND-007-AC-10** [AUTO]: `index.css` shall add a global `button` rule setting
  `border-radius: 999px`, `background: var(--surface)`, `border: none`,
  `box-shadow: var(--shadow)` (reusing the existing token — no new shadow custom property is
  introduced), `padding: 0.4rem 0.85rem`, `font: inherit` at `0.8rem`/`600` weight,
  `color: var(--text-h)`, and `cursor: pointer`.
- **FRONTEND-007-AC-11** [AUTO]: The global `button` rule's `:hover` state shall apply a subtly
  stronger shadow and/or background shift, with the transition itself declared only inside
  `@media (prefers-reduced-motion: no-preference)`.
- **FRONTEND-007-AC-12** [AUTO]: The global `button` rule's `:focus-visible` state shall set
  `outline: 2px solid var(--accent)` and `outline-offset: 2px`.
- **FRONTEND-007-AC-13** [AUTO]: Where any button renders anywhere in the app (Edit, Delete, Add
  activity, Log in, Confirm move, etc.), it shall receive the identical global pill+shadow treatment
  from AC-10–AC-12, with no component-level `.module.css` defining a competing `button`-element
  selector or a primary/secondary button class — a deliberate, uniform treatment (see Out of scope).
- **FRONTEND-007-AC-14** [AUTO]: `index.css` shall add a global rule for
  `input[type="text"], textarea, select` setting `border: 1px solid var(--border)`,
  `border-radius: 6px` (deliberately not the full pill radius buttons get — fields read as fields,
  not actions), `padding: 0.45rem 0.65rem`, `background: var(--surface)`, `color: var(--text-h)`,
  and `font: inherit`.
- **FRONTEND-007-AC-15** [AUTO]: `index.css` shall add a dedicated `input[type="color"]` rule
  (distinct from AC-14's text-field rule), sizing it as a small swatch trigger —
  `width: 2.5rem`, `height: 2.5rem`, `padding: 0`, `border: 1px solid var(--border)`,
  `border-radius: 6px`, `cursor: pointer` — since no such sizing exists anywhere in the codebase
  today (verified: `Settings.module.css` has no `input[type="color"]` rule at all).
- **FRONTEND-007-AC-16** [AUTO]: `index.css` shall add a global `input[type="radio"]` rule setting
  `accent-color: var(--accent)` only — no custom radio component is built.

### Requirement 4 — Layout shell

As a user, I want the app's content constrained to a readable, centred column instead of running
edge-to-edge, so long lines of text and the weekly grid don't feel unmoored on a wide screen.

- **FRONTEND-007-AC-17** [AUTO]: A new `App.module.css` shall define a layout-shell class with
  `max-width: 52rem`, `margin: 0 auto`, and `padding: 2.5rem 1.75rem 5rem`, applied to `App.tsx`'s
  authenticated-view wrapper (which also carries `data-testid="app-shell"` for test convenience).
- **FRONTEND-007-AC-18** [AUTO]: While navigating between tabs, the layout-shell wrapper shall
  remain the single outer container for the header, `TabNav`, and the routed content together — not
  reapplied or duplicated per-route.

### Requirement 5 — Activity Bank + sub-tasks restyle

As a user, I want my activity list and its sub-tasks to read as a clean, calm list rather than
default bullet points, so scanning them feels quiet, not cluttered.

- **FRONTEND-007-AC-19** [AUTO]: A new `ActivityBank.module.css` shall style each activity `<li>`
  with a bottom hairline (`border-bottom: 1px solid var(--border)`), `padding: 0.85rem 0`, and a
  flex layout — no background colour and no `box-shadow` on the row itself (only buttons carry a
  shadow, per Requirement 3).
- **FRONTEND-007-AC-20** [AUTO]: Within each activity row, the action buttons (Edit/Delete/Show
  sub-tasks, or Confirm delete/Cancel) shall be right-aligned via `margin-left: auto` on their
  wrapping element, with the activity name and `CategoryChip` remaining left-aligned.
- **FRONTEND-007-AC-21** [AUTO]: A new `SubTaskList.module.css` shall apply the equivalent
  hairline-row treatment (AC-19's bottom border, padding, flex layout, no shadow) to each sub-task
  `<li>`.
- **FRONTEND-007-AC-22** [AUTO]: Each sub-task row shall additionally receive
  `background: var(--code-bg)`, a small `border-radius` (~4px), and left indentation, visually
  distinguishing it as nested under its parent activity.

### Requirement 6 — Weekly Planner restyle

As a user, I want the weekly grid, bucket list, occurrence rows, and assignment picker to share the
same calm, flat visual language as the rest of the app, so the planner doesn't look like a separate,
unstyled section.

- **FRONTEND-007-AC-23** [AUTO]: A new `PlannerGrid.module.css` shall style each day/slot cell with
  `background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: 6px`, and no
  `box-shadow` — flat, matching the Activity Bank rows' no-shadow treatment.
- **FRONTEND-007-AC-24** [AUTO]: A new `BucketList.module.css` shall apply the same flat panel
  treatment as AC-23 (`background: var(--surface)`, `border: 1px solid var(--border)`,
  `border-radius: 6px`, no shadow) to the bucket list's own `<section>` wrapper.
- **FRONTEND-007-AC-25** [AUTO]: A new `OccurrenceItem.module.css` shall apply the same hairline-row
  treatment as `ActivityBank`'s rows (AC-19) to each occurrence `<li>`, applied identically whether
  the item is rendered inside a `PlannerGrid` cell or inside `BucketList` — the row's own styling
  does not vary by the `isBucketItem` prop.
- **FRONTEND-007-AC-26** [AUTO]: A new `AssignActivityPicker.module.css` shall apply the same flat
  panel treatment as AC-23/AC-24 to its activity/sub-task selection list, and shall define no
  component-level `button`/`input` selector of its own — its buttons and inputs rely entirely on the
  global base styles from Requirement 3. **Narrowed by `frontend_spec_009_add_picker_modal.md`'s
  Requirement 9 amendment (2026-09-30)**: a visually-hidden `input[type="radio"]` behind a
  pill-styled `<label>` (the same segmented-control idiom `Settings.module.css`'s `.themeList` uses)
  is now permitted, since it carries no bespoke *visible* style — every other `input[type=...]` is
  still forbidden.

### Requirement 7 — Login page restyle

As a user, I want the login page to already look like the redesigned app, so the very first screen I
see doesn't feel inconsistent with everything after it.

- **FRONTEND-007-AC-27** [AUTO]: A new `LoginPage.module.css` shall apply the same layout-shell
  centering as AC-17 (or an equivalent narrower single-column variant appropriate to a login form) to
  `LoginPage`'s content.
- **FRONTEND-007-AC-28** [AUTO]: `LoginPage`'s form fields and submit button shall render using the
  global input/button base styles from Requirement 3, with `LoginPage.module.css` defining no
  bespoke `button`/`input[type=...]` override.

### Requirement 8 — Existing component token alignment

As a user, I want the navigation tabs, settings page, and category chips — which already work
structurally — to visually match the rest of the redesign, so no part of the app looks like it was
missed.

- **FRONTEND-007-AC-29** [AUTO]: `CategoryChip.module.css`'s `.chip` rule shall be updated to
  `font-size: 0.72rem`, `font-weight: 700`, and `padding: 0.18rem 0.65rem` (from its current
  `0.85em`/`500`/`2px 10px`), matching the new type scale — its `border-radius: 999px` is unchanged
  (already correct, verified).
- **FRONTEND-007-AC-30** [AUTO]: `TabNav.module.css` shall continue to reference only `var(--*)`
  custom properties (verified already true today, no hardcoded hex colour values) — no structural
  change is required under the new token values.
- **FRONTEND-007-AC-31** [AUTO]: `Settings.module.css` shall continue to reference only `var(--*)`
  custom properties (verified already true today, no hardcoded hex colour values) — no structural
  change is required under the new token values.
- **FRONTEND-007-AC-32** [MANUAL]: Verified by manual review in a real browser (Light, Dark, and
  System, per `frontend_spec_005_navigation_and_theme.md`'s theme switcher), across Activities,
  Weekly Planner, Settings, and the Login page: the redesigned interface reads as calm and
  uncluttered per `product.md`'s "calm, non-gamified UI" goal, text remains legible against
  `--surface`/`--bg` in both themes, and no layout regression (overlapping content, broken wrapping,
  a button/input rendering unstyled) is introduced by the new pill buttons, hairline rows, or layout
  shell — required per this project's Definition of Done ("verified in a real browser, not just
  Vitest," since jsdom doesn't render CSS).

## New and changed files

**New `.module.css` files** (none of these components have one today):
- `frontend/src/App.module.css`
- `frontend/src/components/LoginPage.module.css`
- `frontend/src/components/ActivityBank/ActivityBank.module.css`
- `frontend/src/components/ActivityBank/SubTaskList.module.css`
- `frontend/src/components/WeeklyPlanner/PlannerGrid.module.css`
- `frontend/src/components/WeeklyPlanner/BucketList.module.css`
- `frontend/src/components/WeeklyPlanner/OccurrenceItem.module.css`
- `frontend/src/components/WeeklyPlanner/AssignActivityPicker.module.css`

**Changed, values/tokens only** (already have a `.module.css`, structure unchanged):
- `frontend/src/components/CategoryChip/CategoryChip.module.css` (AC-29)
- `frontend/src/components/Navigation/TabNav.module.css` (AC-30, verify-only, likely no diff)
- `frontend/src/components/Settings/Settings.module.css` (AC-31, verify-only, likely no diff)

**Changed, global stylesheets**:
- `frontend/src/theme.css` (Requirement 1)
- `frontend/src/index.css` (Requirements 2 and 3)

**Changed, JSX wiring only** (apply new classes, no logic/prop changes):
- `frontend/src/App.tsx`, `frontend/src/components/LoginPage.tsx`,
  `frontend/src/components/ActivityBank/ActivityBank.tsx`,
  `frontend/src/components/ActivityBank/SubTaskList.tsx`,
  `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx`,
  `frontend/src/components/WeeklyPlanner/BucketList.tsx`,
  `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx`,
  `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx`

**Not touched at all**: `ActivityForm.tsx`, `CategoryPicker.tsx`, `SubTaskForm.tsx`,
`WeeklyPlanner.tsx` (its own markup is a plain `<section>` + Previous/Next week buttons, which
already inherit Requirement 3's global button styles with no wrapper changes needed), and every
`types/`/`services/`/`utils/` file — this is a styling-only pass.

## Cross-references

| This spec | Contracts against |
|---|---|
| `theme.css` token values | Superseding, not restructuring, `frontend_spec_005_navigation_and_theme.md`'s token architecture (`:root`/media-query/`[data-theme]` blocks) — same custom-property names, new values, plus one new name (`--surface`) |
| `index.css` global element rules | New territory — no prior spec touched button/input/textarea/select/radio styling; `frontend_conventions.md`'s Styling section already documents `index.css` as the one deliberate non-module exception to "styles live in a component's own `.module.css`" |
| `ActivityBank.module.css`, `SubTaskList.module.css` | `ActivityBank`/`SubTaskList` components from `frontend_spec_002_activity_bank.md`/`frontend_spec_003_sub_tasks.md` — JSX/props/data flow unchanged, styling only |
| `PlannerGrid.module.css`, `BucketList.module.css`, `OccurrenceItem.module.css`, `AssignActivityPicker.module.css` | `WeeklyPlanner` subtree from `frontend_spec_004_week_planning.md` — JSX/props/data flow unchanged, styling only |
| `LoginPage.module.css` | `LoginPage` from `frontend_spec_001_login.md` — JSX/props/data flow unchanged, styling only |
| `CategoryChip.module.css`, `TabNav.module.css`, `Settings.module.css` | Existing components from `frontend_spec_005_navigation_and_theme.md` — values-only alignment, no structural change |
| No new `services/*Api.ts`, no new `types/` shape | This spec makes zero backend calls and introduces no new data shape |

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
// frontend/src/theme.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const themeCss = readFileSync(resolve(__dirname, './theme.css'), 'utf-8')

function block(source: string, selector: string): string {
  const start = source.indexOf(selector)
  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  return source.slice(open + 1, close)
}

describe('FRONTEND-007-AC-01: light theme tokens', () => {
  it('defines the Quiet Room light values identically in :root and [data-theme="light"]', () => {
    for (const b of [block(themeCss, ':root'), block(themeCss, "[data-theme='light']")]) {
      expect(b).toContain('--text: #706c64')
      expect(b).toContain('--bg: #faf8f5')
      expect(b).toContain('--accent: #5f7a5e')
    }
    expect(themeCss).not.toContain('#aa3bff')
  })
})

describe('FRONTEND-007-AC-02: dark theme tokens', () => {
  it('defines the Quiet Room dark values, no leftover purple accent', () => {
    expect(themeCss).toContain('--text: #b3ac9f')
    expect(themeCss).toContain('--bg: #211f1c')
    expect(themeCss).toContain('--accent: #93b28e')
    expect(themeCss).not.toContain('#c084fc')
  })
})

describe('FRONTEND-007-AC-03: --surface token added to all four blocks', () => {
  it('defines --surface distinct from --bg everywhere', () => {
    expect(block(themeCss, ':root')).toContain('--surface: #ffffff')
    expect(themeCss).toContain('--surface: #2a2825')
  })
})

describe('FRONTEND-007-AC-04: category tokens unchanged', () => {
  it('still defines the Okabe-Ito defaults untouched', () => {
    expect(themeCss).toContain('--category-routine: #0072b2')
    expect(themeCss).toContain('--category-necessary: #e69f00')
    expect(themeCss).toContain('--category-pleasurable: #009e73')
  })
})
```

```typescript
// frontend/src/index.css.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const indexCss = readFileSync(resolve(__dirname, './index.css'), 'utf-8')

describe('FRONTEND-007-AC-05: sans/heading font stack updated', () => {
  it('includes -apple-system in --sans and --heading', () => {
    expect(indexCss).toMatch(/--sans:\s*system-ui,\s*-apple-system,\s*"Segoe UI",\s*Roboto,\s*sans-serif/)
    expect(indexCss).toMatch(/--heading:\s*system-ui,\s*-apple-system,\s*"Segoe UI",\s*Roboto,\s*sans-serif/)
  })
})

describe('FRONTEND-007-AC-06/AC-07: heading weight, tracking, balance', () => {
  it('sets bold, tighter, balanced headings', () => {
    expect(indexCss).toContain('font-weight: 700')
    expect(indexCss).toContain('letter-spacing: -0.01em')
    expect(indexCss).toContain('text-wrap: balance')
  })
})

describe('FRONTEND-007-AC-08: tabular numerals globally', () => {
  it('applies font-variant-numeric: tabular-nums', () => {
    expect(indexCss).toContain('font-variant-numeric: tabular-nums')
  })
})

describe('FRONTEND-007-AC-10/AC-11/AC-12: global button base styles', () => {
  it('defines the pill button rule reusing the shared shadow token', () => {
    expect(indexCss).toMatch(/button\s*\{[^}]*border-radius:\s*999px/s)
    expect(indexCss).toMatch(/button\s*\{[^}]*box-shadow:\s*var\(--shadow\)/s)
  })

  it('gates the hover transition behind prefers-reduced-motion', () => {
    expect(indexCss).toMatch(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*button:hover/)
  })

  it('sets a visible focus-visible outline using the accent token', () => {
    expect(indexCss).toMatch(/button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--accent\)/s)
  })
})

describe('FRONTEND-007-AC-14: text input/textarea/select base styles', () => {
  it('defines the moderate-radius field rule', () => {
    expect(indexCss).toMatch(/input\[type="text"\],\s*textarea,\s*select\s*\{[^}]*border-radius:\s*6px/s)
  })
})

describe('FRONTEND-007-AC-15: colour input sizing', () => {
  it('defines a dedicated input[type="color"] rule', () => {
    expect(indexCss).toMatch(/input\[type="color"\]\s*\{[^}]*width:\s*2\.5rem/s)
  })
})

describe('FRONTEND-007-AC-16: radio accent-color only', () => {
  it('sets accent-color with no other overrides', () => {
    expect(indexCss).toMatch(/input\[type="radio"\]\s*\{\s*accent-color:\s*var\(--accent\);\s*\}/)
  })
})
```

```typescript
// frontend/src/components/WeeklyPlanner/PlannerGrid.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlannerGrid } from './PlannerGrid'
import styles from './PlannerGrid.module.css'

const noop = () => {}

describe('FRONTEND-007-AC-09: day-of-week labels use the mono day-label style', () => {
  it('applies the dayLabel class to each weekday heading', () => {
    render(
      <PlannerGrid
        occurrences={[]}
        busyId={null}
        confirmingRemoveId={null}
        movingId={null}
        onAdd={noop}
        onStartRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onStartMove={noop}
        onCancelMove={noop}
        onConfirmMove={noop}
        onMoveToBucket={noop}
        onComplete={noop}
        onUndo={noop}
      />,
    )

    expect(screen.getByText('Monday')).toHaveClass(styles.dayLabel)
  })
})

describe('FRONTEND-007-AC-23: planner grid cells are flat panels', () => {
  it('applies the cell class to each day/slot cell', () => {
    render(
      <PlannerGrid
        occurrences={[]}
        busyId={null}
        confirmingRemoveId={null}
        movingId={null}
        onAdd={noop}
        onStartRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onStartMove={noop}
        onCancelMove={noop}
        onConfirmMove={noop}
        onMoveToBucket={noop}
        onComplete={noop}
        onUndo={noop}
      />,
    )

    expect(screen.getByLabelText('Add to Monday Morning').closest(`.${styles.cell}`)).not.toBeNull()
  })
})
```

```typescript
// frontend/src/components/ActivityBank/ActivityBank.test.tsx (additions)
import styles from './ActivityBank.module.css'

describe('FRONTEND-007-AC-19/AC-20: activity rows use the hairline treatment, actions right-aligned', () => {
  it('applies the row class to each activity li and the actions class to its action buttons', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: '1', name: 'Walk', category: 'ROUTINE', description: null, createdAt: '2026-09-01T00:00:00Z' },
    ])
    render(<ActivityBank />)

    const row = (await screen.findByText('Walk')).closest('li')
    expect(row).toHaveClass(styles.row)
    expect(screen.getByRole('button', { name: 'Edit' }).closest(`.${styles.actions}`)).not.toBeNull()
  })
})
```

```typescript
// frontend/src/components/ActivityBank/SubTaskList.test.tsx (additions)
import styles from './SubTaskList.module.css'

describe('FRONTEND-007-AC-21/AC-22: sub-task rows use the nested hairline treatment', () => {
  it('applies the row and nested classes to each sub-task li', async () => {
    vi.mocked(subTaskApi.getAll).mockResolvedValue([
      { id: 's1', activityId: 'a1', name: 'Put on shoes', category: 'ROUTINE', createdAt: '2026-09-01T00:00:00Z' },
    ])
    render(<SubTaskList activityId="a1" category="ROUTINE" />)

    const row = (await screen.findByText('Put on shoes')).closest('li')
    expect(row).toHaveClass(styles.row)
    expect(row).toHaveClass(styles.nested)
  })
})
```

```typescript
// frontend/src/components/WeeklyPlanner/OccurrenceItem.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OccurrenceItem } from './OccurrenceItem'
import styles from './OccurrenceItem.module.css'

const occurrence = {
  id: 'o1',
  name: 'Walk',
  category: 'ROUTINE' as const,
  dayOfWeek: 'MONDAY' as const,
  slot: 'MORNING' as const,
  completed: false,
  completedAt: null,
}

const noop = () => {}

describe('FRONTEND-007-AC-25: occurrence rows match identically in grid and bucket contexts', () => {
  it('applies the same row class whether isBucketItem is true or false', () => {
    const { rerender } = render(
      <OccurrenceItem
        occurrence={occurrence}
        isBucketItem={false}
        busyId={null}
        confirmingRemoveId={null}
        movingId={null}
        onStartRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onStartMove={noop}
        onCancelMove={noop}
        onConfirmMove={noop}
        onMoveToBucket={noop}
        onComplete={noop}
        onUndo={noop}
        onCarryForward={noop}
      />,
    )
    expect(screen.getByText('Walk').closest('li')).toHaveClass(styles.row)

    rerender(
      <OccurrenceItem
        occurrence={occurrence}
        isBucketItem
        busyId={null}
        confirmingRemoveId={null}
        movingId={null}
        onStartRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onStartMove={noop}
        onCancelMove={noop}
        onConfirmMove={noop}
        onMoveToBucket={noop}
        onComplete={noop}
        onUndo={noop}
        onCarryForward={noop}
      />,
    )
    expect(screen.getByText('Walk').closest('li')).toHaveClass(styles.row)
  })
})
```

```typescript
// frontend/src/components/WeeklyPlanner/BucketList.test.tsx (additions)
import styles from './BucketList.module.css'

describe('FRONTEND-007-AC-24: bucket list wrapper is a flat panel', () => {
  it('applies the panel class to the bucket list section', () => {
    render(<BucketList occurrences={[]} busyId={null} confirmingRemoveId={null} movingId={null}
      onAdd={noop} onStartRemove={noop} onConfirmRemove={noop} onCancelRemove={noop}
      onStartMove={noop} onCancelMove={noop} onConfirmMove={noop} onComplete={noop}
      onUndo={noop} onCarryForward={noop} />)

    expect(screen.getByRole('region', { name: /weekend bucket list/i })).toHaveClass(styles.panel)
  })
})
```

```typescript
// frontend/src/components/WeeklyPlanner/moduleStyles.test.ts and
// frontend/src/components/LoginPage.moduleStyles.test.ts (shared pattern)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('FRONTEND-007-AC-13: uniform button treatment, no component-level override', () => {
  it('finds no button-element selector or primary/secondary class in any restyled module', () => {
    const files = [
      '../ActivityBank/ActivityBank.module.css',
      '../ActivityBank/SubTaskList.module.css',
      '../WeeklyPlanner/PlannerGrid.module.css',
      '../WeeklyPlanner/BucketList.module.css',
      '../WeeklyPlanner/OccurrenceItem.module.css',
      '../WeeklyPlanner/AssignActivityPicker.module.css',
      '../LoginPage.module.css',
    ]
    for (const file of files) {
      const css = readFileSync(resolve(__dirname, file), 'utf-8')
      expect(css).not.toMatch(/\bbutton\s*\{/)
      expect(css).not.toMatch(/primary|secondary/i)
    }
  })
})

describe('FRONTEND-007-AC-26: assign picker panel + no bespoke button/input override', () => {
  it('applies the panel class and defines no button/input selector', () => {
    const css = readFileSync(resolve(__dirname, '../WeeklyPlanner/AssignActivityPicker.module.css'), 'utf-8')
    expect(css).not.toMatch(/\bbutton\s*\{/)
    expect(css).not.toMatch(/input\[type=/)
  })
})

describe('FRONTEND-007-AC-28: login form controls have no bespoke override', () => {
  it('defines no button/input selector in LoginPage.module.css', () => {
    const css = readFileSync(resolve(__dirname, '../LoginPage.module.css'), 'utf-8')
    expect(css).not.toMatch(/\bbutton\s*\{/)
    expect(css).not.toMatch(/input\[type=/)
  })
})
```

```typescript
// frontend/src/App.test.tsx (additions)
import styles from './App.module.css'

describe('FRONTEND-007-AC-17/AC-18: layout-shell wrapper', () => {
  it('wraps the authenticated header, TabNav, and routed content in one shell container', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ username: 'stef' })
    render(
      <MemoryRouter initialEntries={['/activities']}>
        <App />
      </MemoryRouter>,
    )

    const shell = await screen.findByTestId('app-shell')
    expect(shell).toHaveClass(styles.shell)
    expect(shell).toContainElement(screen.getByRole('link', { name: /activities/i }))
  })
})
```

```typescript
// frontend/src/components/LoginPage.test.tsx (additions)
import styles from './LoginPage.module.css'

describe('FRONTEND-007-AC-27: login page uses the layout shell', () => {
  it('applies the shell class to its wrapping element', () => {
    render(<LoginPage onLoginSuccess={() => {}} />)

    expect(screen.getByRole('heading', { name: /log in/i }).closest(`.${styles.shell}`)).not.toBeNull()
  })
})
```

```typescript
// frontend/src/components/CategoryChip/CategoryChip.moduleStyles.test.ts and
// frontend/src/components/Navigation/TabNav.moduleStyles.test.ts and
// frontend/src/components/Settings/Settings.moduleStyles.test.ts (shared pattern)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('FRONTEND-007-AC-29: CategoryChip matches the new type scale', () => {
  it('updates font-size/weight/padding, keeps the pill radius', () => {
    const css = readFileSync(resolve(__dirname, './CategoryChip.module.css'), 'utf-8')
    expect(css).toContain('font-size: 0.72rem')
    expect(css).toContain('font-weight: 700')
    expect(css).toContain('padding: 0.18rem 0.65rem')
    expect(css).toContain('border-radius: 999px')
  })
})

describe('FRONTEND-007-AC-30/AC-31: TabNav and Settings stay fully token-driven', () => {
  it('contains no hardcoded hex colours', () => {
    const tabNavCss = readFileSync(resolve(__dirname, '../Navigation/TabNav.module.css'), 'utf-8')
    const settingsCss = readFileSync(resolve(__dirname, '../Settings/Settings.module.css'), 'utf-8')
    expect(tabNavCss).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(settingsCss).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
```

**FRONTEND-007-AC-32 [MANUAL]**: no automatable test — verified per the statement above via a real
browser pass across all four routes, both explicit themes and System, checked off manually in the
Acceptance Criteria Summary once done.

## Acceptance Criteria Summary

- [x] FRONTEND-007-AC-01 — `theme.css` light tokens updated to the Quiet Room palette in both blocks
- [x] FRONTEND-007-AC-02 — `theme.css` dark tokens updated to the Quiet Room palette in both blocks
- [x] FRONTEND-007-AC-03 — `--surface` token added to all four blocks, distinct from `--bg`
- [x] FRONTEND-007-AC-04 — category tokens unchanged across all four blocks
- [x] FRONTEND-007-AC-05 — `--sans`/`--heading` stacks include `-apple-system`
- [x] FRONTEND-007-AC-06 — `h1, h2` are `font-weight: 700` with `letter-spacing: -0.01em`
- [x] FRONTEND-007-AC-07 — `h1, h2` get `text-wrap: balance`
- [x] FRONTEND-007-AC-08 — `font-variant-numeric: tabular-nums` applied globally
- [x] FRONTEND-007-AC-09 — `PlannerGrid` day labels get the mono/uppercase/tracking treatment
- [x] FRONTEND-007-AC-10 — global `button` rule: pill radius, surface bg, reused shadow token, etc.
- [x] FRONTEND-007-AC-11 — button `:hover` lift gated behind `prefers-reduced-motion`
- [x] FRONTEND-007-AC-12 — button `:focus-visible` outline using `var(--accent)`
- [x] FRONTEND-007-AC-13 — uniform button treatment everywhere, no primary/secondary override
      (confirmed: grepped every pass-2 `.module.css` for a bare `button {` selector — none found)
- [x] FRONTEND-007-AC-14 — global text input/textarea/select base rule, moderate radius
- [x] FRONTEND-007-AC-15 — dedicated `input[type="color"]` sizing rule
- [x] FRONTEND-007-AC-16 — `input[type="radio"]` gets `accent-color` only
- [x] FRONTEND-007-AC-17 — `App.module.css` layout-shell wrapper (max-width/margin/padding)
- [x] FRONTEND-007-AC-18 — layout-shell wrapper persists as one container across tab navigation
- [x] FRONTEND-007-AC-19 — `ActivityBank` rows get the hairline treatment, no shadow
- [x] FRONTEND-007-AC-20 — activity row action buttons right-aligned via `margin-left: auto`
- [x] FRONTEND-007-AC-21 — `SubTaskList` rows get the equivalent hairline treatment
- [x] FRONTEND-007-AC-22 — sub-task rows get `--code-bg`, small radius, and indentation
- [x] FRONTEND-007-AC-23 — `PlannerGrid` day/slot cells are flat panels, no shadow
- [x] FRONTEND-007-AC-24 — `BucketList`'s own section wrapper is a flat panel, no shadow
- [x] FRONTEND-007-AC-25 — `OccurrenceItem` rows match identically in grid and bucket contexts
- [x] FRONTEND-007-AC-26 — `AssignActivityPicker` panel treatment, no bespoke button/input override
- [x] FRONTEND-007-AC-27 — `LoginPage` uses the layout-shell centering
- [x] FRONTEND-007-AC-28 — `LoginPage` form controls use global base styles, no bespoke override
- [x] FRONTEND-007-AC-29 — `CategoryChip` font-size/weight/padding match the new type scale
- [x] FRONTEND-007-AC-30 — `TabNav.module.css` verified fully token-driven, no change required
- [x] FRONTEND-007-AC-31 — `Settings.module.css` verified fully token-driven, no change required
- [x] FRONTEND-007-AC-32 — manual real-browser pass across all routes/themes (MANUAL) — verified
      2026-09-29, see Status header for what was checked.
