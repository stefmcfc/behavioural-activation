# Category-Colour Swatch Discoverability in Settings (Frontend)

**Status**: Not started

**Priority**: P3 — minor, low-risk discoverability/visual polish; nothing else depends on it.

**Depends on**: `frontend_spec_005_navigation_and_theme.md` (`Settings.tsx`'s "Category colours"
fieldset and `utils/categoryColors.ts`'s `getCategoryColor`/`setCategoryColor`/
`resetCategoryColor`/`subscribeToCategoryColorChanges`, all reused unmodified)

**Area**: Frontend

**Roadmap version**: V1 (close-out item — see `.claude/v1_work_to_be_delivered.md`)

## Overview

Settings' "Category colours" section shows a plain circular `<input type="color">` swatch next to
each category's name and its "Reset to default" button — nothing about the swatch's current
styling hints that it's clickable and opens a colour picker. This spec adds a small, purely
cosmetic affordance: a visible "Change colour" hint text next to each swatch, plus a visible
hover/focus highlight on the swatch itself, so a user doesn't have to guess-click it. Raised in
`.claude/SPEC_CANDIDATES.md`'s "Category-colour swatch discoverability in Settings" entry
(2026-10-06).

**No behavioural change of any kind** — `handleColorChange`/`handleReset` and the
`categoryColors.ts` utilities they call are untouched. This is markup/CSS only.

**Resolved ambiguity, not explicit in the originating candidate**: the new "Change colour" hint
text is a plain, non-interactive `<span>`, **not** a second `<label htmlFor={inputId}>`. This
matters because `Settings.test.tsx`'s existing tests (`FRONTEND-005-AC-20` through `AC-25`) resolve
the swatch via `screen.getByLabelText(/^routine$/i)` — an exact-anchored match against the
category-name label's accessible name. Per the HTML label/accname algorithm, a form control with
*multiple* associated `<label for>` elements gets its accessible name computed by concatenating all
of them — so adding a second label (even one carrying only "Change colour") would silently change
every swatch's accessible name (e.g. to "Routine Change colour") and break those five pre-existing,
already-passing tests. Keeping the hint as a plain `<span>` sidesteps this entirely: the existing
`<label>` (and therefore every existing test) is untouched, and the hint is still visible to sighted
users, which is the actual ask.

**Out of scope**: making the hint text itself independently clickable (the swatch is already
clickable; the candidate's own wording — "a visible label, a hover/focus state, or similar" — asks
for visibility, not a second click target); any change to the swatch's size, shape, or colour-
picker behaviour; any change to the "Reset to default" button.

## Requirements

### Requirement 1 — A visible "Change colour" hint next to each swatch

As a user, I want a visible hint that the colour circle is clickable, so I don't have to guess-click
it to discover the colour picker.

- **FRONTEND-057-AC-01** [AUTO]: Settings' Category colours section shall render a visible "Change
  colour" text next to each category's colour swatch, in addition to the existing category-name
  text.
- **FRONTEND-057-AC-02** [AUTO — regression guard]: Each swatch's existing `<label
  htmlFor={inputId}>{CATEGORY_LABELS[category]}</label>` shall remain exactly as it is today — its
  accessible name shall still resolve to exactly the bare category name, with no other text
  concatenated into it (guards `Settings.test.tsx`'s pre-existing `FRONTEND-005-AC-20`–`AC-25`
  tests, which rely on `screen.getByLabelText(/^routine$/i)`'s exact-anchored match).

### Requirement 2 — A visible hover/focus affordance on the swatch itself

As a user, I want the swatch to visually react when I hover or tab to it, the same way every other
interactive control in this app does, so it reads as clickable even before I notice the hint text.

- **FRONTEND-057-AC-03** [MANUAL — verified by a real-browser visual check in both Light and Dark
  themes, since jsdom cannot render CSS (`frontend_conventions.md`'s Testing Strategy note)]: On
  keyboard focus, the colour swatch shall display a visible focus ring using this app's existing
  `--accent` treatment (matching `.themeList label:focus-within`'s existing precedent elsewhere in
  this same file), clearly distinguishable from its resting (unfocused) state.
- **FRONTEND-057-AC-04** [MANUAL — same verification method as AC-03]: On mouse hover, the colour
  swatch shall display a visible highlight, clearly distinguishable from its resting state.

### Requirement 3 — Colour-change and reset behaviour is unmodified

As a user, I want this visual change to be purely cosmetic — changing or resetting a category's
colour must keep working exactly as it does today.

- **FRONTEND-057-AC-05** [AUTO — regression guard]: Changing a category's colour via the swatch, and
  resetting it via "Reset to default," shall continue to call `setCategoryColor`/
  `resetCategoryColor` (via `handleColorChange`/`handleReset`) exactly as before, with no change to
  their behaviour.

## Component changes

`frontend/src/components/Settings/Settings.tsx` — one new line inside the existing category-colour
`<li>`, no change to any existing element:

```tsx
<li key={category} className={styles.categoryRow}>
  <input
    id={inputId}
    className={styles.swatch}
    type="color"
    value={categoryColors[category]}
    onChange={(event) => handleColorChange(category, event.target.value)}
  />
  <label htmlFor={inputId}>{CATEGORY_LABELS[category]}</label>
  <span className={styles.changeColourHint}>Change colour</span> {/* new -- FRONTEND-057-AC-01 */}
  <button
    type="button"
    className={styles.resetButton}
    aria-label={`Reset ${CATEGORY_LABELS[category]} colour to default`}
    onClick={() => handleReset(category)}
  >
    Reset to default
  </button>
</li>
```

`frontend/src/components/Settings/Settings.module.css` — new rules only, nothing existing removed
or altered:

```css
.changeColourHint {
  font-size: 0.8rem;
  color: var(--text-muted); /* match whatever this codebase's existing muted/secondary-text token is named */
}

input[type='color'].swatch:hover {
  box-shadow: 0 0 0 3px var(--accent); /* FRONTEND-057-AC-04 */
}

input[type='color'].swatch:focus-visible {
  outline: 2px solid var(--accent); /* FRONTEND-057-AC-03, matches .themeList label:focus-within */
  outline-offset: 2px;
}
```

Exact shadow/outline values, the real muted-text custom property name, and hint-text placement
(before or after the Reset button) are left to implementation — the requirement is a clearly
visible, theme-appropriate affordance in both Light and Dark, not a specific pixel value.

## Cross-references

| This spec | Contracts against |
|---|---|
| `Settings.tsx`/`Settings.module.css` (`frontend_spec_005_navigation_and_theme.md`) | Extended — new hint `<span>` + hover/focus CSS, nothing existing removed |
| `categoryColors.ts` (`frontend_spec_005_navigation_and_theme.md`) | Reused unmodified — `getCategoryColor`/`setCategoryColor`/`resetCategoryColor`/`subscribeToCategoryColorChanges` |
| `CATEGORY_LABELS` (`utils/categoryLabels.ts`) | Reused unmodified |
| `Settings.test.tsx`'s `FRONTEND-005-AC-20`–`AC-25` | Regression-guarded (AC-02) — exact-anchored `getByLabelText` queries must keep resolving to the bare category name |
| `.claude/SPEC_CANDIDATES.md` | "Category-colour swatch discoverability in Settings" entry — resolved here; removed from that file as part of this change |
| `.claude/v1_work_to_be_delivered.md` | V1 close-out recommendation this spec fulfils |

## Test case sketches (Vitest + RTL, red before implementation)

```tsx
describe('FRONTEND-057-AC-01: a visible "Change colour" hint appears per category', () => {
  it('renders a "Change colour" hint next to each category colour swatch', () => {
    render(<Settings />)
    expect(screen.getAllByText(/change colour/i)).toHaveLength(3)
  })
})

describe('FRONTEND-057-AC-02: the existing category-name label is unchanged', () => {
  it('still resolves each swatch via its exact, unmodified category-name accessible name', () => {
    render(<Settings />)
    expect(screen.getByLabelText(/^routine$/i)).toHaveValue('#0072b2')
    expect(screen.getByLabelText(/^necessary$/i)).toHaveValue('#e69f00')
    expect(screen.getByLabelText(/^pleasurable$/i)).toHaveValue('#009e73')
  })
})

describe('FRONTEND-057-AC-05: colour change/reset behaviour is unmodified', () => {
  it('still persists a colour change and reverts it on reset, exactly as before', async () => {
    render(<Settings />)

    fireEvent.change(screen.getByLabelText(/^routine$/i), { target: { value: '#123456' } })
    expect(localStorage.getItem('bap-category-colors')).toContain('#123456')

    await userEvent.click(screen.getByRole('button', { name: /reset routine colour to default/i }))
    expect(screen.getByLabelText(/^routine$/i)).toHaveValue('#0072b2')
  })
})
```

`FRONTEND-057-AC-03`/`AC-04` have no automated test — see each AC's `[MANUAL]` marker for the
real-browser verification method.

## Acceptance Criteria Summary

- [ ] FRONTEND-057-AC-01 — a visible "Change colour" hint renders next to each swatch
- [ ] FRONTEND-057-AC-02 — the existing category-name label's accessible name is unchanged (regression guard)
- [ ] FRONTEND-057-AC-03 — keyboard focus shows a visible ring on the swatch (real-browser, both themes)
- [ ] FRONTEND-057-AC-04 — mouse hover shows a visible highlight on the swatch (real-browser, both themes)
- [ ] FRONTEND-057-AC-05 — colour change/reset behaviour is unmodified (regression guard)
