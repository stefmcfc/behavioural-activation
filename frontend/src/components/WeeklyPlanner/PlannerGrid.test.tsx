import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlannerGrid } from './PlannerGrid'
import styles from './PlannerGrid.module.css'
import occurrenceItemStyles from './OccurrenceItem.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'
import { WEEKDAY_DAYS, WEEKEND_DAYS } from './planLabels'
import { setGridOrientation } from '../../utils/gridOrientation'
import type { DragPayload } from './dragPayload'
import type { PlanDayOfWeek, PlannedOccurrence } from '../../types/plan'

const noop = () => {}

beforeEach(() => {
  localStorage.clear()
})

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
    onUpdateNotes: noop,
    dragPayload: null,
    onDragStart: noop,
    onDragEnd: noop,
    onAssignFromDrawer: noop,
  }
}

function renderGrid(overrides: { todayColumn?: PlanDayOfWeek | null } = {}) {
  render(<PlannerGrid {...baseGridProps(overrides)} />)
}

// FRONTEND-026-AC-01 / FRONTEND-028: dragPayload (formerly draggedId) is a controlled prop, not
// local state. This harness mirrors WeeklyPlanner's lifted state so existing drag tests keep
// exercising real drag behaviour (dragstart -> controlled dragPayload -> drop) instead of
// asserting internals.
function DraggableGridHarness(
  props: Omit<Parameters<typeof PlannerGrid>[0], 'dragPayload' | 'onDragStart' | 'onDragEnd'>,
) {
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
  return (
    <PlannerGrid
      {...props}
      dragPayload={dragPayload}
      onDragStart={(id) => setDragPayload({ kind: 'occurrence', id })}
      onDragEnd={() => setDragPayload(null)}
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

describe('FRONTEND-031-AC-16: regression guard -- per-cell Add buttons stay unstyled', () => {
  it('leaves the per-cell Add button with no variant class', () => {
    renderGrid()

    const addButton = screen.getByLabelText('Add to Monday Morning')
    expect(addButton).not.toHaveClass(buttonStyles.primary)
    expect(addButton).not.toHaveClass(buttonStyles.destructive)
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
    notes: null,
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

describe('FRONTEND-028-AC-10/AC-15: dropping a drawer item on a grid cell', () => {
  it("AC-10: calls onAssignFromDrawer with the dropped cell's day/slot, not onConfirmMove", () => {
    const onAssignFromDrawer = vi.fn()
    const onConfirmMove = vi.fn()
    render(
      <PlannerGrid
        {...baseGridProps()}
        dragPayload={{ kind: 'activity', activityId: 'activity-1' }}
        onAssignFromDrawer={onAssignFromDrawer}
        onConfirmMove={onConfirmMove}
      />,
    )
    const targetCell = screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!
    fireEvent.drop(targetCell)
    expect(onAssignFromDrawer).toHaveBeenCalledWith(
      { kind: 'activity', activityId: 'activity-1' },
      'TUESDAY',
      'AFTERNOON',
    )
    expect(onConfirmMove).not.toHaveBeenCalled()
  })

  it('AC-10: also works for a sub-task payload', () => {
    const onAssignFromDrawer = vi.fn()
    render(
      <PlannerGrid
        {...baseGridProps()}
        dragPayload={{ kind: 'subtask', subTaskId: 'subtask-1' }}
        onAssignFromDrawer={onAssignFromDrawer}
      />,
    )
    const targetCell = screen.getByLabelText('Add to Monday Morning').closest('div')!
    fireEvent.drop(targetCell)
    expect(onAssignFromDrawer).toHaveBeenCalledWith(
      { kind: 'subtask', subTaskId: 'subtask-1' },
      'MONDAY',
      'MORNING',
    )
  })

  it('does not throw when onAssignFromDrawer is omitted and a non-occurrence payload is dropped', () => {
    render(
      <PlannerGrid
        {...baseGridProps()}
        dragPayload={{ kind: 'activity', activityId: 'activity-1' }}
        onAssignFromDrawer={undefined}
      />,
    )
    const targetCell = screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!
    expect(() => fireEvent.drop(targetCell)).not.toThrow()
  })

  it('AC-15: an occurrence-kind payload is unaffected, still calling onConfirmMove', () => {
    const onConfirmMove = vi.fn()
    const onAssignFromDrawer = vi.fn()
    render(
      <DraggableGridHarness
        {...baseGridProps()}
        occurrences={[occurrenceOnMonMorning]}
        onConfirmMove={onConfirmMove}
        onAssignFromDrawer={onAssignFromDrawer}
      />,
    )
    const sourceTile = screen.getByText(occurrenceOnMonMorning.name).closest('li')!
    const targetCell = screen.getByLabelText('Add to Tuesday Afternoon').closest('div')!
    fireEvent.dragStart(sourceTile)
    fireEvent.drop(targetCell)
    expect(onConfirmMove).toHaveBeenCalledWith(occurrenceOnMonMorning.id, 'TUESDAY', 'AFTERNOON')
    expect(onAssignFromDrawer).not.toHaveBeenCalled()
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

describe('FRONTEND-012-AC-06: day-columns layout is unchanged when unset', () => {
  it('renders a single shared grid with a day-label header row and no day-sections', () => {
    renderGrid()

    expect(screen.getByText('Monday').closest(`.${styles.dayLabel}`)).not.toBeNull()
    expect(document.querySelectorAll(`.${styles.daySection}`)).toHaveLength(0)
  })
})

describe('FRONTEND-012-AC-07/AC-09: day-rows layout renders one section per day, no shared header', () => {
  it('renders five day-sections in the order given by the days prop, each with its own heading', () => {
    setGridOrientation('day-rows')

    renderGrid()

    const sections = document.querySelectorAll(`.${styles.daySection}`)
    expect(sections).toHaveLength(5)
    expect(screen.getByRole('heading', { name: /monday/i, level: 4 })).toHaveClass(
      styles.dayHeading,
    )
    expect(document.querySelectorAll(`.${styles.dayLabel}`)).toHaveLength(0)
  })

  it('renders one section per entry in a shorter days list (WEEKEND_DAYS), not a hardcoded five', () => {
    setGridOrientation('day-rows')

    render(<PlannerGrid {...baseGridProps()} days={WEEKEND_DAYS} />)

    expect(document.querySelectorAll(`.${styles.daySection}`)).toHaveLength(2)
    expect(screen.getByRole('heading', { name: /saturday/i, level: 4 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /sunday/i, level: 4 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /monday/i, level: 4 })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-012-AC-08: day-rows cells render the same slot label/Add/list content', () => {
  it("renders an inside-box slot label and Add control for each of Monday's three slots", () => {
    setGridOrientation('day-rows')

    renderGrid()

    const mondaySection = screen.getByRole('heading', { name: /monday/i, level: 4 }).closest(
      'section',
    )!
    expect(within(mondaySection).getByLabelText('Add to Monday Morning')).toBeInTheDocument()
    expect(within(mondaySection).getByLabelText('Add to Monday Afternoon')).toBeInTheDocument()
    expect(within(mondaySection).getByLabelText('Add to Monday Evening')).toBeInTheDocument()
    expect(within(mondaySection).getByText('Morning')).toHaveClass(styles.slotLabel)
  })

  it('renders occurrences in the matching day-rows cell, same as day-columns', () => {
    setGridOrientation('day-rows')

    render(<PlannerGrid {...baseGridProps()} occurrences={[occurrenceOnMonMorning]} />)

    expect(screen.getByText(occurrenceOnMonMorning.name)).toBeInTheDocument()
  })
})

describe('FRONTEND-012-AC-11: PlannerGrid reads the preference at mount', () => {
  it('renders day-rows on a fresh mount after the preference was changed', () => {
    setGridOrientation('day-rows')

    renderGrid()

    expect(document.querySelectorAll(`.${styles.daySection}`)).toHaveLength(5)
  })
})

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

describe('FRONTEND-034-AC-03: PlannerGrid unsubscribes on unmount', () => {
  it('does not update state (or warn) after unmount', () => {
    const { unmount } = render(<PlannerGrid {...baseGridProps()} />)
    unmount()

    expect(() => {
      act(() => {
        setGridOrientation('day-rows')
      })
    }).not.toThrow()
  })
})

describe('FRONTEND-035-AC-06: dimmedOccurrenceIds threads through to OccurrenceItem', () => {
  it('applies styles.dimmed when the occurrence id is in dimmedOccurrenceIds', () => {
    render(
      <PlannerGrid
        {...baseGridProps()}
        occurrences={[occurrenceOnMonMorning]}
        dimmedOccurrenceIds={new Set([occurrenceOnMonMorning.id])}
      />,
    )
    expect(screen.getByText(occurrenceOnMonMorning.name).closest('li')).toHaveClass(
      occurrenceItemStyles.dimmed,
    )
  })

  it('FRONTEND-035-AC-08: does not dim an occurrence when dimmedOccurrenceIds is omitted (default)', () => {
    render(
      <PlannerGrid {...baseGridProps()} occurrences={[occurrenceOnMonMorning]} />,
    )
    expect(screen.getByText(occurrenceOnMonMorning.name).closest('li')).not.toHaveClass(
      occurrenceItemStyles.dimmed,
    )
  })
})

describe('FRONTEND-012-AC-12: today-highlight is consistent across orientations', () => {
  it('applies the today class to the day-section heading and its slot cells in day-rows', () => {
    setGridOrientation('day-rows')

    renderGrid({ todayColumn: 'TUESDAY' })

    const tuesdayHeading = screen.getByRole('heading', { name: /tuesday/i, level: 4 })
    expect(tuesdayHeading.closest(`.${styles.today}`)).not.toBeNull()
    const tuesdaySection = tuesdayHeading.closest('section')!
    expect(
      within(tuesdaySection).getByLabelText('Add to Tuesday Morning').closest(`.${styles.today}`),
    ).not.toBeNull()

    const mondayHeading = screen.getByRole('heading', { name: /monday/i, level: 4 })
    expect(mondayHeading.closest(`.${styles.today}`)).toBeNull()
  })
})

describe('FRONTEND-042-AC-05: each day header shows a work-day toggle reflecting that date\'s status', () => {
  it('defaults every toggle to unmarked (aria-pressed=false) when workDays is omitted', () => {
    renderGrid()

    const toggle = screen.getByRole('button', { name: /mark monday.*work day/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a marked toggle for a date present and true in workDays', () => {
    // weekStart is 2026-09-28 (a Monday)
    render(
      <PlannerGrid
        {...baseGridProps()}
        workDays={new Map([['2026-09-28', true]])}
      />,
    )

    const mondayToggle = screen.getByRole('button', { name: /unmark monday.*work day/i })
    expect(mondayToggle).toHaveAttribute('aria-pressed', 'true')
    const tuesdayToggle = screen.getByRole('button', { name: /mark tuesday.*work day/i })
    expect(tuesdayToggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders a toggle in both the day-rows and day-columns layouts', () => {
    const { unmount } = render(
      <PlannerGrid {...baseGridProps()} workDays={new Map([['2026-09-28', true]])} />,
    )
    expect(screen.getByRole('button', { name: /unmark monday.*work day/i })).toBeInTheDocument()
    unmount()

    setGridOrientation('day-rows')
    render(<PlannerGrid {...baseGridProps()} workDays={new Map([['2026-09-28', true]])} />)
    expect(screen.getByRole('button', { name: /unmark monday.*work day/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-042-AC-06: clicking the toggle calls onToggleWorkDay with that exact date', () => {
  it('calls onToggleWorkDay with the ISO date for the clicked day', async () => {
    const onToggleWorkDay = vi.fn()
    render(<PlannerGrid {...baseGridProps()} onToggleWorkDay={onToggleWorkDay} />)

    await userEvent.click(screen.getByRole('button', { name: /mark monday.*work day/i }))

    expect(onToggleWorkDay).toHaveBeenCalledWith('2026-09-28')
  })

  it('does not throw when onToggleWorkDay is omitted', async () => {
    renderGrid()

    await userEvent.click(screen.getByRole('button', { name: /mark monday.*work day/i }))

    expect(screen.getByRole('button', { name: /mark monday.*work day/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-042-AC-07: regression guard -- the work-day toggle never changes slots/plannability', () => {
  it('leaves Add buttons and occurrence rendering unaffected by workDays/onToggleWorkDay', () => {
    render(
      <PlannerGrid
        {...baseGridProps()}
        occurrences={[occurrenceOnMonMorning]}
        workDays={new Map([['2026-09-28', true]])}
      />,
    )

    expect(screen.getByText(occurrenceOnMonMorning.name)).toBeInTheDocument()
    expect(screen.getByLabelText('Add to Monday Morning')).toBeInTheDocument()
    expect(screen.getByLabelText('Add to Monday Afternoon')).toBeInTheDocument()
    expect(screen.getByLabelText('Add to Monday Evening')).toBeInTheDocument()
  })
})
