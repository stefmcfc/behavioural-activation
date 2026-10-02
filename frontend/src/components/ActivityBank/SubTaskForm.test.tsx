import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SubTaskForm } from './SubTaskForm'
import { subTaskApi } from '../../services/subTaskApi'
import type { SubTask } from '../../types/subTask'
import buttonStyles from '../../styles/buttonVariants.module.css'

vi.mock('../../services/subTaskApi')

const guestList: SubTask = {
  id: 's1',
  activityId: 'a1',
  name: 'Create a guest list',
  category: 'PLEASURABLE',
  createdAt: '2026-09-29T00:00:00Z',
}

describe('SubTaskForm', () => {
  beforeEach(() => {
    vi.mocked(subTaskApi.create).mockReset()
    vi.mocked(subTaskApi.update).mockReset()
  })

  describe('FRONTEND-003-AC-05: valid add submit calls subTaskApi.create', () => {
    it('calls create with the parent activity id and entered name', async () => {
      vi.mocked(subTaskApi.create).mockResolvedValue({ ...guestList })
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} />)

      await userEvent.type(screen.getByLabelText(/sub-task name/i), 'Create a guest list')
      await userEvent.click(screen.getByRole('button', { name: /save sub-task/i }))

      expect(subTaskApi.create).toHaveBeenCalledWith('a1', { name: 'Create a guest list' })
    })
  })

  describe('FRONTEND-003-AC-06: blank name blocks add submit', () => {
    it('shows an inline validation error and does not call create', async () => {
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} />)

      await userEvent.click(screen.getByRole('button', { name: /save sub-task/i }))

      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      expect(subTaskApi.create).not.toHaveBeenCalled()
    })
  })

  describe('FRONTEND-003-AC-08: in-flight create disables submit and shows a loading indicator', () => {
    it('disables the button and shows a status while pending', async () => {
      let resolveCreate: (value: SubTask) => void = () => {}
      vi.mocked(subTaskApi.create).mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve
        }),
      )
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} />)

      await userEvent.type(screen.getByLabelText(/sub-task name/i), 'Create a guest list')
      await userEvent.click(screen.getByRole('button', { name: /save sub-task/i }))

      expect(screen.getByRole('button', { name: /save sub-task/i })).toBeDisabled()
      expect(screen.getByRole('status')).toBeInTheDocument()

      resolveCreate({ ...guestList })
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /save sub-task/i })).not.toBeDisabled(),
      )
    })
  })

  describe('FRONTEND-003-AC-09: rename form prefills from the given sub-task', () => {
    it('shows the current name in the field', () => {
      render(<SubTaskForm mode="edit" activityId="a1" subTask={guestList} onSuccess={vi.fn()} />)

      expect(screen.getByLabelText(/sub-task name/i)).toHaveValue('Create a guest list')
    })
  })

  describe('FRONTEND-003-AC-10: valid rename submit calls subTaskApi.update', () => {
    it('calls update with the activity id, sub-task id, and edited name', async () => {
      vi.mocked(subTaskApi.update).mockResolvedValue({
        ...guestList,
        name: 'Create and send a guest list',
      })
      render(<SubTaskForm mode="edit" activityId="a1" subTask={guestList} onSuccess={vi.fn()} />)

      await userEvent.clear(screen.getByLabelText(/sub-task name/i))
      await userEvent.type(screen.getByLabelText(/sub-task name/i), 'Create and send a guest list')
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(subTaskApi.update).toHaveBeenCalledWith('a1', 's1', {
        name: 'Create and send a guest list',
      })
    })
  })

  describe('FRONTEND-003-AC-11: blank name blocks rename submit', () => {
    it('shows an inline validation error and does not call update', async () => {
      render(<SubTaskForm mode="edit" activityId="a1" subTask={guestList} onSuccess={vi.fn()} />)

      await userEvent.clear(screen.getByLabelText(/sub-task name/i))
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      expect(subTaskApi.update).not.toHaveBeenCalled()
    })
  })

  describe('TOOLING-003-AC-04: SubTaskForm name field error timing', () => {
    it('shows no error until the name field is blurred empty or submit is attempted', () => {
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} />)
      expect(screen.queryByText('Name is required.')).not.toBeInTheDocument()
    })

    it('shows the error and sets aria-invalid after blurring an empty name field', () => {
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} />)
      const name = screen.getByLabelText(/sub-task name/i)
      fireEvent.focus(name)
      fireEvent.blur(name)
      expect(screen.getByText('Name is required.')).toBeInTheDocument()
      expect(name).toHaveAttribute('aria-invalid', 'true')
    })

    it('clears the error once a non-empty name is entered', async () => {
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} />)
      const name = screen.getByLabelText(/sub-task name/i)
      fireEvent.blur(name)
      await userEvent.type(name, 'Create a guest list')
      expect(screen.queryByText('Name is required.')).not.toBeInTheDocument()
      expect(name).not.toHaveAttribute('aria-invalid')
    })

    it('shows the error on a bare submit attempt and marks the field required', () => {
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /save sub-task/i }))
      expect(screen.getByText('Name is required.')).toBeInTheDocument()
      expect(screen.getByLabelText(/sub-task name/i)).toBeRequired()
    })
  })

  describe('TOOLING-003-AC-05: submit stays enabled regardless of validity', () => {
    it('SubTaskForm submit button is never disabled by invalid required fields', () => {
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /save sub-task/i }))
      expect(screen.getByRole('button', { name: /save sub-task/i })).toBeEnabled()
    })
  })

  describe('FRONTEND-003-AC-19: create failure shows an alert and preserves the entered name', () => {
    it('displays the error and keeps the field value', async () => {
      vi.mocked(subTaskApi.create).mockRejectedValue({ status: 500, message: 'Server error' })
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} />)

      await userEvent.type(screen.getByLabelText(/sub-task name/i), 'Create a guest list')
      await userEvent.click(screen.getByRole('button', { name: /save sub-task/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByLabelText(/sub-task name/i)).toHaveValue('Create a guest list')
    })
  })

  describe('FRONTEND-003-AC-20: rename failure shows an alert and stays in rename mode', () => {
    it('displays the error and keeps the entered value', async () => {
      vi.mocked(subTaskApi.update).mockRejectedValue({ status: 500, message: 'Server error' })
      render(<SubTaskForm mode="edit" activityId="a1" subTask={guestList} onSuccess={vi.fn()} />)

      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByLabelText(/sub-task name/i)).toHaveValue('Create a guest list')
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-22: renders no CategoryPicker in either mode', () => {
    it('has no radio inputs in create mode', () => {
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} />)
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    })

    it('has no radio inputs in edit mode', () => {
      render(<SubTaskForm mode="edit" activityId="a1" subTask={guestList} onSuccess={vi.fn()} />)
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-031-AC-10: submit button is primary; Cancel is not', () => {
    it('applies primary to the create-mode submit button', () => {
      render(<SubTaskForm mode="create" activityId="a1" onSuccess={vi.fn()} onCancel={vi.fn()} />)
      expect(screen.getByRole('button', { name: /save sub-task/i })).toHaveClass(buttonStyles.primary)
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).not.toHaveClass(buttonStyles.primary)
      expect(cancelButton).not.toHaveClass(buttonStyles.destructive)
    })

    it('applies primary to the edit-mode submit button', () => {
      render(<SubTaskForm mode="edit" activityId="a1" subTask={guestList} onSuccess={vi.fn()} />)
      expect(screen.getByRole('button', { name: /save changes/i })).toHaveClass(buttonStyles.primary)
    })
  })
})
