# Live-Update the Grid-Orientation Preference Across the Settings Popover Boundary (Frontend)

**Status**: Not started
**Priority**: P2 — same tier as `frontend_spec_012_grid_orientation_toggle.md`, whose gap this
closes; not yet merged to `main`
**Depends on**: `frontend_spec_012_grid_orientation_toggle.md` (origin of
`utils/gridOrientation.ts`, the Settings "Weekly grid layout" fieldset, and `PlannerGrid`'s
orientation-conditional render — implemented on the same still-open `feature/grid-orientation-
toggle` branch/PR this spec also lands on), `frontend_spec_005_navigation_and_theme.md` (origin of
the `subscribeToCategoryColorChanges()` event mechanism this spec directly replicates, in
`utils/categoryColors.ts`), `frontend_spec_030_header_restructure.md` (turned `Settings` into a
Popover-API overlay mounted over whatever page is active, rather than a separate `/settings`
route — the change that invalidated `frontend_spec_012`'s `AC-11` reasoning; see Overview)
**Area**: Frontend
**Roadmap version**: V1 (same as `frontend_spec_012`, which this amends)

## Overview

Found during real-browser verification of `frontend_spec_012_grid_orientation_toggle.md`: changing
the "Weekly grid layout" preference in Settings while looking at the Weekly Planner or Today view
has no visible effect until the page is manually reloaded, or the user navigates away to a
different tab and back.

`frontend_spec_012`'s `FRONTEND-012-AC-11` assumed `/planner` and `/settings` are mutually-exclusive
React Router routes (true when `frontend_spec_005_navigation_and_theme.md` originally built that
routing), so changing the preference and then navigating to `/planner` would always remount
`PlannerGrid`, which picks up the new value via its mount-time `useState(() =>
getGridOrientation())` read — no extra plumbing needed. That assumption is now false:
`frontend_spec_030_header_restructure.md` (implemented after `frontend_spec_012` was originally
written, before this fix) replaced the separate `/settings` route with a `Popover`-API overlay that
sits on top of whichever page is already mounted. `Settings` and `PlannerGrid` (or `TodayView`) are
now routinely mounted at the same time — opening the Settings popover from the Weekly Planner does
not unmount `PlannerGrid`, so its one-time `useState` read never re-runs, and the new preference
sits in `localStorage` unread until something else happens to remount the component.

This is the exact same class of problem `frontend_spec_005_navigation_and_theme.md` already solved
for category colours: `CategoryChip` instances can be mounted at the same time as the Settings
panel that's changing their colour, so `utils/categoryColors.ts` dispatches a `CustomEvent` on
`window` (`subscribeToCategoryColorChanges()`/`notifyChange()`) and `Settings.tsx` subscribes to
re-render its own swatches, while any other mounted `CategoryChip` instances could do the same (and
`PlannerGrid` already subscribes to nothing today only because, until `frontend_spec_030`, it never
needed to). This spec adds the equivalent `subscribeToGridOrientationChanges()` mechanism to
`utils/gridOrientation.ts`, mirroring `subscribeToCategoryColorChanges()`'s exact shape (a
`CustomEvent` dispatched from `setGridOrientation()`, a subscribe function returning an unsubscribe
function), and has `PlannerGrid` subscribe on mount so it re-renders with the new orientation the
moment the preference changes — no reload, no unrelated navigation required.

**Supersedes, in place, the following now-false statements** (IDs unchanged, per
`.claude/steering/ears_format.md`'s "Reference IDs are immutable" rule and the precedent
`frontend_spec_012` itself already established twice — against `frontend_spec_008`'s `AC-18`
wording, and against its own `AC-07` wording during implementation):
- `frontend_spec_012_grid_orientation_toggle.md`'s Overview section, "Live update, no reload, no
  cross-component subscription needed" — its reasoning (`PlannerGrid` and `Settings` are never
  mounted at the same time) no longer holds.
- `FRONTEND-012-AC-11`'s statement text, which currently claims the live-update behavior is
  "satisfied by React Router's route-exclusive mount/unmount... with no additional cross-component
  event/subscription mechanism required." This spec's `FRONTEND-034-AC-01`/`AC-02` are the real
  contract going forward; `frontend_spec_012`'s own Component/type changes section's
  `useState(() => getGridOrientation())` read (its `FRONTEND-012-AC-10`) is also superseded by this
  spec's `FRONTEND-034-AC-02`, which replaces it with live-updating state while still reading the
  initial value the same way at first mount.

**Out of scope**: the theme/category-colour live-update mechanisms themselves (already built,
untouched by this spec). Any change to `Settings.tsx`'s own rendering of the grid-layout radio
group (it already reflects the current preference correctly within the popover itself; the gap is
only in components mounted *behind* it). Any backend change — this remains a pure client-side
`localStorage` preference, same scope boundary as `frontend_spec_012`.

## Requirement 1: `utils/gridOrientation.ts` notifies subscribers on change

**User story**: As a developer, I want a way for any mounted component to be notified when the
grid-orientation preference changes, the same way category-colour changes are already broadcast, so
I don't have to invent a new mechanism per preference.

### FRONTEND-034-AC-01 [AUTO]: `setGridOrientation` notifies subscribers
**Statement**: When `setGridOrientation(orientation)` is called, `utils/gridOrientation.ts` shall,
in addition to persisting the value to `localStorage` (`FRONTEND-012-AC-02`, unchanged), dispatch a
change notification that any `subscribeToGridOrientationChanges()` listener receives.

**Rationale**: The core broadcast mechanism — every other requirement in this spec depends on this
firing correctly.

**References**:
- `utils/gridOrientation.ts` — add a `CHANGE_EVENT = 'bap-grid-orientation-changed'` constant and a
  `notifyChange()` helper that calls `window.dispatchEvent(new CustomEvent(CHANGE_EVENT))`, called
  from `setGridOrientation()` after the `localStorage.setItem` call — mirrors
  `utils/categoryColors.ts`'s `notifyChange()`/`setCategoryColor()` exactly.
- `export function subscribeToGridOrientationChanges(listener: () => void): () => void` —
  `window.addEventListener(CHANGE_EVENT, listener)`, returning `() =>
  window.removeEventListener(CHANGE_EVENT, listener)` — mirrors
  `subscribeToCategoryColorChanges()` exactly.

**Test Case (Red)**:
```typescript
// utils/gridOrientation.test.ts addition

describe('FRONTEND-034-AC-01: setGridOrientation notifies subscribers', () => {
  it('calls a subscribed listener when the orientation changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToGridOrientationChanges(listener)

    setGridOrientation('day-rows')

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToGridOrientationChanges(listener)
    unsubscribe()

    setGridOrientation('day-rows')

    expect(listener).not.toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: implement `CHANGE_EVENT`/`notifyChange()`/`subscribeToGridOrientationChanges()`
as described in References.

## Requirement 2: `PlannerGrid` re-renders live when the preference changes while mounted

**User story**: As a user, I want changing the grid layout in Settings to apply immediately to
whatever planner view I'm looking at behind the Settings popover, without reloading the page or
navigating away and back.

### FRONTEND-034-AC-02 [AUTO]: `PlannerGrid` subscribes to orientation changes on mount
**Statement**: While `PlannerGrid` is mounted, when the grid-orientation preference changes (via
`setGridOrientation`, from any component — including a `Settings` popover mounted over the current
page), `PlannerGrid` shall re-render using the new orientation, with no reload or remount required.

**Rationale**: The actual user-facing fix — this is the behavior the gap report described.

**References**: `PlannerGrid.tsx` — replace the current `const [orientation] = useState(() =>
getGridOrientation())` (read-once, `FRONTEND-012-AC-10`) with `const [orientation, setOrientation] =
useState(() => getGridOrientation())` plus a `useEffect(() =>
subscribeToGridOrientationChanges(() => setOrientation(getGridOrientation())), [])` that
subscribes on mount and unsubscribes on unmount (via the returned cleanup function) — mirrors
`Settings.tsx`'s existing `useEffect(() => subscribeToCategoryColorChanges(() =>
setCategoryColors(getCategoryColorSnapshot())), [])`.

**Test Case (Red)**:
```tsx
// PlannerGrid.test.tsx addition

describe('FRONTEND-034-AC-02: PlannerGrid re-renders live when the orientation preference changes while mounted', () => {
  it('switches from day-columns to day-rows without remounting', () => {
    renderGrid()
    expect(document.querySelectorAll(`.${styles.daySection}`)).toHaveLength(0)

    act(() => {
      setGridOrientation('day-rows')
    })

    expect(document.querySelectorAll(`.${styles.daySection}`)).toHaveLength(5)
  })
})
```

**Test Case (Green)**: implement the `useEffect`-based subscription as described in References.

### FRONTEND-034-AC-03 [AUTO]: `PlannerGrid` unsubscribes on unmount
**Statement**: When `PlannerGrid` unmounts, it shall unsubscribe from grid-orientation change
notifications.

**Rationale**: Regression/leak guard — without this, an unmounted `PlannerGrid` instance's stale
`setOrientation` call on a change notification would either be a silent no-op warning in React's
dev console or, worse, accumulate listeners across repeated mount/unmount cycles (e.g. switching
between the Weekly Planner and Today tabs repeatedly).

**References**: The cleanup function returned by `useEffect` in `FRONTEND-034-AC-02`'s
implementation — `subscribeToGridOrientationChanges()`'s own return value, called automatically by
React on unmount.

**Test Case (Red)**:
```tsx
describe('FRONTEND-034-AC-03: PlannerGrid unsubscribes on unmount', () => {
  it('does not update state (or warn) after unmount', () => {
    const { unmount } = render(<PlannerGrid {...baseGridProps()} />)
    unmount()

    expect(() => {
      act(() => {
        setGridOrientation('day-rows')
      })
    }).not.toThrow()
    // No React "state update on an unmounted component" warning — implicitly covered by Vitest's
    // default console.error-throws-on-warning setup in this project's test harness, if configured;
    // otherwise assert no console.error call here explicitly.
  })
})
```

**Test Case (Green)**: the `useEffect` cleanup function from `FRONTEND-034-AC-02` already satisfies
this — React calls it automatically before unmount, removing the listener.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| Mechanism replicated | `frontend/src/utils/categoryColors.ts`'s `subscribeToCategoryColorChanges()`/`notifyChange()` (`frontend_spec_005_navigation_and_theme.md`) |
| Consumer of the existing pattern, for reference | `frontend/src/components/Settings/Settings.tsx`'s `useEffect(() => subscribeToCategoryColorChanges(...), [])` |
| Utility gaining the new export | `frontend/src/utils/gridOrientation.ts` (`getGridOrientation`/`setGridOrientation` from `frontend_spec_012_grid_orientation_toggle.md`, unchanged) |
| Component gaining the subscription | `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx` (its orientation-conditional render from `frontend_spec_012`, unchanged — only the orientation *read* changes from one-shot to live) |
| Root cause of the gap | `frontend_spec_030_header_restructure.md` (Settings popover no longer unmounts the page behind it) |
| Spec whose AC-11/Overview text this directly supersedes (in place, ID unchanged) | `frontend_spec_012_grid_orientation_toggle.md` |

## Acceptance Criteria Summary

- [ ] FRONTEND-034-AC-01 [AUTO]: `setGridOrientation` notifies subscribers via a `CustomEvent`, mirroring `categoryColors.ts`
- [ ] FRONTEND-034-AC-02 [AUTO]: `PlannerGrid` subscribes on mount and re-renders live when the preference changes
- [ ] FRONTEND-034-AC-03 [AUTO]: `PlannerGrid` unsubscribes on unmount
