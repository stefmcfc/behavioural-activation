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
  bucketPosition: null,
  recentlyCarriedForward: false,
  completed: false,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  repeatable: true,
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
  bucketPosition: null,
  recentlyCarriedForward: false,
  completed: false,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  repeatable: true,
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
  bucketPosition: 0,
  recentlyCarriedForward: false,
  completed: false,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  repeatable: false,
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

describe('detail card renders as a native dialog, closed by clicking the backdrop or pressing Escape', () => {
  it('calls onCloseDetail when the dialog backdrop (the dialog element itself) is clicked', () => {
    const onCloseDetail = vi.fn()
    render(<OccurrenceItem {...baseProps({ detailOpenId: 'o1', onCloseDetail })} />)

    fireEvent.click(screen.getByRole('dialog', { name: /walk actions/i }))
    expect(onCloseDetail).toHaveBeenCalledTimes(1)
  })

  it('does not call onCloseDetail when clicking inside the card', async () => {
    const onCloseDetail = vi.fn()
    render(<OccurrenceItem {...baseProps({ detailOpenId: 'o1', onCloseDetail })} />)

    await userEvent.click(within(screen.getByRole('dialog')).getByText('Walk'))
    expect(onCloseDetail).not.toHaveBeenCalled()
  })

  it('calls onCloseDetail when the dialog fires its native close event (Escape in a real browser)', () => {
    const onCloseDetail = vi.fn()
    render(<OccurrenceItem {...baseProps({ detailOpenId: 'o1', onCloseDetail })} />)

    fireEvent(screen.getByRole('dialog', { name: /walk actions/i }), new Event('close'))
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

describe('FRONTEND-021-AC-01: shows the repeatable icon for a repeatable bucket item', () => {
  it('renders a RepeatableIcon between CategoryChip and the completion indicator', () => {
    render(
      <OccurrenceItem
        {...baseProps({ occurrence: { ...bucketOccurrence, repeatable: true }, isBucketItem: true })}
      />,
    )

    expect(screen.getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-021-AC-02: shows no repeatable icon for a one-off bucket item', () => {
  it('renders no RepeatableIcon when the bucket item is not repeatable', () => {
    render(
      <OccurrenceItem
        {...baseProps({ occurrence: { ...bucketOccurrence, repeatable: false }, isBucketItem: true })}
      />,
    )

    expect(screen.queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-021-AC-03: shows no repeatable icon on a grid cell, even when repeatable is true', () => {
  it('renders no RepeatableIcon for a grid occurrence regardless of its repeatable value', () => {
    render(
      <OccurrenceItem
        {...baseProps({ occurrence: { ...gridOccurrence, repeatable: true }, isBucketItem: false })}
      />,
    )

    expect(screen.queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-021-AC-04: shows no repeatable icon on a sub-task-sourced bucket item, even when repeatable is true', () => {
  it('renders no RepeatableIcon for a sub-task occurrence regardless of its repeatable value', () => {
    render(
      <OccurrenceItem
        {...baseProps({
          occurrence: { ...subTaskOccurrence, dayOfWeek: null, slot: null, repeatable: true },
          isBucketItem: true,
        })}
      />,
    )

    expect(screen.queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-010-AC-02/AC-03/AC-15: reorder controls render always at-rest for a bucket item', () => {
  it('renders a draggable, aria-hidden grip handle and Move up/down buttons for a bucket item', () => {
    render(
      <OccurrenceItem {...baseProps({ occurrence: bucketOccurrence, isBucketItem: true })} />,
    )

    const handle = document.querySelector('[draggable="true"]')
    expect(handle).not.toBeNull()
    expect(handle).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: /move paint up/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move paint down/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-010-AC-16: grid items never render a drag handle or Move up/down controls', () => {
  it('renders no grip-handle drag source or Move up/down buttons for a grid-scheduled occurrence', () => {
    render(<OccurrenceItem {...baseProps({ isBucketItem: false })} />)

    // FRONTEND-025-AC-01 makes the root <li> itself draggable for grid items instead — this
    // assertion now targets the dedicated grip-handle icon specifically, not any draggable node.
    expect(document.querySelector(`.${styles.dragHandle}`)).toBeNull()
    expect(screen.queryByRole('button', { name: /move .* up/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move .* down/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-025-AC-01: grid tiles are draggable, bucket tiles unaffected', () => {
  it('renders draggable=true on a grid-scheduled occurrence row', () => {
    render(<OccurrenceItem {...baseProps({ isBucketItem: false })} />)
    expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'true')
  })

  it('calls onDragStart with the occurrence id when a grid tile starts dragging', () => {
    const onDragStart = vi.fn()
    render(<OccurrenceItem {...baseProps({ isBucketItem: false, onDragStart })} />)
    fireEvent.dragStart(screen.getByRole('listitem'))
    expect(onDragStart).toHaveBeenCalledWith('o1')
  })

  it('does not add draggable to the bucket item row itself (handle stays the drag source)', () => {
    render(
      <OccurrenceItem
        {...baseProps({ occurrence: bucketOccurrence, isBucketItem: true, onDragStart: vi.fn() })}
      />,
    )
    expect(screen.getByRole('listitem')).not.toHaveAttribute('draggable', 'true')
  })
})

describe('FRONTEND-011-AC-02/AC-03: the "moved from last week" label only renders when flagged', () => {
  it('renders the label when recentlyCarriedForward is true, and omits it otherwise', () => {
    const { rerender } = render(
      <OccurrenceItem
        {...baseProps({ occurrence: { ...gridOccurrence, recentlyCarriedForward: true } })}
      />,
    )
    expect(screen.getByText(/moved from last week/i)).toBeInTheDocument()

    rerender(<OccurrenceItem {...baseProps()} />)
    expect(screen.queryByText(/moved from last week/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-011-AC-04: the label never uses fault/lateness wording', () => {
  it('does not render "overdue", "missed", or "late" anywhere on a carried-forward item', () => {
    render(
      <OccurrenceItem
        {...baseProps({ occurrence: { ...gridOccurrence, recentlyCarriedForward: true } })}
      />,
    )
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/missed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\blate\b/i)).not.toBeInTheDocument()
  })
})
