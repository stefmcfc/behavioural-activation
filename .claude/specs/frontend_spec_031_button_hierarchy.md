# Frontend Button Visual Hierarchy (Primary / Destructive)

**Status**: Implemented (2026-10-02) — all 17 ACs green, including AC-17's real-browser contrast
check (see Summary)
**Priority**: P3 — visual/UX polish, no new capability. Deferred scope from
`frontend_spec_007_visual_refresh.md`'s Requirement 3 (see that spec's Out-of-scope section) and
confirmed in `.claude/SPEC_CANDIDATES.md`'s "Frontend button visual hierarchy (primary/secondary)"
entry.
**Depends on**: `frontend_spec_007_visual_refresh.md` (origin of the single, uniform `button { ... }`
global base style in `index.css` and the `--accent`/`--accent-ink` token pair this spec reuses),
`frontend_spec_005_navigation_and_theme.md` (`theme.css`'s `--error`/`--error-bg`/`--error-border`
tokens, already used for form/alert error text, reused here for the destructive variant)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish — not tied to a specific `HIGH_LEVEL_DESIGN.md` version theme

## Summary

All 16 `[AUTO]` ACs implemented and tested as specified, with no deviations from the plan. 30 new
tests added (13 production-behaviour tests for AC-06–AC-14, plus 17 regression-guard tests for
AC-15/AC-16 and the two CSS-content ACs' own describe blocks) — full suite now 456 tests across 35
files, up from the 426/35 baseline, 0 regressions. `npm run lint` (oxlint) and `npm run build`
(`tsc -b && vite build`) both clean.

**Mechanism exactly as planned**: `theme.css` gained `--error-ink` (AC-01); the new
`frontend/src/styles/buttonVariants.module.css` exports `.primary`/`.destructive`, neither defining
a `:focus-visible` override (AC-02–AC-04); `index.css` gained a generic `button:disabled` rule
(AC-05). Every call site in Requirement 3/4 combines the new class via a plain template literal
where a component-scoped class already existed (`` `${styles.addButton} ${buttonStyles.primary}` ``
in `ActivityBank.tsx`/`SubTaskList.tsx`/`OccurrenceItem.tsx`), or sets `buttonStyles.primary`/
`.destructive` directly where the button was previously classless (`BucketList.tsx`,
`LoginPage.tsx`, `ActivityForm.tsx`/`SubTaskForm.tsx`, `AssignActivityPicker.tsx`,
`ActivityBank.tsx`'s/`SubTaskList.tsx`'s Delete/Confirm delete). No `classnames`/`clsx` dependency
added, as planned.

**Regression guards (AC-15/AC-16) were verified both ways**: written as failing-if-wrong assertions
(`not.toHaveClass`) against the *current* (pre-change) markup first, confirmed green before any
production code changed (i.e. today's unstyled buttons really were unstyled), then re-confirmed
green after all AC-06–AC-14 production changes landed — so a true regression (a variant class
leaking onto a button it shouldn't) would have been caught either way, not just incidentally passed
because the assertion never ran against real markup.

**AC-17 — real-browser contrast check, now done**: logged in and checked both variants, both themes,
using the WCAG relative-luminance formula against the actual rendered `getComputedStyle` `color`/
`background-color` pair (not assumed from the source token values). All four combinations clear the
4.5:1 minimum, one of them narrowly:

| Variant | Theme | Text / background (rendered) | Contrast |
|---|---|---|---|
| `.primary` | Dark | `rgb(22,34,15)` / `rgb(147,178,142)` | 7.09:1 |
| `.primary` | Light | `rgb(255,255,255)` / `rgb(95,122,94)` | **4.74:1** |
| `.destructive` | Dark | `rgb(105,0,5)` / `rgb(255,180,171)` | 7.72:1 |
| `.destructive` | Light | `rgb(255,255,255)` / `rgb(179,38,30)` | 6.54:1 |

`.primary` in light theme is the tightest margin (4.74:1 vs. the 4.5:1 minimum) — a real pass, not a
failure, but closer to the line than the other three; worth keeping in mind if `--accent`'s light
value ever gets tweaked lighter in a future pass. Also spot-checked visually: `Add activity`/
`Complete`/`Undo` render as a solid green pill with clearly legible text in both themes; `Delete`/
`Confirm delete` as a solid red pill; `Cancel`, `Edit`, the per-cell grid `Add` buttons (5 visible at
once, correctly *not* primary — confirms the Overview's "wall of colour" concern was worth avoiding),
`Browse activities`, and the Settings popover's `Reset to default` buttons are all unchanged/neutral.
`SettingsMenu`'s open-state icon highlight (`frontend_spec_030`) still works, confirming no
regression there either.

**One spec-language note, not a defect**: `.primary`/`.destructive`'s `border-color: var(--accent)`/
`var(--error)` declarations are inert as written — the base `button` rule already sets `border:
none`, which zeroes border-width/style, so a `border-color` alone with no width/style never produces
a visible border. Harmless (the solid-fill backgrounds already give both variants a clear edge
against the page background in both themes, confirmed above), but noted here in case a future pass
wants an actual visible border and reaches for this same pattern expecting it to work.

## Overview

Today every `<button>` in the app — "Add activity", "Log in", "Cancel", "Delete", "Confirm delete",
the per-cell "Add" in the weekly grid, icon triggers, everything — renders with the identical pill+
shadow treatment from `index.css`'s single global `button` rule (`frontend_spec_007`'s deliberate
choice, deferring exactly this). This spec adds two **variant classes** — `primary` and
`destructive` — applied to the small set of buttons that should visually stand out, while every
other button keeps today's unmodified treatment (which this spec treats as the implicit "secondary"
default — **no new class for secondary**, so most of the ~45 `<button>` call sites in this codebase
need zero changes, not "every component" as the candidate note originally feared).

**Researched via the `modern-web-guidance` skill before drafting ACs** (`accessibility` and `css`
guides):
- WCAG non-text/UI-component contrast minimum is 3:1, text contrast 4.5:1 — directly shapes
  Requirement 1's colour-token choice and Requirement 6's manual verification AC.
- "Don't use colour alone to indicate state" — satisfied here because the variants differ in fill
  weight (solid vs today's neutral surface) as well as hue, not hue alone, and because destructive
  actions already require a type-to-confirm-free but click-twice ("Delete" → "Confirm delete"/
  "Cancel") flow independent of colour.
- The `css` guide recommends cascade layers + `:where()` over BEM-style specificity management for
  larger design systems. **Deliberately not adopted here** — checked the actual specificity math
  first: a CSS Module class selector (0,1,0) already outranks the existing bare-element `button`
  selector (0,0,1) and `button:hover` (0,1,1) is beaten by an explicit `.primary:hover`/
  `.destructive:hover` (0,2,0) override with no layering needed. Reaching for `@layer` here would be
  solving a specificity problem this codebase's small, two-variant scope doesn't actually have —
  flagged explicitly per this project's "don't add abstractions beyond what's needed" convention.

**What was open going into this spec, and how it's resolved** (the candidate note only sketched two
illustrative examples per category and explicitly deferred "a real design pass" — these are my
calls, flagged for easy correction):

1. **Two variants, not just primary/secondary.** The candidate's own examples listed "Delete" as a
   *secondary*-category example, but that predates this codebase's actual delete flow (a two-step
   "Delete" → "Confirm delete"/"Cancel"). A dedicated **destructive** variant (reusing the existing
   `--error` token family already used for error text) gives irreversible delete actions a distinct
   visual warning independent of position in the row — judged worth the small scope increase beyond
   the candidate's literal two examples.
2. **Destructive is reserved for actions that permanently discard a resource** (an Activity or
   Sub-task, cascading to its history) — **not** for the Weekly Planner's "Remove"/"Confirm remove"
   (unscheduling an occurrence; the Activity itself is untouched and trivially re-assignable), which
   stays secondary/default. This keeps the warning colour meaningful by reserving it for the
   genuinely higher-stakes case, rather than diluting it across every "take this off my
   screen"-flavoured button. Flagged as a judgment call — easy to widen later if it reads as
   inconsistent in practice.
3. **Primary is reserved for each screen/card's single headline action**, not every button that
   happens to create or confirm something: "Add activity", "Add sub-task", "Log in", a form's
   Save/Create submit button, `AssignActivityPicker`'s "Assign", and `OccurrenceItem`'s
   "Complete"/"Undo" toggle (this app's core behavioural-activation loop) all qualify. The Weekly
   Planner grid's per-cell "Add" button does **not** — up to 14 of them render simultaneously
   (7 slots × 2 visible days), and giving all 14 a solid accent fill would read as a wall of colour,
   working against `frontend_spec_007`'s "calm, Quiet Room" goal rather than adding real signal.
   `BucketList`'s single header-level "Add", by contrast, is a once-per-list entry point structurally
   analogous to "Add activity"/"Add sub-task", so it does qualify — the same label can land on either
   side of the line depending on how many copies of it are visible at once.
4. **Icon-only buttons are entirely out of scope for this pass.** `SettingsMenu`/`AccountMenu`
   triggers, `OccurrenceItem`'s move-up/move-down arrows, the week-nav chevrons, the favourite-star
   toggle, and the repeatable-activity icon toggle already carry their own bespoke affordance
   (`aria-pressed`, hover/open-state highlighting from `frontend_spec_030`) that a solid-fill
   primary/destructive treatment would visually fight with, not complement. Revisiting icon-button
   styling is a separate, later concern if it ever comes up.
5. **`ActivityPickerList`'s `mode="select"` row buttons** (the `aria-pressed` activity/sub-task
   selection rows in the "Add" picker modal) are a **selection** affordance, not an action-hierarchy
   one — explicitly unchanged, same reasoning as icon buttons.
6. **A small, free adjacent fix**: zero `:disabled` visual feedback exists on any button today
   (confirmed — no `:disabled` rule anywhere in `index.css`/`theme.css`). Since this spec already
   touches the global base button style, Requirement 2 adds one generic `button:disabled` dimming
   rule, covering all three variants uniformly. Flagged as incidental-but-related, not scope creep.

**Mechanism**: a new shared `frontend/src/styles/buttonVariants.module.css` (the `styles/` directory
`frontend_structure.md` already reserves for exactly this "global styles split out of `index.css`"
need), exporting `.primary` and `.destructive` (no export for secondary/default — the existing global
`button` rule already *is* that state). A button that needs a variant imports this module alongside
its own component-scoped module (if it has one) and combines the two class names via a plain template
literal (e.g. `` className={`${styles.addButton} ${buttonStyles.primary}`} ``) — no `classnames`/
`clsx` dependency, since this is the first and only place in the codebase that currently needs to
combine two classes on one element, and a one-line template literal doesn't justify a new dependency.

**Out of scope**:
- Any 4th variant (ghost/tertiary/link-style) — not asked for, no current button needs it.
- Re-styling icon-only buttons, or `ActivityPickerList`'s selection-row buttons (see judgment calls
  above).
- Any animation beyond the existing `prefers-reduced-motion`-gated hover-shadow transition
  `frontend_spec_007` already established — variants reuse that transition unchanged.
- Any change to `--accent`/`--accent-ink`/`--error`/`--error-bg`/`--error-border` themselves, or to
  category-colour customization — only one new token (`--error-ink`) is added, nothing existing is
  touched.

## Requirement 1: A new `--error-ink` token for text atop a solid destructive fill

**User story**: As a user, I want a destructive button's text to stay clearly readable against its
red fill in both light and dark theme, the same way existing solid-accent elements already are.

### FRONTEND-031-AC-01 [AUTO]: `theme.css` defines `--error-ink`
**Statement**: `theme.css`'s `:root` block shall define `--error-ink: light-dark(#ffffff, #690005)`,
mirroring the existing `--accent-ink` token's role (the text colour used atop a solid fill of the
paired colour token) for the `--error` token instead of `--accent`.

**Rationale**: `#ffffff`/`#690005` are Material Design 3's own published `onError` values for its
`error` colour in light/dark theme respectively — the same palette `--error`/`--error-bg`/
`--error-border` (`#b3261e`/`#ffb4ab`) already visibly draw from (exact value match), so this isn't a
new, unverified colour choice; it's completing a pairing that palette already defines elsewhere.

**References**: `frontend/src/theme.css` (new token, alongside the existing `--accent-ink` at the
same nesting level)

## Requirement 2: A shared button-variant stylesheet, and global disabled-state styling

**User story**: As a developer extending this app, I want one shared place that defines what
"primary" and "destructive" mean visually, so a future button can opt in with one class instead of
hand-rolling its own variant styling.

### FRONTEND-031-AC-02 [AUTO]: `buttonVariants.module.css` defines `.primary`
**Statement**: `frontend/src/styles/buttonVariants.module.css` shall define a `.primary` class
setting `background: var(--accent)`, `border-color: var(--accent)`, and `color: var(--accent-ink)`
(overriding the global `button` rule's neutral `--surface` background/`--text-h` text), plus a
`.primary:hover` rule preserving the existing global `button:hover` box-shadow lift (same literal
shadow values already in `index.css`) without changing the solid background on hover.

**References**: New: `frontend/src/styles/buttonVariants.module.css`; existing:
`frontend/src/index.css` (`button`, `button:hover` — the rules being overridden)

### FRONTEND-031-AC-03 [AUTO]: `buttonVariants.module.css` defines `.destructive`
**Statement**: `frontend/src/styles/buttonVariants.module.css` shall define a `.destructive` class
setting `background: var(--error)`, `border-color: var(--error)`, and `color: var(--error-ink)`, plus
a `.destructive:hover` rule with the same box-shadow-only hover treatment as `.primary:hover`.

**References**: New: `frontend/src/styles/buttonVariants.module.css`

### FRONTEND-031-AC-04 [AUTO]: Neither variant class overrides `:focus-visible`
**Statement**: Neither `.primary` nor `.destructive` shall define a `:focus-visible` rule — both
continue to inherit the existing global `button:focus-visible` accent-coloured outline unchanged,
keeping one consistent focus-ring colour across all three variants.

**Rationale**: Deliberate — a consistent, predictable focus indicator independent of the action's
semantic colour is itself a usability property worth keeping; this is a regression guard against
accidentally adding a competing rule.

**References**: `frontend/src/index.css` (`button:focus-visible`, unchanged)

### FRONTEND-031-AC-05 [AUTO]: `index.css` adds a generic `button:disabled` rule
**Statement**: `frontend/src/index.css`'s global button base styles shall gain a `button:disabled`
rule reducing opacity (e.g. `opacity: 0.5`) and setting `cursor: not-allowed`, applying uniformly
regardless of variant class.

**References**: `frontend/src/index.css`

## Requirement 3: The primary variant marks each screen/card's single headline action

**User story**: As a user, I want the one main thing a screen or card wants me to do to visually
stand out, so I don't have to read every button's label to find it.

### FRONTEND-031-AC-06 [AUTO]: `ActivityBank.tsx`'s "Add activity" button is primary
**Statement**: `ActivityBank.tsx`'s "Add activity" button shall combine its existing
`styles.addButton` class with `buttonVariants.primary`.

**References**: `frontend/src/components/ActivityBank/ActivityBank.tsx` (~line 284)

### FRONTEND-031-AC-07 [AUTO]: `SubTaskList.tsx`'s "Add sub-task" button is primary
**Statement**: `SubTaskList.tsx`'s "Add sub-task" button shall combine its existing
`styles.addButton` class with `buttonVariants.primary`.

**References**: `frontend/src/components/ActivityBank/SubTaskList.tsx` (~line 106)

### FRONTEND-031-AC-08 [AUTO]: `BucketList.tsx`'s "Add" (to weekend bucket list) button is primary
**Statement**: `BucketList.tsx`'s "Add" button (currently classless) shall gain `buttonVariants.primary`.

**References**: `frontend/src/components/WeeklyPlanner/BucketList.tsx` (~line 162)

### FRONTEND-031-AC-09 [AUTO]: `LoginPage.tsx`'s "Log in" submit button is primary
**Statement**: `LoginPage.tsx`'s submit button (currently classless) shall gain `buttonVariants.primary`.

**References**: `frontend/src/components/LoginPage.tsx` (~line 122)

### FRONTEND-031-AC-10 [AUTO]: `ActivityForm.tsx`'s and `SubTaskForm.tsx`'s submit buttons are primary; their Cancel buttons are not
**Statement**: `ActivityForm.tsx`'s and `SubTaskForm.tsx`'s submit ("Save changes"/"Save activity"/
"Save sub-task") buttons shall each gain `buttonVariants.primary`; their sibling "Cancel" buttons
shall receive no variant class.

**References**: `frontend/src/components/ActivityBank/ActivityForm.tsx` (~line 206),
`frontend/src/components/ActivityBank/SubTaskForm.tsx` (~line 107)

### FRONTEND-031-AC-11 [AUTO]: `AssignActivityPicker.tsx`'s "Assign" button is primary; its Cancel button is not
**Statement**: `AssignActivityPicker.tsx`'s "Assign" button shall gain `buttonVariants.primary`; its
"Cancel" button shall receive no variant class.

**References**: `frontend/src/components/WeeklyPlanner/AssignActivityPicker.tsx` (~lines 84, 87)

### FRONTEND-031-AC-12 [AUTO]: `OccurrenceItem.tsx`'s Complete/Undo toggle button is primary in both states
**Statement**: `OccurrenceItem.tsx`'s completion-toggle button shall combine its existing
`styles.completeButton` class with `buttonVariants.primary`, in both its "Complete" (incomplete
state) and "Undo" (completed state) renderings.

**References**: `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` (~lines 181, 190)

## Requirement 4: The destructive variant marks irreversible resource-deletion actions

**User story**: As a user, I want the actions that permanently delete an activity or sub-task
(losing its history) to visually warn me, distinct from actions that just rearrange or unschedule
something I can easily redo.

### FRONTEND-031-AC-13 [AUTO]: `ActivityBank.tsx`'s "Delete" and "Confirm delete" are destructive; "Cancel" is not
**Statement**: `ActivityBank.tsx`'s "Delete" (confirmation entry point) and "Confirm delete" buttons
shall each gain `buttonVariants.destructive`; the paired "Cancel" button shall receive no variant
class.

**References**: `frontend/src/components/ActivityBank/ActivityBank.tsx` (~lines 187, 194, 213)

### FRONTEND-031-AC-14 [AUTO]: `SubTaskList.tsx`'s "Delete" and "Confirm delete" are destructive; "Cancel" is not
**Statement**: `SubTaskList.tsx`'s "Delete" (confirmation entry point) and "Confirm delete" buttons
shall each gain `buttonVariants.destructive`; the paired "Cancel" button shall receive no variant
class.

**References**: `frontend/src/components/ActivityBank/SubTaskList.tsx` (~lines 133, 140, 153)

## Requirement 5: Everything else keeps today's unmodified (secondary/default) treatment

**User story**: As a user, I want the hierarchy to stay meaningful by only marking genuinely primary
or destructive actions, so it doesn't collapse back into "everything is highlighted" noise.

### FRONTEND-031-AC-15 [AUTO]: Icon-only and selection-row buttons receive no variant class
**Statement**: `SettingsMenu.tsx`/`AccountMenu.tsx`'s trigger buttons, `OccurrenceItem.tsx`'s
move-up/move-down arrow buttons, `WeeklyPlanner.tsx`'s previous/next-week chevron buttons, the
favourite-star toggle (`ActivityBank.tsx`), the repeatable-activity icon toggle, and
`ActivityPickerList.tsx`'s `mode="select"` row buttons shall each receive no variant class, unchanged
from their current (already-shipped) styling.

**Rationale**: Explicit regression guard — these already carry their own bespoke, previously-specced
affordance (`frontend_spec_030`'s open-state highlight, `aria-pressed` selection/toggle styling) that
this spec must not disturb.

**References**: `frontend/src/components/Navigation/SettingsMenu.tsx`,
`frontend/src/components/Navigation/AccountMenu.tsx`,
`frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx`,
`frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx`,
`frontend/src/components/ActivityBank/ActivityBank.tsx`,
`frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`

### FRONTEND-031-AC-16 [AUTO]: Every remaining named button receives no variant class
**Statement**: `PlannerGrid.tsx`'s per-cell "Add" buttons; `OccurrenceItem.tsx`'s "Rearrange",
"Remove", "Confirm remove", "Cancel" (both the remove and rearrange flows' Cancel), "Confirm
rearrange", "Send to bucket", "Carry forward", and "Close" buttons; `WeeklyPlanner.tsx`'s "Browse
activities" and "Retry" buttons; `ActivityBank.tsx`'s "Edit", "Unarchive", "Retry", and sub-tasks
disclosure-toggle buttons; `SubTaskList.tsx`'s equivalent "Edit"/"Retry"/disclosure-toggle buttons;
`Settings.tsx`'s "Reset to default" buttons; and `AccountMenu.tsx`'s "Log out" button shall each
receive no variant class, unchanged from their current styling.

**Rationale**: Explicit regression guard enumerating the "stays secondary" side of every decision in
the Overview's judgment-call list, so a future reader can tell a deliberate omission from an
oversight.

**References**: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx`,
`frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx`,
`frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx`,
`frontend/src/components/ActivityBank/ActivityBank.tsx`,
`frontend/src/components/ActivityBank/SubTaskList.tsx`,
`frontend/src/components/Settings/Settings.tsx`,
`frontend/src/components/Navigation/AccountMenu.tsx`

## Requirement 6: Accessible contrast, verified where it actually counts

**User story**: As a user relying on sufficient contrast to read button text, I want the new
variants to actually meet accessible contrast once rendered, not just in theory.

### FRONTEND-031-AC-17 [MANUAL]: `.primary`/`.destructive` text meets WCAG AA contrast in both themes, confirmed in a real browser
**Statement**: In a real browser, in both light and dark theme, `.primary`'s `--accent-ink`-on-
`--accent` pairing and `.destructive`'s `--error-ink`-on-`--error` pairing shall each meet a measured
contrast ratio of at least 4.5:1, checked with a contrast-checking tool against the actual rendered
computed colours.

**Rationale**: `[MANUAL]` — this project's `vitest.config.ts` doesn't enable CSS injection
(`frontend_spec_007`'s own established limit — see that spec's "A note on how the `[AUTO]` ACs below
are actually verified" section, which this spec's AUTO ACs below follow exactly), and contrast is a
rendered-colour property no amount of class-name or source-file assertion can actually verify; a real
browser pass is the only honest check, consistent with this project's global CSS-verification
convention (jsdom doesn't render CSS).

**References**: `frontend/src/styles/buttonVariants.module.css`, `frontend/src/theme.css`

## Cross-references

| This spec depends on / contracts against | What it provides |
|---|---|
| `frontend_spec_007_visual_refresh.md` | The global `button`/`button:hover`/`button:focus-visible` base rules this spec overrides per-variant, and the `--accent`/`--accent-ink` tokens `.primary` reuses |
| `frontend_spec_005_navigation_and_theme.md` | The `--error`/`--error-bg`/`--error-border` tokens `.destructive` reuses (text-only usage today; this spec is their first solid-fill usage) |
| `frontend_spec_030_header_restructure.md` | `SettingsMenu`/`AccountMenu` trigger icon styling this spec must not disturb (AC-15) |
| `frontend_structure.md` | The reserved `src/styles/` directory this spec populates for the first time |

## TDD test case sketches

Following `frontend_spec_007`'s established two-mechanism approach (CSS injection is not enabled in
`vitest.config.ts`, so computed-style assertions aren't reliable): **CSS Module class assertions**
(`toHaveClass`) to verify a component's JSX is wired to the right class, and **source-file content
assertions** (`readFileSync` + substring/regex match against the real `.css` file) to verify the CSS
rule itself was actually written as specified.

### FRONTEND-031-AC-01
```typescript
import { readFileSync } from 'node:fs'

describe('FRONTEND-031-AC-01: --error-ink token', () => {
  it('defines --error-ink in :root using light-dark(#ffffff, #690005)', () => {
    const css = readFileSync('src/theme.css', 'utf-8')
    expect(css).toMatch(/--error-ink:\s*light-dark\(#ffffff,\s*#690005\)/)
  })
})
```

### FRONTEND-031-AC-02 / AC-03 / AC-04
```typescript
describe('FRONTEND-031-AC-02/03/04: buttonVariants.module.css', () => {
  it('AC-02: .primary sets background/border-color/color from --accent tokens', () => {
    const css = readFileSync('src/styles/buttonVariants.module.css', 'utf-8')
    expect(css).toMatch(/\.primary\s*{[^}]*background:\s*var\(--accent\)/)
    expect(css).toMatch(/\.primary\s*{[^}]*color:\s*var\(--accent-ink\)/)
  })
  it('AC-03: .destructive sets background/border-color/color from --error tokens', () => {
    const css = readFileSync('src/styles/buttonVariants.module.css', 'utf-8')
    expect(css).toMatch(/\.destructive\s*{[^}]*background:\s*var\(--error\)/)
    expect(css).toMatch(/\.destructive\s*{[^}]*color:\s*var\(--error-ink\)/)
  })
  it('AC-04: neither variant defines a :focus-visible rule', () => {
    const css = readFileSync('src/styles/buttonVariants.module.css', 'utf-8')
    expect(css).not.toMatch(/:focus-visible/)
  })
})
```

### FRONTEND-031-AC-05
```typescript
describe('FRONTEND-031-AC-05: disabled-state dimming', () => {
  it('index.css defines a generic button:disabled rule', () => {
    const css = readFileSync('src/index.css', 'utf-8')
    expect(css).toMatch(/button:disabled\s*{[^}]*opacity:/)
  })
})
```

### FRONTEND-031-AC-06 through AC-12 (primary)
```typescript
import buttonStyles from '../styles/buttonVariants.module.css'

it('AC-06: "Add activity" button has the primary class', () => {
  render(<ActivityBank />)
  expect(screen.getByRole('button', { name: 'Add activity' })).toHaveClass(buttonStyles.primary)
})
// ...one equivalent assertion per AC-07–AC-12, substituting the button's accessible name and
// rendering context (AssignActivityPicker needs an open modal; OccurrenceItem needs both the
// completed and incomplete render branches checked for AC-12)
```

### FRONTEND-031-AC-13 / AC-14 (destructive)
```typescript
it('AC-13: "Delete" and "Confirm delete" both have the destructive class; "Cancel" does not', () => {
  render(<ActivityBank />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  // re-query after the entry-point click re-renders this row with Confirm delete/Cancel visible
  expect(screen.getByRole('button', { name: 'Confirm delete' })).toHaveClass(buttonStyles.destructive)
  expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveClass(buttonStyles.destructive)
})
```

### FRONTEND-031-AC-15 / AC-16 (regression guards — stays unstyled)
```typescript
it('AC-15/AC-16: a representative sample of unaffected buttons has neither variant class', () => {
  // one assertion per enumerated button in the two regression-guard ACs, e.g.:
  render(<WeeklyPlanner />)
  const addButton = screen.getByRole('button', { name: /^Add to/ })
  expect(addButton).not.toHaveClass(buttonStyles.primary)
  expect(addButton).not.toHaveClass(buttonStyles.destructive)
})
```

### FRONTEND-031-AC-17 (manual — no automated sketch)
No Vitest sketch — contrast is a rendered-colour property, not testable without real CSS injection
(see Rationale above). Verify manually in a real browser:
1. Open a view with a primary button (e.g. Activity Bank's "Add activity") in light theme; use a
   contrast-checker tool (e.g. browser DevTools' built-in contrast ratio display on the computed
   `color`/`background-color` pair) to confirm ≥4.5:1.
2. Repeat in dark theme.
3. Repeat both theme checks for a destructive button (e.g. "Confirm delete").

## Acceptance Criteria Summary

- [x] FRONTEND-031-AC-01 — `theme.css` defines `--error-ink`
- [x] FRONTEND-031-AC-02 — `buttonVariants.module.css` defines `.primary`
- [x] FRONTEND-031-AC-03 — `buttonVariants.module.css` defines `.destructive`
- [x] FRONTEND-031-AC-04 — neither variant overrides `:focus-visible`
- [x] FRONTEND-031-AC-05 — `index.css` adds a generic `button:disabled` rule
- [x] FRONTEND-031-AC-06 — "Add activity" is primary
- [x] FRONTEND-031-AC-07 — "Add sub-task" is primary
- [x] FRONTEND-031-AC-08 — BucketList's "Add" is primary
- [x] FRONTEND-031-AC-09 — "Log in" is primary
- [x] FRONTEND-031-AC-10 — ActivityForm/SubTaskForm submit buttons are primary; Cancel is not
- [x] FRONTEND-031-AC-11 — AssignActivityPicker's "Assign" is primary; Cancel is not
- [x] FRONTEND-031-AC-12 — OccurrenceItem's Complete/Undo toggle is primary in both states
- [x] FRONTEND-031-AC-13 — ActivityBank's Delete/Confirm delete are destructive; Cancel is not
- [x] FRONTEND-031-AC-14 — SubTaskList's Delete/Confirm delete are destructive; Cancel is not
- [x] FRONTEND-031-AC-15 — icon-only and selection-row buttons receive no variant class
- [x] FRONTEND-031-AC-16 — every remaining named button receives no variant class
- [x] FRONTEND-031-AC-17 — contrast meets WCAG AA in both themes (real-browser check)
