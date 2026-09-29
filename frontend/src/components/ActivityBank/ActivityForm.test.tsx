import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivityForm } from './ActivityForm'
import { activityApi } from '../../services/activityApi'
import type { Activity } from '../../types/activity'

vi.mock('../../services/activityApi')

const walk: Activity = {
  id: '1',
  name: 'Walk',
  category: 'ROUTINE',
  description: 'Around the block',
  repeatable: true,
  archived: false,
  createdAt: '2026-09-28T00:00:00Z',
}

describe('ActivityForm', () => {
  beforeEach(() => {
    vi.mocked(activityApi.create).mockReset()
    vi.mocked(activityApi.update).mockReset()
  })

  describe('FRONTEND-002-AC-12: valid create submit calls activityApi.create', () => {
    it('calls create with the entered name, category, and description', async () => {
      vi.mocked(activityApi.create).mockResolvedValue({ ...walk })
      const onSuccess = vi.fn()
      render(<ActivityForm mode="create" onSuccess={onSuccess} />)

      await userEvent.type(screen.getByLabelText(/name/i), 'Walk')
      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

      expect(activityApi.create).toHaveBeenCalledWith({
        name: 'Walk',
        category: 'ROUTINE',
        description: null,
        repeatable: true,
      })
    })
  })

  describe('FRONTEND-006-AC-01/AC-02: repeatable checkbox defaults checked and is sent on create', () => {
    it('is checked by default and submits repeatable: true', async () => {
      vi.mocked(activityApi.create).mockResolvedValue({ ...walk })
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      expect(screen.getByLabelText(/repeatable/i)).toBeChecked()

      await userEvent.type(screen.getByLabelText(/^name$/i), 'Walk')
      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

      expect(activityApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ repeatable: true }),
      )
    })
  })

  describe('FRONTEND-006-AC-03: edit mode prefills the repeatable checkbox from the activity', () => {
    it('unchecks when the activity is not repeatable', () => {
      render(<ActivityForm mode="edit" activity={{ ...walk, repeatable: false }} onSuccess={vi.fn()} />)

      expect(screen.getByLabelText(/repeatable/i)).not.toBeChecked()
    })
  })

  describe('FRONTEND-006-AC-04: unchecking repeatable on edit sends repeatable: false', () => {
    it('submits the unchecked state', async () => {
      vi.mocked(activityApi.update).mockResolvedValue({ ...walk, repeatable: false })
      render(<ActivityForm mode="edit" activity={walk} onSuccess={vi.fn()} />)

      await userEvent.click(screen.getByLabelText(/repeatable/i))
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(activityApi.update).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ repeatable: false }),
      )
    })
  })

  describe('FRONTEND-002-AC-13: blank name blocks submit', () => {
    it('shows an inline validation error and does not call create', async () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      expect(activityApi.create).not.toHaveBeenCalled()
    })
  })

  describe('FRONTEND-002-AC-14: missing category blocks submit', () => {
    it('shows an inline validation error and does not call create', async () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      await userEvent.type(screen.getByLabelText(/name/i), 'Walk')
      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

      expect(screen.getByText(/select a category/i)).toBeInTheDocument()
      expect(activityApi.create).not.toHaveBeenCalled()
    })
  })

  describe('FRONTEND-002-AC-16: create failure shows an alert and preserves entered values', () => {
    it('displays the error and keeps the field values', async () => {
      vi.mocked(activityApi.create).mockRejectedValue({ status: 500, message: 'Server error' })
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      await userEvent.type(screen.getByLabelText(/name/i), 'Walk')
      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByLabelText(/name/i)).toHaveValue('Walk')
      expect(screen.getByLabelText(/routine/i)).toBeChecked()
    })
  })

  describe('FRONTEND-002-AC-17: in-flight create disables submit and shows a loading indicator', () => {
    it('disables the button and shows a status while pending', async () => {
      let resolveCreate: (value: Activity) => void = () => {}
      vi.mocked(activityApi.create).mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve
        }),
      )
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      await userEvent.type(screen.getByLabelText(/name/i), 'Walk')
      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

      expect(screen.getByRole('button', { name: /add activity/i })).toBeDisabled()
      expect(screen.getByRole('status')).toBeInTheDocument()

      resolveCreate({ ...walk })
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /add activity/i })).not.toBeDisabled(),
      )
    })
  })

  describe('FRONTEND-002-AC-18: edit mode prefills from the given activity', () => {
    it('shows the current name, category, and description', () => {
      render(<ActivityForm mode="edit" activity={walk} onSuccess={vi.fn()} />)

      expect(screen.getByLabelText(/name/i)).toHaveValue('Walk')
      expect(screen.getByLabelText(/description/i)).toHaveValue('Around the block')
      expect(screen.getByLabelText(/routine/i)).toBeChecked()
    })
  })

  describe('FRONTEND-002-AC-19: valid edit submit calls activityApi.update', () => {
    it('calls update with the activity id and edited fields', async () => {
      vi.mocked(activityApi.update).mockResolvedValue({ ...walk, name: 'Walk further' })
      render(<ActivityForm mode="edit" activity={walk} onSuccess={vi.fn()} />)

      await userEvent.clear(screen.getByLabelText(/name/i))
      await userEvent.type(screen.getByLabelText(/name/i), 'Walk further')
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(activityApi.update).toHaveBeenCalledWith('1', {
        name: 'Walk further',
        category: 'ROUTINE',
        description: 'Around the block',
        repeatable: true,
      })
    })
  })

  describe('FRONTEND-002-AC-21: edit failure shows an alert and stays in edit mode', () => {
    it('displays the error and keeps the entered values', async () => {
      vi.mocked(activityApi.update).mockRejectedValue({ status: 500, message: 'Server error' })
      render(<ActivityForm mode="edit" activity={walk} onSuccess={vi.fn()} />)

      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByLabelText(/name/i)).toHaveValue('Walk')
    })
  })
})
