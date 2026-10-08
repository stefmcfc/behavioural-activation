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

describe('FRONTEND-055-AC-01: visual tooltip is three stacked lines, with no status text', () => {
  it('shows name, location, and a labelled notes line as separate lines', () => {
    render(<CompletionMark occurrence={makeOccurrence({ notes: 'Book A' })} shape="circle" />)
    const tooltip = document.querySelector('[aria-hidden="true"]')
    const lines = Array.from(tooltip?.children ?? []).map((child) => child.textContent)
    expect(lines).toEqual(['Go for a walk', 'Monday Morning', 'Notes: Book A'])
  })

  it('omits the notes line entirely when there is no note', () => {
    render(<CompletionMark occurrence={makeOccurrence({ notes: null })} shape="circle" />)
    const tooltip = document.querySelector('[aria-hidden="true"]')
    const lines = Array.from(tooltip?.children ?? []).map((child) => child.textContent)
    expect(lines).toEqual(['Go for a walk', 'Monday Morning'])
  })

  it('never shows "completed"/"not completed" text, regardless of completion state', () => {
    const { rerender } = render(
      <CompletionMark occurrence={makeOccurrence({ completed: true })} shape="circle" />,
    )
    expect(document.querySelector('[aria-hidden="true"]')).not.toHaveTextContent(/completed/i)

    rerender(<CompletionMark occurrence={makeOccurrence({ completed: false })} shape="circle" />)
    expect(document.querySelector('[aria-hidden="true"]')).not.toHaveTextContent(/completed/i)
  })
})
