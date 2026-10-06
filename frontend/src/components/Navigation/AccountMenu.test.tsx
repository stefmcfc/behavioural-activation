import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './AccountMenu'
import { authApi } from '../../services/authApi'
import { ApiError } from '../../types/api'
import buttonStyles from '../../styles/buttonVariants.module.css'

vi.mock('../../services/authApi')

// FRONTEND-050 (modal follow-up): the form now lives in a real <dialog> (Modal), opened via a
// "Change password" trigger inside the Account popover -- both steps are needed to reach the
// fields, mirroring how every other Modal-wrapped form in this app is reached from its own
// trigger (e.g. ActivityBank's "Add activity").
async function openChangePasswordDialog() {
  // Cancelling/closing the dialog only closes the dialog, not the Account popover behind it (that's
  // fine UX -- it's reasonable for the popover to still be open after dismissing the dialog it
  // triggered). The Account trigger is a native popover toggle button though -- clicking it while
  // the popover's already open would close it instead, so only click it if the panel isn't already
  // showing (detected via the trigger it contains).
  if (!screen.queryByRole('button', { name: 'Change password' })) {
    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
  }
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
}

// Disambiguates the dialog's own submit button from the popover's "Change password" trigger
// (same accessible name, both potentially present in jsdom's accessibility tree at once).
function submitButton() {
  return within(screen.getByRole('dialog')).getByRole('button', { name: 'Change password' })
}

describe('FRONTEND-030: AccountMenu popover', () => {
  describe('FRONTEND-030-AC-07: opens to show the username and a Log out button', () => {
    it('shows the username and a Log out button after clicking the trigger', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)

      // Note: deliberately not asserting the panel's absence pre-click via getByText here --
      // testing-library's text queries don't filter on CSS visibility (unlike getByRole, which
      // does), so they can't distinguish "closed" (display: none) from "open" in this jsdom
      // polyfill. getByRole('button', { name: 'Log out' }) below does correctly reflect open vs
      // closed state, which is what AC-05's test exercises for the Settings popover.
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))

      expect(screen.getByText('steve')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-030-AC-08: logging out calls the provided handler', () => {
    it('calls onLogout when "Log out" is clicked', async () => {
      const onLogout = vi.fn()
      render(<AccountMenu username="steve" onLogout={onLogout} onPasswordChanged={vi.fn()} />)

      await userEvent.click(screen.getByRole('button', { name: 'Account' }))
      await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

      expect(onLogout).toHaveBeenCalled()
    })
  })

  describe('FRONTEND-031-AC-16: regression guard -- "Log out" stays unstyled', () => {
    it('leaves the Log out button with no variant class', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)

      await userEvent.click(screen.getByRole('button', { name: 'Account' }))
      const logoutButton = screen.getByRole('button', { name: 'Log out' })
      expect(logoutButton).not.toHaveClass(buttonStyles.primary)
      expect(logoutButton).not.toHaveClass(buttonStyles.destructive)
    })
  })

  describe('FRONTEND-031-AC-15: regression guard -- trigger stays unstyled', () => {
    it('leaves the Account trigger with no variant class', () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)

      const trigger = screen.getByRole('button', { name: 'Account' })
      expect(trigger).not.toHaveClass(buttonStyles.primary)
      expect(trigger).not.toHaveClass(buttonStyles.destructive)
    })
  })
})

describe('FRONTEND-050: Change password', () => {
  describe('modal follow-up: Change password opens a real dialog, not an inline popover form', () => {
    it('renders a "Change password" trigger in the Account popover, with no dialog open yet', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))

      expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('opens a dialog labelled "Change password" when the trigger is activated', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await openChangePasswordDialog()

      expect(screen.getByRole('dialog', { name: 'Change password' })).toBeInTheDocument()
    })

    it('Cancel closes the dialog and resets the form', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await openChangePasswordDialog()
      await userEvent.type(screen.getByLabelText(/current password/i), 'partially typed')

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await openChangePasswordDialog()
      expect(screen.getByLabelText(/current password/i)).toHaveValue('')
    })
  })

  describe('FRONTEND-050-AC-01: Change password form renders with validation timing matching LoginPage', () => {
    it('shows the three fields and no error until a field is blurred empty or submit is attempted', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await openChangePasswordDialog()

      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
      expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
    })

    it('shows the error and sets aria-invalid after blurring an empty current password field', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await openChangePasswordDialog()

      const currentPassword = screen.getByLabelText(/current password/i)
      fireEvent.focus(currentPassword)
      fireEvent.blur(currentPassword)

      expect(screen.getByText(/current password.*required/i)).toBeInTheDocument()
      expect(currentPassword).toHaveAttribute('aria-invalid', 'true')
    })

    it('clears the required error once a value is entered', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await openChangePasswordDialog()

      const currentPassword = screen.getByLabelText(/current password/i)
      fireEvent.blur(currentPassword)
      await userEvent.type(currentPassword, 'secret')

      expect(screen.queryByText(/current password.*required/i)).not.toBeInTheDocument()
      expect(currentPassword).not.toHaveAttribute('aria-invalid')
    })

    it('shows all empty required field errors on a bare submit attempt', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await openChangePasswordDialog()

      await userEvent.click(submitButton())

      expect(screen.getByText(/current password.*required/i)).toBeInTheDocument()
      expect(screen.getByText(/^new password.*required/i)).toBeInTheDocument()
      expect(screen.getByText(/confirm new password.*required/i)).toBeInTheDocument()
      expect(authApi.changePassword).not.toHaveBeenCalled()
    })
  })

  describe('FRONTEND-050-AC-02: mismatched new password and confirmation blocks submit', () => {
    it('shows an error and does not call the API when the two new-password fields differ', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await openChangePasswordDialog()

      await userEvent.type(screen.getByLabelText(/current password/i), 'old-password')
      await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-1')
      await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-2')
      await userEvent.click(submitButton())

      expect(await screen.findByText(/passwords don't match/i)).toBeInTheDocument()
      expect(authApi.changePassword).not.toHaveBeenCalled()
    })
  })

  describe('FRONTEND-050-AC-03: a successful password change logs out with a confirmation message', () => {
    it('calls onPasswordChanged after a successful change', async () => {
      vi.mocked(authApi.changePassword).mockResolvedValue(undefined)
      const onPasswordChanged = vi.fn()
      render(
        <AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={onPasswordChanged} />,
      )
      await openChangePasswordDialog()

      await userEvent.type(screen.getByLabelText(/current password/i), 'old-password')
      await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-123')
      await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-123')
      await userEvent.click(submitButton())

      await vi.waitFor(() => expect(onPasswordChanged).toHaveBeenCalled())
      expect(authApi.changePassword).toHaveBeenCalledWith('old-password', 'new-password-123')
    })
  })

  describe('FRONTEND-050-AC-04: a failed change shows an error, user stays logged in', () => {
    it('shows an error and does not log out on failure', async () => {
      vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError(401, 'Invalid credentials'))
      const onPasswordChanged = vi.fn()
      render(
        <AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={onPasswordChanged} />,
      )
      await openChangePasswordDialog()

      await userEvent.type(screen.getByLabelText(/current password/i), 'wrong-password')
      await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-123')
      await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-123')
      await userEvent.click(submitButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(/invalid credentials/i)
      expect(onPasswordChanged).not.toHaveBeenCalled()
    })
  })
})
