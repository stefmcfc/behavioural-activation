# Header Restructure — Settings/Account Icons, Tabs Demoted to a Second Row

**Status**: Not started
**Priority**: P3 — visual/UX cleanup, no new capability (Settings and account info/log out already
exist; this relocates them)
**Depends on**: `frontend_spec_005_navigation_and_theme.md` (`TabNav`, `Settings`, the theme/colour
preferences this relocates but does not change), `frontend_spec_001_login.md` (`App.tsx`'s session
gate and `handleLogout`, unchanged)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish — not tied to a specific `HIGH_LEVEL_DESIGN.md` version theme

## Overview

Promotes the `.claude/SPEC_CANDIDATES.md` entry "Header restructure: Settings + Account/Profile
icons, tabs demoted to a second row" to a real spec. That entry already settled the product-level
scope during an earlier design pass (2026-09-29, restated here as **settled, not re-litigated**):

1. Replace the current header — `<h1>` title, then a static "Logged in as {username}" paragraph, then
   a standalone "Log out" button, then `TabNav` (Activities / Weekly Planner / Settings, three equal
   tabs) — with: a top row of **Title | Settings icon | Account/profile icon**, and a second row
   containing just the remaining two tabs (Activities, Weekly Planner).
2. Settings and Account/Profile are **two separate icon-triggered menus**, not one combined menu —
   confirmed reasoning: they're different categories (Settings = how the app looks/behaves;
   Account/Profile = who's logged in), and starting separated avoids re-splitting a combined menu
   later once Account/Profile content grows.
3. Account/Profile menu content for this spec is deliberately minimal: just the username (replacing
   "Logged in as X") and the Log out action (replacing the standalone button). Notifications/email
   preferences, change password, etc. are explicitly **not** this spec's scope — don't build ahead of
   a concrete need for them.

**What was still open going into this spec** (per that candidate's own "needs a real design pass"
note) and how it's resolved below: icon choice, the menu/dropdown interaction pattern, and
keyboard/focus handling.

**Interaction pattern — the native Popover API, researched via this project's `modern-web-guidance`
skill before drafting ACs**: this codebase has no existing anchored-dropdown/popover component
(`Modal.tsx` is a centered `<dialog>` with a full backdrop — the right fit for the bigger flows it's
used for, but too heavy for a small header menu). The HTML Popover API
(`popover="auto"` on the panel, `popovertarget="<id>"` on the trigger `<button>`) is Baseline **Newly
Available** (since 2025-01-27; Chrome 116+, Firefox 125+, Safari 17+) and gives, with **zero custom
JavaScript**:
- Declarative toggle-open/close from the trigger button (`popovertarget` alone, no extra attribute,
  already defaults to toggle behavior).
- Native light-dismiss: clicking outside the panel or pressing Escape closes it.
- Top-layer rendering (the panel is never clipped by an ancestor's `overflow: hidden`).
- Mutual exclusivity for free: `popover="auto"` means opening one auto-popover automatically closes
  any other that's currently open — exactly what's wanted for "open Account while Settings is open
  closes Settings," with no custom coordination code.

This mirrors how `Modal.tsx` already leans on a modern native primitive (`closedby="any"` on
`<dialog>`) rather than hand-rolling focus-trap/dismiss logic — same approach, applied to the lighter
primitive that actually fits a small anchored menu. **No polyfill** is added, consistent with that
existing precedent — this is a single-user, self-hosted app the user runs in their own
evergreen browser, not a broadly public site needing old-browser fallbacks.

**Positioning — plain CSS, not CSS anchor positioning**: the `modern-web-guidance` research surfaced
CSS anchor positioning (`position-area`) as the modern way to tether a popover to its trigger with
automatic edge-flipping, but it currently has **limited availability** (not yet supported in Chrome,
Edge, or Firefox per that guide). It also solves a problem this spec doesn't have — the trigger icons
live in a fixed spot at the top of the page, so there's no viewport-edge collision to flip away from.
Plain CSS is simpler and fully supported: a `position: relative` wrapper around each trigger+panel
pair, with the panel `position: absolute`, anchored to the wrapper's bottom-right.

**Accessibility shape — a disclosure panel, not an ARIA menu**: neither panel implements arrow-key
menu navigation (the Settings panel holds radio inputs and colour pickers; the Account panel holds
text and a single button) — ordinary interactive content revealed by a button, not a `role="menu"`
widget. Per the `modern-web-guidance` research, `role="menu"`/`role="menuitem"`/`aria-haspopup="menu"`
are only appropriate when that keyboard contract is actually implemented, so none of them are used
here. Each trigger button is linked to its panel's accessible name via `aria-labelledby` pointing at a
visible heading inside the panel (the same `titleId` pattern `Modal.tsx` already establishes
elsewhere in this codebase, applied here to a popover instead of a dialog).

**Judgment call, flagged explicitly — icon choice**: a gear/cog for Settings, a person-in-a-circle for
Account — near-universal conventions, built as small local SVG function components (mirroring
`WeeklyPlanner.tsx`'s local `ChevronIcon` — single-use within this feature, not promoted to a shared
icon folder like `RepeatableIcon`/`FavouriteIcon`, which are reused across several components). **This
is a judgment call** — easy to swap for different iconography if these don't read well in practice.

**Judgment call, flagged explicitly — `/settings` redirects rather than 404s**: since Settings moves
from a routed page into a popover, direct navigation to `/settings` (a stale bookmark, browser
back/forward) redirects to `/activities`, mirroring the existing `/` → `/activities` redirect already
in `App.tsx`. **This is a judgment call**, not dictated by the candidate's own notes — flagged in case
a different fallback is preferred.

## Requirement 1: Header restructures to Title | Settings icon | Account icon, tabs demoted to a second row

**User story**: As a user, I want the "who am I / how does this look" controls out of the main content
flow and into a compact icon row, so the page header reads as navigation chrome, not another block of
content to scroll past.

### FRONTEND-030-AC-01 [AUTO]: App renders Title, Settings icon, Account icon as one row
**Statement**: `App.tsx` shall render, in order, the app title, a Settings icon button (accessible
name "Settings"), and an Account icon button (accessible name "Account") as a single header row,
replacing the existing "Logged in as {username}" paragraph and standalone "Log out" button.

**References**: Component: `frontend/src/App.tsx`

### FRONTEND-030-AC-02 [AUTO]: TabNav renders as a second row with only two tabs
**Statement**: `TabNav` shall render immediately below the icon row and shall list only "Activities"
and "Weekly Planner" — "Settings" shall no longer appear as a tab.

**References**: Component: `frontend/src/components/Navigation/TabNav.tsx` (`TABS` array)

### FRONTEND-030-AC-03 [AUTO]: The /settings route redirects to /activities
**Statement**: `App.tsx`'s `<Routes>` shall no longer render a `Settings` page component at
`/settings`; navigating to `/settings` shall redirect to `/activities`, mirroring the existing `/` →
`/activities` redirect.

**References**: Component: `frontend/src/App.tsx` (`<Route path="/settings" element={<Navigate
to="/activities" replace />} />`)

## Requirement 2: The Settings icon opens a popover with the existing Settings content

**User story**: As a user, I want to open a small panel to change my theme or category colours
without leaving the page I'm on, instead of navigating to a separate Settings tab.

### FRONTEND-030-AC-04 [AUTO]: Clicking the Settings icon opens a popover with the existing Appearance and Category colours content
**Statement**: Clicking the Settings icon button shall open a popover panel (`popover="auto"`)
containing the existing Appearance (theme) and Category colours fieldsets, unchanged in markup and
behavior from the current `Settings` component.

**References**: Component: `frontend/src/components/Settings/Settings.tsx` (content, unchanged),
new: `frontend/src/components/Navigation/SettingsMenu.tsx`

### FRONTEND-030-AC-05 [AUTO]: Clicking the Settings icon again closes the popover
**Statement**: While the Settings popover is open, clicking the Settings icon button a second time
shall close it (native `popovertarget` toggle behavior).

**References**: Component: `frontend/src/components/Navigation/SettingsMenu.tsx`

### FRONTEND-030-AC-06 [MANUAL]: Clicking outside or pressing Escape closes the Settings popover
**Statement**: In a real browser, while the Settings popover is open, clicking anywhere outside it or
pressing Escape shall close it, with no custom JavaScript dismiss handler.

**Rationale**: `[MANUAL]` — this is native `popover="auto"` light-dismiss behavior; jsdom's Popover
API support may not fully model outside-click/Escape dismissal, so a real-browser check is the honest
way to verify it, consistent with this project's established pattern for native-platform-behavior ACs
(e.g. `frontend_spec_025`-AC-03's cursor-affordance check).

**References**: Component: `frontend/src/components/Navigation/SettingsMenu.tsx`

## Requirement 3: The Account icon opens a popover with the username and Log out

**User story**: As a user, I want to check who I'm logged in as and log out from a small panel near
the top of the page, instead of a static line of text and a button taking up space in the main content.

### FRONTEND-030-AC-07 [AUTO]: Clicking the Account icon opens a popover showing the username and a Log out button
**Statement**: Clicking the Account icon button shall open a popover panel (`popover="auto"`)
showing the authenticated username (replacing the current "Logged in as {username}" text) and a "Log
out" button (replacing the current standalone button).

**References**: New: `frontend/src/components/Navigation/AccountMenu.tsx`

### FRONTEND-030-AC-08 [AUTO]: Logging out from the Account popover behaves exactly as the existing Log out action
**Statement**: Clicking "Log out" inside the Account popover shall call `authApi.logout()` and
transition `session` to `{ status: 'unauthenticated' }`, identical to the existing (now-removed)
standalone button's behavior.

**Rationale**: Explicit regression guard — relocating the trigger must not change `handleLogout`'s
behavior.

**References**: Component: `frontend/src/App.tsx` (`handleLogout`, unchanged)

### FRONTEND-030-AC-09 [AUTO]: Opening one popover closes the other
**Statement**: While the Settings popover is open, clicking the Account icon shall close the Settings
popover and open the Account popover (and vice versa) — native `popover="auto"` mutual-exclusivity,
no custom coordination code.

**References**: Components: `frontend/src/components/Navigation/SettingsMenu.tsx`,
`frontend/src/components/Navigation/AccountMenu.tsx`

## Requirement 4: Existing navigation and Settings behavior are fully unaffected

**User story**: As a user, I want switching between Activities and Weekly Planner, and changing my
theme or category colours, to keep working exactly as before — only where they live in the page
changed.

### FRONTEND-030-AC-10 [AUTO]: Activities/Weekly Planner tab navigation is unaffected
**Statement**: Clicking "Activities" or "Weekly Planner" in the demoted second-row `TabNav` shall
navigate and mark the active tab exactly as `frontend_spec_005`'s existing `FRONTEND-005-AC-01`/`AC-03`
already specify.

**References**: Component: `frontend/src/components/Navigation/TabNav.tsx`

### FRONTEND-030-AC-11 [AUTO]: Theme and category colour behavior, now inside the Settings popover, is unaffected
**Statement**: Selecting a theme preference and changing or resetting a category colour, now inside
the Settings popover, shall continue to behave exactly as `frontend_spec_005`'s existing
`FRONTEND-005-AC-07` through `AC-25` already specify (persistence, live `data-theme` application,
system-theme display, live colour updates, reset-to-default).

**References**: Component: `frontend/src/components/Settings/Settings.tsx` (unchanged)

## Explicitly out of scope (do not implement as part of this spec)

- Any Account/Profile menu content beyond username + Log out (notifications/email preferences,
  change password, etc.) — explicitly deferred per the candidate's own scope note.
- Combining Settings and Account into one menu — confirmed separate, see Overview.
- CSS anchor positioning (`position-area`) — not yet broadly supported; plain CSS positioning is used
  instead (see Overview).
- A true ARIA `role="menu"` widget with arrow-key navigation — neither panel's content needs it (see
  Overview's accessibility-shape rationale).
- Any mobile/narrow-viewport-specific redesign of the header — this project has no established
  responsive/mobile story yet (touch/mobile is explicitly out of scope elsewhere, e.g.
  `frontend_spec_025`/`026`/`028`'s drag-and-drop specs); this spec only needs to not visually break
  at the desktop widths this app is actually used at.

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/App.tsx` | Header row restructure, `/settings` redirect, `handleLogout` (unchanged, now called from `AccountMenu`) |
| `frontend/src/components/Navigation/TabNav.tsx` | `TABS` array loses the Settings entry |
| `frontend/src/components/Navigation/SettingsMenu.tsx` | New — Settings icon trigger + popover wrapping the existing `Settings` component |
| `frontend/src/components/Navigation/AccountMenu.tsx` | New — Account icon trigger + popover with username + Log out |
| `frontend/src/components/Settings/Settings.tsx` | Content moved into a popover; internal markup/behavior unchanged |
| `frontend/src/components/Modal/Modal.tsx` | The `aria-labelledby`/`titleId` pattern this spec's popovers mirror (for a popover instead of a dialog) |
| `.claude/SPEC_CANDIDATES.md` | The candidate entry this spec promotes — remove once this spec is written |
| `frontend_spec_005_navigation_and_theme.md` | The original `TabNav`/`Settings` ACs this spec regression-guards |

## TDD test case sketches

### FRONTEND-030-AC-01 / AC-02 / AC-03
```typescript
describe('FRONTEND-030: header restructure', () => {
  it('AC-01: renders Title, Settings icon, Account icon as one row, no more "Logged in as" text', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
    render(<App />)
    await screen.findByText('Behavioural Activation Planner')
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument()
    expect(screen.queryByText(/logged in as/i)).not.toBeInTheDocument()
  })

  it('AC-02: TabNav lists only Activities and Weekly Planner', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Activities' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Weekly Planner' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('AC-03: navigating to /settings redirects to /activities', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
    render(<App />, { route: '/settings' })
    expect(await screen.findByRole('heading', { name: 'Activity Bank' })).toBeInTheDocument()
  })
})
```

### FRONTEND-030-AC-04 / AC-05 / AC-09
```typescript
describe('FRONTEND-030: SettingsMenu popover', () => {
  it('AC-04: opens to reveal the Appearance and Category colours fieldsets', async () => {
    render(<SettingsMenu />)
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Category colours' })).toBeInTheDocument()
  })

  it('AC-05: clicking the trigger again closes it', async () => {
    render(<SettingsMenu />)
    const trigger = screen.getByRole('button', { name: 'Settings' })
    await userEvent.click(trigger)
    await userEvent.click(trigger)
    expect(screen.queryByRole('group', { name: 'Appearance' })).not.toBeInTheDocument()
  })

  it('AC-09: opening Account closes an already-open Settings popover', async () => {
    render(
      <>
        <SettingsMenu />
        <AccountMenu username="steve" onLogout={vi.fn()} />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.queryByRole('group', { name: 'Appearance' })).not.toBeInTheDocument()
    expect(screen.getByText('steve')).toBeInTheDocument()
  })
})
```

### FRONTEND-030-AC-07 / AC-08
```typescript
describe('FRONTEND-030: AccountMenu popover', () => {
  it('AC-07: opens to show the username and a Log out button', async () => {
    render(<AccountMenu username="steve" onLogout={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.getByText('steve')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it('AC-08: clicking Log out calls the provided handler', async () => {
    const onLogout = vi.fn()
    render(<AccountMenu username="steve" onLogout={onLogout} />)
    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(onLogout).toHaveBeenCalled()
  })
})
```

### FRONTEND-030-AC-10 / AC-11
```typescript
describe('FRONTEND-030: existing navigation/Settings behavior unaffected', () => {
  it('AC-10: tab navigation and active-tab marking still work (frontend_spec_005 regression guard)', () => {
    // exercises the pre-existing FRONTEND-005-AC-01/AC-03 path unchanged
  })
  it('AC-11: theme/colour behavior inside the popover still works (frontend_spec_005 regression guard)', () => {
    // exercises the pre-existing FRONTEND-005-AC-07 through AC-25 path unchanged, now rendered inside SettingsMenu
  })
})
```

## Acceptance Criteria Summary

- [ ] FRONTEND-030-AC-01 — Title, Settings icon, Account icon render as one header row
- [ ] FRONTEND-030-AC-02 — TabNav renders as a second row with only two tabs
- [ ] FRONTEND-030-AC-03 — `/settings` redirects to `/activities`
- [ ] FRONTEND-030-AC-04 — Settings icon opens a popover with the existing Settings content
- [ ] FRONTEND-030-AC-05 — Settings icon toggles the popover closed on a second click
- [ ] FRONTEND-030-AC-06 — clicking outside or Escape closes the Settings popover (real-browser check)
- [ ] FRONTEND-030-AC-07 — Account icon opens a popover with username + Log out
- [ ] FRONTEND-030-AC-08 — Log out from the popover behaves exactly as the existing action
- [ ] FRONTEND-030-AC-09 — opening one popover closes the other
- [ ] FRONTEND-030-AC-10 — Activities/Weekly Planner tab navigation unaffected
- [ ] FRONTEND-030-AC-11 — theme/category colour behavior unaffected, now inside the popover
