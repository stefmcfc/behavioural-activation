import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssignActivityPicker } from './AssignActivityPicker'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import type { Activity } from '../../types/activity'
import type { SubTask } from '../../types/subTask'

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
  createdAt: '2026-09-01T00:00:00Z',
}

const party: Activity = {
  id: 'a2',
  name: 'Organise a leaving party',
  category: 'NECESSARY',
  description: null,
  repeatable: true,
  archived: false,
  createdAt: '2026-09-01T00:00:00Z',
}

const sendInvitations: SubTask = {
  id: 's1',
  activityId: 'a2',
  name: 'Send invitations',
  category: 'PLEASURABLE',
  createdAt: '2026-09-01T00:00:00Z',
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
  })

  describe('FRONTEND-006-AC-12: never fetches with includeArchived (regression guard)', () => {
    it('calls activityApi.getAll with no arguments', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      renderPicker()

      await waitFor(() => expect(activityApi.getAll).toHaveBeenCalledWith())
    })
  })

  describe('FRONTEND-009-AC-24: each activity and sub-task shows its category', () => {
    it('renders a CategoryChip next to the activity and its sub-task', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([party])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([sendInvitations])
      renderPicker()

      const activityButton = await screen.findByRole('button', { name: 'Organise a leaving party' })
      expect(within(activityButton.parentElement!).getByText('Necessary')).toBeInTheDocument()

      const subTaskButton = screen.getByRole('button', { name: 'Send invitations' })
      expect(within(subTaskButton.parentElement!).getByText('Pleasurable')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-009-AC-25/AC-26: filtering by category', () => {
    it('hides an activity whose own category and sub-tasks all fail to match', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk, party])
      vi.mocked(subTaskApi.getAll).mockImplementation((activityId) =>
        Promise.resolve(activityId === 'a2' ? [sendInvitations] : []),
      )
      renderPicker()

      await screen.findByRole('button', { name: 'Go for a walk' })

      await userEvent.click(screen.getByRole('radio', { name: 'Necessary' }))

      expect(screen.queryByRole('button', { name: 'Go for a walk' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Organise a leaving party' })).toBeInTheDocument()
    })

    it('keeps a non-matching activity visible if one of its sub-tasks matches the filter', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([party])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([sendInvitations])
      renderPicker()

      await screen.findByRole('button', { name: 'Organise a leaving party' })

      await userEvent.click(screen.getByRole('radio', { name: 'Pleasurable' }))

      expect(screen.getByRole('button', { name: 'Organise a leaving party' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send invitations' })).toBeInTheDocument()
    })

    it('shows "No activities match this category" when nothing matches', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      renderPicker()

      await screen.findByRole('button', { name: 'Go for a walk' })

      await userEvent.click(screen.getByRole('radio', { name: 'Pleasurable' }))

      expect(screen.getByText(/no activities match this category/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Go for a walk' })).not.toBeInTheDocument()
    })
  })
})
