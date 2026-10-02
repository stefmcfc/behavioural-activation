import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BucketList } from './BucketList'
import type { DragPayload } from './dragPayload'
import { PlannerGrid } from './PlannerGrid'
import { WEEKDAY_DAYS } from './planLabels'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'

// frontend_spec_026 / frontend_spec_028: dragging a grid occurrence onto the bucket list (and
// vice versa) relies on WeeklyPlanner lifting a single shared `dragPayload` (formerly a bare
// `draggedId`) and passing it to both PlannerGrid and BucketList. This harness mirrors that exact
// wiring (minus the real API calls WeeklyPlanner makes) so these tests exercise the real
// cross-component drag flow, not two components tested in isolation with the cross-section case
// asserted only indirectly.

const noop = () => {}

function makeOccurrence(overrides: Partial<PlannedOccurrence>): PlannedOccurrence {
  return {
    id: 'o1',
    activityId: 'a1',
    subTaskId: null,
    name: 'Walk',
    parentActivityName: null,
    category: 'ROUTINE',
    weekStart: '2026-09-28',
    dayOfWeek: 'MONDAY',
    slot: 'MORNING',
    bucketPosition: null,
    recentlyCarriedForward: false,
    completed: false,
    completedAt: null,
    createdAt: '2026-09-28T00:00:00Z',
    repeatable: true,
    ...overrides,
  }
}

const gridOccurrence = makeOccurrence({
  id: 'grid-1',
  name: 'Walk',
  dayOfWeek: 'MONDAY',
  slot: 'MORNING',
})

const bucketOccurrence = makeOccurrence({
  id: 'bucket-1',
  name: 'Paint',
  category: 'PLEASURABLE',
  dayOfWeek: null,
  slot: null,
  bucketPosition: 0,
})

interface HarnessProps {
  readonly occurrences: readonly PlannedOccurrence[]
  readonly busyId?: string | null
  readonly onMoveToBucket?: (id: string) => void
  readonly onConfirmMove?: (id: string, dayOfWeek: PlanDayOfWeek, slot: PlanSlot) => void
  readonly onReorder?: (ids: string[]) => void
}

function WeeklyPlannerHarness({
  occurrences,
  busyId = null,
  onMoveToBucket = noop,
  onConfirmMove = noop,
  onReorder = noop,
}: HarnessProps) {
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)

  return (
    <>
      <PlannerGrid
        weekStart="2026-09-28"
        days={WEEKDAY_DAYS}
        heading="Week grid"
        emptyMessage="No activities planned for this week."
        occurrences={occurrences}
        busyId={busyId}
        detailOpenId={null}
        confirmingRemoveId={null}
        movingId={null}
        todayColumn={null}
        onAdd={noop}
        onOpenDetail={noop}
        onCloseDetail={noop}
        onStartRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onStartMove={noop}
        onCancelMove={noop}
        onConfirmMove={onConfirmMove}
        onMoveToBucket={onMoveToBucket}
        onComplete={noop}
        onUndo={noop}
        dragPayload={dragPayload}
        onDragStart={(id) => setDragPayload({ kind: 'occurrence', id })}
        onDragEnd={() => setDragPayload(null)}
        onAssignFromDrawer={noop}
      />
      <BucketList
        occurrences={occurrences}
        busyId={busyId}
        detailOpenId={null}
        confirmingRemoveId={null}
        movingId={null}
        reorderInFlight={false}
        onAdd={noop}
        onOpenDetail={noop}
        onCloseDetail={noop}
        onStartRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onStartMove={noop}
        onCancelMove={noop}
        onConfirmMove={onConfirmMove}
        onMoveToBucket={onMoveToBucket}
        onComplete={noop}
        onUndo={noop}
        onCarryForward={noop}
        onReorder={onReorder}
        dragPayload={dragPayload}
        onDragStart={(id) => setDragPayload({ kind: 'occurrence', id })}
        onDragEnd={() => setDragPayload(null)}
        onAssignFromDrawer={noop}
      />
    </>
  )
}

describe('FRONTEND-026-AC-01: drag state is shared between PlannerGrid and BucketList', () => {
  it('a drag started on a grid tile is visible to the bucket panel drop handler', () => {
    const onMoveToBucket = vi.fn()
    render(
      <WeeklyPlannerHarness occurrences={[gridOccurrence]} onMoveToBucket={onMoveToBucket} />,
    )

    const sourceTile = screen.getByText(gridOccurrence.name).closest('li')!
    const bucketPanel = screen.getByRole('region', { name: 'Weekend bucket list' })
    fireEvent.dragStart(sourceTile)
    fireEvent.dragOver(bucketPanel)
    fireEvent.drop(bucketPanel)

    expect(onMoveToBucket).toHaveBeenCalledWith(gridOccurrence.id)
  })
})

describe('FRONTEND-026: dragging a grid occurrence onto the bucket demotes it', () => {
  it('AC-02: dropping on empty bucket space calls onMoveToBucket with the dragged id', () => {
    const onMoveToBucket = vi.fn()
    render(
      <WeeklyPlannerHarness occurrences={[gridOccurrence]} onMoveToBucket={onMoveToBucket} />,
    )

    const sourceTile = screen.getByText(gridOccurrence.name).closest('li')!
    const bucketPanel = screen.getByRole('region', { name: 'Weekend bucket list' })
    fireEvent.dragStart(sourceTile)
    fireEvent.dragOver(bucketPanel)
    fireEvent.drop(bucketPanel)

    expect(onMoveToBucket).toHaveBeenCalledWith(gridOccurrence.id)
  })

  it('AC-03: dropping on an existing bucket item also calls onMoveToBucket, not onReorder', () => {
    const onMoveToBucket = vi.fn()
    const onReorder = vi.fn()
    render(
      <WeeklyPlannerHarness
        occurrences={[gridOccurrence, bucketOccurrence]}
        onMoveToBucket={onMoveToBucket}
        onReorder={onReorder}
      />,
    )

    const sourceTile = screen.getByText(gridOccurrence.name).closest('li')!
    const bucketItem = screen.getByText(bucketOccurrence.name).closest('li')!
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(bucketItem)

    expect(onMoveToBucket).toHaveBeenCalledWith(gridOccurrence.id)
    expect(onReorder).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-026: dragging a bucket occurrence onto a grid cell promotes it', () => {
  it("AC-05: dropping on a grid cell calls onConfirmMove with that cell's day/slot", () => {
    const onConfirmMove = vi.fn()
    render(
      <WeeklyPlannerHarness occurrences={[bucketOccurrence]} onConfirmMove={onConfirmMove} />,
    )

    const bucketDragHandle = screen
      .getByText(bucketOccurrence.name)
      .closest('li')!
      .querySelector('[draggable="true"]')!
    const targetCell = screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!
    fireEvent.dragStart(bucketDragHandle)
    fireEvent.dragOver(targetCell)
    fireEvent.drop(targetCell)

    expect(onConfirmMove).toHaveBeenCalledWith(bucketOccurrence.id, 'TUESDAY', 'AFTERNOON')
  })

  it('AC-06: a drop while busyId is set does not call onMoveToBucket or onConfirmMove (grid to bucket)', () => {
    const onMoveToBucket = vi.fn()
    const onConfirmMove = vi.fn()
    render(
      <WeeklyPlannerHarness
        occurrences={[gridOccurrence]}
        busyId={gridOccurrence.id}
        onMoveToBucket={onMoveToBucket}
        onConfirmMove={onConfirmMove}
      />,
    )

    const sourceTile = screen.getByText(gridOccurrence.name).closest('li')!
    const bucketPanel = screen.getByRole('region', { name: 'Weekend bucket list' })
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(bucketPanel)

    expect(onMoveToBucket).not.toHaveBeenCalled()
    expect(onConfirmMove).not.toHaveBeenCalled()
  })

  it('AC-06: a drop while busyId is set does not call onConfirmMove (bucket to grid)', () => {
    const onConfirmMove = vi.fn()
    render(
      <WeeklyPlannerHarness
        occurrences={[bucketOccurrence]}
        busyId={bucketOccurrence.id}
        onConfirmMove={onConfirmMove}
      />,
    )

    const bucketDragHandle = screen
      .getByText(bucketOccurrence.name)
      .closest('li')!
      .querySelector('[draggable="true"]')!
    const targetCell = screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!
    fireEvent.dragStart(bucketDragHandle)
    fireEvent.drop(targetCell)

    expect(onConfirmMove).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-026-AC-07: abandoned bucket-origin drag resets shared state', () => {
  it('a dragend with no drop calls neither onMoveToBucket nor onConfirmMove, and a later drag behaves fresh', () => {
    const onMoveToBucket = vi.fn()
    const onConfirmMove = vi.fn()
    render(
      <WeeklyPlannerHarness
        occurrences={[bucketOccurrence, gridOccurrence]}
        onMoveToBucket={onMoveToBucket}
        onConfirmMove={onConfirmMove}
      />,
    )

    const bucketDragHandle = screen
      .getByText(bucketOccurrence.name)
      .closest('li')!
      .querySelector('[draggable="true"]')!
    fireEvent.dragStart(bucketDragHandle)
    fireEvent.dragEnd(bucketDragHandle)

    expect(onMoveToBucket).not.toHaveBeenCalled()
    expect(onConfirmMove).not.toHaveBeenCalled()

    // A subsequent, unrelated drag/drop (the grid tile, onto the bucket) should behave as a
    // fresh drag using its own id, proving the abandoned drag's state was actually reset.
    const otherTile = screen.getByText(gridOccurrence.name).closest('li')!
    const bucketPanel = screen.getByRole('region', { name: 'Weekend bucket list' })
    fireEvent.dragStart(otherTile)
    fireEvent.drop(bucketPanel)

    expect(onMoveToBucket).toHaveBeenCalledWith(gridOccurrence.id)
    expect(onMoveToBucket).not.toHaveBeenCalledWith(bucketOccurrence.id)
  })
})
