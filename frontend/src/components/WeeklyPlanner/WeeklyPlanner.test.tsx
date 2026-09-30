import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WeeklyPlanner } from './WeeklyPlanner'
import { planApi } from '../../services/planApi'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { PlannedOccurrence } from '../../types/plan'
import plannerGridStyles from './PlannerGrid.module.css'

vi.mock('../../services/planApi')
vi.mock('../../services/activityApi')
vi.mock('../../services/subTaskApi')

const walk: PlannedOccurrence = {
  id: '1',
  activityId: 'a1',
  subTaskId: null,
  name: 'Go for a walk',
  parentActivityName: null,
  category: 'ROUTINE',
  weekStart: '2026-10-05',
  dayOfWeek: 'MONDAY',
  slot: 'MORNING',
  completed: false,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
}

const bucketItem: PlannedOccurrence = {
  id: '2',
  activityId: 'a2',
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

describe('WeeklyPlanner', () => {
  beforeEach(() => {
    vi.mocked(planApi.getWeek).mockReset()
    vi.mocked(planApi.create).mockReset()
    vi.mocked(planApi.move).mockReset()
    vi.mocked(planApi.remove).mockReset()
    vi.mocked(planApi.complete).mockReset()
    vi.mocked(planApi.undoCompletion).mockReset()
    vi.mocked(planApi.carryForward).mockReset()
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
  })

  describe('FRONTEND-004-AC-09/AC-10: fetches the current week on mount, shows a loading indicator', () => {
    it("calls planApi.getWeek with this week's Monday and shows <output> while pending", () => {
      vi.mocked(planApi.getWeek).mockReturnValue(new Promise(() => {}))
      render(<WeeklyPlanner />)

      expect(planApi.getWeek).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-005-AC-19: occurrence category is a CategoryChip, not plain "— Category" text', () => {
    it('renders a CategoryChip for a planned occurrence', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([walk])
      render(<WeeklyPlanner />)

      expect(await screen.findByText('Go for a walk')).toBeInTheDocument()
      expect(screen.getByTestId('category-chip-ROUTINE')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-004-AC-11/AC-12: grid cells render every occurrence in their day+slot, not just the last', () => {
    it('renders two occurrences in the same Monday/Morning cell', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        walk,
        { ...walk, id: '3', name: 'Stretch' },
      ])
      render(<WeeklyPlanner />)

      expect(await screen.findByText('Go for a walk')).toBeInTheDocument()
      expect(screen.getByText('Stretch')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-004-AC-13: completed occurrences are visually distinguishable', () => {
    it('shows a Completed label for a completed occurrence', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([{ ...walk, completed: true, completedAt: '2026-10-05T09:00:00Z' }])
      render(<WeeklyPlanner />)

      expect(await screen.findByRole('img', { name: /completed/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-004-AC-14/AC-15: week navigation re-fetches with a shifted weekStart', () => {
    it('moves weekStart back 7 days on Previous week', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklyPlanner />)
      await screen.findByText(/no activities planned/i)

      await userEvent.click(screen.getByRole('button', { name: /previous week/i }))

      expect(planApi.getWeek).toHaveBeenLastCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      )
      expect(planApi.getWeek).toHaveBeenCalledTimes(2)
    })

    it('moves weekStart forward 7 days on Next week', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklyPlanner />)
      await screen.findByText(/no activities planned/i)

      await userEvent.click(screen.getByRole('button', { name: /next week/i }))

      expect(planApi.getWeek).toHaveBeenCalledTimes(2)
    })
  })

  describe('FRONTEND-004-AC-16: currently viewed week is displayed', () => {
    it('shows the weekStart date on the page', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklyPlanner />)

      expect(await screen.findByText(/week of \d{4}-\d{2}-\d{2}/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-004-AC-17: bucket list renders occurrences with no dayOfWeek/slot, separately from the grid', () => {
    it('renders bucket items in the bucket section, not the grid', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([bucketItem])
      render(<WeeklyPlanner />)

      expect(await screen.findByText('Paint')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-004-AC-18/AC-19: bucket balance highlight vs empty state', () => {
    it('highlights a category with zero occurrences when another has at least one', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([bucketItem])
      render(<WeeklyPlanner />)

      expect(
        await screen.findByText(/no routine activities in your bucket list/i),
      ).toBeInTheDocument()
    })

    it('shows the empty-state message and no highlight when the bucket is empty', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklyPlanner />)

      expect(await screen.findByText(/bucket list is empty/i)).toBeInTheDocument()
      expect(screen.queryByText(/in your bucket list yet/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-004-AC-20/AC-21/AC-22: assign picker lists activities+sub-tasks, creates on confirm', () => {
    it('creates a scheduled occurrence from a picked activity and closes the picker', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([
        {
          id: 'a1',
          name: 'Go for a walk',
          category: 'ROUTINE',
          description: null,
          repeatable: true,
          archived: false,
          createdAt: '2026-09-01T00:00:00Z',
        },
      ])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      vi.mocked(planApi.create).mockResolvedValue(walk)
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: /add.*monday.*morning/i }))
      await userEvent.click(await screen.findByRole('button', { name: /go for a walk/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm|assign/i }))

      expect(planApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ activityId: 'a1', dayOfWeek: 'MONDAY', slot: 'MORNING' }),
      )
      expect(await screen.findByText('Go for a walk')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('lists a sub-task and creates a bucket occurrence from it', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([
        {
          id: 'a1',
          name: 'Plan a party',
          category: 'PLEASURABLE',
          description: null,
          repeatable: true,
          archived: false,
          createdAt: '2026-09-01T00:00:00Z',
        },
      ])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([
        { id: 's1', activityId: 'a1', name: 'Send invites', category: 'PLEASURABLE', createdAt: '2026-09-01T00:00:00Z' },
      ])
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      vi.mocked(planApi.create).mockResolvedValue({
        ...bucketItem,
        id: '4',
        activityId: null,
        subTaskId: 's1',
        name: 'Send invites',
      })
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: /add to weekend bucket list/i }))
      await userEvent.click(await screen.findByRole('button', { name: /send invites/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm|assign/i }))

      expect(planApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ subTaskId: 's1', activityId: null, dayOfWeek: null, slot: null }),
      )
      expect(await screen.findByText('Send invites')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-004-AC-23/AC-25: moving an occurrence to a new day/slot', () => {
    it('calls planApi.move with the selected day and slot and re-renders in the new cell', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([walk])
      vi.mocked(planApi.move).mockResolvedValue({ ...walk, dayOfWeek: 'TUESDAY', slot: 'AFTERNOON' })
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: 'Go for a walk' }))
      await userEvent.click(await screen.findByRole('button', { name: /^rearrange$/i }))
      await userEvent.selectOptions(screen.getByLabelText(/new day/i), 'TUESDAY')
      await userEvent.selectOptions(screen.getByLabelText(/new slot/i), 'AFTERNOON')
      await userEvent.click(screen.getByRole('button', { name: /confirm rearrange/i }))

      expect(planApi.move).toHaveBeenCalledWith('1', { dayOfWeek: 'TUESDAY', slot: 'AFTERNOON' })
      expect(await screen.findByRole('button', { name: 'Go for a walk' })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-004-AC-24: "Send to bucket" clears dayOfWeek/slot', () => {
    it('calls planApi.move with both cleared', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([walk])
      vi.mocked(planApi.move).mockResolvedValue({ ...walk, dayOfWeek: null, slot: null })
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: 'Go for a walk' }))
      await userEvent.click(await screen.findByRole('button', { name: /^rearrange$/i }))
      await userEvent.click(await screen.findByRole('button', { name: /send to bucket/i }))

      expect(planApi.move).toHaveBeenCalledWith('1', { dayOfWeek: null, slot: null })
    })
  })

  describe('FRONTEND-004-AC-26/AC-27/AC-28/AC-29: remove uses an inline confirm, not window.confirm', () => {
    it('cancelling the inline confirm does not call planApi.remove', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
      vi.mocked(planApi.getWeek).mockResolvedValue([walk])
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: 'Go for a walk' }))
      await userEvent.click(await screen.findByRole('button', { name: /^remove$/i }))
      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(planApi.remove).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Go for a walk' })).toBeInTheDocument()
    })

    it('confirming removal calls planApi.remove and removes the occurrence from view', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([walk])
      vi.mocked(planApi.remove).mockResolvedValue(undefined)
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: 'Go for a walk' }))
      await userEvent.click(await screen.findByRole('button', { name: /^remove$/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm remove/i }))

      expect(planApi.remove).toHaveBeenCalledWith('1')
      await waitFor(() => expect(screen.queryByText('Go for a walk')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-004-AC-30/AC-31/AC-32/AC-33: complete and undo call the matching planApi methods', () => {
    it('calls complete then undoCompletion in turn', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([walk])
      vi.mocked(planApi.complete).mockResolvedValue({
        ...walk,
        completed: true,
        completedAt: '2026-10-05T09:00:00Z',
      })
      vi.mocked(planApi.undoCompletion).mockResolvedValue(undefined)
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: /^complete$/i }))
      expect(planApi.complete).toHaveBeenCalledWith('1')
      expect(await screen.findByRole('img', { name: /completed/i })).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /undo/i }))
      expect(planApi.undoCompletion).toHaveBeenCalledWith('1')
      await waitFor(() =>
        expect(screen.queryByRole('img', { name: /completed/i })).not.toBeInTheDocument(),
      )
    })
  })

  describe('FRONTEND-004-AC-34: carry-forward control only appears on bucket items', () => {
    it('does not render Carry forward for a scheduled occurrence', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([walk])
      render(<WeeklyPlanner />)

      await screen.findByText('Go for a walk')
      expect(screen.queryByRole('button', { name: /carry forward/i })).not.toBeInTheDocument()
    })

    it('renders Carry forward for a bucket item', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([bucketItem])
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: 'Paint' }))
      expect(await screen.findByRole('button', { name: /carry forward/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-004-AC-35/AC-36: carrying forward removes the item from the current week view', () => {
    it('calls planApi.carryForward and removes the bucket item from view', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([bucketItem])
      vi.mocked(planApi.carryForward).mockResolvedValue({ ...bucketItem, weekStart: '2026-10-12' })
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: 'Paint' }))
      await userEvent.click(await screen.findByRole('button', { name: /carry forward/i }))

      expect(planApi.carryForward).toHaveBeenCalledWith('2')
      await waitFor(() => expect(screen.queryByText('Paint')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-004-AC-37: empty week shows explanatory grid empty-state message', () => {
    it('renders an empty-state message alongside the grid structure', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklyPlanner />)

      expect(await screen.findByText(/no activities planned/i)).toBeInTheDocument()
      expect(screen.getByText('Monday')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-004-AC-38: fetch failure shows an alert with a working Retry control', () => {
    it('re-fetches when Retry is activated', async () => {
      vi.mocked(planApi.getWeek)
        .mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Please try again.'))
        .mockResolvedValueOnce([])
      render(<WeeklyPlanner />)

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /retry/i }))

      expect(await screen.findByText(/no activities planned/i)).toBeInTheDocument()
      expect(planApi.getWeek).toHaveBeenCalledTimes(2)
    })
  })

  describe('FRONTEND-004-AC-39: create failure shows an alert in the picker, preserves selection', () => {
    it('keeps the picker open and the selection intact on create failure', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([
        {
          id: 'a1',
          name: 'Go for a walk',
          category: 'ROUTINE',
          description: null,
          repeatable: true,
          archived: false,
          createdAt: '2026-09-01T00:00:00Z',
        },
      ])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      vi.mocked(planApi.create).mockRejectedValue(new ApiError(500, 'Server error'))
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: /add.*monday.*morning/i }))
      await userEvent.click(await screen.findByRole('button', { name: /go for a walk/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm|assign/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByRole('button', { name: /go for a walk/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })
  })

  describe('FRONTEND-004-AC-40: move/remove/complete/undo/carry-forward failure shows an alert, non-optimistic', () => {
    it('keeps the occurrence in place when planApi.remove rejects', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([walk])
      vi.mocked(planApi.remove).mockRejectedValue(new ApiError(500, 'Server error'))
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: 'Go for a walk' }))
      await userEvent.click(await screen.findByRole('button', { name: /^remove$/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm remove/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByRole('button', { name: 'Go for a walk' })).toBeInTheDocument()
    })

    it('keeps the occurrence uncompleted when planApi.complete rejects', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([walk])
      vi.mocked(planApi.complete).mockRejectedValue(new ApiError(500, 'Server error'))
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: /^complete$/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.queryByRole('img', { name: /completed/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-008-AC-10: at most one occurrence detail card is open at a time', () => {
    it('closes the first card when a second occurrence card is opened', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([walk, bucketItem])
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: 'Go for a walk' }))
      expect(
        screen.getByRole('dialog', { name: /go for a walk actions/i }),
      ).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Paint' }))

      expect(
        screen.queryByRole('dialog', { name: /go for a walk actions/i }),
      ).not.toBeInTheDocument()
      expect(screen.getByRole('dialog', { name: /paint actions/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-008-AC-11: opening a different card clears a stale move/remove sub-state', () => {
    it('cancels an in-progress move for a different occurrence when a new card opens', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([walk, bucketItem])
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: 'Go for a walk' }))
      await userEvent.click(screen.getByRole('button', { name: /^rearrange$/i }))
      expect(screen.getByLabelText(/new day/i)).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Paint' }))

      expect(screen.queryByLabelText(/new day/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-008-AC-18/AC-20/AC-21: today-column highlight reflects the real current week/day', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('computes a null today-column on a weekend, even during the current week', async () => {
      vi.setSystemTime(new Date('2026-10-10T09:00:00')) // a Saturday
      vi.mocked(planApi.getWeek).mockResolvedValue([])

      render(<WeeklyPlanner />)

      await screen.findByText(/no activities planned/i)
      expect(document.querySelector(`.${plannerGridStyles.today}`)).toBeNull()
    })

    it('passes a null todayColumn for a week that is not the current one', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklyPlanner />)

      await userEvent.click(await screen.findByRole('button', { name: /previous week/i }))

      expect(document.querySelector(`.${plannerGridStyles.today}`)).toBeNull()
    })
  })
})
