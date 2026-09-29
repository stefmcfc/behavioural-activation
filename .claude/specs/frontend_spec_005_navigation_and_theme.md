# Navigation, Theme, and Category Chips (Frontend)

**Status**: Not started
**Priority**: P2 — usability polish layered on top of the fully-delivered V1 feature set; doesn't
block V2 backend work.
**Depends on**: `frontend_spec_002_activity_bank.md` (wraps `ActivityBank` under `/activities`, its
`ActivityCategory` type and category-label pattern), `frontend_spec_003_sub_tasks.md` (wraps/edits
`SubTaskList`'s per-item category display), `frontend_spec_004_week_planning.md` (wraps
`WeeklyPlanner` under `/planner`, edits `OccurrenceItem`'s per-item category display). No paired
backend spec — this is frontend-only (see Overview).
**Area**: Frontend
**Roadmap version**: V1 (cross-cutting navigation/UX polish on top of the already-delivered V1
feature set — activity bank, sub-tasks, weekly planner — rather than a new V1 user story of its
own; no new backend functionality, no V2+ scope pulled forward)

## Overview

Introduces real client-side navigation (`react-router-dom`) with three tabs — Activities, Weekly
Planner, Settings — replacing `App.tsx`'s current single-page stack of `<WeeklyPlanner />` +
`<ActivityBank />` with no routing at all. Adds a new Settings page for two purely client-side
preferences (light/dark/system theme, per-category chip colours), both persisted to
`localStorage` with **no backend involvement, no new endpoint, and nothing added to the `User`
entity** — this is a deliberate scope boundary, not an oversight (see Out of scope). Adds a
reusable `CategoryChip` component that replaces the plain "Name — Category" text suffix currently
rendered in three places (`ActivityBank.tsx`, `SubTaskList.tsx`, `OccurrenceItem.tsx`) with a
coloured chip, and lets the user customize each category's chip colour while the chip's *text*
colour is always computed automatically for contrast, never user-chosen.

This isn't tied to a specific numbered user story in `.claude/HIGH_LEVEL_DESIGN.md` — it's
cross-cutting UX/navigation infrastructure supporting all of V1's delivered stories (US-001–US-009)
at once, in service of `product.md`'s "calm, non-gamified UI" goal and the general usability bar
implied by having three now-separate feature areas sharing one page with no way to navigate between
them cleanly.

This spec is also where `.claude/steering/frontend_conventions.md`'s long-deferred Styling
placeholder gets resolved for real: **one `*.module.css` per component, colocated**, plus a new
global, non-module `frontend/src/theme.css` (imported once from `main.tsx`) that owns the
`:root` custom properties. `frontend/src/index.css` (Vite's scaffolded default, already customized
with its own `--text`/`--bg`/`--border`/`--accent`/`prefers-color-scheme` block — not the untouched
Vite template) currently duplicates what `theme.css` should own; this spec's `theme.css` supersedes
that block, and the duplicate is trimmed from `index.css` as part of the same change so there's
exactly one source of truth for the custom properties. `theme.css` adds three new things `index.css`
doesn't have today: the three category-colour custom properties, `[data-theme="light"]`/
`[data-theme="dark"]` attribute-selector override blocks, and the values used by `CategoryChip`.

**Out of scope**:
- Any backend change. No new endpoint, no new `dto/` shape, nothing on the `User` entity, no
  `*Api.ts` service file — everything in this spec is `localStorage` + client-side rendering (see
  the Cross-references table's explicit note on this deviation from the usual API-layer rule).
- Server-persisted preferences, or preferences following the user across devices/browsers — a
  future spec could add that once there's a concrete second-device/second-user need; not built
  ahead of one, per `product.md`'s multi-user non-goals.
- Guaranteeing WCAG AA (4.5:1) contrast for every background the user could pick via the free
  `<input type="color">` picker. `utils/contrast.ts` guarantees only that it picks the *objectively
  better* of pure-black or pure-white text for a given background — for a background that's
  already low-contrast against both (a mid-saturation, mid-lightness colour), neither choice may
  clear 4.5:1. This is stated plainly here rather than oversold as "ensures contrast."
- Drag-and-drop tab reordering, additional Settings sections (notifications, data export, etc.) —
  only theme mode and category colours are in scope.
- Any change to `ActivityBank`/`SubTaskList`/`WeeklyPlanner`'s own business logic — this spec only
  changes how their category text renders (Requirement 3) and where they're mounted (Requirement 1).

## Requirements

### Requirement 1 — Tab navigation

As a user, I want a persistent tab bar for Activities, Weekly Planner, and Settings, so I can move
between the app's areas without everything being stacked on one page.

- **FRONTEND-005-AC-01** [AUTO]: When the authenticated app renders, `App` shall render a
  persistent tab navigation (`TabNav`) with three links labelled "Activities", "Weekly Planner",
  and "Settings", positioned above the routed content and below the existing authenticated header
  (title, "Logged in as X", "Log out").
- **FRONTEND-005-AC-02** [AUTO]: When the user activates a tab link, the router shall navigate to
  that tab's route (`/activities` → `ActivityBank`, `/planner` → `WeeklyPlanner`, `/settings` →
  the new `Settings` component) and render the corresponding component without a full page reload.
- **FRONTEND-005-AC-03** [AUTO]: While a given route is active, that route's tab link shall carry
  `aria-current="page"`, and no other tab link shall carry it.
- **FRONTEND-005-AC-04** [AUTO]: When the app is loaded at `/`, the router shall redirect to
  `/activities`.
- **FRONTEND-005-AC-05** [AUTO]: While navigating between tabs, the shared authenticated header and
  `TabNav` itself shall remain mounted and rendered unchanged — only the `<Routes>` subtree beneath
  them shall swap, per `App.tsx`'s restructure (see Component outline below).
- **FRONTEND-005-AC-06** [AUTO]: When the user activates the browser's back-navigation control after
  switching from one tab to another, the router shall render the previously active tab's route
  again — exercising real browser/router history, not simulated component state.

### Requirement 2 — Settings: theme mode

As a user, I want to choose Light, Dark, or System appearance, so the app matches my preference and
persists it across visits.

- **FRONTEND-005-AC-07** [AUTO]: `Settings` shall render a labelled Light/Dark/System option group
  reflecting the currently stored theme preference, defaulting to "System" when nothing is stored
  yet.
- **FRONTEND-005-AC-08** [AUTO]: When the user selects a theme option, `Settings` shall persist the
  choice to `localStorage` under the `bap-theme-preference` key and apply it immediately, without a
  page reload.
- **FRONTEND-005-AC-09** [AUTO]: When the applied preference is "Light" or "Dark", the app shall set
  `data-theme="light"`/`data-theme="dark"` on `document.documentElement`, which shall take effect
  regardless of the OS's `prefers-color-scheme` value.
- **FRONTEND-005-AC-10** [AUTO]: When the applied preference is "System" (or nothing is stored),
  the app shall not set a `data-theme` attribute on `document.documentElement`, leaving appearance
  to `theme.css`'s `@media (prefers-color-scheme: dark)` block.
- **FRONTEND-005-AC-11** [AUTO]: On app start, a synchronous `applyStoredTheme()` utility
  (`src/utils/theme.ts`) shall read `bap-theme-preference` from `localStorage` (treating a missing
  or invalid value as "system") and set/remove the `data-theme` attribute accordingly; it shall be
  called at the top of `main.tsx`, before `createRoot(...).render()`.
- **FRONTEND-005-AC-12** [MANUAL]: On a hard reload with a previously chosen Light or Dark theme,
  the correct theme shall be visually applied with no perceptible flash of the alternate theme —
  verified by manual browser reload checks in a real browser (both an OS-light + stored-dark-
  override case and the reverse), since jsdom can't verify paint timing. Note: this AC accepts a
  best-effort, not a byte-for-byte, flash-free guarantee — a true zero-flash guarantee would need an
  inline `<script>` in `index.html` executing before any CSS/JS module load, which this spec
  deliberately doesn't add given this app's personal, low-stakes scale (see Component outline).
- **FRONTEND-005-AC-13** [AUTO]: While the applied preference is "System", `Settings` shall
  additionally display which mode is currently in effect (Light or Dark), determined via
  `window.matchMedia('(prefers-color-scheme: dark)').matches`.
- **FRONTEND-005-AC-14** [AUTO]: When the user selects "System" after previously having selected
  Light or Dark, `Settings` shall remove the `data-theme` attribute from `document.documentElement`,
  handing control back to the OS-driven media query.

### Requirement 3 — Category chip display

As a user, I want each activity's/sub-task's/occurrence's category shown as a clear coloured chip
instead of plain text, so I can visually scan by category at a glance.

- **FRONTEND-005-AC-15** [AUTO]: `CategoryChip` shall accept an `ActivityCategory` prop and render
  that category's label text on a background coloured with the category's current colour (built-in
  default unless customized per Requirement 4).
- **FRONTEND-005-AC-16** [AUTO]: `CategoryChip` shall compute its text colour by calling
  `getReadableTextColor()` (`src/utils/contrast.ts`) against its background colour, rather than
  using a hardcoded chip text colour.
- **FRONTEND-005-AC-17** [AUTO]: `ActivityBank`'s activity list shall render `CategoryChip` in place
  of its current plain-text `<span>{activity.name}</span> — <span>{CATEGORY_LABELS[...]}</span>`
  category suffix, for every activity.
- **FRONTEND-005-AC-18** [AUTO]: `SubTaskList`'s per-sub-task rows shall render `CategoryChip` in
  place of their current plain-text `<span>{subTask.name}</span> — <span>{CATEGORY_LABELS[...]}
  </span>` category suffix, for every sub-task. (The list's own `<h3>Sub-tasks — {label}</h3>`
  section heading is unchanged — it's a section label describing the parent activity's inherited
  category, not a per-item category display, and is out of scope.)
- **FRONTEND-005-AC-19** [AUTO]: `OccurrenceItem`'s rendering of each planned occurrence shall
  render `CategoryChip` in place of its current plain-text `<span>{occurrence.name}</span> —
  <span>{CATEGORY_LABELS[...]}</span>` category suffix, for every occurrence.

### Requirement 4 — Category colour customization

As a user, I want to customize each category's chip colour, with the chip's text always kept
legible automatically, so the chips fit my own visual preference without me having to manually pick
readable text.

- **FRONTEND-005-AC-20** [AUTO]: `Settings` shall render one native `<input type="color">` per
  category (Routine, Necessary, Pleasurable), each with an associated `<label>`.
- **FRONTEND-005-AC-21** [AUTO]: Each colour input shall default to that category's built-in default
  hex (see Data model below) unless a customized value is stored in `localStorage` under
  `bap-category-colors`, in which case it shall reflect the stored value.
- **FRONTEND-005-AC-22** [AUTO]: When the user changes a colour input's value, `Settings` shall
  persist the new hex for that category into the `bap-category-colors` `localStorage` entry and
  apply it immediately, without a page reload.
- **FRONTEND-005-AC-23** [AUTO]: When a category's colour is persisted per AC-22, every already-
  rendered `CategoryChip` instance for that category — across `ActivityBank`, `SubTaskList`, and
  `OccurrenceItem` wherever currently mounted — shall re-render with the new colour without a page
  reload.
- **FRONTEND-005-AC-24** [AUTO]: `Settings` shall render a "Reset to default" control for each
  category individually (per-category reset, not one global reset — see Data model below for the
  rationale).
- **FRONTEND-005-AC-25** [AUTO]: When the user activates "Reset to default" for a category,
  `Settings` shall remove that category's entry from `bap-category-colors`, and that category's
  colour input plus every rendered `CategoryChip` for it shall revert to the built-in default hex,
  without a page reload.
- **FRONTEND-005-AC-26** [AUTO]: `getReadableTextColor(backgroundHex)` (`src/utils/contrast.ts`)
  shall compute the WCAG relative-luminance contrast ratio of `backgroundHex` against both
  `#000000` and `#ffffff`, and return whichever of the two achieves the higher ratio.
  Where the two ratios are unequal, the returned colour shall be the objectively higher-contrast
  one — never a fixed/arbitrary choice.
- **FRONTEND-005-AC-27** [AUTO]: Given the three built-in default category hex values (see Data
  model below), `getReadableTextColor()` shall return the colours worked out by hand in this spec:
  Routine `#0072B2` → `#ffffff`; Necessary `#E69F00` → `#000000`; Pleasurable `#009E73` →
  `#000000`.
- **FRONTEND-005-AC-28** [AUTO]: Given `#ffffff`, `#000000`, and the mid-tone `#777777`,
  `getReadableTextColor()` shall return `#000000`, `#ffffff`, and `#000000` respectively — the last
  case demonstrating a close, non-obvious call (contrast against black ≈4.69 vs. against white
  ≈4.48 for `#777777`) that the utility still resolves correctly by computing rather than guessing.

## Data model, new dependency, and component outline

**New dependency**: `react-router-dom` `^7.18.4` — verified live via `npm view react-router-dom
version` (2026-09-29), the actual latest stable v7 release, not a guess.

**`localStorage` keys** (both under the `bap-` prefix to avoid collision with any future unrelated
key):
- `bap-theme-preference`: `"light" | "dark" | "system"`.
- `bap-category-colors`: JSON object, only customized categories present, e.g.
  `{"ROUTINE": "#1a2b3c"}` — an absent key means "use the built-in default," not "use black."

**Built-in default category colours** — the [Okabe–Ito colourblind-safe
palette](https://jfly.uni-koeln.de/color/), chosen for being clearly distinct and considerate of
the most common forms of colour-vision deficiency:
- Routine: `#0072B2` (blue)
- Necessary: `#E69F00` (orange/amber)
- Pleasurable: `#009E73` (bluish-green)

**Reset scope**: per-category, not global — chosen because the colour pickers are already
per-category (Requirement 4), so a matching per-category reset is the more consistent, less
surprising control; a user who only wants to undo one accidental change shouldn't have their other
two customizations wiped along with it.

**New files**:
- `frontend/src/theme.css` — global, non-module. Defines `--text`, `--bg`, `--border`, `--accent`
  (moved from `index.css`, values unchanged) plus three new custom properties,
  `--category-routine`, `--category-necessary`, `--category-pleasurable`, defaulting to the hexes
  above. `:root` holds the light values; a `@media (prefers-color-scheme: dark)` block redefines
  `--text`/`--bg`/`--border`/`--accent` for OS-dark-without-an-explicit-override (category colours
  are theme-independent — same hue in both themes, since `CategoryChip`'s own contrast computation
  already handles legibility); `[data-theme="light"]`/`[data-theme="dark"]` attribute-selector
  blocks override the `:root`/media-query values when the user has explicitly chosen a mode.
  Imported once from `main.tsx`. `index.css`'s existing duplicate `:root`/`@media
  (prefers-color-scheme: dark)` custom-property block is removed as part of this change — `index.css`
  keeps only its non-theme rules (`body`, `h1`/`h2`, `code`, font settings).
- `frontend/src/utils/theme.ts` — `applyStoredTheme()`, `getThemePreference()`,
  `setThemePreference(preference)`.
- `frontend/src/utils/categoryColors.ts` — `getCategoryColor(category)`,
  `setCategoryColor(category, hex)`, `resetCategoryColor(category)`, `DEFAULT_CATEGORY_COLORS`.
- `frontend/src/utils/contrast.ts` — `getReadableTextColor(backgroundHex)`, a pure function (WCAG
  relative-luminance formula), no component/DOM dependency, independently unit-testable.
- `frontend/src/components/Navigation/TabNav.tsx` (+ `TabNav.module.css`) — the three `NavLink`s.
- `frontend/src/components/Settings/Settings.tsx` (+ `Settings.module.css`) — theme section +
  category-colours section.
- `frontend/src/components/CategoryChip/CategoryChip.tsx` (+ `CategoryChip.module.css`).

**`App.tsx` restructure**: `main.tsx` wraps `<App />` in `<BrowserRouter>` (so `TabNav`'s `NavLink`s
have router context) and imports `theme.css` alongside `index.css`, calling `applyStoredTheme()`
before `createRoot(...).render()`. Inside `App.tsx`, the authenticated view keeps its header
(title, "Logged in as X", "Log out") and renders `<TabNav />` beneath it, both outside `<Routes>`;
`<Routes>` contains only `<Route path="/" element={<Navigate to="/activities" replace />} />`,
`<Route path="/activities" element={<ActivityBank />} />`, `<Route path="/planner" element={
<WeeklyPlanner />} />`, and `<Route path="/settings" element={<Settings />} />`. The existing
`App.test.tsx` needs its `render(<App />)` calls wrapped in `<MemoryRouter>` as part of this
change (a test-file maintenance detail, not its own AC — `App.tsx` itself intentionally excludes
the `BrowserRouter`/`MemoryRouter` provider so tests can swap in `MemoryRouter`).

## Cross-references

| This spec | Contracts against |
|---|---|
| `TabNav` | `react-router-dom`'s `NavLink`/`Routes`/`Route`/`Navigate`; wraps `ActivityBank` (`frontend_spec_002_activity_bank.md`), `WeeklyPlanner` (`frontend_spec_004_week_planning.md`), and this spec's new `Settings`, mounted at `/activities`, `/planner`, `/settings` |
| `Settings` | New component; reads/writes `localStorage` only via `utils/theme.ts`/`utils/categoryColors.ts` — no backend call |
| `CategoryChip` | `ActivityCategory` (`types/activity.ts`, unmodified); replaces the plain-text category suffix in `ActivityBank.tsx` (`frontend_spec_002_activity_bank.md`), `SubTaskList.tsx` (`frontend_spec_003_sub_tasks.md`), and `OccurrenceItem.tsx` (`frontend_spec_004_week_planning.md`) |
| `utils/contrast.ts` (`getReadableTextColor`) | Pure function, no dependencies; consumed by `CategoryChip` |
| `utils/theme.ts`, `utils/categoryColors.ts` | `localStorage` keys `bap-theme-preference`, `bap-category-colors` — client-only, no backend endpoint, nothing on the `User` entity |
| `theme.css` (new global stylesheet) | Supersedes the equivalent `:root`/`prefers-color-scheme` block currently duplicated in `index.css`; every component's own `*.module.css` (existing and new) references these custom properties per `frontend_conventions.md`'s Styling section (updated by this spec) |
| No new `services/*Api.ts` | Deliberate deviation from the usual "all backend calls through `services/`" rule — this spec makes zero backend calls |

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
describe('FRONTEND-005-AC-01/AC-02/AC-03: tab nav renders, navigates, marks the active tab', () => {
  it('renders three tabs and marks Activities as aria-current on the default route', () => {
    render(
      <MemoryRouter initialEntries={['/activities']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /activities/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /weekly planner/i })).not.toHaveAttribute('aria-current')
  })

  it('navigates to /planner and marks it active when its tab is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/activities']}>
        <App />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('link', { name: /weekly planner/i }))

    expect(await screen.findByRole('link', { name: /weekly planner/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

describe('FRONTEND-005-AC-04: root redirects to /activities', () => {
  it('renders the Activities tab as active when loaded at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /activities/i })).toHaveAttribute('aria-current', 'page')
  })
})

describe('FRONTEND-005-AC-05: shared header persists across tab switches', () => {
  it('keeps "Logged in as" visible after switching tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/activities']}>
        <App />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('link', { name: /settings/i }))

    expect(screen.getByText(/logged in as/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-06: browser back returns to the previous tab', () => {
  it('renders /activities again after Back following a switch to /planner', async () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/activities'] })
    render(<RouterProvider router={router} />)

    router.navigate('/planner')
    expect(await screen.findByRole('link', { name: /weekly planner/i })).toHaveAttribute(
      'aria-current',
      'page',
    )

    router.navigate(-1)
    expect(await screen.findByRole('link', { name: /activities/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

describe('FRONTEND-005-AC-07/AC-08/AC-09: selecting a theme persists and applies data-theme', () => {
  it('sets data-theme="dark" on <html> and persists it when Dark is chosen', async () => {
    render(<Settings />)

    await userEvent.click(screen.getByRole('radio', { name: /^dark$/i }))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('bap-theme-preference')).toBe('dark')
  })
})

describe('FRONTEND-005-AC-10/AC-14: System removes the data-theme override', () => {
  it('clears data-theme when switching from Dark back to System', async () => {
    localStorage.setItem('bap-theme-preference', 'dark')
    document.documentElement.setAttribute('data-theme', 'dark')
    render(<Settings />)

    await userEvent.click(screen.getByRole('radio', { name: /^system$/i }))

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})

describe('FRONTEND-005-AC-11: applyStoredTheme reads localStorage before first render', () => {
  it('sets data-theme="light" when "light" is stored', () => {
    localStorage.setItem('bap-theme-preference', 'light')

    applyStoredTheme()

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('defaults to no override for an invalid stored value', () => {
    localStorage.setItem('bap-theme-preference', 'not-a-real-value')

    applyStoredTheme()

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})

describe('FRONTEND-005-AC-13: System mode shows the currently-in-effect OS theme', () => {
  it('shows "currently: Dark" when matchMedia reports prefers-color-scheme: dark', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    )
    localStorage.setItem('bap-theme-preference', 'system')

    render(<Settings />)

    expect(screen.getByText(/currently.*dark/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-15/AC-16: CategoryChip renders label with computed text colour', () => {
  it('renders the Routine label on the default Routine background with white text', () => {
    render(<CategoryChip category="ROUTINE" />)

    const chip = screen.getByText('Routine')
    expect(chip).toHaveStyle({ backgroundColor: '#0072B2', color: '#ffffff' })
  })
})

describe('FRONTEND-005-AC-17/AC-18/AC-19: plain-text category suffix replaced by CategoryChip', () => {
  it('renders a CategoryChip, not raw "— Routine" text, in the activity list', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: '1', name: 'Walk', category: 'ROUTINE', description: null, createdAt: '2026-09-01T00:00:00Z' },
    ])
    render(<ActivityBank />)

    expect(await screen.findByText('Walk')).toBeInTheDocument()
    expect(screen.getByTestId('category-chip-ROUTINE')).toBeInTheDocument()
    expect(screen.queryByText(/— routine/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-005-AC-20/AC-21/AC-22/AC-23: colour picker persists and live-updates chips', () => {
  it('updates a rendered CategoryChip immediately after a colour change, no reload', async () => {
    render(
      <>
        <Settings />
        <CategoryChip category="ROUTINE" />
      </>,
    )

    await userEvent.click(screen.getByLabelText(/routine colour/i))
    fireEvent.change(screen.getByLabelText(/routine colour/i), { target: { value: '#123456' } })

    expect(localStorage.getItem('bap-category-colors')).toContain('#123456')
    expect(screen.getByText('Routine')).toHaveStyle({ backgroundColor: '#123456' })
  })
})

describe('FRONTEND-005-AC-24/AC-25: reset to default reverts colour and stored override', () => {
  it('removes the ROUTINE override and reverts the input + chip to the default hex', async () => {
    localStorage.setItem('bap-category-colors', JSON.stringify({ ROUTINE: '#123456' }))
    render(<Settings />)

    await userEvent.click(screen.getByRole('button', { name: /reset.*routine/i }))

    expect(JSON.parse(localStorage.getItem('bap-category-colors') ?? '{}')).not.toHaveProperty('ROUTINE')
    expect(screen.getByLabelText(/routine colour/i)).toHaveValue('#0072b2')
  })
})

describe('FRONTEND-005-AC-26/AC-27/AC-28: getReadableTextColor picks the higher-contrast option', () => {
  it.each([
    ['#ffffff', '#000000'],
    ['#000000', '#ffffff'],
    ['#0072B2', '#ffffff'],
    ['#E69F00', '#000000'],
    ['#009E73', '#000000'],
    ['#777777', '#000000'],
  ])('resolves %s to %s', (background, expected) => {
    expect(getReadableTextColor(background)).toBe(expected)
  })
})
```

## Acceptance Criteria Summary

- [ ] FRONTEND-005-AC-01 — persistent tab nav with three labelled links, above routed content
- [ ] FRONTEND-005-AC-02 — activating a tab navigates to its route, renders the right component, no full reload
- [ ] FRONTEND-005-AC-03 — active route's tab carries `aria-current="page"`, others don't
- [ ] FRONTEND-005-AC-04 — `/` redirects to `/activities`
- [ ] FRONTEND-005-AC-05 — shared header + `TabNav` stay mounted across route switches
- [ ] FRONTEND-005-AC-06 — browser back returns to the previously active tab's route
- [ ] FRONTEND-005-AC-07 — `Settings` shows Light/Dark/System, defaulting to System when unset
- [ ] FRONTEND-005-AC-08 — selecting an option persists to `localStorage` and applies immediately
- [ ] FRONTEND-005-AC-09 — Light/Dark sets `data-theme`, overriding OS preference
- [ ] FRONTEND-005-AC-10 — System sets no `data-theme`, leaving it to the media query
- [ ] FRONTEND-005-AC-11 — `applyStoredTheme()` runs before render, reads/defaults correctly
- [ ] FRONTEND-005-AC-12 — manual no-flash check on reload, both directions (MANUAL)
- [ ] FRONTEND-005-AC-13 — System mode shows which OS theme is currently in effect
- [ ] FRONTEND-005-AC-14 — selecting System after Light/Dark removes the `data-theme` override
- [ ] FRONTEND-005-AC-15 — `CategoryChip` renders the category label on its current colour
- [ ] FRONTEND-005-AC-16 — `CategoryChip` computes text colour via `getReadableTextColor()`
- [ ] FRONTEND-005-AC-17 — `ActivityBank` list uses `CategoryChip`, not plain text
- [ ] FRONTEND-005-AC-18 — `SubTaskList` per-item rows use `CategoryChip`, not plain text
- [ ] FRONTEND-005-AC-19 — `OccurrenceItem` uses `CategoryChip`, not plain text
- [ ] FRONTEND-005-AC-20 — `Settings` renders one labelled colour picker per category
- [ ] FRONTEND-005-AC-21 — picker defaults to built-in hex unless customized
- [ ] FRONTEND-005-AC-22 — changing a colour persists it and applies immediately
- [ ] FRONTEND-005-AC-23 — persisted colour re-renders all matching chips, no reload
- [ ] FRONTEND-005-AC-24 — per-category "Reset to default" control rendered
- [ ] FRONTEND-005-AC-25 — reset clears the stored override and reverts input + chips
- [ ] FRONTEND-005-AC-26 — `getReadableTextColor()` picks the objectively higher-contrast option
- [ ] FRONTEND-005-AC-27 — correct results for the three built-in default category hexes
- [ ] FRONTEND-005-AC-28 — correct results for `#ffffff`/`#000000`/`#777777`, including the close call
