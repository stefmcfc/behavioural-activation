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

describe('FRONTEND-053-AC-01/AC-02: note text in the tooltip, replacing the generic hint', () => {
  it("includes the note's own text when notes is present", () => {
    render(<CompletionMark occurrence={makeOccurrence({ notes: 'Book A' })} shape="circle" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(expect.stringContaining('Book A'))
  })

  it('omits any note-related text when notes is null', () => {
    render(<CompletionMark occurrence={makeOccurrence({ notes: null })} shape="circle" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(expect.not.stringContaining('note'))
  })
})
