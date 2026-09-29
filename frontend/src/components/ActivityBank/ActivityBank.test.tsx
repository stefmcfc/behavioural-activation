import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivityBank } from './ActivityBank'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { Activity } from '../../types/activity'
import styles from './ActivityBank.module.css'

vi.mock('../../services/activityApi')
vi.mock('../../services/subTaskApi')

const walk: Activity = {
  id: '1',
  name: 'Walk',
  category: 'ROUTINE',
  description: 'Around the block',
  repeatable: true,
  archived: false,
  createdAt: '2026-09-28T00:00:00Z',
}

const jobs: Activity = {
  id: '2',
  name: 'Apply for jobs',
  category: 'NECESSARY',
  description: null,
  repeatable: false,
  archived: true,
  createdAt: '2026-09-28T00:00:00Z',
}

describe('ActivityBank', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(activityApi.create).mockReset()
    vi.mocked(activityApi.update).mockReset()
    vi.mocked(activityApi.remove).mockReset()
    vi.mocked(activityApi.unarchive).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
  })

  describe('FRONTEND-002-AC-07: fetches the list on mount', () => {
    it('calls activityApi.getAll', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      await waitFor(() => expect(activityApi.getAll).toHaveBeenCalled())
    })
  })

  describe('FRONTEND-002-AC-08: shows a loading indicator while the fetch is in flight', () => {
    it('renders an output element until the fetch resolves', async () => {
      let resolveGetAll: (value: Activity[]) => void = () => {}
      vi.mocked(activityApi.getAll).mockReturnValue(
        new Promise((resolve) => {
          resolveGetAll = resolve
        }),
      )
      render(<ActivityBank />)

      expect(screen.getByRole('status')).toBeInTheDocument()

      resolveGetAll([])
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-002-AC-09: empty bank shows an explanatory empty state', () => {
    it('renders an empty-state message, not a blank list', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)
      expect(await screen.findByText(/no activities yet/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-002-AC-10: populated list renders name, category, and description', () => {
    it('renders the fetched activities', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      expect(await screen.findByText('Walk')).toBeInTheDocument()
      const list = within(screen.getByRole('list'))
      expect(list.getByText('Routine')).toBeInTheDocument()
      expect(list.getByText('Around the block')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-005-AC-17: category is shown as a CategoryChip, not plain "— Category" text', () => {
    it('renders a CategoryChip, not raw "— Routine" text, in the activity list', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      expect(await screen.findByText('Walk')).toBeInTheDocument()
      expect(screen.getByTestId('category-chip-ROUTINE')).toBeInTheDocument()
      expect(screen.queryByText(/— routine/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-007-AC-19/AC-20: activity rows use the hairline treatment, actions right-aligned', () => {
    it('applies the row class to each activity li and the actions class to its action buttons', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')
      expect(row).toHaveClass(styles.row)
      expect(screen.getByRole('button', { name: 'Edit' }).closest(`.${styles.actions}`)).not.toBeNull()
    })
  })

  describe('FRONTEND-002-AC-11: fetch failure shows an alert', () => {
    it('displays the error in a role="alert" element', async () => {
      vi.mocked(activityApi.getAll).mockRejectedValue({ status: 500, message: 'Server error' })
      render(<ActivityBank />)

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
    })
  })

  describe('FRONTEND-002-AC-15: successful create adds to the list and clears the form', () => {
    it('shows the new activity and resets the form fields', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      vi.mocked(activityApi.create).mockResolvedValue({
        id: '1',
        name: 'Walk',
        category: 'ROUTINE',
        description: null,
        repeatable: true,
        archived: false,
        createdAt: '2026-09-28T00:00:00Z',
      })
      render(<ActivityBank />)

      await userEvent.type(await screen.findByLabelText(/name/i), 'Walk')
      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

      expect(await screen.findByText('Walk')).toBeInTheDocument()
      expect(screen.getByLabelText(/name/i)).toHaveValue('')
    })
  })

  describe('FRONTEND-002-AC-18: edit form prefills from existing activity data', () => {
    it("shows the activity's current values in the form fields", async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /edit/i }))

      expect(screen.getByLabelText(/name/i)).toHaveValue('Walk')
      expect(screen.getByLabelText(/description/i)).toHaveValue('Around the block')
    })
  })

  describe('FRONTEND-002-AC-20: successful update replaces the list entry', () => {
    it('shows the updated name in place of the old one', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(activityApi.update).mockResolvedValue({ ...walk, name: 'Walk further' })
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
      await userEvent.clear(screen.getByLabelText(/name/i))
      await userEvent.type(screen.getByLabelText(/name/i), 'Walk further')
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(await screen.findByText('Walk further')).toBeInTheDocument()
      expect(screen.queryByText('Walk', { exact: true })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-002-AC-22/AC-24: delete uses an inline confirm, not window.confirm', () => {
    it('cancelling the inline confirm does not call activityApi.remove', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(activityApi.remove).not.toHaveBeenCalled()
      expect(screen.getByText('Walk')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-002-AC-23/AC-25: confirming delete removes the activity', () => {
    it('calls activityApi.remove and removes the row on success', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(activityApi.remove).mockResolvedValue(undefined)
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

      expect(activityApi.remove).toHaveBeenCalledWith('1')
      await waitFor(() => expect(screen.queryByText('Walk')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-002-AC-26: failed delete shows an alert and keeps the activity', () => {
    it('displays the error and leaves the row in place', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(activityApi.remove).mockRejectedValue({ status: 500, message: 'Server error' })
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByText('Walk')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-01/AC-02: expand/collapse toggles the sub-task checklist', () => {
    it('renders SubTaskList on expand and removes it on collapse', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /show sub-tasks/i }))
      expect(subTaskApi.getAll).toHaveBeenCalledWith('1')
      expect(await screen.findByText(/no sub-tasks yet/i)).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /hide sub-tasks/i }))
      expect(screen.queryByText(/no sub-tasks yet/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-006-AC-05: default mount fetch excludes archived activities', () => {
    it('calls activityApi.getAll(false) on mount', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await screen.findByText('Walk')
      expect(activityApi.getAll).toHaveBeenCalledWith(false)
    })
  })

  describe('FRONTEND-006-AC-06: "Show archived" toggle, off by default', () => {
    it('renders an unchecked checkbox', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      expect(screen.getByRole('checkbox', { name: /show archived/i })).not.toBeChecked()
    })
  })

  describe('FRONTEND-006-AC-07/AC-08: toggling "Show archived" refetches and toggles archived visibility', () => {
    it('fetches with includeArchived=true when on, and false again when off', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)
      await screen.findByText('Walk')

      vi.mocked(activityApi.getAll).mockResolvedValueOnce([walk, jobs])
      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))

      expect(activityApi.getAll).toHaveBeenLastCalledWith(true)
      expect(await screen.findByText('(Archived)')).toBeInTheDocument()

      vi.mocked(activityApi.getAll).mockResolvedValueOnce([walk])
      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))

      expect(activityApi.getAll).toHaveBeenLastCalledWith(false)
      await waitFor(() => expect(screen.queryByText('(Archived)')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-006-AC-09/AC-10/AC-11: Unarchive replaces the normal actions and restores the activity', () => {
    it('calls unarchive and shows the normal actions again on success', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([jobs])
      vi.mocked(activityApi.unarchive).mockResolvedValue(undefined)
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
      expect(await screen.findByRole('button', { name: /unarchive/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /show sub-tasks/i })).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /unarchive/i }))

      expect(activityApi.unarchive).toHaveBeenCalledWith('2')
      expect(await screen.findByRole('button', { name: /^edit$/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /unarchive/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-006-AC-15: archived activity sub-tasks are viewable but read-only', () => {
    it('shows sub-tasks with no create form and no Rename/Delete actions', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([jobs])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([
        {
          id: 's1',
          activityId: '2',
          name: 'Update CV',
          category: 'NECESSARY',
          createdAt: '2026-09-29T00:00:00Z',
        },
      ])
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
      await userEvent.click(await screen.findByRole('button', { name: /show sub-tasks/i }))

      expect(await screen.findByText('Update CV')).toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: /sub-task name/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-006-AC-13: "Show archived" re-fetch failure shows an alert with a working Retry', () => {
    it('retries the fetch with includeArchived still true, keeping the toggle on', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)
      await screen.findByText('Walk')

      vi.mocked(activityApi.getAll).mockRejectedValueOnce(
        new ApiError(500, 'Something went wrong. Please try again.'),
      )
      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /show archived/i })).toBeChecked()

      vi.mocked(activityApi.getAll).mockResolvedValueOnce([walk, jobs])
      await userEvent.click(screen.getByRole('button', { name: /retry/i }))

      expect(activityApi.getAll).toHaveBeenLastCalledWith(true)
      expect(await screen.findByText('(Archived)')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-006-AC-14: unarchive failure shows an alert and leaves the activity archived', () => {
    it('keeps the Unarchive action visible after a rejected call', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([jobs])
      vi.mocked(activityApi.unarchive).mockRejectedValue(
        new ApiError(500, 'Something went wrong. Please try again.'),
      )
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
      await userEvent.click(await screen.findByRole('button', { name: /unarchive/i }))

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /unarchive/i })).toBeInTheDocument()
    })
  })
})
