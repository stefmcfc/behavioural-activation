import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssignActivityPicker } from './AssignActivityPicker'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import type { Activity } from '../../types/activity'
import type { SubTask } from '../../types/subTask'
import buttonStyles from '../../styles/buttonVariants.module.css'

vi.mock('../../services/activityApi')
vi.mock('../../services/subTaskApi')
vi.mock('../../services/planApi')

const walk: Activity = {
  id: 'a1',
  name: 'Go for a walk',
  category: 'ROUTINE',
  description: null,
  repeatable: true,
  archived: false,
  favourite: false,
  createdAt: '2026-09-01T00:00:00Z',
  subTaskCount: 0,
}

const party: Activity = {
  id: 'a2',
  name: 'Organise a leaving party',
  category: 'NECESSARY',
  description: null,
  repeatable: true,
  archived: false,
  favourite: false,
  createdAt: '2026-09-01T00:00:00Z',
  subTaskCount: 0,
}

const jobs: Activity = {
  id: 'a3',
  name: 'Apply for jobs',
  category: 'NECESSARY',
  description: null,
  repeatable: false,
  archived: false,
  favourite: false,
  createdAt: '2026-09-01T00:00:00Z',
  subTaskCount: 0,
}

const sendInvitations: SubTask = {
  id: 's1',
  activityId: 'a2',
  name: 'Send invitations',
  category: 'PLEASURABLE',
  createdAt: '2026-09-01T00:00:00Z',
  position: 0,
}

const stepOne: SubTask = {
  id: 's2',
  activityId: 'a3',
  name: 'Step one',
  category: 'NECESSARY',
  createdAt: '2026-09-01T00:00:00Z',
  position: 0,
}

function renderPicker() {
  render(
    <AssignActivityPicker
      weekStart="2026-09-28"
      target={{ dayOfWeek: 'MONDAY', slot: 'MORNING' }}
      onSuccess={vi.fn()}
      onCancel={vi.fn()}
    />,
  )
}

describe('AssignActivityPicker', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAllForOwner).mockReset()
  })

  describe('FRONTEND-006-AC-12: never fetches with includeArchived (regression guard)', () => {
    it('calls activityApi.getAll with no arguments', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      await waitFor(() => expect(activityApi.getAll).toHaveBeenCalledWith())
    })
  })

  describe('FRONTEND-009-AC-24: each activity and sub-task shows its category', () => {
    it('renders a CategoryChip next to the activity and its sub-task', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([party])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
      renderPicker()

      const activityButton = await screen.findByRole('button', { name: 'Organise a leaving party' })
      expect(within(activityButton.parentElement!).getByText('Necessary')).toBeInTheDocument()

      // FRONTEND-045-AC-06: sub-tasks are collapsed by default in select mode -- expand this
      // activity's toggle before asserting on its sub-task row.
      await userEvent.click(screen.getByRole('button', { name: 'Show sub-tasks (1)' }))
      const subTaskButton = screen.getByRole('button', { name: 'Send invitations' })
      expect(within(subTaskButton.parentElement!).getByText('Pleasurable')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-022-AC-01: shows the repeatable icon for a repeatable activity row', () => {
    it('renders RepeatableIcon next to the CategoryChip for a repeatable activity', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      const activityButton = await screen.findByRole('button', { name: 'Go for a walk' })
      expect(
        within(activityButton.parentElement!).getByRole('img', { name: /repeatable/i }),
      ).toBeInTheDocument()
    })
  })

  describe('FRONTEND-022-AC-02: shows no repeatable icon for a one-off activity row', () => {
    it('renders no RepeatableIcon for a one-off activity', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([jobs])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      const activityButton = await screen.findByRole('button', { name: 'Apply for jobs' })
      expect(
        within(activityButton.parentElement!).queryByRole('img', { name: /repeatable/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-022-AC-03: never shows the repeatable icon on a sub-task row, even when its parent activity is repeatable', () => {
    it('renders no RepeatableIcon on a sub-task row whose parent activity is repeatable', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([party])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
      renderPicker()

      // FRONTEND-045-AC-06: sub-tasks are collapsed by default in select mode -- expand this
      // activity's toggle before asserting on its sub-task row.
      await userEvent.click(await screen.findByRole('button', { name: 'Show sub-tasks (1)' }))
      const subTaskButton = screen.getByRole('button', { name: 'Send invitations' })
      expect(
        within(subTaskButton.parentElement!).queryByRole('img', { name: /repeatable/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-022-AC-04: never shows the repeatable icon on a sub-task row when its parent activity is one-off', () => {
    it('renders no RepeatableIcon for a sub-task whose parent activity is one-off', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([jobs])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([stepOne])
      renderPicker()

      // FRONTEND-045-AC-06: sub-tasks are collapsed by default in select mode -- expand this
      // activity's toggle before asserting on its sub-task row.
      await userEvent.click(await screen.findByRole('button', { name: 'Show sub-tasks (1)' }))
      const subTaskButton = screen.getByRole('button', { name: 'Step one' })
      expect(
        within(subTaskButton.parentElement!).queryByRole('img', { name: /repeatable/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-009-AC-25/AC-26: filtering by category', () => {
    it('hides an activity whose own category and sub-tasks all fail to match', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk, party])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
      renderPicker()

      await screen.findByRole('button', { name: 'Go for a walk' })
      await userEvent.click(screen.getByText('Filters'))

      await userEvent.click(screen.getByRole('radio', { name: 'Necessary' }))

      expect(screen.queryByRole('button', { name: 'Go for a walk' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Organise a leaving party' })).toBeInTheDocument()
    })

    it('keeps a non-matching activity visible if one of its sub-tasks matches the filter', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([party])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
      renderPicker()

      await screen.findByRole('button', { name: 'Organise a leaving party' })
      await userEvent.click(screen.getByText('Filters'))

      await userEvent.click(screen.getByRole('radio', { name: 'Pleasurable' }))

      expect(screen.getByRole('button', { name: 'Organise a leaving party' })).toBeInTheDocument()
      // FRONTEND-045-AC-06: sub-tasks are collapsed by default in select mode -- expand this
      // activity's toggle before asserting on its sub-task row.
      await userEvent.click(screen.getByRole('button', { name: 'Show sub-tasks (1)' }))
      expect(screen.getByRole('button', { name: 'Send invitations' })).toBeInTheDocument()
    })

    it('shows "No activities match this category" when nothing matches', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      await screen.findByRole('button', { name: 'Go for a walk' })
      await userEvent.click(screen.getByText('Filters'))

      await userEvent.click(screen.getByRole('radio', { name: 'Pleasurable' }))

      expect(screen.getByText(/no activities match these filters/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Go for a walk' })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-009-AC-30: filtering by repeatable/one-off', () => {
    it('shows only repeatable activities when Repeatable is selected', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk, jobs])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      await screen.findByRole('button', { name: 'Go for a walk' })
      await userEvent.click(screen.getByText('Filters'))

      await userEvent.click(screen.getByRole('radio', { name: 'Repeatable' }))

      expect(screen.getByRole('button', { name: 'Go for a walk' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Apply for jobs' })).not.toBeInTheDocument()
    })

    it('shows only one-off activities when One-off is selected', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk, jobs])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      await screen.findByRole('button', { name: 'Go for a walk' })
      await userEvent.click(screen.getByText('Filters'))

      await userEvent.click(screen.getByRole('radio', { name: 'One-off' }))

      expect(screen.getByRole('button', { name: 'Apply for jobs' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Go for a walk' })).not.toBeInTheDocument()
    })

    it('combines the type filter with the category filter', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk, jobs])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      await screen.findByRole('button', { name: 'Go for a walk' })
      await userEvent.click(screen.getByText('Filters'))

      await userEvent.click(screen.getByRole('radio', { name: 'Necessary' }))
      await userEvent.click(screen.getByRole('radio', { name: 'Repeatable' }))

      expect(screen.getByText(/no activities match these filters/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-027-AC-06: a favourited activity shows a read-only favourite indicator', () => {
    it('renders a FavouriteIcon with no click handler for a favourited activity', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([{ ...walk, favourite: true }])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      const activityButton = await screen.findByRole('button', { name: 'Go for a walk' })
      const icon = within(activityButton.parentElement!).getByRole('img', { name: 'Favourite' })
      expect(icon.closest('button')).toBeNull()
    })

    it('renders no FavouriteIcon for a non-favourited activity', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([{ ...walk, favourite: false }])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      const activityButton = await screen.findByRole('button', { name: 'Go for a walk' })
      expect(
        within(activityButton.parentElement!).queryByRole('img', { name: 'Favourite' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-027-AC-07: sub-task rows never show a favourite indicator', () => {
    it('renders no FavouriteIcon on a sub-task row, even when its parent activity is favourited', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([{ ...party, favourite: true }])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
      renderPicker()

      // FRONTEND-045-AC-06: sub-tasks are collapsed by default in select mode -- expand this
      // activity's toggle before asserting on its sub-task row.
      await userEvent.click(await screen.findByRole('button', { name: 'Show sub-tasks (1)' }))
      const subTaskButton = screen.getByRole('button', { name: 'Send invitations' })
      expect(
        within(subTaskButton.parentElement!).queryByRole('img', { name: 'Favourite' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-027-AC-08: preserves backend-provided order through its filters', () => {
    it('renders activities in the exact order activityApi.getAll returns', async () => {
      const zebraFavourite: Activity = { ...walk, id: 'z1', name: 'Zebra', favourite: true }
      const appleActivity: Activity = { ...jobs, id: 'z2', name: 'Apple', favourite: false }
      vi.mocked(activityApi.getAll).mockResolvedValue([zebraFavourite, appleActivity])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      await screen.findByRole('button', { name: 'Zebra' })
      const buttons = screen.getAllByRole('button', { name: /Zebra|Apple/ })
      expect(buttons[0]).toHaveTextContent('Zebra')
      expect(buttons[1]).toHaveTextContent('Apple')
    })
  })

  describe('FRONTEND-027-AC-13: renders a "Favourites only" filter, "All" selected by default', () => {
    it('renders a two-option pill group with "All" selected', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      await screen.findByRole('button', { name: 'Go for a walk' })
      await userEvent.click(screen.getByText('Filters'))
      const group = screen.getByRole('group', { name: 'Filter by favourite' })
      expect(within(group).getByRole('radio', { name: 'All' })).toBeChecked()
      expect(within(group).getByRole('radio', { name: 'Favourites only' })).not.toBeChecked()
    })
  })

  describe('FRONTEND-027-AC-14: selecting "Favourites only" hides non-favourited activities, composing with existing filters', () => {
    it('shows only the favourited activity when selected', async () => {
      const favouritedActivity: Activity = { ...walk, favourite: true }
      const nonFavouritedActivity: Activity = { ...jobs, favourite: false }
      vi.mocked(activityApi.getAll).mockResolvedValue([favouritedActivity, nonFavouritedActivity])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      await screen.findByRole('button', { name: 'Go for a walk' })
      await userEvent.click(screen.getByText('Filters'))
      await userEvent.click(screen.getByRole('radio', { name: 'Favourites only' }))

      expect(screen.getByRole('button', { name: 'Go for a walk' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Apply for jobs' })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-027-AC-15: a shown favourited activity\'s sub-tasks are unaffected by the filter', () => {
    it('still renders sub-tasks beneath a shown favourited activity', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([{ ...party, favourite: true }])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
      renderPicker()

      await screen.findByRole('button', { name: 'Organise a leaving party' })
      await userEvent.click(screen.getByText('Filters'))
      await userEvent.click(screen.getByRole('radio', { name: 'Favourites only' }))

      // FRONTEND-045-AC-06: sub-tasks are collapsed by default in select mode -- expand this
      // activity's toggle before asserting on its sub-task row.
      await userEvent.click(screen.getByRole('button', { name: 'Show sub-tasks (1)' }))
      expect(screen.getByRole('button', { name: 'Send invitations' })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-027-AC-16: selecting "All" again restores previously-hidden activities', () => {
    it('restores the non-favourited activity after selecting "All" again', async () => {
      const favouritedActivity: Activity = { ...walk, favourite: true }
      const nonFavouritedActivity: Activity = { ...jobs, favourite: false }
      vi.mocked(activityApi.getAll).mockResolvedValue([favouritedActivity, nonFavouritedActivity])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      await screen.findByRole('button', { name: 'Go for a walk' })
      await userEvent.click(screen.getByText('Filters'))
      const group = screen.getByRole('group', { name: 'Filter by favourite' })
      await userEvent.click(within(group).getByRole('radio', { name: 'Favourites only' }))
      expect(screen.queryByRole('button', { name: 'Apply for jobs' })).not.toBeInTheDocument()

      await userEvent.click(within(group).getByRole('radio', { name: 'All' }))
      expect(screen.getByRole('button', { name: 'Apply for jobs' })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-031-AC-15: regression guard -- selection-row buttons stay unstyled', () => {
    it('leaves an activity selection-row button with no variant class', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      const activityButton = await screen.findByRole('button', { name: 'Go for a walk' })
      expect(activityButton).not.toHaveClass(buttonStyles.primary)
      expect(activityButton).not.toHaveClass(buttonStyles.destructive)
    })
  })

  describe('FRONTEND-032-AC-04: the Filters disclosure is collapsed by default, with zero changes to AssignActivityPicker.tsx itself', () => {
    it('shows the Filters disclosure collapsed via its unmodified ActivityPickerList render', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      const disclosure = (await screen.findByText('Filters')).closest('details')!
      expect(disclosure).not.toHaveAttribute('open')
    })
  })

  describe('FRONTEND-031-AC-11: "Assign" button is primary; Cancel is not', () => {
    it('applies primary to Assign and no variant to Cancel', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
      renderPicker()

      await screen.findByText(/no activities yet/i)
      const assignButton = screen.getByRole('button', { name: 'Assign' })
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      expect(assignButton).toHaveClass(buttonStyles.primary)
      expect(cancelButton).not.toHaveClass(buttonStyles.primary)
      expect(cancelButton).not.toHaveClass(buttonStyles.destructive)
    })
  })
})
