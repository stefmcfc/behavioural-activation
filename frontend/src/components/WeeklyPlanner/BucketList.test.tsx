import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BucketList } from './BucketList'
import styles from './BucketList.module.css'
import occurrenceItemStyles from './OccurrenceItem.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'
import type { DragPayload } from './dragPayload'
import type { PlannedOccurrence } from '../../types/plan'

const noop = () => {}

function bucketOccurrence(overrides: Partial<PlannedOccurrence> = {}): PlannedOccurrence {
  return {
    id: 'o1',
    activityId: 'a1',
    subTaskId: null,
    name: 'Read',
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
    ...overrides,
  }
}

function baseBucketProps(
  overrides: Partial<Parameters<typeof BucketList>[0]> = {},
): Parameters<typeof BucketList>[0] {
  return {
    occurrences: [],
    busyId: null,
    detailOpenId: null,
    confirmingRemoveId: null,
    movingId: null,
    reorderInFlight: false,
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
    onCarryForward: noop,
    onReorder: noop,
    dragPayload: null,
    onDragStart: noop,
    onDragEnd: noop,
    onAssignFromDrawer: noop,
    ...overrides,
  }
}

// FRONTEND-026-AC-01 / FRONTEND-028: dragPayload (formerly draggedId) is a controlled prop, not
// local state. This harness mirrors WeeklyPlanner's lifted state so existing drag tests keep
// exercising real drag behaviour (dragstart -> controlled dragPayload -> drop) instead of
// asserting internals.
function DraggableBucketHarness(
  props: Omit<Parameters<typeof BucketList>[0], 'dragPayload' | 'onDragStart' | 'onDragEnd'>,
) {
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
  return (
    <BucketList
      {...props}
      dragPayload={dragPayload}
      onDragStart={(id) => setDragPayload({ kind: 'occurrence', id })}
      onDragEnd={() => setDragPayload(null)}
    />
  )
}

describe('FRONTEND-007-AC-24: bucket list wrapper is a flat panel', () => {
  it('applies the panel class to the bucket list section', () => {
    render(<BucketList {...baseBucketProps()} />)

    expect(screen.getByRole('region', { name: /weekend bucket list/i })).toHaveClass(styles.panel)
  })
})

describe('FRONTEND-031-AC-08: "Add" (to weekend bucket list) button is primary', () => {
  it('gains buttonVariants.primary', () => {
    render(<BucketList {...baseBucketProps()} />)

    expect(screen.getByRole('button', { name: /add to weekend bucket list/i })).toHaveClass(
      buttonStyles.primary,
    )
  })
})

describe('FRONTEND-031-AC-16: regression guard -- Move up/down stay unstyled', () => {
  it('leaves the move-up/move-down buttons with no variant class', () => {
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences })} />)

    const moveButtons = [
      screen.getByRole('button', { name: /move first up/i }),
      screen.getByRole('button', { name: /move first down/i }),
      screen.getByRole('button', { name: /move second up/i }),
      screen.getByRole('button', { name: /move second down/i }),
    ]
    for (const button of moveButtons) {
      expect(button).not.toHaveClass(buttonStyles.primary)
      expect(button).not.toHaveClass(buttonStyles.destructive)
    }
  })
})

describe('FRONTEND-010-AC-01: bucket items render ordered by bucketPosition, not array order', () => {
  it('renders items in bucketPosition order', () => {
    const occurrences = [
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences })} />)

    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items.findIndex((text) => text?.includes('First'))).toBeLessThan(
      items.findIndex((text) => text?.includes('Second')),
    )
  })
})

describe('FRONTEND-010-AC-04/AC-05: Move up/down disabled at the boundaries', () => {
  it('disables Move up on the first item and Move down on the last', () => {
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences })} />)

    expect(screen.getByRole('button', { name: /move first up/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /move second down/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /move first down/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /move second up/i })).not.toBeDisabled()
  })
})

describe('FRONTEND-010-AC-06: Move up/down computes the full swapped order and calls onReorder once', () => {
  it('swaps the activated item with its neighbour above', async () => {
    const onReorder = vi.fn()
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
      bucketOccurrence({ id: 'c', name: 'Third', bucketPosition: 2 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences, onReorder })} />)

    await userEvent.click(screen.getByRole('button', { name: /move second up/i }))

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
  })

  it('is a no-op when Move up is activated on the first item', async () => {
    const onReorder = vi.fn()
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences, onReorder })} />)

    fireEvent.click(screen.getByRole('button', { name: /move first up/i }))

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('is a no-op when Move down is activated on the last item', async () => {
    const onReorder = vi.fn()
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences, onReorder })} />)

    fireEvent.click(screen.getByRole('button', { name: /move second down/i }))

    expect(onReorder).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-010-AC-07: dropping onto another row computes the relocated full order', () => {
  it('moves the dragged item to the drop target position', () => {
    const onReorder = vi.fn()
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
      bucketOccurrence({ id: 'c', name: 'Third', bucketPosition: 2 }),
    ]
    render(<DraggableBucketHarness {...baseBucketProps({ occurrences, onReorder })} />)

    const firstRow = screen.getByText('First').closest('li')!
    const thirdRow = screen.getByText('Third').closest('li')!
    fireEvent.dragStart(firstRow.querySelector('[draggable]')!)
    fireEvent.drop(thirdRow)

    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a'])
  })
})

describe('FRONTEND-026-AC-09: bucket-internal drag-to-reorder is unaffected by the draggedId state lift', () => {
  it('still calls onReorder between two bucket items, and never calls onMoveToBucket', () => {
    const onReorder = vi.fn()
    const onMoveToBucket = vi.fn()
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
    ]
    render(
      <DraggableBucketHarness
        {...baseBucketProps({ occurrences, onReorder, onMoveToBucket })}
      />,
    )

    const firstRow = screen.getByText('First').closest('li')!
    const secondRow = screen.getByText('Second').closest('li')!
    fireEvent.dragStart(firstRow.querySelector('[draggable]')!)
    fireEvent.drop(secondRow)

    expect(onReorder).toHaveBeenCalledWith(['b', 'a'])
    expect(onMoveToBucket).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-026-AC-02: dropping a non-bucket-member occurrence on the panel calls onMoveToBucket', () => {
  it('calls onMoveToBucket with the dragged id when dropped on empty panel space', () => {
    const onMoveToBucket = vi.fn()
    const onReorder = vi.fn()
    render(
      <BucketList
        {...baseBucketProps({ dragPayload: { kind: 'occurrence', id: 'grid-origin' }, onMoveToBucket, onReorder })}
      />,
    )

    const panel = screen.getByRole('region', { name: 'Weekend bucket list' })
    fireEvent.dragOver(panel)
    fireEvent.drop(panel)

    expect(onMoveToBucket).toHaveBeenCalledWith('grid-origin')
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('also calls onMoveToBucket when the empty-list state is the drop target', () => {
    const onMoveToBucket = vi.fn()
    render(<BucketList {...baseBucketProps({ dragPayload: { kind: 'occurrence', id: 'grid-origin' }, onMoveToBucket })} />)

    expect(screen.getByText(/bucket list is empty/i)).toBeInTheDocument()
    fireEvent.drop(screen.getByRole('region', { name: 'Weekend bucket list' }))

    expect(onMoveToBucket).toHaveBeenCalledWith('grid-origin')
  })
})

describe('FRONTEND-026-AC-03: dropping a non-bucket-member occurrence on an existing item also demotes it', () => {
  it('calls onMoveToBucket, not onReorder, when the dragged id is not already a bucket member', () => {
    const onMoveToBucket = vi.fn()
    const onReorder = vi.fn()
    const occurrences = [bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 })]
    render(
      <BucketList
        {...baseBucketProps({
          occurrences,
          dragPayload: { kind: 'occurrence', id: 'grid-origin' },
          onMoveToBucket,
          onReorder,
        })}
      />,
    )

    const firstRow = screen.getByText('First').closest('li')!
    fireEvent.drop(firstRow)

    expect(onMoveToBucket).toHaveBeenCalledWith('grid-origin')
    expect(onReorder).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-026-AC-06: a move in flight blocks a new cross-section drop onto the bucket', () => {
  it('does not call onMoveToBucket when busyId is set, on the panel', () => {
    const onMoveToBucket = vi.fn()
    render(
      <BucketList
        {...baseBucketProps({ dragPayload: { kind: 'occurrence', id: 'grid-origin' }, busyId: 'grid-origin', onMoveToBucket })}
      />,
    )

    fireEvent.drop(screen.getByRole('region', { name: 'Weekend bucket list' }))

    expect(onMoveToBucket).not.toHaveBeenCalled()
  })

  it('does not call onMoveToBucket when busyId is set, dropped on an existing item', () => {
    const onMoveToBucket = vi.fn()
    const occurrences = [bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 })]
    render(
      <BucketList
        {...baseBucketProps({
          occurrences,
          dragPayload: { kind: 'occurrence', id: 'grid-origin' },
          busyId: 'grid-origin',
          onMoveToBucket,
        })}
      />,
    )

    fireEvent.drop(screen.getByText('First').closest('li')!)

    expect(onMoveToBucket).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-028-AC-13/AC-14: dropping a drawer item onto the bucket', () => {
  it('AC-13: dropping on the panel calls onAssignFromDrawer with null day/slot', () => {
    const onAssignFromDrawer = vi.fn()
    const onMoveToBucket = vi.fn()
    render(
      <BucketList
        {...baseBucketProps({
          dragPayload: { kind: 'subtask', subTaskId: 'subtask-1' },
          onAssignFromDrawer,
          onMoveToBucket,
        })}
      />,
    )

    fireEvent.drop(screen.getByRole('region', { name: 'Weekend bucket list' }))

    expect(onAssignFromDrawer).toHaveBeenCalledWith(
      { kind: 'subtask', subTaskId: 'subtask-1' },
      null,
      null,
    )
    expect(onMoveToBucket).not.toHaveBeenCalled()
  })

  it('AC-14: dropping on an existing bucket item also assigns to the bucket, not a reorder', () => {
    const onAssignFromDrawer = vi.fn()
    const onReorder = vi.fn()
    const occurrences = [bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 })]
    render(
      <BucketList
        {...baseBucketProps({
          occurrences,
          dragPayload: { kind: 'activity', activityId: 'activity-2' },
          onAssignFromDrawer,
          onReorder,
        })}
      />,
    )

    fireEvent.drop(screen.getByText('First').closest('li')!)

    expect(onAssignFromDrawer).toHaveBeenCalledWith(
      { kind: 'activity', activityId: 'activity-2' },
      null,
      null,
    )
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('does not throw when onAssignFromDrawer is omitted and a non-occurrence payload is dropped on the panel', () => {
    render(
      <BucketList
        {...baseBucketProps({
          dragPayload: { kind: 'activity', activityId: 'activity-1' },
          onAssignFromDrawer: undefined,
        })}
      />,
    )

    expect(() =>
      fireEvent.drop(screen.getByRole('region', { name: 'Weekend bucket list' })),
    ).not.toThrow()
  })

  it('does not throw when onAssignFromDrawer is omitted and a non-occurrence payload is dropped on an existing item', () => {
    const occurrences = [bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 })]
    render(
      <BucketList
        {...baseBucketProps({
          occurrences,
          dragPayload: { kind: 'subtask', subTaskId: 'subtask-1' },
          onAssignFromDrawer: undefined,
        })}
      />,
    )

    expect(() => fireEvent.drop(screen.getByText('First').closest('li')!)).not.toThrow()
  })
})

describe('FRONTEND-035-AC-06: dimmedOccurrenceIds threads through to OccurrenceItem', () => {
  it('applies styles.dimmed when the occurrence id is in dimmedOccurrenceIds', () => {
    const occurrence = bucketOccurrence({ id: 'a', name: 'First' })
    render(
      <BucketList
        {...baseBucketProps({
          occurrences: [occurrence],
          dimmedOccurrenceIds: new Set([occurrence.id]),
        })}
      />,
    )
    expect(screen.getByText('First').closest('li')).toHaveClass(occurrenceItemStyles.dimmed)
  })

  it('FRONTEND-035-AC-08: does not dim an occurrence when dimmedOccurrenceIds is omitted (default)', () => {
    const occurrence = bucketOccurrence({ id: 'a', name: 'First' })
    render(<BucketList {...baseBucketProps({ occurrences: [occurrence] })} />)
    expect(screen.getByText('First').closest('li')).not.toHaveClass(occurrenceItemStyles.dimmed)
  })
})

describe('FRONTEND-010-AC-11: reorder controls are disabled while a reorder request is in flight', () => {
  it('disables every Move up/down button while reorderInFlight is true', () => {
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'Read', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Write', bucketPosition: 1 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences, reorderInFlight: true })} />)

    expect(screen.getByRole('button', { name: /move read down/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /move write up/i })).toBeDisabled()
  })
})
