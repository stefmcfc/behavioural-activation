import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './AccountMenu'
import { authApi } from '../../services/authApi'
import { ApiError } from '../../types/api'
import buttonStyles from '../../styles/buttonVariants.module.css'

vi.mock('../../services/authApi')

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

describe('FRONTEND-050: Change password form in the Account popover', () => {
  describe('FRONTEND-050-AC-01: Change password form renders with validation timing matching LoginPage', () => {
    it('shows the three fields and no error until a field is blurred empty or submit is attempted', () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)

      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
      expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
    })

    it('shows the error and sets aria-invalid after blurring an empty current password field', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))

      const currentPassword = screen.getByLabelText(/current password/i)
      fireEvent.focus(currentPassword)
      fireEvent.blur(currentPassword)

      expect(screen.getByText(/current password.*required/i)).toBeInTheDocument()
      expect(currentPassword).toHaveAttribute('aria-invalid', 'true')
    })

    it('clears the required error once a value is entered', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))

      const currentPassword = screen.getByLabelText(/current password/i)
      fireEvent.blur(currentPassword)
      await userEvent.type(currentPassword, 'secret')

      expect(screen.queryByText(/current password.*required/i)).not.toBeInTheDocument()
      expect(currentPassword).not.toHaveAttribute('aria-invalid')
    })

    it('shows all empty required field errors on a bare submit attempt', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))

      await userEvent.click(screen.getByRole('button', { name: /change password/i }))

      expect(screen.getByText(/current password.*required/i)).toBeInTheDocument()
      expect(screen.getByText(/^new password.*required/i)).toBeInTheDocument()
      expect(screen.getByText(/confirm new password.*required/i)).toBeInTheDocument()
      expect(authApi.changePassword).not.toHaveBeenCalled()
    })
  })

  describe('FRONTEND-050-AC-02: mismatched new password and confirmation blocks submit', () => {
    it('shows an error and does not call the API when the two new-password fields differ', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))

      await userEvent.type(screen.getByLabelText(/current password/i), 'old-password')
      await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-1')
      await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-2')
      await userEvent.click(screen.getByRole('button', { name: /change password/i }))

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
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))

      await userEvent.type(screen.getByLabelText(/current password/i), 'old-password')
      await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-123')
      await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-123')
      await userEvent.click(screen.getByRole('button', { name: /change password/i }))

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
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))

      await userEvent.type(screen.getByLabelText(/current password/i), 'wrong-password')
      await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-123')
      await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-123')
      await userEvent.click(screen.getByRole('button', { name: /change password/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/invalid credentials/i)
      expect(onPasswordChanged).not.toHaveBeenCalled()
    })
  })
})
