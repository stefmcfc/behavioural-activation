import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlannerGrid } from './PlannerGrid'
import styles from './PlannerGrid.module.css'

const noop = () => {}

function renderGrid() {
  render(
    <PlannerGrid
      occurrences={[]}
      busyId={null}
      confirmingRemoveId={null}
      movingId={null}
      onAdd={noop}
      onStartRemove={noop}
      onConfirmRemove={noop}
      onCancelRemove={noop}
      onStartMove={noop}
      onCancelMove={noop}
      onConfirmMove={noop}
      onMoveToBucket={noop}
      onComplete={noop}
      onUndo={noop}
    />,
  )
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
