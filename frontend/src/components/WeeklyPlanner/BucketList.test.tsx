import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BucketList } from './BucketList'
import styles from './BucketList.module.css'

const noop = () => {}

describe('FRONTEND-007-AC-24: bucket list wrapper is a flat panel', () => {
  it('applies the panel class to the bucket list section', () => {
    render(
      <BucketList
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
        onComplete={noop}
        onUndo={noop}
        onCarryForward={noop}
      />,
    )

    expect(screen.getByRole('region', { name: /weekend bucket list/i })).toHaveClass(styles.panel)
  })
})
