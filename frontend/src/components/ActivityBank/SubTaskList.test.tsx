import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SubTaskList } from './SubTaskList'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { SubTask } from '../../types/subTask'
import styles from './SubTaskList.module.css'

vi.mock('../../services/subTaskApi')

const guestList: SubTask = {
  id: 's1',
  activityId: 'a1',
  name: 'Create a guest list',
  category: 'PLEASURABLE',
  createdAt: '2026-09-29T00:00:00Z',
}

describe('SubTaskList', () => {
  beforeEach(() => {
    vi.mocked(subTaskApi.getAll).mockReset()
    vi.mocked(subTaskApi.create).mockReset()
    vi.mocked(subTaskApi.update).mockReset()
    vi.mocked(subTaskApi.remove).mockReset()
  })

  describe('FRONTEND-003-AC-03: fetches the checklist on mount', () => {
    it('calls subTaskApi.getAll with the activity id', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      await waitFor(() => expect(subTaskApi.getAll).toHaveBeenCalledWith('a1'))
    })
  })

  describe('FRONTEND-005-AC-18: per-sub-task category is a CategoryChip, not plain "— Category" text', () => {
    it('renders a CategoryChip, not raw "— Pleasurable" text, for each sub-task row', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      expect(await screen.findByText('Create a guest list')).toBeInTheDocument()
      const list = within(screen.getByRole('list'))
      expect(list.getByTestId('category-chip-PLEASURABLE')).toBeInTheDocument()
      expect(list.queryByText(/— pleasurable/i)).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /sub-tasks — pleasurable/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-007-AC-21/AC-22: sub-task rows use the nested hairline treatment', () => {
    it('applies the row and nested classes to each sub-task li', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      const row = (await screen.findByText('Create a guest list')).closest('li')
      expect(row).toHaveClass(styles.row)
      expect(row).toHaveClass(styles.nested)
    })
  })

  describe('FRONTEND-003-AC-04: shows a loading indicator while the fetch is in flight', () => {
    it('renders an output element until the fetch resolves', async () => {
      let resolveGetAll: (value: SubTask[]) => void = () => {}
      vi.mocked(subTaskApi.getAll).mockReturnValue(
        new Promise((resolve) => {
          resolveGetAll = resolve
        }),
      )
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      expect(screen.getByRole('status')).toBeInTheDocument()

      resolveGetAll([])
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-003-AC-07: successful create adds to the checklist and clears the form', () => {
    it('shows the new sub-task and resets the name field', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      vi.mocked(subTaskApi.create).mockResolvedValue({ ...guestList })
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      await userEvent.type(await screen.findByLabelText(/sub-task name/i), 'Create a guest list')
      await userEvent.click(screen.getByRole('button', { name: /add sub-task/i }))

      expect(await screen.findByText('Create a guest list')).toBeInTheDocument()
      expect(screen.getByLabelText(/sub-task name/i)).toHaveValue('')
    })
  })

  describe('FRONTEND-003-AC-09: rename is activated and prefills the field', () => {
    it('shows the rename form with the current name', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      await userEvent.click(await screen.findByRole('button', { name: /rename/i }))

      expect(screen.getByLabelText(/sub-task name/i)).toHaveValue('Create a guest list')
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-12: successful rename replaces the checklist entry and exits rename mode', () => {
    it('shows the updated name and returns to the add form', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      vi.mocked(subTaskApi.update).mockResolvedValue({
        ...guestList,
        name: 'Create and send a guest list',
      })
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      await userEvent.click(await screen.findByRole('button', { name: /rename/i }))
      await userEvent.clear(screen.getByLabelText(/sub-task name/i))
      await userEvent.type(screen.getByLabelText(/sub-task name/i), 'Create and send a guest list')
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(await screen.findByText('Create and send a guest list')).toBeInTheDocument()
      expect(screen.queryByText('Create a guest list', { exact: true })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add sub-task/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-13/AC-15: delete uses an inline confirm, not window.confirm', () => {
    it('cancelling the inline confirm does not call subTaskApi.remove', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(subTaskApi.remove).not.toHaveBeenCalled()
      expect(screen.getByText('Create a guest list')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-14/AC-16: confirming delete removes the sub-task', () => {
    it('calls subTaskApi.remove and removes the row on success', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      vi.mocked(subTaskApi.remove).mockResolvedValue(undefined)
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

      expect(subTaskApi.remove).toHaveBeenCalledWith('a1', 's1')
      await waitFor(() => expect(screen.queryByText('Create a guest list')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-003-AC-17: empty checklist shows an explanatory message', () => {
    it('renders an empty-state message, not a blank checklist', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      expect(await screen.findByText(/no sub-tasks yet/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-18: fetch failure shows an alert with a working Retry control', () => {
    it('re-fetches when Retry is activated', async () => {
      vi.mocked(subTaskApi.getAll)
        .mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Please try again.'))
        .mockResolvedValueOnce([])
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /retry/i }))

      expect(await screen.findByText(/no sub-tasks yet/i)).toBeInTheDocument()
      expect(subTaskApi.getAll).toHaveBeenCalledTimes(2)
    })
  })

  describe('FRONTEND-003-AC-21: delete failure shows an alert and keeps the sub-task', () => {
    it('displays the error and leaves the row in place', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      vi.mocked(subTaskApi.remove).mockRejectedValue({ status: 500, message: 'Server error' })
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByText('Create a guest list')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-22: category is shown read-only, never inside a picker', () => {
    it('renders the category label but no CategoryPicker in the add form', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

      expect(await screen.findByText(/pleasurable/i)).toBeInTheDocument()
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-006-AC-15: readOnly hides the create form and per-row Rename/Delete actions', () => {
    it('renders sub-tasks with no create form, Rename, or Delete controls', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" category="PLEASURABLE" readOnly />)

      expect(await screen.findByText('Create a guest list')).toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
    })
  })
})
