import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlannerGrid } from './PlannerGrid'
import styles from './PlannerGrid.module.css'
import type { PlanDayOfWeek } from '../../types/plan'

const noop = () => {}

function baseGridProps(overrides: { todayColumn?: PlanDayOfWeek | null } = {}) {
  return {
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
  }
}

function renderGrid(overrides: { todayColumn?: PlanDayOfWeek | null } = {}) {
  render(<PlannerGrid {...baseGridProps(overrides)} />)
}

describe('FRONTEND-007-AC-09: day-of-week labels use the mono day-label style', () => {
  it('applies the dayLabel class to each weekday heading', () => {
    renderGrid()

    expect(screen.getByText('Monday')).toHaveClass(styles.dayLabel)
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
    expect(screen.getByText('Tuesday')).toHaveClass(styles.today)
    expect(screen.getByText('Monday')).not.toHaveClass(styles.today)

    rerender(<PlannerGrid {...baseGridProps({ todayColumn: null })} />)
    expect(screen.getByText('Tuesday')).not.toHaveClass(styles.today)
  })
})
