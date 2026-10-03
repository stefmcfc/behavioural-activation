import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WeeklySummary } from './WeeklySummary'
import { planApi } from '../../services/planApi'
import type { PlannedOccurrence } from '../../types/plan'

vi.mock('../../services/planApi')

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
    ...overrides,
  }
}

describe('WeeklySummary', () => {
  beforeEach(() => {
    vi.mocked(planApi.getWeek).mockReset()
  })

  describe('FRONTEND-036-AC-08/AC-11: fetches the current week on mount, shows a loading indicator', () => {
    it("calls planApi.getWeek with this week's Monday and shows a loading output while pending", () => {
      vi.mocked(planApi.getWeek).mockReturnValue(new Promise(() => {}))
      render(<WeeklySummary />)

      expect(planApi.getWeek).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-036-AC-09: shows planned/completed counts and a category breakdown for a non-empty week', () => {
    it('shows the completion total, scheduled-vs-bucket split, and category breakdown', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ id: '1', category: 'ROUTINE', completed: true }),
        makeOccurrence({
          id: '2',
          category: 'PLEASURABLE',
          completed: false,
          dayOfWeek: null,
          slot: null,
        }),
      ])
      render(<WeeklySummary />)

      expect(await screen.findByText(/1 of 2/i)).toBeInTheDocument()
      expect(screen.getByText(/1 scheduled, 1 in the weekend bucket/i)).toBeInTheDocument()
      expect(screen.getByRole('rowheader', { name: 'Routine' })).toBeInTheDocument()
      expect(screen.getByRole('rowheader', { name: 'Pleasurable' })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-036-AC-10: empty week shows a plain message', () => {
    it('renders an empty-state message instead of a stats table', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklySummary />)

      expect(await screen.findByText(/no activities planned for this week/i)).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-036-AC-03/AC-04/AC-07: independent week navigation via the shared WeekNav, refetches on change', () => {
    it('refetches when the next-week control is activated', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklySummary />)
      await screen.findByText(/no activities planned for this week/i)

      await userEvent.click(screen.getByLabelText('Next week'))

      await waitFor(() => expect(planApi.getWeek).toHaveBeenCalledTimes(2))
    })

    it('refetches when the previous-week control is activated', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklySummary />)
      await screen.findByText(/no activities planned for this week/i)

      await userEvent.click(screen.getByLabelText('Previous week'))

      await waitFor(() => expect(planApi.getWeek).toHaveBeenCalledTimes(2))
    })
  })

  describe('FRONTEND-036-AC-12: Retry re-attempts the fetch on failure', () => {
    it('shows an alert with Retry, and refetches when clicked', async () => {
      vi.mocked(planApi.getWeek)
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce([])
      render(<WeeklySummary />)

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /retry/i }))

      expect(await screen.findByText(/no activities planned for this week/i)).toBeInTheDocument()
      expect(planApi.getWeek).toHaveBeenCalledTimes(2)
    })
  })
})
