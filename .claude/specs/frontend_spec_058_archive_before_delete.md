# Archive-Before-Delete for Activities (Frontend)

**Status**: Implemented (2026-10-29)

**Priority**: P1 — safety/data-integrity fix, pairs with `planner_spec_027_archive_before_delete.md`'s
backend enforcement (see that spec's Overview for the real incident that prompted this).

**Depends on**: `planner_spec_027_archive_before_delete.md` (the new `409`/`ActivityDeleteNotAllowedException`
and `GET /api/v1/activities/{id}/deletion-impact` contracts this spec consumes),
`frontend_spec_002_activity_bank.md` (`ActivityBank.tsx`'s base shape),
`frontend_spec_006_repeatable_activities.md` (`archived` field, the existing `Unarchive` button/
`handleUnarchive`, reused unmodified), `frontend_spec_049_undo_delete.md` (the deferred-delete/
undo-window mechanic — `pendingDeleteIds`, `pendingDeleteTimersRef`, `isMountedRef`, `commitDelete`,
`handleConfirmDelete`, `handleUndoDelete` — relocated, not duplicated, by this spec),
`frontend_spec_040_preset_starter_activities.md` (`SuggestedActivities.tsx`'s `<details>`/`<summary>`
disclosure pattern, reused a third time for the new archived section)

**Area**: Frontend only

**Roadmap version**: V1 polish

**Supersedes**: the interleaved "Show archived" toggle behavior from `frontend_spec_006_repeatable_activities.md`'s
`FRONTEND-006-AC-05` through `AC-14` — archived activities move to their own section instead of
being filtered into the same list. `Unarchive`'s own behavior (`handleUnarchive`) is unchanged.

## Overview

Three changes to `ActivityBank.tsx`, all in the same file — no new component, since the deferred-
delete/undo-window machinery already lives here and `frontend_spec_049` established this project's
own precedent of keeping that logic independent per-component rather than extracting a shared hook:

1. **Active rows lose Delete, gain Archive.** An active (non-archived) row's only destructive-ish
   action becomes a direct, unconfirmed `Archive` click (mirrors `Unarchive`'s existing no-confirm
   UX — archiving is fully reversible). There is no more `Confirm delete`/`Cancel` step reachable
   from an active row at all.
2. **Archived activities move into their own section.** The "Show archived" checkbox and the
   interleaved-list rendering go away. `ActivityBank` now always fetches with `includeArchived:
   true` and partitions the result client-side into "My Activities" (active) and a new, closed-by-
   default "Archived activities" `<details>` section below it — structurally identical to
   `SuggestedActivities.tsx`'s own disclosure pattern (same category-grouping idiom, reused a third
   time in this codebase). The inline `(Archived)` text label is removed — redundant once archived
   rows live in their own clearly-labelled section.
3. **Deleting an archived activity checks its history first.** `Delete` on an archived row still
   shows the existing `Confirm delete`/`Cancel` step, but confirming no longer starts the undo
   window directly — it first calls the new `GET .../deletion-impact` endpoint. Zero history →
   proceeds straight into the existing (unmodified) deferred-delete/undo-window flow. Any history →
   a second, stronger warning states the real counts and requires one more explicit `Delete anyway`
   before the undo window starts. A failed impact check blocks with a retryable error rather than
   silently proceeding.

**Resolved ambiguities, not fully specified by the originating request:**
- The combined-count warning is **one message** ("This activity has N planned occurrence(s), M of
  them completed"), not separately escalated wording for completed-vs-merely-planned history —
  confirmed with the user.
- A failed `deletion-impact` fetch **blocks with a retryable error**, never silently falls back to
  the zero-impact path — confirmed with the user.
- Manual `Archive` has **no confirmation step** — confirmed with the user, mirrors `Unarchive`.
- The archived section lives as a **collapsible section on the existing Activity Bank page**, not a
  new nav tab/route — confirmed with the user.
- The archived section is **always closed by default**, regardless of content — unlike
  `SuggestedActivities.tsx`'s empty-bank auto-open, there's no equivalent "helpful default" reason to
  auto-expand an archive.
- The favourite-star toggle and the "Favourites only" filter stay scoped to the active list only —
  favouriting is about pinning/filtering your *current* activity bank, not archived history. The
  category filter, however, applies to both sections (it's a page-level toolbar control already).

**Out of scope**: any change to `SubTaskList.tsx` (sub-tasks of an archived activity are already
read-only via the existing `readOnly={activity.archived}` prop, unaffected by this spec); any change
to `ActivityPickerList.tsx` (already excludes archived activities from plan assignment — see
Requirement 4, a regression test only, not new behavior); any change to `Unarchive`'s own logic.

## Requirement 1 — An active activity's only exit is Archive, never direct Delete

As a user, I want the app to physically remove the option to delete an activity I'm still using, so
I can't accidentally destroy it without having deliberately archived it first.

- **FRONTEND-058-AC-01** [AUTO]: An active (non-archived) activity's row actions shall render
  `Archive` where `Delete` used to be — `Delete`/`Confirm delete`/`Cancel` shall never be reachable
  from an active row.
- **FRONTEND-058-AC-02** [AUTO]: When `Archive` is clicked for an active activity, `ActivityBank`
  shall call `activityApi.archive(id)` directly (no confirmation step), and on success that
  activity shall no longer appear in "My Activities" (it now has `archived: true` and renders in the
  archived section instead, per Requirement 2).
- **FRONTEND-058-AC-03** [AUTO — unwanted behaviour]: If `activityApi.archive` rejects, the activity
  shall remain in "My Activities" (unarchived) and a `role="alert"` error shall display the failure
  — mirrors `handleUnarchive`'s existing error-handling shape exactly.

## Requirement 2 — Archived activities render in their own, closed-by-default section

As a user, I want archived activities out of my everyday list entirely, in a clearly separate place
I can check when I need to, not mixed into "My Activities" behind a toggle.

- **FRONTEND-058-AC-04** [AUTO]: `ActivityBank` shall fetch with `includeArchived: true`
  unconditionally on mount (replacing the `showArchived`-conditional fetch) and shall render every
  activity with `archived: true` inside a new "Archived activities" `<details>` section, never
  interleaved into "My Activities".
- **FRONTEND-058-AC-05** [AUTO]: The "Show archived" checkbox (and its `showArchived` state) shall be
  removed entirely — "My Activities" shall only ever show non-archived activities, with no toggle to
  change that.
- **FRONTEND-058-AC-06** [AUTO — unwanted behaviour]: The "Archived activities" section shall render
  closed by default regardless of how many archived activities exist (unlike `SuggestedActivities`'s
  empty-bank auto-open).
- **FRONTEND-058-AC-07** [AUTO]: Each archived row shall offer `Unarchive` (unchanged
  `handleUnarchive` behavior — on success, the activity moves back into "My Activities") alongside
  the new `Delete` flow (Requirement 3).

## Requirement 3 — Deleting an archived activity checks its history before committing

As a user, I want to know whether an archived activity actually has planning/completion history
before I permanently delete it, so I'm not surprised by what gets destroyed.

- **FRONTEND-058-AC-08** [AUTO]: Clicking `Delete` on an archived row shows `Confirm delete`/`Cancel`
  — the same inline-confirm pattern `frontend_spec_002`'s original Delete flow established.
- **FRONTEND-058-AC-09** [AUTO]: Clicking `Confirm delete` shall call `activityApi.deletionImpact(id)`
  before anything else — `activityApi.remove`/the undo window shall not start yet. While this call
  is in flight, `Confirm delete` and `Cancel` shall be disabled for that row.
- **FRONTEND-058-AC-10** [AUTO]: Where the impact response has `plannedOccurrenceCount: 0` and
  `completionCount: 0`, `ActivityBank` shall proceed immediately into the existing, unmodified
  deferred-delete/undo-window flow (`handleConfirmDelete`) — identical to `frontend_spec_049`'s
  current behavior, no added friction for the common case.
- **FRONTEND-058-AC-11** [AUTO]: Where either count is nonzero, `ActivityBank` shall instead render
  a combined warning — "This activity has {plannedOccurrenceCount} planned occurrence(s),
  {completionCount} of them completed. Deleting it will remove those too." — with `Delete
  anyway`/`Cancel`, and shall **not** start the undo window yet.
- **FRONTEND-058-AC-12** [AUTO]: Clicking `Delete anyway` enters the same deferred-delete/undo-window
  flow as the zero-impact case (AC-10) — same `handleConfirmDelete`, same 6-second window, same
  "{name} deleted. Undo" notice.
- **FRONTEND-058-AC-13** [AUTO — unwanted behaviour]: If `activityApi.deletionImpact` rejects,
  `ActivityBank` shall show a `role="alert"` error with a Retry control for that row (not a silent
  fallback to the zero-impact path) — Retry re-attempts the same `deletionImpact` call; the undo
  window shall not start until a successful check (or `Delete anyway`, once shown) occurs.
- **FRONTEND-058-AC-14** [AUTO]: `Cancel` at any stage — the first confirm, the impact-warning
  step, or the impact-error step — returns the row to its idle archived state (`Delete`/`Unarchive`
  visible again) with no API call made for that attempt.

## Requirement 4 — Archived activities remain excluded from plan assignment (regression)

As a user, I should never be able to assign an archived activity to a plan, matching how it already
works today.

- **FRONTEND-058-AC-15** [AUTO — regression test]: `ActivityPickerList.tsx`'s existing
  `activityApi.getAll()` call (no argument, `includeArchived` defaulting `false`) continues to
  exclude archived activities — and, since sub-tasks are grouped under their parent activity, their
  sub-tasks too — from the "Assign activity" picker and the Today-view Activity Drawer. No code
  change; a test is added only if this exact exclusion isn't already directly asserted.

## Component/type changes

`frontend/src/types/activity.ts` — new type:
```typescript
export interface ActivityDeletionImpact {
  plannedOccurrenceCount: number
  completionCount: number
}
```

`frontend/src/services/activityApi.ts` — one new method, same `request(...)` wrapper shape as every
other method here:
```typescript
deletionImpact: (id: string): Promise<ActivityDeletionImpact> =>
  request<ActivityDeletionImpact>(() => client.get(`/activities/${id}/deletion-impact`)),
```

`frontend/src/components/ActivityBank/ActivityBank.tsx` — sketch of the key changes (final
markup/styling left to implementation, matching this file's existing conventions):

```tsx
// Removed: const [showArchived, setShowArchived] = useState(false)
// New state, alongside the existing pendingDeleteIds/confirmingDeleteId/deleteError:
const [archivingId, setArchivingId] = useState<string | null>(null)
const [archiveError, setArchiveError] = useState<string | null>(null)
const [impactCheckingId, setImpactCheckingId] = useState<string | null>(null)
const [impactWarning, setImpactWarning] = useState<
  { id: string; plannedOccurrenceCount: number; completionCount: number } | null
>(null)
const [impactError, setImpactError] = useState<{ id: string; message: string } | null>(null)

// Mount effect: always includeArchived: true, no [showArchived] dependency.
useEffect(() => {
  let cancelled = false
  fetchActivities(true, () => cancelled)
  return () => { cancelled = true }
}, [])

// FRONTEND-058-AC-02/AC-03
const handleArchive = async (id: string) => {
  setArchiveError(null)
  setArchivingId(id)
  try {
    const updated = await activityApi.archive(id)
    setActivities((previous) =>
      previous?.map((existing) => (existing.id === id ? updated : existing)) ?? previous,
    )
  } catch (error) {
    setArchiveError(getErrorMessage(error))
  } finally {
    setArchivingId(null)
  }
}

// FRONTEND-058-AC-09/AC-10/AC-11/AC-13 -- replaces the direct setConfirmingDeleteId(null) +
// handleConfirmDelete(id) call Confirm-delete used to make; handleConfirmDelete itself (the actual
// deferred-delete/undo-window starter) is UNCHANGED from frontend_spec_049.
const handleDeleteConfirmed = async (id: string) => {
  setImpactError(null)
  setImpactCheckingId(id)
  try {
    const impact = await activityApi.deletionImpact(id)
    setImpactCheckingId(null)
    if (impact.plannedOccurrenceCount === 0 && impact.completionCount === 0) {
      handleConfirmDelete(id) // unchanged -- starts the undo window
    } else {
      setImpactWarning({ id, ...impact })
    }
  } catch (error) {
    setImpactCheckingId(null)
    setImpactError({ id, message: getErrorMessage(error) })
  }
}

const handleDeleteAnyway = (id: string) => {
  setImpactWarning(null)
  handleConfirmDelete(id) // unchanged -- same undo-window flow as the zero-impact path
}

const handleCancelArchivedDelete = (id: string) => {
  setConfirmingDeleteId(null)
  if (impactWarning?.id === id) setImpactWarning(null)
  if (impactError?.id === id) setImpactError(null)
}
```

`renderRowActions` restructures into two independent branches (active vs. archived), each with its
own states — the active branch loses its `confirmingDeleteId` handling entirely (moved to the
archived branch, now gated behind the impact check):
```tsx
if (activity.archived) {
  if (impactWarning?.id === activity.id) {
    return (
      <>
        <p>
          This activity has {impactWarning.plannedOccurrenceCount} planned occurrence(s),{' '}
          {impactWarning.completionCount} of them completed. Deleting it will remove those too.
        </p>
        <button className={buttonStyles.destructive} onClick={() => handleDeleteAnyway(activity.id)}>
          Delete anyway
        </button>
        <button onClick={() => handleCancelArchivedDelete(activity.id)}>Cancel</button>
      </>
    )
  }
  if (impactError?.id === activity.id) {
    return (
      <>
        <p role="alert">
          {impactError.message}{' '}
          <button onClick={() => handleDeleteConfirmed(activity.id)}>Retry</button>
        </p>
        <button onClick={() => handleCancelArchivedDelete(activity.id)}>Cancel</button>
      </>
    )
  }
  if (confirmingDeleteId === activity.id) {
    return (
      <>
        <button
          className={buttonStyles.destructive}
          onClick={() => handleDeleteConfirmed(activity.id)}
          disabled={impactCheckingId === activity.id}
        >
          Confirm delete
        </button>
        <button
          onClick={() => handleCancelArchivedDelete(activity.id)}
          disabled={impactCheckingId === activity.id}
        >
          Cancel
        </button>
      </>
    )
  }
  return (
    <>
      {/* sub-tasks toggle, unchanged */}
      <button onClick={() => handleUnarchive(activity.id)} disabled={unarchivingId === activity.id}>
        Unarchive
      </button>
      <button className={buttonStyles.destructive} onClick={() => setConfirmingDeleteId(activity.id)}>
        Delete
      </button>
    </>
  )
}

// active row -- Delete is gone, Archive takes its place
return (
  <>
    {/* sub-tasks toggle, Edit -- unchanged */}
    <button onClick={() => handleArchive(activity.id)} disabled={archivingId === activity.id}>
      Archive
    </button>
  </>
)
```

New derived lists (replacing the single `visibleActivities` + inline `(Archived)` label):
```tsx
const visibleActivities = (activities ?? []).filter(
  (activity) =>
    !activity.archived &&
    !pendingDeleteIds.has(activity.id) &&
    (categoryFilter === 'ALL' || activity.category === categoryFilter) &&
    (!favouriteFilter || activity.favourite),
)

const archivedActivities = (activities ?? []).filter(
  (activity) =>
    activity.archived &&
    !pendingDeleteIds.has(activity.id) &&
    (categoryFilter === 'ALL' || activity.category === categoryFilter),
)
```

New section, rendered after the "My Activities" list and before `<SuggestedActivities>` — same
`CATEGORY_ORDER`/`CategoryGroupHeading`/per-category `<ul>` idiom as both existing instances:
```tsx
<details className={styles.archivedDetails}>
  <summary className={styles.sectionHeading}>
    Archived activities ({archivedActivities.length})
    <ChevronIcon />
  </summary>
  {archiveError && <p role="alert">{archiveError}</p>}
  {archivedActivities.length === 0 && <p>No archived activities.</p>}
  {/* same visibleCategories.map(...) grouping as the main list, over archivedActivities instead,
      reusing renderRowActions(activity) unchanged -- it already branches on activity.archived */}
</details>
```

The inline `{activity.archived && <span className={styles.archivedLabel}>(Archived)</span>}` label
is removed from the row markup — redundant once archived rows only ever render inside this section.

## Cross-references

| This spec | Contracts against |
|---|---|
| `GET /api/v1/activities/{id}/deletion-impact` (`planner_spec_027`) | New — consumed by `activityApi.deletionImpact` |
| `409 ActivityDeleteNotAllowedException` (`planner_spec_027`) | New — structurally unreachable from this UI once Delete is removed from active rows, but `commitDelete`'s existing generic error handling (`deleteError`/`getErrorMessage`) already covers it if it were ever hit (e.g. a race with another tab) |
| `activityApi.archive` (`services/activityApi.ts`) | Reused unmodified — already existed, wired to a UI button for the first time |
| `handleUnarchive` (`frontend_spec_006_repeatable_activities.md`) | Reused unmodified |
| `handleConfirmDelete`/`commitDelete`/`handleUndoDelete`/`pendingDeleteIds`/`pendingDeleteTimersRef`/`isMountedRef` (`frontend_spec_049_undo_delete.md`) | Reused unmodified — relocated to only be reachable from archived rows, gated behind the new impact check |
| `SuggestedActivities.tsx` disclosure pattern (`frontend_spec_040_preset_starter_activities.md`) | Structural precedent for the new archived section — not itself modified |
| `ActivityPickerList.tsx` | Unmodified — Requirement 4 is a regression test only |

## Test case sketches (Vitest + RTL, red before implementation)

```tsx
describe('FRONTEND-058-AC-01: active rows have no Delete button', () => {
  it('renders Archive, never Delete, for a non-archived activity', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk]) // walk: archived: false
    render(<ActivityBank />)
    expect(await screen.findByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-058-AC-02/AC-03: Archive moves the row into the archived section', () => {
  it('calls activityApi.archive and the row no longer appears in My Activities', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    vi.mocked(activityApi.archive).mockResolvedValue({ ...walk, archived: true })
    render(<ActivityBank />)
    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }))
    expect(activityApi.archive).toHaveBeenCalledWith(walk.id)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument())
  })

  it('shows an alert and keeps the activity active if archive fails', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    vi.mocked(activityApi.archive).mockRejectedValue(new Error('Server error'))
    render(<ActivityBank />)
    await userEvent.click(await screen.findByRole('button', { name: 'Archive' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
  })
})

describe('FRONTEND-058-AC-04/AC-05/AC-06: archived activities render in their own closed-by-default section', () => {
  it('lists an archived activity under "Archived activities", not in My Activities', async () => {
    const archived = { ...walk, archived: true }
    vi.mocked(activityApi.getAll).mockResolvedValue([archived])
    render(<ActivityBank />)
    expect(activityApi.getAll).toHaveBeenCalledWith(true)
    const details = (await screen.findByText(/archived activities/i)).closest('details')
    expect(details).not.toHaveAttribute('open')
    expect(within(details!).getByText(walk.name)).toBeInTheDocument()
  })

  it('no longer renders a "Show archived" checkbox', () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<ActivityBank />)
    expect(screen.queryByRole('checkbox', { name: /show archived/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-058-AC-09/AC-10: zero-impact delete goes straight to the undo window', () => {
  it('fetches deletion impact, then starts the undo window when both counts are zero', async () => {
    vi.useFakeTimers()
    const archived = { ...walk, archived: true }
    vi.mocked(activityApi.getAll).mockResolvedValue([archived])
    vi.mocked(activityApi.deletionImpact).mockResolvedValue({ plannedOccurrenceCount: 0, completionCount: 0 })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ActivityBank />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(activityApi.deletionImpact).toHaveBeenCalledWith(archived.id)
    expect(await screen.findByRole('status')).toHaveTextContent(/walk.*deleted/i)
    vi.useRealTimers()
  })
})

describe('FRONTEND-058-AC-11/AC-12: nonzero impact shows a stronger warning before deleting', () => {
  it('shows the combined-count warning and only deletes on "Delete anyway"', async () => {
    vi.useFakeTimers()
    const archived = { ...walk, archived: true }
    vi.mocked(activityApi.getAll).mockResolvedValue([archived])
    vi.mocked(activityApi.deletionImpact).mockResolvedValue({ plannedOccurrenceCount: 3, completionCount: 1 })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ActivityBank />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(await screen.findByText(/3 planned occurrence.*1 of them completed/i)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete anyway' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/walk.*deleted/i)
    vi.useRealTimers()
  })
})

describe('FRONTEND-058-AC-13: a failed impact check blocks with a retryable error', () => {
  it('shows an alert with Retry and never starts the undo window', async () => {
    const archived = { ...walk, archived: true }
    vi.mocked(activityApi.getAll).mockResolvedValue([archived])
    vi.mocked(activityApi.deletionImpact)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ plannedOccurrenceCount: 0, completionCount: 0 })
    const user = userEvent.setup()
    render(<ActivityBank />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/network error/i)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})

describe('FRONTEND-058-AC-14: Cancel at any stage returns to idle with no API call', () => {
  it('cancels from the impact-warning step without deleting', async () => {
    const archived = { ...walk, archived: true }
    vi.mocked(activityApi.getAll).mockResolvedValue([archived])
    vi.mocked(activityApi.deletionImpact).mockResolvedValue({ plannedOccurrenceCount: 2, completionCount: 0 })
    const user = userEvent.setup()
    render(<ActivityBank />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(activityApi.remove).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
```

## Acceptance Criteria Summary

- [x] FRONTEND-058-AC-01 — active rows render Archive, never Delete
- [x] FRONTEND-058-AC-02 — Archive calls `activityApi.archive` directly, no confirm, row moves out of My Activities
- [x] FRONTEND-058-AC-03 — failed Archive shows an alert, activity stays active
- [x] FRONTEND-058-AC-04 — archived activities render in their own `<details>` section, never interleaved
- [x] FRONTEND-058-AC-05 — the "Show archived" checkbox/state is removed entirely
- [x] FRONTEND-058-AC-06 — the archived section is closed by default regardless of content
- [x] FRONTEND-058-AC-07 — archived rows offer Unarchive (unchanged) and Delete
- [x] FRONTEND-058-AC-08 — Delete on an archived row shows Confirm delete/Cancel
- [x] FRONTEND-058-AC-09 — Confirm delete calls `deletionImpact` first, disables controls while in flight
- [x] FRONTEND-058-AC-10 — zero impact proceeds straight into the existing undo-window flow
- [x] FRONTEND-058-AC-11 — nonzero impact shows a combined-count warning, does not start the undo window yet
- [x] FRONTEND-058-AC-12 — "Delete anyway" enters the same undo-window flow as the zero-impact case
- [x] FRONTEND-058-AC-13 — a failed impact check blocks with a retryable alert, never silently proceeds
- [x] FRONTEND-058-AC-14 — Cancel at any stage returns to idle with no API call
- [x] FRONTEND-058-AC-15 — archived activities remain excluded from plan assignment (regression test)

## Summary

Implemented entirely within `ActivityBank.tsx`, as planned — no new component/hook. `activityApi.ts`
gained one new `deletionImpact` method and `types/activity.ts` gained the `ActivityDeletionImpact`
type, both exactly as sketched. The archived-section markup reuses `SuggestedActivities.tsx`'s
`<details>`/`<summary>` + `CATEGORY_ORDER`/`CategoryGroupHeading` idiom via a new shared
`renderActivityRow` helper (used by both "My Activities" and "Archived activities" to avoid
duplicating the row markup a third time).

`ActivityBank.test.tsx`: 76 tests (up from the pre-change count), all passing. Full frontend suite:
47 test files / 706 tests passing. `npm run lint` (oxlint) clean. `npm run build` (tsc -b + vite
build) succeeds.

**Deviations from the spec's sketch, with reasons:**
- **`archiveError`'s placement.** The sketch showed `archiveError` rendered *inside* the archived
  `<details>` section. That can't be right for AC-03's own test case (archiving a row fails when
  there are *zero* archived activities yet, i.e. the section doesn't even need to be opened) --
  since the section is closed by default, an alert rendered only inside it would be excluded from
  the accessibility tree and `screen.findByRole('alert')` would never find it. Rendered
  `archiveError` in the same always-visible error-banner area as `deleteError`/`unarchiveError`/
  `favouriteError` instead, which both matches those siblings' existing convention and is the only
  placement that can pass the spec's own test sketch.
- **Favourite toggle on archived rows.** The spec's "Resolved ambiguities" section says the
  favourite-star toggle and "Favourites only" filter "stay scoped to the active list only." Taken
  literally this would mean removing the toggle button from archived rows entirely, but an existing,
  still-required test (`FRONTEND-027-AC-01`'s "renders the toggle on an archived row too") expects
  the toggle to keep rendering there. Interpreted this as: the *filter* (`favouriteFilter`) doesn't
  apply to the archived section's `archivedActivities` derivation (so it can't hide archived rows),
  but the toggle button itself still renders on every row via the shared `renderActivityRow` helper
  -- satisfies both the existing passing test and the stated intent of the ambiguity resolution.
- **A fourth Cancel-path test added beyond the spec's three sketched cases.** The spec's AC-14 test
  sketch only showed cancelling from the impact-warning step. Added two more for the other two
  reachable idle-returning states (the first Confirm-delete step, and the impact-error step) since
  AC-14's own wording explicitly covers all three and the component has three distinct branches that
  could regress independently.
- **One existing fixture-driven test needed a non-behavioral data fix, not a logic change**:
  `FRONTEND-044-AC-10`'s order-preservation test derived one of its three activities from the file's
  (archived) `jobs` fixture; since archived activities no longer render inline in "My Activities",
  that derived activity would have silently moved to the new archived section and broken the test's
  three-in-a-row DOM-order assertion. Fixed by spreading `{ ...jobs, archived: false }` for that one
  test's fixture -- same for `FRONTEND-044-AC-03`'s category-heading test, which hit the identical
  issue for the same reason.
- **`activityApi.getAll()` call-signature assertion uses `toHaveBeenCalledWith()`** (not
  `toHaveBeenCalledWith(undefined)`) for the new `FRONTEND-058-AC-15` regression test in
  `ActivityPickerList.test.tsx`, matching how the component's own source calls it
  (`activityApi.getAll()`, no argument) rather than asserting an explicit `undefined`.

No backend dependency issues hit: `planner_spec_027`'s endpoint work was already visible as
in-progress on this branch from a parallel agent, but this frontend work only needed the *shape* of
the response (`ActivityDeletionImpact`), which was fully specified in this spec already, so no
coordination blocker.

**Not done (explicitly out of scope / deferred):** real-browser verification. This session's toolset
had no browser-automation tool available, so only `npm test`/`npm run lint`/`npm run build` were run
as verification. Both dev servers (`:4321`/`:8420`) were confirmed already running via `netstat`/
`curl`, but an actual rendered-UI pass (light/dark theme, real click-through of the new Archive/
Delete/impact-warning flow) still needs a manual check before this is fully "Definition of Done"
per `CLAUDE.md` -- flagging this explicitly rather than silently skipping it.
