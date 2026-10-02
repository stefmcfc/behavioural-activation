import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SubTaskList } from './SubTaskList'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { SubTask } from '../../types/subTask'
import styles from './SubTaskList.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'

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
      render(<SubTaskList activityId="a1" />)

      await waitFor(() => expect(subTaskApi.getAll).toHaveBeenCalledWith('a1'))
    })
  })

  describe('FRONTEND-005-AC-18: per-sub-task category is a CategoryChip, not plain "— Category" text', () => {
    it('renders a CategoryChip, not raw "— Pleasurable" text, for each sub-task row', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" />)

      expect(await screen.findByText('Create a guest list')).toBeInTheDocument()
      const list = within(screen.getByRole('list'))
      expect(list.getByTestId('category-chip-PLEASURABLE')).toBeInTheDocument()
      expect(list.queryByText(/— pleasurable/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-007-AC-21/AC-22: sub-task rows use the nested hairline treatment', () => {
    it('applies the row and nested classes to each sub-task li', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" />)

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
      render(<SubTaskList activityId="a1" />)

      expect(screen.getByRole('status')).toBeInTheDocument()

      resolveGetAll([])
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-014-AC-01/AC-02/AC-03: Add sub-task opens a modal, not an inline top-of-list form', () => {
    it('renders no form until Add sub-task is clicked, then opens it in a dialog', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<SubTaskList activityId="a1" />)

      await screen.findByText(/no sub-tasks yet/i)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: /sub-task name/i })).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /add sub-task/i }))

      expect(await screen.findByRole('dialog', { name: /add sub-task/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /sub-task name/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-018-AC-04: no "Sub-tasks — {Category}" heading', () => {
    it('renders no heading', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" />)

      await screen.findByText('Create a guest list')
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-018-AC-06: "No sub-tasks yet." and "Add sub-task" share the same row', () => {
    it('renders the empty message and the Add sub-task button in the same container', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<SubTaskList activityId="a1" />)

      const emptyMessage = await screen.findByText(/no sub-tasks yet/i)
      const addButton = screen.getByRole('button', { name: /add sub-task/i })
      expect(emptyMessage.parentElement).toBe(addButton.parentElement)
    })
  })

  describe('FRONTEND-014-AC-08: create-mode submit button is "Save sub-task", not "Add sub-task"', () => {
    it("does not collide with the page-level trigger's own label", async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<SubTaskList activityId="a1" />)

      await userEvent.click(screen.getByRole('button', { name: /add sub-task/i }))
      await screen.findByRole('dialog')

      expect(screen.getByRole('button', { name: /^add sub-task$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^save sub-task$/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-014-AC-09/AC-10: Cancel in create mode closes with no create call', () => {
    it('calls no create and closes the modal', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<SubTaskList activityId="a1" />)

      await userEvent.click(screen.getByRole('button', { name: /add sub-task/i }))
      await screen.findByRole('dialog')

      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(subTaskApi.create).not.toHaveBeenCalled()
    })
  })

  describe('FRONTEND-014-AC-12: a second Add/Rename while open retargets, never a second dialog', () => {
    it('switches from create to rename without stacking a dialog', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" />)

      await userEvent.click(screen.getByRole('button', { name: /add sub-task/i }))
      await screen.findByRole('dialog', { name: /add sub-task/i })

      await userEvent.click(screen.getByRole('button', { name: /^rename$/i }))

      expect(await screen.findByRole('dialog', { name: /rename sub-task/i })).toBeInTheDocument()
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })
  })

  describe('FRONTEND-003-AC-07: successful create adds to the checklist and closes the modal', () => {
    it('shows the new sub-task and closes the dialog', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      vi.mocked(subTaskApi.create).mockResolvedValue({ ...guestList })
      render(<SubTaskList activityId="a1" />)

      await userEvent.click(await screen.findByRole('button', { name: /add sub-task/i }))
      await userEvent.type(screen.getByLabelText(/sub-task name/i), 'Create a guest list')
      await userEvent.click(screen.getByRole('button', { name: /save sub-task/i }))

      expect(await screen.findByText('Create a guest list')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-09: rename is activated and prefills the field', () => {
    it('shows the rename form with the current name', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" />)

      await userEvent.click(await screen.findByRole('button', { name: /rename/i }))

      expect(await screen.findByRole('dialog', { name: /rename sub-task/i })).toBeInTheDocument()
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
      render(<SubTaskList activityId="a1" />)

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
      render(<SubTaskList activityId="a1" />)

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
      render(<SubTaskList activityId="a1" />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

      expect(subTaskApi.remove).toHaveBeenCalledWith('a1', 's1')
      await waitFor(() => expect(screen.queryByText('Create a guest list')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-003-AC-17: empty checklist shows an explanatory message', () => {
    it('renders an empty-state message, not a blank checklist', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<SubTaskList activityId="a1" />)

      expect(await screen.findByText(/no sub-tasks yet/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-18: fetch failure shows an alert with a working Retry control', () => {
    it('re-fetches when Retry is activated', async () => {
      vi.mocked(subTaskApi.getAll)
        .mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Please try again.'))
        .mockResolvedValueOnce([])
      render(<SubTaskList activityId="a1" />)

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
      render(<SubTaskList activityId="a1" />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByText('Create a guest list')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-22: category is shown read-only, never inside a picker', () => {
    it('renders the category label but no CategoryPicker in the add form', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" />)

      expect(await screen.findByText(/pleasurable/i)).toBeInTheDocument()
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-031-AC-07: "Add sub-task" button is primary', () => {
    it('combines styles.addButton with buttonVariants.primary', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<SubTaskList activityId="a1" />)

      const addButton = await screen.findByRole('button', { name: 'Add sub-task' })
      expect(addButton).toHaveClass(styles.addButton)
      expect(addButton).toHaveClass(buttonStyles.primary)
    })
  })

  describe('FRONTEND-031-AC-14: Delete/Confirm delete are destructive; Cancel is not', () => {
    it('applies destructive to Delete and Confirm delete, and no variant to Cancel', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" />)

      const deleteButton = await screen.findByRole('button', { name: 'Delete' })
      expect(deleteButton).toHaveClass(buttonStyles.destructive)

      await userEvent.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: 'Confirm delete' })
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      expect(confirmButton).toHaveClass(buttonStyles.destructive)
      expect(cancelButton).not.toHaveClass(buttonStyles.destructive)
      expect(cancelButton).not.toHaveClass(buttonStyles.primary)
    })
  })

  describe('FRONTEND-031-AC-16: regression guard -- Rename stays unstyled', () => {
    it('leaves Rename with no variant class', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" />)

      const renameButton = await screen.findByRole('button', { name: /rename/i })
      expect(renameButton).not.toHaveClass(buttonStyles.primary)
      expect(renameButton).not.toHaveClass(buttonStyles.destructive)
    })
  })

  describe('FRONTEND-006-AC-15: readOnly hides the create form and per-row Rename/Delete actions', () => {
    it('renders sub-tasks with no create form, Rename, or Delete controls', async () => {
      vi.mocked(subTaskApi.getAll).mockResolvedValue([guestList])
      render(<SubTaskList activityId="a1" readOnly />)

      expect(await screen.findByText('Create a guest list')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /add sub-task/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
    })
  })
})
