import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CompletionMark } from './CompletionMark'
import type { PlannedOccurrence } from '../../types/plan'

function makeOccurrence(overrides: Partial<PlannedOccurrence> = {}): PlannedOccurrence {
  return {
    id: '1',
    activityId: 'a1',
    subTaskId: null,
    name: 'Go for a walk',
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
    notes: null,
    ...overrides,
  }
}

describe('FRONTEND-043-AC-07: has-notes tooltip hint', () => {
  it('appends the hint to the tooltip and aria-label when notes is present', () => {
    render(<CompletionMark occurrence={makeOccurrence({ notes: 'Book A' })} shape="circle" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(expect.stringContaining('has a note'))
  })

  it('omits the hint when notes is null', () => {
    render(<CompletionMark occurrence={makeOccurrence({ notes: null })} shape="circle" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(
      expect.not.stringContaining('has a note'),
    )
  })
})
