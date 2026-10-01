import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BucketList } from './BucketList'
import styles from './BucketList.module.css'
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
    onComplete: noop,
    onUndo: noop,
    onCarryForward: noop,
    onReorder: noop,
    ...overrides,
  }
}

describe('FRONTEND-007-AC-24: bucket list wrapper is a flat panel', () => {
  it('applies the panel class to the bucket list section', () => {
    render(<BucketList {...baseBucketProps()} />)

    expect(screen.getByRole('region', { name: /weekend bucket list/i })).toHaveClass(styles.panel)
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
    render(<BucketList {...baseBucketProps({ occurrences, onReorder })} />)

    const firstRow = screen.getByText('First').closest('li')!
    const thirdRow = screen.getByText('Third').closest('li')!
    fireEvent.dragStart(firstRow.querySelector('[draggable]')!)
    fireEvent.drop(thirdRow)

    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a'])
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
