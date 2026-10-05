# Prevent a Completed Occurrence from Being Moved to the Bucket (Frontend)

**Status**: Not started
**Priority**: P2 — correctness bug, found while reviewing the Weekly Summary tab's "X scheduled, Y
in the bucket" stat with the user (2026-10-05)
**Depends on**: `planner_spec_020_prevent_completed_occurrence_bucket_move.md` (the backend guard
this spec's UI changes make largely unreachable — this spec is the primary UX fix, the backend's
`409` is a defense-in-depth safety net for any path this spec misses), `frontend_spec_026_grid_
bucket_cross_drag.md` (origin of drag-to-bucket, `onMoveToBucket` wiring), `frontend_spec_008_
occurrence_detail_card.md` (origin of the "Send to bucket" button this spec hides)
**Area**: Frontend only
**Roadmap version**: V1 polish

## Overview

Two existing UI paths currently let a user turn a *completed* grid occurrence back into an
unscheduled bucket item, with no guard on either: `OccurrenceItem.tsx`'s "Send to bucket" button
(rendered whenever `!isBucketItem`, with no check on `occurrence.completed`) and dragging a
completed grid tile onto the weekend bucket list (`draggable={!isBucketItem}`, same gap). Confirmed
by reading both code paths — neither checks completion state today.

Rather than relying solely on the backend's new `409` rejection (`planner_spec_020`) and showing the
user an error message after they've already attempted an action that was never going to succeed,
this spec proactively removes the affordance: the "Send to bucket" button doesn't render for a
completed occurrence, and dropping a completed occurrence onto the bucket is a no-op (the drag still
starts and ends normally — unaffected, since grid-internal rearranging of a completed occurrence
stays allowed — but the drop onto the bucket target specifically does nothing).

**Out of scope**: rearranging a completed occurrence to a different grid slot (drag or the
"Rearrange" dropdown) is unaffected — only the bucket-targeting action is blocked, matching
`planner_spec_020`'s identical scope boundary. No change to `carryForward`'s existing, separate
"completed bucket items can't be carried forward" guard.

## Requirements

### Requirement 1 — Hide the click-based "Send to bucket" action for a completed occurrence

**User story**: As a user looking at a completed activity's detail card, I don't want to see a
"Send to bucket" option that will never succeed, since the activity is already done.

#### FRONTEND-038-AC-01 [AUTO]: "Send to bucket" does not render for a completed occurrence
**Statement**: While `occurrence.completed` is `true`, `OccurrenceItem`'s "Send to bucket" button
shall not render, regardless of `isBucketItem` (unchanged: it already never renders for a bucket
item).

**Rationale**: Proactive UX fix — don't offer an action that's now guaranteed to fail.

**References**: Component: `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` (existing
`!isBucketItem` condition around the button, extended with `!occurrence.completed`)

#### FRONTEND-038-AC-02 [AUTO]: "Send to bucket" still renders for a not-completed grid occurrence
**Statement**: While `occurrence.completed` is `false` and `isBucketItem` is `false`, "Send to
bucket" shall continue to render exactly as before this spec.

**Rationale**: Explicit regression guard.

**References**: Component: `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx`

### Requirement 2 — Dropping a completed occurrence onto the bucket is a no-op

**User story**: As a user, if I drag a completed activity tile toward the weekend bucket, I don't
want it to actually move there, since it's already done.

#### FRONTEND-038-AC-03 [AUTO]: A completed occurrence dropped on the bucket panel does not call `onMoveToBucket`
**Statement**: When a dragged occurrence whose `completed` is `true` is dropped on the `BucketList`
panel (empty space or an existing item), `BucketList` shall not call `onMoveToBucket`.

**Rationale**: Closes the cross-drag gap `frontend_spec_026` left open — the drag/drop mechanics
stay unchanged, only the resulting action is suppressed for a completed occurrence.

**References**: Component: `frontend/src/components/WeeklyPlanner/BucketList.tsx` (existing
`handlePanelDrop`/per-item `handleDrop`, new completed check alongside the existing
`idsInOrder.includes(draggedId)` guard)

#### FRONTEND-038-AC-04 [AUTO]: A not-completed occurrence dropped on the bucket still calls `onMoveToBucket`
**Statement**: When a dragged occurrence whose `completed` is `false` is dropped on the `BucketList`
panel, the existing `frontend_spec_026` behavior (call `onMoveToBucket`) shall be unaffected.

**Rationale**: Explicit regression guard.

**References**: Component: `frontend/src/components/WeeklyPlanner/BucketList.tsx`

#### FRONTEND-038-AC-05 [AUTO]: Grid-internal drag-to-move of a completed occurrence is unaffected
**Statement**: Dragging a completed grid occurrence and dropping it on a different grid cell (not
the bucket) shall continue to call `onConfirmMove` exactly as `frontend_spec_025` already specifies.

**Rationale**: Explicit regression guard — this spec narrows only the bucket-drop case, not
grid-internal rearranging, matching `planner_spec_020`'s identical scope boundary.

**References**: Component: `frontend/src/components/WeeklyPlanner/PlannerGrid.tsx`

## Cross-references

| Reference | What it provides |
|---|---|
| `planner_spec_020_prevent_completed_occurrence_bucket_move.md` | The backend `409` this spec's `actionError`/`getErrorMessage` handling (`usePlanActions.ts`, already generic) would surface if any path reaches the API anyway — no new frontend error-handling plumbing needed, since `handleMove`'s existing `catch` block already covers it |
| `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` | `onMoveToBucket` button visibility (Requirement 1) |
| `frontend/src/components/WeeklyPlanner/BucketList.tsx` | Panel-level and per-item drop handlers (Requirement 2) |
| `frontend_spec_026_grid_bucket_cross_drag.md` | Origin of the cross-section drag-and-drop this spec narrows |
| `frontend_spec_008_occurrence_detail_card.md` | Origin of the "Send to bucket" button this spec hides conditionally |

## Test case sketches (Vitest + RTL, red before implementation)

```tsx
describe('FRONTEND-038-AC-01/AC-02: Send to bucket button respects completion state', () => {
  it('AC-01: does not render Send to bucket for a completed grid occurrence', () => {
    render(<OccurrenceItem occurrence={makeOccurrence({ completed: true })} isBucketItem={false} {...handlers} />)
    fireEvent.click(screen.getByText(/rearrange/i))
    expect(screen.queryByText('Send to bucket')).not.toBeInTheDocument()
  })

  it('AC-02: still renders Send to bucket for a not-completed grid occurrence', () => {
    render(<OccurrenceItem occurrence={makeOccurrence({ completed: false })} isBucketItem={false} {...handlers} />)
    fireEvent.click(screen.getByText(/rearrange/i))
    expect(screen.getByText('Send to bucket')).toBeInTheDocument()
  })
})

describe('FRONTEND-038-AC-03/AC-04: dropping on the bucket respects completion state', () => {
  it('AC-03: a completed occurrence dropped on the bucket panel does not call onMoveToBucket', () => {
    const onMoveToBucket = vi.fn()
    render(<WeeklyPlannerHarness occurrences={[makeOccurrence({ id: '1', completed: true })]} />)
    const sourceTile = screen.getByText(/walk/i).closest('li')!
    const bucketPanel = screen.getByRole('region', { name: 'Weekend bucket list' })
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(bucketPanel)
    expect(onMoveToBucket).not.toHaveBeenCalled()
  })

  it('AC-04: a not-completed occurrence dropped on the bucket still calls onMoveToBucket', () => {
    const onMoveToBucket = vi.fn()
    render(<WeeklyPlannerHarness occurrences={[makeOccurrence({ id: '1', completed: false })]} />)
    const sourceTile = screen.getByText(/walk/i).closest('li')!
    const bucketPanel = screen.getByRole('region', { name: 'Weekend bucket list' })
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(bucketPanel)
    expect(onMoveToBucket).toHaveBeenCalledWith('1')
  })
})

describe('FRONTEND-038-AC-05: grid-internal drag of a completed occurrence is unaffected', () => {
  it('still calls onConfirmMove when dropped on a different grid cell', () => {
    // Regression guard only -- exercises the pre-existing frontend_spec_025 path unchanged.
  })
})
```

**Test Case (Green)**: add the `!occurrence.completed` condition to `OccurrenceItem`'s "Send to
bucket" button, and the completed check to `BucketList`'s drop handlers, until all sketches above
pass.

## Acceptance Criteria Summary

- [ ] FRONTEND-038-AC-01 — "Send to bucket" does not render for a completed occurrence
- [ ] FRONTEND-038-AC-02 — "Send to bucket" still renders for a not-completed grid occurrence (regression guard)
- [ ] FRONTEND-038-AC-03 — dropping a completed occurrence on the bucket does not call `onMoveToBucket`
- [ ] FRONTEND-038-AC-04 — dropping a not-completed occurrence on the bucket still calls `onMoveToBucket` (regression guard)
- [ ] FRONTEND-038-AC-05 — grid-internal drag-to-move of a completed occurrence is unaffected (regression guard)
