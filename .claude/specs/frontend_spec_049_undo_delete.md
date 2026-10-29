# Undo Window for Deleting an Activity or Sub-task

**Status**: Implemented (2026-10-29)
**Priority**: P2 — safety/UX improvement for an existing irreversible action
**Depends on**: `frontend_spec_002_activity_bank.md` (`ActivityBank`'s delete flow),
`frontend_spec_003_sub_tasks.md` (`SubTaskList`'s delete flow), `frontend_spec_031_button_hierarchy.md`
(`buttonStyles.destructive`, reused unmodified)
**Area**: Frontend only — no backend/API changes, no `API.md` update. The existing
`DELETE /api/v1/activities/{id}` and `DELETE /api/v1/activities/{activityId}/sub-tasks/{id}`
endpoints are reused exactly as they are, just called later than today.
**Roadmap version**: V1 (Activity Bank)

## Overview

Raised by the user 2026-10-06 during a V1 ideas review. Today, deleting an activity or sub-task is
a two-step confirm (`Delete` → `Confirm delete`/`Cancel`), but once confirmed it's immediate and
final — the `DELETE` API call fires straight away, and the row is gone from local state the moment
it resolves. There's no recovery path for a mis-click on `Confirm delete`.

This spec adds a third layer: after confirming, the row disappears from the list immediately (as
today), but the real `DELETE` call is **deferred** for 6 seconds behind an "Undo" notice. Clicking
Undo within that window restores the row and the `DELETE` call never fires at all. If the window
expires without Undo, the deferred `DELETE` call fires then — functionally identical to today's
behavior, just 6 seconds later.

**Why deferred, not a real delete-then-restore**: a true "delete, then undo by restoring" is not
feasible here without disproportionate backend complexity. Deleting an `Activity` or `SubTask`
cascades via `ON DELETE CASCADE` through `sub_tasks` → `planned_occurrences` → `completion_records`
(confirmed via the Flyway migrations) — once the real `DELETE` executes, reversing it means
reconstructing every cascaded row, not undoing one lightweight record (unlike the existing
Complete/Undo pattern on `PlannedOccurrence`, where "Undo" is a real, cheap `DELETE
/occurrences/{id}/completion` call against a single side-record). Deferring the call instead means
nothing is ever destroyed unless the window genuinely expires — simpler, and zero risk of a
partial/failed restore.

**New patterns this spec introduces to the frontend** (confirmed via research: none of these exist
anywhere in the codebase today) — called out explicitly since there's no existing convention to
point to:
- A transient, auto-dismissing notice (today's `role="alert"` banners are persistent, dismissed only
  by the next state change, never on a timer).
- A `setTimeout`-based deferred-action pattern.
- `vi.useFakeTimers()` in a Vitest test (used for the first time by this spec's own tests).

**Scope**: both call sites that currently do an immediate confirmed-delete — `ActivityBank.tsx`
(activity delete) and `SubTaskList.tsx` (sub-task delete). Each gets its own independent
implementation (matching how `confirmingDeleteId`/`deletingId`/`deleteError` are already
independently duplicated between the two files, not shared) — no new shared hook/component is
introduced by this spec; consolidating the existing duplication between the two files' delete logic
is a separate, already-logged refactor candidate, not part of this change.

**Out of scope**: changing or removing the existing `Delete` → `Confirm delete`/`Cancel` step. This
spec adds the undo window *after* that existing confirmation, not instead of it — this is additive
safety, not a redesign of the confirmation flow. Not configurable — the 6-second window is a fixed
constant, not a user preference.

## Requirement 1: Confirming delete defers the actual removal behind an undo window

**User story**: As a user, when I confirm deleting an activity or sub-task, I want a brief window to
change my mind before it's actually gone, so a mis-click on "Confirm delete" isn't irreversible.

### FRONTEND-049-AC-01 [AUTO]: Confirming delete hides the row and starts a 6-second window, without calling the delete API yet
**Statement**: When "Confirm delete" is activated, `ActivityBank`/`SubTaskList` shall immediately
remove the row from the visible list and display an undo notice (`"{name} deleted." ` + an "Undo"
button) via a non-persistent `role="status"` region, without calling `activityApi.remove`/
`subTaskApi.remove` yet.

**Rationale**: The row disappearing immediately gives the same "it's done" feedback as today;
`role="status"` (not `role="alert"`) since this isn't an error — matches this project's existing
live-region urgency convention (`modern-web-guidance:accessibility` — `polite`/`status` for
non-critical confirmations, `alert` reserved for errors).

**References**: `components/ActivityBank/ActivityBank.tsx` (`handleConfirmDelete`),
`components/ActivityBank/SubTaskList.tsx` (`handleConfirmDelete`) — both currently call the delete
API synchronously inside this handler; change to set a `pendingDeleteIds` entry and start a timer
instead.

**Test Case (Red)**:
```typescript
describe('FRONTEND-049-AC-01: confirming delete hides the row and defers the API call', () => {
  it('removes the row from view and shows an undo notice without calling the API yet', async () => {
    vi.useFakeTimers()
    vi.mocked(activityApi.getAll).mockResolvedValue([walkActivity])
    const removeSpy = vi.spyOn(activityApi, 'remove')
    render(<ActivityBank />)

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
      await screen.findByRole('button', { name: 'Delete' }),
    )
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
      screen.getByRole('button', { name: 'Confirm delete' }),
    )

    expect(screen.queryByText(walkActivity.name)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/go for a walk.*deleted/i)
    expect(removeSpy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
```

**Test Case (Green)**: implement the deferred-delete state as described in References.

### FRONTEND-049-AC-02 [AUTO]: Undo cancels the pending deletion — the delete API is never called
**Statement**: When "Undo" is activated within the 6-second window, `ActivityBank`/`SubTaskList`
shall restore the row to the visible list, dismiss the undo notice, and cancel the pending timer —
the delete API shall never be called for that deletion.

**References**: clear the row's `setTimeout` handle and remove its `pendingDeleteIds` entry.

**Test Case (Red)**:
```typescript
describe('FRONTEND-049-AC-02: Undo cancels the pending deletion', () => {
  it('restores the row and never calls the delete API', async () => {
    vi.useFakeTimers()
    vi.mocked(activityApi.getAll).mockResolvedValue([walkActivity])
    const removeSpy = vi.spyOn(activityApi, 'remove')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ActivityBank />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.getByText(walkActivity.name)).toBeInTheDocument()
    vi.advanceTimersByTime(10000)
    expect(removeSpy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
```

**Test Case (Green)**: implement the Undo handler as described in References.

### FRONTEND-049-AC-03 [AUTO]: The window expiring commits the deletion
**Statement**: If "Undo" is not activated within 6 seconds of confirming delete, `ActivityBank`/
`SubTaskList` shall call `activityApi.remove`/`subTaskApi.remove` for that row and dismiss the undo
notice. On success, the row stays removed (no visible change, since it was already hidden from
confirmation). On failure, the row shall be restored to the visible list and the existing
`deleteError` `role="alert"` shall display the error.

**Rationale**: A failed deferred delete must not leave the UI silently out of sync with the
server — restoring the row on failure mirrors the existing (pre-this-spec) behavior, where a failed
delete never removed the row in the first place.

**Test Case (Red)**:
```typescript
describe('FRONTEND-049-AC-03: the window expiring commits the deletion', () => {
  it('calls the delete API after 6 seconds with no Undo', async () => {
    vi.useFakeTimers()
    vi.mocked(activityApi.getAll).mockResolvedValue([walkActivity])
    vi.mocked(activityApi.remove).mockResolvedValue(undefined)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ActivityBank />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    vi.advanceTimersByTime(6000)
    await vi.waitFor(() => expect(activityApi.remove).toHaveBeenCalledWith(walkActivity.id))
    vi.useRealTimers()
  })

  it('restores the row and shows an error if the deferred delete fails', async () => {
    vi.useFakeTimers()
    vi.mocked(activityApi.getAll).mockResolvedValue([walkActivity])
    vi.mocked(activityApi.remove).mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ActivityBank />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    vi.advanceTimersByTime(6000)

    expect(await screen.findByText(walkActivity.name)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
```

**Test Case (Green)**: implement the window-expiry commit path as described in References.

### FRONTEND-049-AC-04 [AUTO]: Multiple pending deletions are tracked independently
**Statement**: Deleting a second item while a first item's undo window is still open shall not
affect the first item's pending state — each pending deletion has its own independent timer and
undo notice.

**Rationale**: A single scalar "is something pending" flag would make the second delete either
block or silently cancel the first — this must not happen.

**References**: `pendingDeleteIds`/timer tracking shall be keyed by id (e.g. `Record<string,
ReturnType<typeof setTimeout>>`), not a single value.

**Test Case (Red)**:
```typescript
describe('FRONTEND-049-AC-04: multiple pending deletions are independent', () => {
  it('undoing one pending deletion leaves a second one still pending', async () => {
    vi.useFakeTimers()
    vi.mocked(activityApi.getAll).mockResolvedValue([walkActivity, journalActivity])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ActivityBank />)

    await user.click((await screen.findAllByRole('button', { name: 'Delete' }))[0])
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await user.click((await screen.findAllByRole('button', { name: 'Delete' }))[0])
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await user.click(screen.getAllByRole('button', { name: 'Undo' })[0])

    expect(screen.getByText(walkActivity.name)).toBeInTheDocument()
    expect(screen.queryByText(journalActivity.name)).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
```

**Test Case (Green)**: key the pending-deletion tracking by id.

### FRONTEND-049-AC-05 [AUTO]: A pending deletion still commits even if the component unmounts
**Statement**: If `ActivityBank`/`SubTaskList` unmounts while a deletion is pending (e.g. the user
navigates to a different tab), the deferred `DELETE` call shall still fire when the window expires —
navigating away shall not silently cancel a confirmed deletion.

**Rationale**: React state (and therefore any in-component "is this pending" tracking) is lost on
unmount — but the `setTimeout` itself is a plain JS timer, independent of the component's lifecycle,
and must not be cleared in a cleanup effect the way a normal in-flight-fetch cancellation would be.
Any `setState` call from the deferred callback must guard against running after unmount (mirroring
this codebase's existing `cancelled` flag convention already used for fetch effects elsewhere in
both files), to avoid a React warning — but the actual `DELETE` call itself must still happen.

**References**: do **not** clear the pending-delete timer in the component's unmount cleanup —
contrast with the existing fetch-`useEffect`'s cleanup, which does cancel its own in-flight request
via a `cancelled` flag; this is a deliberate, different lifecycle for a different reason (committing
a user-confirmed action vs. abandoning a stale fetch).

**Test Case (Green)**: exercised via code review of the implementation (no `clearTimeout` in the
unmount cleanup for pending deletions) — a true unmount-during-pending-window integration test would
require real timers and real unmount timing together, which is disproportionate to verify compared
to just not writing the bug in the first place; the other four ACs' fake-timer tests already cover
the timer mechanics directly.

## Cross-references

| Reference | What it provides |
|---|---|
| `components/ActivityBank/ActivityBank.tsx` | AC-01/02/03/04/05 target (activity delete) |
| `components/ActivityBank/SubTaskList.tsx` | AC-01/02/03/04/05 target (sub-task delete), independent implementation mirroring the same shape |
| `services/activityApi.ts`, `services/subTaskApi.ts` | `remove(...)` — unchanged, called later |
| `utils/getErrorMessage.ts` | Reused for the failure case in AC-03 |

## Acceptance Criteria Summary

- [x] FRONTEND-049-AC-01 — confirming delete hides the row and starts a 6-second window, no API call yet
- [x] FRONTEND-049-AC-02 — Undo cancels the pending deletion, API never called
- [x] FRONTEND-049-AC-03 — window expiry commits the deletion; failure restores the row + shows an error
- [x] FRONTEND-049-AC-04 — multiple pending deletions tracked independently
- [x] FRONTEND-049-AC-05 — a pending deletion still commits even if the component unmounts (verified by
  code review, per this spec's own test-case note — no `clearTimeout` in either component's unmount
  cleanup)

## Summary

Implemented in both `ActivityBank.tsx` and `SubTaskList.tsx` as independent, parallel
implementations (no shared hook introduced, per scope). Each component gained:
`pendingDeleteIds` (a `Set<string>` of ids currently inside their undo window, used to filter them
out of the visible list), a `pendingDeleteTimersRef` (`Record<string, ReturnType<typeof
setTimeout>>`, deliberately a ref, not state, so the timers aren't tied to a render and are never
cleared by the unmount cleanup effect), an `isMountedRef` guarding the `setState` calls inside the
deferred commit (mirroring the `cancelled`-flag convention used by the existing fetch effects, but
as a ref since the timer outlives any single effect), and a `role="status"` notice rendered per
pending id with its own "Undo" button.

**Tests**: 10 new/updated test cases across the two files (5 per component — AC-01/02/03/04 plus one
Undo-race regression, see below; AC-05 is verified by code review only, per the spec's own note)
plus 2 pre-existing tests per file (the old synchronous confirm-delete success/failure cases)
updated to use fake timers and assert the new deferred timing. `ActivityBank.test.tsx` +
`SubTaskList.test.tsx` together: 101 tests passing. Full frontend suite: 694 tests passing.
`npm run lint` clean.

**Real finding — `@testing-library/dom`'s `waitFor`/`findBy*` silently hang under
`vi.useFakeTimers()` without a `globalThis.jest` shim**: this is the first use of
`vi.useFakeTimers()` anywhere in this test suite, and every `await screen.findByRole(...)`/`await
vi.waitFor(...)` call made while fake timers were active hung until Vitest's own per-test timeout
(5s), cascading into dozens of unrelated timed-out tests later in the same file once one fake-timer
test failed to reach its own `vi.useRealTimers()` cleanup. Root cause (confirmed by reading
`node_modules/@testing-library/dom/dist/wait-for.js`): its fake-timer support is Jest-specific —
`jestFakeTimersAreEnabled()` literally checks `typeof jest !== 'undefined'`, which is never true
under Vitest, so it falls through to a "real timers" branch that polls via a plain `setInterval` —
itself one of the globals `vi.useFakeTimers()` has already faked, so that interval never fires on
its own. Fixed with a `globalThis.jest = vi` shim added to `src/test-setup.ts`: Vitest's `vi`
object deliberately mirrors Jest's fake-timer API 1:1 (`useFakeTimers`/`useRealTimers`/
`advanceTimersByTime`/...), so aliasing it under the `jest` name is enough for testing-library's
existing Jest-oriented fake-timer branch to work correctly against Vitest too. Also added a
defensive `afterEach(() => vi.useRealTimers())` to both test files, so a future fake-timer test
that throws before its own cleanup can't leak fake timers into every later test in the same file.
This is a reusable finding for any future spec in this codebase that needs `vi.useFakeTimers()` —
the shim is now in place project-wide via `test-setup.ts`, so later specs shouldn't need to
rediscover this.

**Real finding (post-implementation, found during real-browser verification) — Undo clicked after
the window has already elapsed falsely showed the row as "restored"**: `handleUndoDelete`
unconditionally cleared `pendingDeleteIds` regardless of whether it actually found a live timer to
cancel. `commitDelete` deletes its `pendingDeleteTimersRef` entry **synchronously** the instant the
timer fires — before its `await activityApi.remove(id)`/`await subTaskApi.remove(...)` call even
starts — so there's a real window, roughly the length of that network round-trip, where the delete
is already irreversibly in motion but the Undo button is still rendered and clickable. Clicking it
in that window cleared `pendingDeleteIds` anyway, making the row briefly reappear as a normal, safe
row — a false "it's safe" signal — before it silently vanished again (or showed an error) once the
real result arrived. Found for real: an actual seeded activity ("Journal") was genuinely deleted
this way during manual verification, because the Undo click (via browser automation, with real
round-trip latency between actions) landed just after the window had elapsed. The activity was
manually recreated afterward (best-effort — name/category/repeatable/favourite only, no description
field since none was visible in the UI to recover). **Fix**: `handleUndoDelete` is now a no-op
(`return` immediately) when no live timer is found, in both `ActivityBank.tsx` and `SubTaskList.tsx`
— `commitDelete`'s own success/failure branch is the sole source of truth for that id's state once
the window has elapsed. New regression test added per file, verified red (against the unpatched
code) before green (against the fix): asserts that clicking Undo after `vi.advanceTimersByTime(6000)`
(with the delete promise deliberately held open) does not bring back the row's normal action
buttons while the delete is still in flight.

**Real finding (post-implementation, found during real-browser verification) — the deferred commit
never visibly completed in a real dev-mode browser session, even on success**: a second, more
fundamental bug, found after the first fix, while re-verifying in a real browser. The mount-tracking
effect only set `isMountedRef.current = false` in its cleanup — it never reset it back to `true` in
its setup:
```js
useEffect(() => {
  return () => { isMountedRef.current = false }
}, [])
```
React's `<StrictMode>` (`main.tsx` wraps the whole app in it) deliberately double-invokes every
effect once on initial mount in development — mount, run effects, simulate unmount (run cleanups),
simulate remount (run effect setups again), all on the **same** component instance. That dance ran
this effect's cleanup once immediately after every real mount, leaving `isMountedRef.current`
permanently `false` for the rest of the instance's actual lifetime, since nothing ever set it back
to `true`. Since `commitDelete`'s state updates (both the success path that removes a row and the
failure path that restores one) are gated behind `isMountedRef.current`, this silently disabled
*every* deferred delete's visible completion in real dev-mode browser usage: the real `DELETE` call
still fired and succeeded (confirmed directly against Postgres — the row was genuinely gone), but
the UI never reflected it, leaving the "X deleted. Undo" notice stuck on screen forever. Reproduced
three times in a row against three different throwaway activities before being root-caused. **Fix**:
set `isMountedRef.current = true` in the effect's setup too, not just rely on `useRef(true)`'s
one-time initial value — the standard, StrictMode-safe form of this pattern.
**This class of bug could not be caught by the automated test suite at all**: production builds
don't double-invoke effects (so it would never have manifested in a deployed build), and React
Testing Library's `render()` doesn't wrap in `<StrictMode>` by default (confirmed directly — a test
wrapping `<ActivityBank>` in `<StrictMode>` passed identically against both the buggy and fixed
code, giving false confidence), so the entire 694-test suite was blind to it regardless of how the
mount effect was written. Only real-browser verification — the thing this project's Definition of
Done already requires for UI work — caught it. No attempt was made to force Vitest/jsdom to
replicate StrictMode's double-invoke behavior; the test-suite gap this reveals (this codebase's
automated tests cannot currently catch a mount-effect that doesn't idempotently reset its own
guard/flag state) is logged as its own entry in `.claude/ideas/future_ideas.md` rather than chased
further here.

No deviations from the spec's acceptance criteria. The only implementation choice not explicitly
dictated by the spec: `deletingId` state (used pre-this-spec to disable the Confirm delete/Cancel
buttons while the API call was in flight) was removed from both components, since confirming
delete now hides the row synchronously before any API call — there is no longer an in-flight state
for those buttons to visibly reflect.
