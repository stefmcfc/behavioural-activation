import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OccurrenceItem } from './OccurrenceItem'
import styles from './OccurrenceItem.module.css'
import type { PlannedOccurrence } from '../../types/plan'

const occurrence: PlannedOccurrence = {
  id: 'o1',
  activityId: 'a1',
  subTaskId: null,
  name: 'Walk',
  category: 'ROUTINE',
  weekStart: '2026-10-05',
  dayOfWeek: 'MONDAY',
  slot: 'MORNING',
  completed: false,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
}

const noop = () => {}

describe('FRONTEND-007-AC-25: occurrence rows match identically in grid and bucket contexts', () => {
  it('applies the same row class whether isBucketItem is true or false', () => {
    const { rerender } = render(
      <OccurrenceItem
        occurrence={occurrence}
        isBucketItem={false}
        busyId={null}
        confirmingRemoveId={null}
        movingId={null}
        onStartRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onStartMove={noop}
        onCancelMove={noop}
        onConfirmMove={noop}
        onMoveToBucket={noop}
        onComplete={noop}
        onUndo={noop}
        onCarryForward={noop}
      />,
    )
    expect(screen.getByText('Walk').closest('li')).toHaveClass(styles.row)

    rerender(
      <OccurrenceItem
        occurrence={occurrence}
        isBucketItem
        busyId={null}
        confirmingRemoveId={null}
        movingId={null}
        onStartRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onStartMove={noop}
        onCancelMove={noop}
        onConfirmMove={noop}
        onMoveToBucket={noop}
        onComplete={noop}
        onUndo={noop}
        onCarryForward={noop}
      />,
    )
    expect(screen.getByText('Walk').closest('li')).toHaveClass(styles.row)
  })
})
