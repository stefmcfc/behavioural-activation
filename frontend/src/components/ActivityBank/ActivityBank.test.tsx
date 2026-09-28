import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivityBank } from './ActivityBank'
import { activityApi } from '../../services/activityApi'
import type { Activity } from '../../types/activity'

vi.mock('../../services/activityApi')

const walk: Activity = {
  id: '1',
  name: 'Walk',
  category: 'ROUTINE',
  description: 'Around the block',
  createdAt: '2026-09-28T00:00:00Z',
}

describe('ActivityBank', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(activityApi.create).mockReset()
    vi.mocked(activityApi.update).mockReset()
    vi.mocked(activityApi.remove).mockReset()
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
})
