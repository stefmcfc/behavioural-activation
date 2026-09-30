import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OccurrenceItem } from './OccurrenceItem'
import styles from './OccurrenceItem.module.css'
import type { PlannedOccurrence } from '../../types/plan'

const gridOccurrence: PlannedOccurrence = {
  id: 'o1',
  activityId: 'a1',
  subTaskId: null,
  name: 'Walk',
  parentActivityName: null,
  category: 'ROUTINE',
  weekStart: '2026-10-05',
  dayOfWeek: 'MONDAY',
  slot: 'MORNING',
  completed: false,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
}

const subTaskOccurrence: PlannedOccurrence = {
  id: 'o2',
  activityId: null,
  subTaskId: 's1',
  name: 'Chapter one',
  parentActivityName: 'Write a novel',
  category: 'PLEASURABLE',
  weekStart: '2026-10-05',
  dayOfWeek: 'TUESDAY',
  slot: 'AFTERNOON',
  completed: false,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
}

const bucketOccurrence: PlannedOccurrence = {
  id: 'o3',
  activityId: 'a3',
  subTaskId: null,
  name: 'Paint',
  parentActivityName: null,
  category: 'PLEASURABLE',
  weekStart: '2026-10-05',
  dayOfWeek: null,
  slot: null,
  completed: false,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
}

const noop = () => {}

function baseProps(overrides: Partial<Parameters<typeof OccurrenceItem>[0]> = {}) {
  return {
    occurrence: gridOccurrence,
    isBucketItem: false,
    busyId: null,
    detailOpenId: null,
    confirmingRemoveId: null,
    movingId: null,
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
    onCarryForward: noop,
    ...overrides,
  }
}

describe('FRONTEND-007-AC-25: occurrence rows match identically in grid and bucket contexts', () => {
  it('applies the same row class whether isBucketItem is true or false', () => {
    const { rerender } = render(<OccurrenceItem {...baseProps({ isBucketItem: false })} />)
    expect(screen.getByText('Walk').closest('li')).toHaveClass(styles.row)

    rerender(<OccurrenceItem {...baseProps({ isBucketItem: true })} />)
    expect(screen.getByText('Walk').closest('li')).toHaveClass(styles.row)
  })
})

describe('FRONTEND-008-AC-01: at-rest tile hides Rearrange/Remove/Carry forward', () => {
  it('renders only name, category, and Complete when no card is open', () => {
    render(<OccurrenceItem {...baseProps()} />)

    expect(screen.getByRole('button', { name: 'Walk' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^rearrange$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument()
  })

  it('renders no Carry forward at rest for a bucket item either', () => {
    render(<OccurrenceItem {...baseProps({ isBucketItem: true })} />)

    expect(screen.queryByRole('button', { name: /carry forward/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-02/AC-03/AC-04: activating the tile opens a card with Rearrange/Remove', () => {
  it('calls onOpenDetail, then renders the relocated actions once open', () => {
    const onOpenDetail = vi.fn()
    const { rerender } = render(<OccurrenceItem {...baseProps({ onOpenDetail })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Walk' }))
    expect(onOpenDetail).toHaveBeenCalledWith('o1')

    rerender(<OccurrenceItem {...baseProps({ onOpenDetail, detailOpenId: 'o1' })} />)
    expect(screen.getByRole('button', { name: /^rearrange$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^remove$/i })).toBeInTheDocument()
  })

  it('offers Send to bucket inside Rearrange for a grid item, not for a bucket item', async () => {
    const { rerender } = render(
      <OccurrenceItem {...baseProps({ detailOpenId: 'o1', movingId: 'o1' })} />,
    )
    expect(screen.getByRole('button', { name: /send to bucket/i })).toBeInTheDocument()

    rerender(
      <OccurrenceItem
        {...baseProps({ isBucketItem: true, detailOpenId: 'o1', movingId: 'o1' })}
      />,
    )
    expect(screen.queryByRole('button', { name: /send to bucket/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-05: an open bucket item card shows Carry forward', () => {
  it('renders Carry forward for a bucket item with its card open', () => {
    render(<OccurrenceItem {...baseProps({ isBucketItem: true, detailOpenId: 'o1' })} />)

    expect(screen.getByRole('button', { name: /carry forward/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-06: Remove inside the card enters the existing inline confirm sub-state', () => {
  it('shows Confirm remove/Cancel after Remove is activated', async () => {
    const onStartRemove = vi.fn()
    const { rerender } = render(
      <OccurrenceItem {...baseProps({ detailOpenId: 'o1', onStartRemove })} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }))
    expect(onStartRemove).toHaveBeenCalledWith('o1')

    rerender(
      <OccurrenceItem
        {...baseProps({ detailOpenId: 'o1', onStartRemove, confirmingRemoveId: 'o1' })}
      />,
    )
    expect(screen.getByRole('button', { name: /confirm remove/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-07: Rearrange inside the card enters the existing day/slot-select sub-state', () => {
  it('shows day/slot selects and Confirm rearrange/Cancel after Rearrange is activated', async () => {
    const onStartMove = vi.fn()
    const { rerender } = render(<OccurrenceItem {...baseProps({ detailOpenId: 'o1', onStartMove })} />)

    await userEvent.click(screen.getByRole('button', { name: /^rearrange$/i }))
    expect(onStartMove).toHaveBeenCalledWith('o1')

    rerender(<OccurrenceItem {...baseProps({ detailOpenId: 'o1', onStartMove, movingId: 'o1' })} />)
    expect(screen.getByLabelText(/new day/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/new slot/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm rearrange/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-08/AC-09: Close and re-activating the tile both close the card', () => {
  it('calls onCloseDetail from the Close control and from re-activating the name', async () => {
    const onCloseDetail = vi.fn()
    render(<OccurrenceItem {...baseProps({ detailOpenId: 'o1', onCloseDetail })} />)

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onCloseDetail).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Walk' }))
    expect(onCloseDetail).toHaveBeenCalledTimes(2)
  })
})

describe('FRONTEND-008-AC-12: Complete/Undo works with the card closed or open', () => {
  it('calls onComplete when the card is closed', async () => {
    const onComplete = vi.fn()
    render(<OccurrenceItem {...baseProps({ onComplete })} />)

    await userEvent.click(screen.getByRole('button', { name: /complete/i }))
    expect(onComplete).toHaveBeenCalledWith('o1')
  })

  it('calls onUndo from the tile when completed, regardless of card state', async () => {
    const onUndo = vi.fn()
    render(
      <OccurrenceItem
        {...baseProps({ occurrence: { ...gridOccurrence, completed: true }, detailOpenId: 'o1', onUndo })}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(onUndo).toHaveBeenCalledWith('o1')
  })
})

describe('detail card renders as a modal, closed by clicking outside or pressing Escape', () => {
  it('calls onCloseDetail when the overlay outside the card is clicked', async () => {
    const onCloseDetail = vi.fn()
    render(<OccurrenceItem {...baseProps({ detailOpenId: 'o1', onCloseDetail })} />)

    await userEvent.click(screen.getByRole('dialog', { name: /walk actions/i }).parentElement!)
    expect(onCloseDetail).toHaveBeenCalledTimes(1)
  })

  it('does not call onCloseDetail when clicking inside the card', async () => {
    const onCloseDetail = vi.fn()
    render(<OccurrenceItem {...baseProps({ detailOpenId: 'o1', onCloseDetail })} />)

    await userEvent.click(screen.getByRole('dialog', { name: /walk actions/i }))
    expect(onCloseDetail).not.toHaveBeenCalled()
  })

  it('calls onCloseDetail when Escape is pressed while the card is open', async () => {
    const onCloseDetail = vi.fn()
    render(<OccurrenceItem {...baseProps({ detailOpenId: 'o1', onCloseDetail })} />)

    await userEvent.keyboard('{Escape}')
    expect(onCloseDetail).toHaveBeenCalledTimes(1)
  })
})

describe('detail card header shows what was clicked', () => {
  it('shows the occurrence name and category, plus day/slot for a scheduled item', () => {
    render(<OccurrenceItem {...baseProps({ detailOpenId: 'o1' })} />)

    const dialog = screen.getByRole('dialog', { name: /walk actions/i })
    expect(within(dialog).getByText('Walk')).toBeInTheDocument()
    expect(within(dialog).getByTestId('category-chip-ROUTINE')).toBeInTheDocument()
    expect(within(dialog).getByText(/monday/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/morning/i)).toBeInTheDocument()
  })

  it('shows "Weekend bucket list" for an unscheduled bucket item', () => {
    render(
      <OccurrenceItem
        {...baseProps({ occurrence: bucketOccurrence, isBucketItem: true, detailOpenId: 'o3' })}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: /paint actions/i })
    expect(within(dialog).getByText(/weekend bucket list/i)).toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-14/AC-15: parent activity name shown only for sub-task occurrences', () => {
  it('renders the parent activity name for a sub-task, not for a whole-activity occurrence', () => {
    const { rerender } = render(<OccurrenceItem {...baseProps({ occurrence: subTaskOccurrence })} />)
    expect(screen.getByText('Write a novel')).toBeInTheDocument()

    rerender(<OccurrenceItem {...baseProps()} />)
    expect(screen.queryByText('Write a novel')).not.toBeInTheDocument()
  })

  it('renders the parent activity name before the sub-task name', () => {
    render(<OccurrenceItem {...baseProps({ occurrence: subTaskOccurrence })} />)

    const parentName = screen.getByText('Write a novel')
    const subTaskName = screen.getByRole('button', { name: 'Chapter one' })
    expect(
      parentName.compareDocumentPosition(subTaskName) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('never renders parent-activity text for a whole-activity occurrence even if the field is set', () => {
    render(
      <OccurrenceItem
        {...baseProps({ occurrence: { ...gridOccurrence, parentActivityName: 'Should not show' } })}
      />,
    )

    expect(screen.queryByText('Should not show')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-008-AC-16/AC-17: completion indicator is an accessible icon, not text', () => {
  it('renders an icon with accessible name Completed only when completed', () => {
    const { rerender } = render(
      <OccurrenceItem {...baseProps({ occurrence: { ...gridOccurrence, completed: true } })} />,
    )
    expect(screen.getByRole('img', { name: /completed/i })).toBeInTheDocument()
    expect(screen.queryByText(/— completed/i)).not.toBeInTheDocument()

    rerender(<OccurrenceItem {...baseProps()} />)
    expect(screen.queryByRole('img', { name: /completed/i })).not.toBeInTheDocument()
  })
})
