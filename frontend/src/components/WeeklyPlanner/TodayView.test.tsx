import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TodayView } from './TodayView'
import { planApi } from '../../services/planApi'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import type { Activity } from '../../types/activity'
import type { PlannedOccurrence } from '../../types/plan'

vi.mock('../../services/planApi')
vi.mock('../../services/activityApi')
vi.mock('../../services/subTaskApi')

const wednesdayOccurrence: PlannedOccurrence = {
  id: '1',
  activityId: 'a1',
  subTaskId: null,
  name: 'Wednesday task',
  parentActivityName: null,
  category: 'ROUTINE',
  weekStart: '2026-09-28',
  dayOfWeek: 'WEDNESDAY',
  slot: 'MORNING',
  bucketPosition: null,
  recentlyCarriedForward: false,
  completed: false,
  completedAt: null,
  createdAt: '2026-09-01T00:00:00Z',
  repeatable: true,
}

const mondayOccurrence: PlannedOccurrence = {
  ...wednesdayOccurrence,
  id: '2',
  name: 'Monday task',
  dayOfWeek: 'MONDAY',
}

const drawerActivity: Activity = {
  id: 'activity-1',
  name: 'Go for a walk',
  category: 'ROUTINE',
  description: null,
  repeatable: true,
  archived: false,
  favourite: false,
  createdAt: '2026-09-01T00:00:00Z',
  subTaskCount: 0,
}

describe('TodayView', () => {
  beforeEach(() => {
    vi.mocked(planApi.getWeek).mockReset()
    vi.mocked(planApi.create).mockReset()
    vi.mocked(planApi.complete).mockReset()
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
    // Default to an empty bulk sub-task response -- ActivityPickerList (reached via the "Browse
    // activities" drawer) now always calls subTaskApi.getAllForOwner() unconditionally
    // (frontend_spec_033), even when a test only cares about activityApi.getAll's result.
    vi.mocked(subTaskApi.getAllForOwner).mockReset().mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('FRONTEND-016-AC-03/AC-04: shows only today, for the real current week', () => {
    it('fetches the real current week Monday regardless of any other navigated state', async () => {
      vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday, week of 2026-09-28
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<TodayView />)

      expect(await screen.findByText(/no activities planned for today/i)).toBeInTheDocument()
      expect(planApi.getWeek).toHaveBeenCalledWith('2026-09-28')
    })

    it('shows only occurrences scheduled for today, not other days in the same week', async () => {
      vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
      vi.mocked(planApi.getWeek).mockResolvedValue([wednesdayOccurrence, mondayOccurrence])
      render(<TodayView />)

      expect(await screen.findByText('Wednesday task')).toBeInTheDocument()
      expect(screen.queryByText('Monday task')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-016-AC-04: renders a single-day grid headed with today\'s day name', () => {
    it('shows a heading naming the real current day', async () => {
      vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<TodayView />)

      expect(await screen.findByRole('heading', { name: /today/i })).toBeInTheDocument()
      // FRONTEND-041-AC-01/AC-02: the grid's own <h3> is a generic "Today's plan" heading, not
      // the day name -- the real day name appears exactly once, via the single day column's own
      // date/day-name label, not duplicated via the heading prop too.
      expect(screen.getByRole('heading', { name: "Today's plan", level: 3 })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Wednesday', level: 3 })).not.toBeInTheDocument()
      expect(screen.getAllByText('Wednesday')).toHaveLength(1)
    })
  })

  describe('FRONTEND-016-AC-05: the bucket list is always visible from Today', () => {
    it('renders the bucket list panel', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<TodayView />)

      expect(await screen.findByRole('region', { name: /weekend bucket list/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-016-AC-06: today-specific empty-state wording', () => {
    it('shows "No activities planned for today." rather than the weekly grid wording', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<TodayView />)

      expect(await screen.findByText('No activities planned for today.')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-016-AC-07: supports the same actions as the Weekly Planner', () => {
    it('completes a today occurrence from the tile', async () => {
      vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday, matches wednesdayOccurrence
      vi.mocked(planApi.getWeek).mockResolvedValue([wednesdayOccurrence])
      vi.mocked(planApi.complete).mockResolvedValue({
        ...wednesdayOccurrence,
        completed: true,
        completedAt: '2026-09-30T12:00:00Z',
      })
      render(<TodayView />)

      await userEvent.click(await screen.findByRole('button', { name: /^complete$/i }))

      expect(planApi.complete).toHaveBeenCalledWith(wednesdayOccurrence.id)
    })

    it('opens the detail card for an occurrence from Today', async () => {
      vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday, matches wednesdayOccurrence
      vi.mocked(planApi.getWeek).mockResolvedValue([wednesdayOccurrence])
      render(<TodayView />)

      await userEvent.click(await screen.findByRole('button', { name: wednesdayOccurrence.name }))
      expect(
        await screen.findByRole('dialog', { name: new RegExp(`${wednesdayOccurrence.name} actions`, 'i') }),
      ).toBeInTheDocument()
    })

    it('opens the Add picker modal for today\'s grid', async () => {
      vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      render(<TodayView />)

      const addButton = await screen.findByRole('button', { name: /add to wednesday morning/i })
      await userEvent.click(addButton)

      expect(await screen.findByRole('dialog', { name: /assign an activity or sub-task/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-016-AC-08: TodayView state is independent of a separately-mounted WeeklyPlanner', () => {
    it('fetches its own occurrences on mount, not reliant on any other component', async () => {
      vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday, matches wednesdayOccurrence
      vi.mocked(planApi.getWeek).mockResolvedValue([wednesdayOccurrence])
      render(<TodayView />)

      await screen.findByText(wednesdayOccurrence.name)
      expect(planApi.getWeek).toHaveBeenCalledTimes(1)
    })
  })

  describe('FRONTEND-016-AC-10/AC-14: the drawer reintroduced for Today', () => {
    it('AC-10: "Browse activities" opens a drag-mode ActivityPickerList panel', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<TodayView />)

      await userEvent.click(await screen.findByRole('button', { name: /browse activities/i }))

      expect(screen.getByRole('complementary', { name: /activities/i })).toBeInTheDocument()
    })

    it('AC-10: clicking the toggle again closes the drawer', async () => {
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<TodayView />)

      await userEvent.click(await screen.findByRole('button', { name: /browse activities/i }))
      expect(screen.getByRole('complementary', { name: /activities/i })).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /browse activities/i }))
      expect(screen.queryByRole('complementary', { name: /activities/i })).not.toBeInTheDocument()
    })

    it('AC-14: dropping a drawer item on today\'s grid calls planApi.create via usePlanActions', async () => {
      vi.setSystemTime(new Date('2026-09-30T09:00:00')) // a Wednesday
      vi.mocked(planApi.getWeek).mockResolvedValue([])
      vi.mocked(activityApi.getAll).mockResolvedValue([drawerActivity])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      vi.mocked(planApi.create).mockResolvedValue({
        ...wednesdayOccurrence,
        id: 'new-occ',
        activityId: drawerActivity.id,
        name: drawerActivity.name,
      })
      render(<TodayView />)

      await userEvent.click(await screen.findByRole('button', { name: /browse activities/i }))
      const row = (await screen.findByText(drawerActivity.name)).closest('li')!
      const targetCell = screen.getByLabelText(/add to wednesday morning/i).closest('div')!

      fireEvent.dragStart(row)
      fireEvent.drop(targetCell)

      await waitFor(() =>
        expect(planApi.create).toHaveBeenCalledWith(
          expect.objectContaining({ activityId: drawerActivity.id, subTaskId: null }),
        ),
      )
      await waitFor(() => expect(screen.getAllByText(drawerActivity.name)).toHaveLength(2))
    })
  })
})
