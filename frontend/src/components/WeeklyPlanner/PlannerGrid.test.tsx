import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlannerGrid } from './PlannerGrid'
import styles from './PlannerGrid.module.css'
import { WEEKDAY_DAYS, WEEKEND_DAYS } from './planLabels'
import type { PlanDayOfWeek, PlannedOccurrence } from '../../types/plan'

const noop = () => {}

function baseGridProps(overrides: { todayColumn?: PlanDayOfWeek | null } = {}) {
  return {
    weekStart: '2026-09-28',
    days: WEEKDAY_DAYS,
    heading: 'Week grid',
    emptyMessage: 'No activities planned for this week.',
    occurrences: [],
    busyId: null,
    detailOpenId: null,
    confirmingRemoveId: null,
    movingId: null,
    todayColumn: overrides.todayColumn ?? null,
    onAdd: noop,
    onOpenDetail: noop,
    onCloseDetail: noop,
    onStartRemove: noop,
    onConfirmRemove: noop,
    onCancelRemove: noop,
    onStartMove: noop,
    onCancelMove: noop,
    onConfirmMove: noop,
    onMoveToBucket: noop,
    onComplete: noop,
    onUndo: noop,
    draggedId: null,
    onDragStart: noop,
    onDragEnd: noop,
  }
}

function renderGrid(overrides: { todayColumn?: PlanDayOfWeek | null } = {}) {
  render(<PlannerGrid {...baseGridProps(overrides)} />)
}

// FRONTEND-026-AC-01: draggedId is now a controlled prop, not local state. This harness
// mirrors WeeklyPlanner's lifted state so existing drag tests keep exercising real drag
// behaviour (dragstart -> controlled draggedId -> drop) instead of asserting internals.
function DraggableGridHarness(
  props: Omit<Parameters<typeof PlannerGrid>[0], 'draggedId' | 'onDragStart' | 'onDragEnd'>,
) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  return (
    <PlannerGrid
      {...props}
      draggedId={draggedId}
      onDragStart={setDraggedId}
      onDragEnd={() => setDraggedId(null)}
    />
  )
}

describe('FRONTEND-007-AC-09: day-of-week labels use the mono day-label style', () => {
  it('applies the dayLabel class to each weekday heading', () => {
    renderGrid()

    expect(screen.getByText('Monday').closest(`.${styles.dayLabel}`)).not.toBeNull()
  })
})

describe('FRONTEND-007-AC-23: planner grid cells are flat panels', () => {
  it('applies the cell class to each day/slot cell', () => {
    renderGrid()

    expect(screen.getByLabelText('Add to Monday Morning').closest(`.${styles.cell}`)).not.toBeNull()
  })
})

describe('FRONTEND-008-AC-18/AC-19: today-column highlight only appears for the current week', () => {
  it('highlights the given today column, and nothing when todayColumn is null', () => {
    const { rerender } = render(<PlannerGrid {...baseGridProps({ todayColumn: 'TUESDAY' })} />)
    expect(screen.getByText('Tuesday').closest(`.${styles.today}`)).not.toBeNull()
    expect(screen.getByText('Monday').closest(`.${styles.today}`)).toBeNull()

    rerender(<PlannerGrid {...baseGridProps({ todayColumn: null })} />)
    expect(screen.getByText('Tuesday').closest(`.${styles.today}`)).toBeNull()
  })
})

describe('FRONTEND-015-AC-02/AC-03: days/heading/emptyMessage are driven by props, not hardcoded', () => {
  it('renders the Monday-Friday layout by default via the days prop', () => {
    render(<PlannerGrid {...baseGridProps()} />)

    expect(screen.getByRole('heading', { name: 'Week grid' })).toBeInTheDocument()
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Friday')).toBeInTheDocument()
    expect(screen.queryByText('Saturday')).not.toBeInTheDocument()
    expect(screen.getByText('No activities planned for this week.')).toBeInTheDocument()
  })

  it('renders Saturday/Sunday in the same 3-slot layout when given WEEKEND_DAYS', () => {
    render(
      <PlannerGrid
        {...baseGridProps()}
        days={WEEKEND_DAYS}
        heading="Weekend grid"
        emptyMessage="No activities planned for the weekend."
      />,
    )

    expect(screen.getByRole('heading', { name: 'Weekend grid' })).toBeInTheDocument()
    expect(screen.getByText('Saturday')).toBeInTheDocument()
    expect(screen.getByText('Sunday')).toBeInTheDocument()
    expect(screen.queryByText('Monday')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Add to Saturday Morning')).toBeInTheDocument()
    expect(screen.getByLabelText('Add to Sunday Evening')).toBeInTheDocument()
    expect(screen.getByText('No activities planned for the weekend.')).toBeInTheDocument()
  })
})

describe('FRONTEND-024-AC-06: day column headers show the date number before the day name', () => {
  it('shows the day-of-month number, including across a month rollover', () => {
    render(<PlannerGrid {...baseGridProps()} />)

    // weekStart is 2026-09-28, a Monday; Friday that week is 2026-10-02
    expect(screen.getByText('28').nextSibling).toHaveTextContent('Monday')
    expect(screen.getByText('2').nextSibling).toHaveTextContent('Friday')
  })
})

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

const occurrenceOnMonMorning = makeOccurrence({
  id: 'mon-morning',
  name: 'Walk',
  dayOfWeek: 'MONDAY',
  slot: 'MORNING',
})

const occurrenceOnTueAfternoon = makeOccurrence({
  id: 'tue-afternoon',
  name: 'Read',
  dayOfWeek: 'TUESDAY',
  slot: 'AFTERNOON',
})

describe('FRONTEND-025: PlannerGrid drag-to-move', () => {
  it("AC-04: calls onConfirmMove with the dropped cell's day/slot", () => {
    const onConfirmMove = vi.fn()
    render(
      <DraggableGridHarness
        {...baseGridProps()}
        occurrences={[occurrenceOnMonMorning]}
        onConfirmMove={onConfirmMove}
      />,
    )
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    const targetCell = screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!
    fireEvent.dragStart(sourceTile)
    fireEvent.dragOver(targetCell)
    fireEvent.drop(targetCell)
    expect(onConfirmMove).toHaveBeenCalledWith(occurrenceOnMonMorning.id, 'TUESDAY', 'AFTERNOON')
  })

  it('AC-05: does not call onConfirmMove when dropped back on its own cell', () => {
    const onConfirmMove = vi.fn()
    render(
      <DraggableGridHarness
        {...baseGridProps()}
        occurrences={[occurrenceOnMonMorning]}
        onConfirmMove={onConfirmMove}
      />,
    )
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    const ownCell = screen.getByLabelText('Add to Monday Morning').closest('div')!
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(ownCell)
    expect(onConfirmMove).not.toHaveBeenCalled()
  })

  it('AC-06: calls onConfirmMove when the target cell already has an occurrence', () => {
    const onConfirmMove = vi.fn()
    render(
      <DraggableGridHarness
        {...baseGridProps()}
        occurrences={[occurrenceOnMonMorning, occurrenceOnTueAfternoon]}
        onConfirmMove={onConfirmMove}
      />,
    )
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    const occupiedCell = screen.getByText(occurrenceOnTueAfternoon.name).closest('div')!
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(occupiedCell)
    expect(onConfirmMove).toHaveBeenCalledWith(occurrenceOnMonMorning.id, 'TUESDAY', 'AFTERNOON')
  })

  it('AC-07: a dragend with no drop leaves occurrences unchanged and resets cleanly', () => {
    const onConfirmMove = vi.fn()
    render(
      <DraggableGridHarness
        {...baseGridProps()}
        occurrences={[occurrenceOnMonMorning]}
        onConfirmMove={onConfirmMove}
      />,
    )
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    fireEvent.dragStart(sourceTile)
    fireEvent.dragEnd(sourceTile)
    expect(onConfirmMove).not.toHaveBeenCalled()
  })

  it('AC-08: a drop while busyId is set does not call onConfirmMove', () => {
    const onConfirmMove = vi.fn()
    render(
      <DraggableGridHarness
        {...baseGridProps()}
        occurrences={[occurrenceOnMonMorning]}
        busyId={occurrenceOnMonMorning.id}
        onConfirmMove={onConfirmMove}
      />,
    )
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    const targetCell = screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(targetCell)
    expect(onConfirmMove).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-026-AC-08: grid-internal drag-to-move is unaffected by the draggedId state lift', () => {
  it('still calls onConfirmMove between two grid cells now that draggedId is a controlled prop', () => {
    const onConfirmMove = vi.fn()
    render(
      <DraggableGridHarness
        {...baseGridProps()}
        occurrences={[occurrenceOnMonMorning, occurrenceOnTueAfternoon]}
        onConfirmMove={onConfirmMove}
      />,
    )
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    const targetCell = screen.getByLabelText('Add to Monday Afternoon').closest('div')!
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(targetCell)
    expect(onConfirmMove).toHaveBeenCalledWith(occurrenceOnMonMorning.id, 'MONDAY', 'AFTERNOON')
  })
})
