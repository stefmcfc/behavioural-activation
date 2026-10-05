import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WeeklySummary } from './WeeklySummary'
import { planApi } from '../../services/planApi'
import { workDayApi } from '../../services/workDayApi'
import { getCategoryColor } from '../../utils/categoryColors'
import type { PlannedOccurrence } from '../../types/plan'
import markStyles from './CompletionMark.module.css'
import styles from './WeeklySummary.module.css'

vi.mock('../../services/planApi')
vi.mock('../../services/workDayApi')

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
    notes: null,
    ...overrides,
  }
}

describe('WeeklySummary', () => {
  beforeEach(async () => {
    vi.mocked(planApi.getWeek).mockReset()
    // FRONTEND-042-AC-11: defaults to no work days for every test that doesn't care about the
    // badge, mirroring every other per-component service reset in this file.
    vi.mocked(workDayApi.getWeek).mockReset().mockResolvedValue([])
    const actual =
      await vi.importActual<typeof import('../../utils/categoryColors')>('../../utils/categoryColors')
    vi.mocked(getCategoryColor).mockImplementation(actual.getCategoryColor)
  })

  afterEach(() => {
    vi.useRealTimers()
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

  describe('FRONTEND-039-AC-01/AC-02/AC-03: section order and renamed headings', () => {
    it('renders sections in order: glance, placement, breakdown, with renamed headings', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({})])
      render(<WeeklySummary />)

      const headings = (await screen.findAllByRole('heading', { level: 3 })).map(
        (h) => h.textContent,
      )
      expect(headings).toEqual([
        'This week at a glance',
        "This week's placement",
        'By schedule and category',
      ])
    })

    it('AC-03: labels the breakdown section "Breakdown by schedule and category"', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({})])
      render(<WeeklySummary />)

      expect(
        await screen.findByRole('region', { name: /breakdown by schedule and category/i }),
      ).toBeInTheDocument()
    })
  })

  describe('FRONTEND-039-AC-10 (regression): marks keep their CompletionMark "block" contract', () => {
    it('names the activity, its day/slot, and completion state within the merged table', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Walk', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: true }),
      ])
      render(<WeeklySummary />)

      const routineRow = (await screen.findByRole('rowheader', { name: /routine/i })).closest(
        'tr',
      )!
      const mark = within(routineRow).getByRole('button', {
        name: /walk.*monday morning.*completed/i,
      })
      expect(mark).toHaveClass(markStyles.block)
    })

    it('labels a bucket item with "Weekend bucket" instead of a day/slot', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Apply for jobs', dayOfWeek: null, slot: null, completed: false }),
      ])
      render(<WeeklySummary />)

      const routineRow = (await screen.findByRole('rowheader', { name: /routine/i })).closest(
        'tr',
      )!
      expect(
        within(routineRow).getByRole('button', {
          name: /apply for jobs.*weekend bucket.*not completed/i,
        }),
      ).toBeInTheDocument()
    })
  })

  describe('FRONTEND-037-AC-05 (regression): a zero-occurrence week renders no stats sections', () => {
    it('shows only the empty-state message, no table, no marks at all', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<WeeklySummary />)

      expect(await screen.findByText(/no activities planned for this week/i)).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.queryByRole('group')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-037-AC-06/AC-07: lite grid renders a circle per scheduled occurrence', () => {
    it('places a circle in the correct day/slot cell', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Walk', dayOfWeek: 'TUESDAY', slot: 'EVENING' }),
      ])
      render(<WeeklySummary />)

      const placement = await screen.findByRole('region', {
        name: /this week's placement/i,
      })
      expect(
        within(placement).getByRole('button', { name: /walk.*tuesday evening/i }),
      ).toBeInTheDocument()
    })

    it('renders no interactive Add/drag/remove controls in the lite grid', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Walk', dayOfWeek: 'TUESDAY', slot: 'EVENING' }),
      ])
      render(<WeeklySummary />)

      const placement = await screen.findByRole('region', {
        name: /this week's placement/i,
      })
      within(placement).getByRole('button', { name: /walk.*tuesday evening/i })
      expect(within(placement).queryByRole('button', { name: /^add to/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-042-AC-11/AC-12: lite grid badges marked work days, read-only', () => {
    it('shows the work-day icon only on marked days, with no button/click handler', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Walk', dayOfWeek: 'MONDAY', slot: 'MORNING' }),
      ])
      vi.mocked(workDayApi.getWeek).mockResolvedValue([
        { date: '2026-10-05', dayOfWeek: 'MONDAY', workDay: true },
        { date: '2026-10-06', dayOfWeek: 'TUESDAY', workDay: false },
        { date: '2026-10-07', dayOfWeek: 'WEDNESDAY', workDay: false },
        { date: '2026-10-08', dayOfWeek: 'THURSDAY', workDay: false },
        { date: '2026-10-09', dayOfWeek: 'FRIDAY', workDay: false },
        { date: '2026-10-10', dayOfWeek: 'SATURDAY', workDay: false },
        { date: '2026-10-11', dayOfWeek: 'SUNDAY', workDay: false },
      ])
      render(<WeeklySummary initialWeekStart="2026-10-05" />)

      const placement = await screen.findByRole('region', { name: /this week's placement/i })
      const mondayLabel = within(placement).getByText('Monday').closest('span')!
      const tuesdayLabel = within(placement).getByText('Tuesday').closest('span')!

      expect(within(mondayLabel).getByRole('img', { name: 'Work day' })).toBeInTheDocument()
      expect(within(tuesdayLabel).queryByRole('img', { name: 'Work day' })).not.toBeInTheDocument()
      expect(within(placement).queryByRole('button', { name: /work day/i })).not.toBeInTheDocument()
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

      const placement = await screen.findByRole('region', {
        name: /this week's placement/i,
      })
      const bucketMarks = within(placement).getAllByRole('button', { name: /first|second/i })
      expect(bucketMarks[0]).toHaveAccessibleName(/first/i)
      expect(bucketMarks[1]).toHaveAccessibleName(/second/i)
    })

    it('does not render the "Weekend bucket" heading when the bucket is empty', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ id: '1', name: 'Walk', dayOfWeek: 'MONDAY', slot: 'MORNING' }),
      ])
      render(<WeeklySummary />)

      const placement = await screen.findByRole('region', {
        name: /this week's placement/i,
      })
      expect(within(placement).queryByText('Weekend bucket')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-039-AC-05/AC-06/AC-07: scheduled/bucket line respects past-week status', () => {
    it('AC-06: hides the scheduled/bucket line for a past week, keeps the completion count', async () => {
      vi.setSystemTime(new Date('2026-10-05T09:00:00'))
      vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({})])
      render(<WeeklySummary initialWeekStart="2026-09-21" />)

      expect(await screen.findByText(/activities completed/i)).toBeInTheDocument()
      expect(screen.queryByText(/in the weekend bucket/i)).not.toBeInTheDocument()
    })

    it('AC-05: shows the scheduled/bucket line for the current week', async () => {
      vi.setSystemTime(new Date('2026-10-05T09:00:00'))
      vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({})])
      render(<WeeklySummary initialWeekStart="2026-09-29" />)

      expect(await screen.findByText(/in the weekend bucket/i)).toBeInTheDocument()
    })

    it('AC-05: shows the scheduled/bucket line for a future week', async () => {
      vi.setSystemTime(new Date('2026-10-05T09:00:00'))
      vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({})])
      render(<WeeklySummary initialWeekStart="2026-10-12" />)

      expect(await screen.findByText(/in the weekend bucket/i)).toBeInTheDocument()
    })

    it('AC-07: the completion-count line still renders for a past week', async () => {
      vi.setSystemTime(new Date('2026-10-05T09:00:00'))
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ id: '1', completed: true }),
        makeOccurrence({ id: '2', completed: false }),
      ])
      render(<WeeklySummary initialWeekStart="2026-09-21" />)

      expect(await screen.findByText(/1 of 2/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-039-AC-08/AC-11: merged per-category table replaces the flat bar and numeric table', () => {
    it('AC-08: renders one table with no column headers and three category rows', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({ category: 'ROUTINE' })])
      render(<WeeklySummary />)

      const table = await screen.findByRole('table')
      expect(within(table).queryByRole('columnheader')).not.toBeInTheDocument()
      expect(within(table).getByRole('rowheader', { name: /routine/i })).toBeInTheDocument()
      expect(within(table).getByRole('rowheader', { name: /necessary/i })).toBeInTheDocument()
      expect(within(table).getByRole('rowheader', { name: /pleasurable/i })).toBeInTheDocument()
    })

    it('AC-11: a category with no occurrences still renders its row, empty', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({ category: 'ROUTINE' })])
      render(<WeeklySummary />)

      const necessaryRow = (
        await screen.findByRole('rowheader', { name: /necessary/i })
      ).closest('tr')!
      expect(within(necessaryRow).queryAllByRole('button')).toHaveLength(0)
    })
  })

  describe('FRONTEND-039-AC-09: marks ordered completed-first, then scheduled-before-bucket', () => {
    it("orders a category's marks completed-first, then day/slot, then bucket position", async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({
          id: '1',
          name: 'Bucket item',
          category: 'ROUTINE',
          dayOfWeek: null,
          slot: null,
          completed: false,
          bucketPosition: 0,
        }),
        makeOccurrence({
          id: '2',
          name: 'Tue walk',
          category: 'ROUTINE',
          dayOfWeek: 'TUESDAY',
          slot: 'MORNING',
          completed: false,
        }),
        makeOccurrence({
          id: '3',
          name: 'Mon walk',
          category: 'ROUTINE',
          dayOfWeek: 'MONDAY',
          slot: 'MORNING',
          completed: true,
        }),
      ])
      render(<WeeklySummary />)

      const routineRow = (await screen.findByRole('rowheader', { name: /routine/i })).closest(
        'tr',
      )!
      const marks = within(routineRow).getAllByRole('button')
      expect(marks).toHaveLength(3)
      expect(marks[0]).toHaveAccessibleName(/mon walk.*completed/i)
      expect(marks[1]).toHaveAccessibleName(/tue walk.*not completed/i)
      expect(marks[2]).toHaveAccessibleName(/bucket item.*weekend bucket.*not completed/i)
    })
  })

  describe('FRONTEND-039-AC-12/AC-13: lite grid styling classes applied', () => {
    it('applies the grid-line/monospace classes to the day and slot header labels', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ dayOfWeek: 'MONDAY', slot: 'MORNING' }),
      ])
      render(<WeeklySummary />)

      const dayLabel = await screen.findByText('Monday')
      expect(dayLabel).toHaveClass(styles.liteGridDayLabel)
      const slotLabel = screen.getByText('Morning')
      expect(slotLabel).toHaveClass(styles.liteGridSlotLabel)
      // .liteGridDayLabel/.liteGridSlotLabel/.liteGridCell carry the border/font-family rules in
      // WeeklySummary.module.css -- a real-browser pass (AC-14) confirms actual rendered
      // appearance, since jsdom doesn't render CSS.
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
      expect(screen.getAllByText('Routine')).toHaveLength(2) // legend + merged per-category table row header
    })
  })

  describe('FRONTEND-037-AC-18: every mark has a visible border regardless of fill colour', () => {
    it('applies the border-carrying block class even when the category colour is white', async () => {
      vi.mocked(getCategoryColor).mockReturnValue('#ffffff')
      vi.mocked(planApi.getWeek).mockResolvedValue([
        makeOccurrence({ name: 'Walk', completed: false }),
      ])
      render(<WeeklySummary />)

      const bar = await screen.findByRole('region', { name: /this week at a glance/i })
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

      const bar = await screen.findByRole('region', { name: /this week at a glance/i })
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
