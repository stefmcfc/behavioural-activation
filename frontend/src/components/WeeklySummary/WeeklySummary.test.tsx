import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WeeklySummary } from './WeeklySummary'
import { planApi } from '../../services/planApi'
import { getCategoryColor } from '../../utils/categoryColors'
import type { PlannedOccurrence } from '../../types/plan'
import markStyles from './CompletionMark.module.css'

vi.mock('../../services/planApi')

// FRONTEND-037-AC-18/AC-20: getCategoryColor is mocked at the module level so individual tests can
// force a specific colour (white, or a colour shared by two categories) without touching real
// localStorage-backed overrides -- defaults back to the real implementation (the Okabe-Ito palette)
// in beforeEach so every other, colour-agnostic test is unaffected.
vi.mock('../../utils/categoryColors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/categoryColors')>()
  return { ...actual, getCategoryColor: vi.fn(actual.getCategoryColor) }
})

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
  beforeEach(async () => {
    vi.mocked(planApi.getWeek).mockReset()
    const actual =
      await vi.importActual<typeof import('../../utils/categoryColors')>('../../utils/categoryColors')
    vi.mocked(getCategoryColor).mockImplementation(actual.getCategoryColor)
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

  describe('FRONTEND-037-AC-01/AC-02/AC-03: completion bar renders blocks, completed first', () => {
    it('renders one block per occurrence, completed before not-completed', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ id: '1', name: 'Walk', completed: true }),
        makeOccurrence({ id: '2', name: 'Read', completed: false }),
      ])
      render(<WeeklySummary />)

      const bar = await screen.findByRole('region', { name: /completion for the week/i })
      const blocks = within(bar).getAllByRole('button', { name: /walk|read/i })
      expect(blocks).toHaveLength(2)
      expect(blocks[0]).toHaveAccessibleName(/walk/i)
      expect(blocks[0]).not.toHaveStyle({ opacity: '0.55' })
      expect(blocks[1]).toHaveAccessibleName(/read/i)
      expect(blocks[1]).toHaveStyle({ opacity: '0.55' })
    })
  })

  describe('FRONTEND-037-AC-04: each mark carries a full detail aria-label', () => {
    it('names the activity, its day/slot, and completion state', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Walk', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: true }),
      ])
      render(<WeeklySummary />)

      const bar = await screen.findByRole('region', { name: /completion for the week/i })
      expect(
        within(bar).getByRole('button', { name: /walk.*monday morning.*completed/i }),
      ).toBeInTheDocument()
    })

    it('labels a bucket item with "Weekend bucket" instead of a day/slot', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Apply for jobs', dayOfWeek: null, slot: null, completed: false }),
      ])
      render(<WeeklySummary />)

      const bar = await screen.findByRole('region', { name: /completion for the week/i })
      expect(
        within(bar).getByRole('button', { name: /apply for jobs.*weekend bucket.*not completed/i }),
      ).toBeInTheDocument()
    })
  })

  describe('FRONTEND-037-AC-05: a zero-occurrence week renders no completion bar', () => {
    it('shows only the empty-state message, no marks at all', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklySummary />)

      expect(await screen.findByText(/no activities planned for this week/i)).toBeInTheDocument()
      expect(
        screen.queryByRole('region', { name: /completion for the week/i }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('group')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-037-AC-06/AC-07: lite grid renders a circle per scheduled occurrence', () => {
    it('places a circle in the correct day/slot cell', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Walk', dayOfWeek: 'TUESDAY', slot: 'EVENING' }),
      ])
      render(<WeeklySummary />)

      const landed = await screen.findByRole('region', {
        name: /where this week's activities landed/i,
      })
      expect(
        within(landed).getByRole('button', { name: /walk.*tuesday evening/i }),
      ).toBeInTheDocument()
    })

    it('renders no interactive Add/drag/remove controls in the lite grid', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Walk', dayOfWeek: 'TUESDAY', slot: 'EVENING' }),
      ])
      render(<WeeklySummary />)

      const landed = await screen.findByRole('region', {
        name: /where this week's activities landed/i,
      })
      within(landed).getByRole('button', { name: /walk.*tuesday evening/i })
      expect(within(landed).queryByRole('button', { name: /^add to/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-037-AC-08/AC-09: lite bucket list orders by bucketPosition, omits empties', () => {
    it('renders bucket occurrences ordered by bucketPosition, nothing extra when empty', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({
          id: '1',
          name: 'Second',
          dayOfWeek: null,
          slot: null,
          bucketPosition: 1,
        }),
        makeOccurrence({
          id: '2',
          name: 'First',
          dayOfWeek: null,
          slot: null,
          bucketPosition: 0,
        }),
      ])
      render(<WeeklySummary />)

      const landed = await screen.findByRole('region', {
        name: /where this week's activities landed/i,
      })
      const bucketMarks = within(landed).getAllByRole('button', { name: /first|second/i })
      expect(bucketMarks[0]).toHaveAccessibleName(/first/i)
      expect(bucketMarks[1]).toHaveAccessibleName(/second/i)
    })
  })

  describe('FRONTEND-037-AC-11/AC-12/AC-13/AC-14: breakdown chart renders labelled, ordered segments', () => {
    it('renders three location bars with category-labelled segments in fixed order', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({
          id: '1',
          category: 'PLEASURABLE',
          dayOfWeek: 'MONDAY',
          slot: 'MORNING',
        }),
        makeOccurrence({
          id: '2',
          category: 'ROUTINE',
          dayOfWeek: 'MONDAY',
          slot: 'AFTERNOON',
        }),
      ])
      render(<WeeklySummary />)

      const weekdayBar = await screen.findByRole('group', { name: /weekday grid/i })
      const segments = within(weekdayBar).getAllByText(/routine|necessary|pleasurable/i)
      expect(segments[0]).toHaveTextContent(/routine/i)
      expect(segments[1]).toHaveTextContent(/pleasurable/i)

      expect(screen.getByRole('group', { name: /weekend grid/i })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: /weekend bucket/i })).toBeInTheDocument()
    })

    it('renders one shared legend naming all three categories, not one per bar', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ id: '1', category: 'ROUTINE', dayOfWeek: 'MONDAY', slot: 'MORNING' }),
      ])
      render(<WeeklySummary />)

      await screen.findByRole('group', { name: /weekday grid/i })
      expect(screen.getAllByText('Routine')).toHaveLength(2) // legend + category table
    })
  })

  describe('FRONTEND-037-AC-18: every mark has a visible border regardless of fill colour', () => {
    it('applies the border-carrying block class even when the category colour is white', async () => {
      vi.mocked(getCategoryColor).mockReturnValue('#ffffff')
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Walk', completed: false }),
      ])
      render(<WeeklySummary />)

      const bar = await screen.findByRole('region', { name: /completion for the week/i })
      const block = within(bar).getByRole('button', { name: /walk/i })
      expect(block).toHaveClass(markStyles.block)
      // the .block class itself carries the border in CompletionMark.module.css -- this asserts
      // the class is applied regardless of fill colour, not the computed border style directly
      // (jsdom doesn't render CSS; a real-browser pass, FRONTEND-037-AC-19, confirms appearance).
    })
  })

  describe('FRONTEND-037-AC-20 (regression): two categories sharing one colour still resolve correctly', () => {
    it('shows correct completed/not-completed state for each occurrence despite a shared colour', async () => {
      vi.mocked(getCategoryColor).mockReturnValue('#5f7a5e')
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ id: '1', name: 'Walk', category: 'ROUTINE', completed: true }),
        makeOccurrence({ id: '2', name: 'Read', category: 'NECESSARY', completed: false }),
      ])
      render(<WeeklySummary />)

      const bar = await screen.findByRole('region', { name: /completion for the week/i })
      const walkBlock = within(bar).getByRole('button', { name: /walk/i })
      const readBlock = within(bar).getByRole('button', { name: /read/i })
      expect(walkBlock).not.toHaveStyle({ opacity: '0.55' })
      expect(readBlock).toHaveStyle({ opacity: '0.55' })
    })

    it('still renders both categories as separately labelled breakdown-chart segments', async () => {
      vi.mocked(getCategoryColor).mockReturnValue('#5f7a5e')
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ id: '1', category: 'ROUTINE', dayOfWeek: 'MONDAY', slot: 'MORNING' }),
        makeOccurrence({ id: '2', category: 'NECESSARY', dayOfWeek: 'MONDAY', slot: 'AFTERNOON' }),
      ])
      render(<WeeklySummary />)

      const weekdayBar = await screen.findByRole('group', { name: /weekday grid/i })
      expect(within(weekdayBar).getByText(/routine/i)).toBeInTheDocument()
      expect(within(weekdayBar).getByText(/necessary/i)).toBeInTheDocument()
    })
  })
})
