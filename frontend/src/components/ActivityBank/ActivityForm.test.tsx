import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
  favourite: false,
  createdAt: '2026-09-28T00:00:00Z',
  subTaskCount: 0,
}

describe('ActivityForm', () => {
  beforeEach(() => {
    vi.mocked(activityApi.create).mockReset()
    vi.mocked(activityApi.update).mockReset()
    vi.mocked(activityApi.markFavourite).mockReset()
    vi.mocked(activityApi.unmarkFavourite).mockReset()
  })

  describe('FRONTEND-002-AC-12: valid create submit calls activityApi.create', () => {
    it('calls create with the entered name, category, and description', async () => {
      vi.mocked(activityApi.create).mockResolvedValue({ ...walk })
      const onSuccess = vi.fn()
      render(<ActivityForm mode="create" onSuccess={onSuccess} />)

      await userEvent.type(screen.getByLabelText(/name/i), 'Walk')
      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

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

      expect(screen.getByLabelText(/repeatable/i, { selector: 'input' })).toBeChecked()

      await userEvent.type(screen.getByLabelText(/^name$/i), 'Walk')
      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

      expect(activityApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ repeatable: true }),
      )
    })
  })

  describe('FRONTEND-006-AC-03: edit mode prefills the repeatable checkbox from the activity', () => {
    it('unchecks when the activity is not repeatable', () => {
      render(<ActivityForm mode="edit" activity={{ ...walk, repeatable: false }} onSuccess={vi.fn()} />)

      expect(screen.getByLabelText(/repeatable/i, { selector: 'input' })).not.toBeChecked()
    })
  })

  describe('FRONTEND-006-AC-04: unchecking repeatable on edit sends repeatable: false', () => {
    it('submits the unchecked state', async () => {
      vi.mocked(activityApi.update).mockResolvedValue({ ...walk, repeatable: false })
      render(<ActivityForm mode="edit" activity={walk} onSuccess={vi.fn()} />)

      await userEvent.click(screen.getByLabelText(/repeatable/i, { selector: 'input' }))
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(activityApi.update).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ repeatable: false }),
      )
    })
  })

  describe('FRONTEND-020-AC-01: shows the repeatable icon when the checkbox is checked', () => {
    it('renders the repeatable icon by default on create (repeatable defaults to true)', () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      expect(screen.getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-020-AC-02: hides the repeatable icon when the checkbox is unchecked', () => {
    it('removes the icon after unchecking the checkbox', async () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      await userEvent.click(screen.getByLabelText(/repeatable/i, { selector: 'input' }))

      expect(screen.queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-020-AC-03: toggling the checkbox live-updates the icon in one interaction', () => {
    it('shows, hides, then shows the icon again across two toggles', async () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      expect(screen.getByRole('img', { name: /repeatable/i })).toBeInTheDocument()

      await userEvent.click(screen.getByLabelText(/repeatable/i, { selector: 'input' }))
      expect(screen.queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()

      await userEvent.click(screen.getByLabelText(/repeatable/i, { selector: 'input' }))
      expect(screen.getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-020-AC-04: shows the icon on initial render in edit mode for a repeatable activity', () => {
    it('renders the icon before any user interaction when editing a repeatable activity', () => {
      render(<ActivityForm mode="edit" activity={{ ...walk, repeatable: true }} onSuccess={vi.fn()} />)

      expect(screen.getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-002-AC-13: blank name blocks submit', () => {
    it('shows an inline validation error and does not call create', async () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      expect(activityApi.create).not.toHaveBeenCalled()
    })
  })

  describe('FRONTEND-002-AC-14: missing category blocks submit', () => {
    it('shows an inline validation error and does not call create', async () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      await userEvent.type(screen.getByLabelText(/name/i), 'Walk')
      await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

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
      await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

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
      await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

      expect(screen.getByRole('button', { name: /save activity/i })).toBeDisabled()
      expect(screen.getByRole('status')).toBeInTheDocument()

      resolveCreate({ ...walk })
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /save activity/i })).not.toBeDisabled(),
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

  describe('TOOLING-003-AC-02: ActivityForm name field error timing', () => {
    it('shows no error until the name field is blurred empty or submit is attempted', () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
      expect(screen.queryByText('Name is required.')).not.toBeInTheDocument()
    })

    it('shows the error and sets aria-invalid after blurring an empty name field', () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
      const name = screen.getByLabelText(/^name$/i)
      fireEvent.focus(name)
      fireEvent.blur(name)
      expect(screen.getByText('Name is required.')).toBeInTheDocument()
      expect(name).toHaveAttribute('aria-invalid', 'true')
    })

    it('clears the error once a non-empty name is entered', async () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
      const name = screen.getByLabelText(/^name$/i)
      fireEvent.blur(name)
      await userEvent.type(name, 'Walk')
      expect(screen.queryByText('Name is required.')).not.toBeInTheDocument()
      expect(name).not.toHaveAttribute('aria-invalid')
    })

    it('shows the error on a bare submit attempt and marks the field required', () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /save activity/i }))
      expect(screen.getByText('Name is required.')).toBeInTheDocument()
      expect(screen.getByLabelText(/^name$/i)).toBeRequired()
    })
  })

  describe('TOOLING-003-AC-03: ActivityForm category group error timing (submit-only)', () => {
    it('shows no category error before a submit attempt, even with no category chosen', async () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
      await userEvent.type(screen.getByLabelText(/^name$/i), 'Walk')
      expect(screen.queryByText(/select a category/i)).not.toBeInTheDocument()
    })

    it('shows the category error only once submit is attempted with none chosen', async () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
      await userEvent.type(screen.getByLabelText(/^name$/i), 'Walk')
      fireEvent.click(screen.getByRole('button', { name: /save activity/i }))
      expect(screen.getByText(/select a category/i)).toBeInTheDocument()
    })

    it('clears the category error once a category is selected', async () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /save activity/i }))
      await userEvent.click(screen.getByLabelText('Routine'))
      expect(screen.queryByText(/select a category/i)).not.toBeInTheDocument()
    })
  })

  describe('TOOLING-003-AC-05: submit stays enabled regardless of validity', () => {
    it('ActivityForm submit button is never disabled by invalid required fields', () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /save activity/i }))
      expect(screen.getByRole('button', { name: /save activity/i })).toBeEnabled()
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

  describe('FRONTEND-027-AC-17: favourite toggle is prefilled from the activity, unchecked on create', () => {
    it('is unchecked by default on create', () => {
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
      expect(screen.getByLabelText(/^favourite$/i, { selector: 'input' })).not.toBeChecked()
    })

    it('is checked in edit mode when the activity is favourited', () => {
      render(<ActivityForm mode="edit" activity={{ ...walk, favourite: true }} onSuccess={vi.fn()} />)
      expect(screen.getByLabelText(/^favourite$/i, { selector: 'input' })).toBeChecked()
    })

    it('is unchecked in edit mode when the activity is not favourited', () => {
      render(<ActivityForm mode="edit" activity={walk} onSuccess={vi.fn()} />)
      expect(screen.getByLabelText(/^favourite$/i, { selector: 'input' })).not.toBeChecked()
    })
  })

  describe('FRONTEND-027-AC-18: turning the favourite toggle on calls markFavourite after create/update succeeds', () => {
    it('calls markFavourite with the created activity\'s id on create', async () => {
      vi.mocked(activityApi.create).mockResolvedValue({ ...walk, favourite: false })
      vi.mocked(activityApi.markFavourite).mockResolvedValue({ ...walk, favourite: true })
      const onSuccess = vi.fn()
      render(<ActivityForm mode="create" onSuccess={onSuccess} />)

      await userEvent.type(screen.getByLabelText(/^name$/i), 'Walk')
      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByLabelText(/^favourite$/i, { selector: 'input' }))
      await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

      await waitFor(() => expect(activityApi.markFavourite).toHaveBeenCalledWith('1'))
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ favourite: true }))
    })

    it('calls markFavourite with the edited activity\'s id on update', async () => {
      vi.mocked(activityApi.update).mockResolvedValue({ ...walk, favourite: false })
      vi.mocked(activityApi.markFavourite).mockResolvedValue({ ...walk, favourite: true })
      render(<ActivityForm mode="edit" activity={walk} onSuccess={vi.fn()} />)

      await userEvent.click(screen.getByLabelText(/^favourite$/i, { selector: 'input' }))
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => expect(activityApi.markFavourite).toHaveBeenCalledWith('1'))
    })
  })

  describe('FRONTEND-027-AC-19: turning the favourite toggle off calls unmarkFavourite after update succeeds', () => {
    it('calls unmarkFavourite with the edited activity\'s id', async () => {
      vi.mocked(activityApi.update).mockResolvedValue({ ...walk, favourite: true })
      vi.mocked(activityApi.unmarkFavourite).mockResolvedValue(undefined)
      render(<ActivityForm mode="edit" activity={{ ...walk, favourite: true }} onSuccess={vi.fn()} />)

      await userEvent.click(screen.getByLabelText(/^favourite$/i, { selector: 'input' }))
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => expect(activityApi.unmarkFavourite).toHaveBeenCalledWith('1'))
    })
  })

  describe('FRONTEND-027-AC-20: an unchanged favourite state calls neither mark nor unmark endpoint', () => {
    it('does not call markFavourite/unmarkFavourite when the toggle is left as-is on create', async () => {
      vi.mocked(activityApi.create).mockResolvedValue({ ...walk, favourite: false })
      render(<ActivityForm mode="create" onSuccess={vi.fn()} />)

      await userEvent.type(screen.getByLabelText(/^name$/i), 'Walk')
      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

      await waitFor(() => expect(activityApi.create).toHaveBeenCalled())
      expect(activityApi.markFavourite).not.toHaveBeenCalled()
      expect(activityApi.unmarkFavourite).not.toHaveBeenCalled()
    })

    it('does not call markFavourite/unmarkFavourite when editing an already-favourited activity unchanged', async () => {
      vi.mocked(activityApi.update).mockResolvedValue({ ...walk, favourite: true, name: 'Walk further' })
      render(<ActivityForm mode="edit" activity={{ ...walk, favourite: true }} onSuccess={vi.fn()} />)

      await userEvent.clear(screen.getByLabelText(/^name$/i))
      await userEvent.type(screen.getByLabelText(/^name$/i), 'Walk further')
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => expect(activityApi.update).toHaveBeenCalled())
      expect(activityApi.markFavourite).not.toHaveBeenCalled()
      expect(activityApi.unmarkFavourite).not.toHaveBeenCalled()
    })
  })
})
