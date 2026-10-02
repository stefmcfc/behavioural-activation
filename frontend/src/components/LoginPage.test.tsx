import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginPage } from './LoginPage'
import { authApi } from '../services/authApi'
import type { User } from '../types/auth'
import styles from './LoginPage.module.css'
import buttonStyles from '../styles/buttonVariants.module.css'

vi.mock('../services/authApi')

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset()
  })

  describe('FRONTEND-007-AC-27: login page uses the layout shell', () => {
    it('applies the shell class to its wrapping element', () => {
      render(<LoginPage onLoginSuccess={() => {}} />)

      expect(screen.getByRole('heading', { name: /log in/i }).closest(`.${styles.shell}`)).not.toBeNull()
    })
  })

  describe('FRONTEND-029-AC-04: session-expired notice', () => {
    it('shows the session-expired notice when sessionExpired is true', () => {
      render(<LoginPage onLoginSuccess={vi.fn()} sessionExpired />)
      expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
    })

    it('shows no notice when sessionExpired is false', () => {
      render(<LoginPage onLoginSuccess={vi.fn()} sessionExpired={false} />)
      expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
    })

    it('shows no notice when sessionExpired is omitted', () => {
      render(<LoginPage onLoginSuccess={vi.fn()} />)
      expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-001-AC-03/AC-04: valid submit logs in and signals success', () => {
    it('calls authApi.login and onLoginSuccess when the form is valid', async () => {
      vi.mocked(authApi.login).mockResolvedValue({ username: 'steve' })
      const onLoginSuccess = vi.fn()
      render(<LoginPage onLoginSuccess={onLoginSuccess} />)

      await userEvent.type(screen.getByLabelText(/username/i), 'steve')
      await userEvent.type(screen.getByLabelText(/password/i), 'correct-horse')
      await userEvent.click(screen.getByRole('button', { name: /log in/i }))

      await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith('steve'))
      expect(authApi.login).toHaveBeenCalledWith({ username: 'steve', password: 'correct-horse' })
    })
  })

  describe('FRONTEND-001-AC-05: failed login shows an alert, stays on the form', () => {
    it('displays the error and does not call onLoginSuccess', async () => {
      vi.mocked(authApi.login).mockRejectedValue({ status: 401, message: 'Invalid credentials' })
      const onLoginSuccess = vi.fn()
      render(<LoginPage onLoginSuccess={onLoginSuccess} />)

      await userEvent.type(screen.getByLabelText(/username/i), 'steve')
      await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
      await userEvent.click(screen.getByRole('button', { name: /log in/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/invalid credentials/i)
      expect(onLoginSuccess).not.toHaveBeenCalled()
    })
  })

  describe('FRONTEND-001-AC-06: in-flight state disables submit and shows a loading indicator', () => {
    it('disables the button and shows role="status" while the request is pending', async () => {
      let resolveLogin: (value: User) => void = () => {}
      vi.mocked(authApi.login).mockReturnValue(
        new Promise((resolve) => {
          resolveLogin = resolve
        }),
      )
      render(<LoginPage onLoginSuccess={vi.fn()} />)

      await userEvent.type(screen.getByLabelText(/username/i), 'steve')
      await userEvent.type(screen.getByLabelText(/password/i), 'secret')
      await userEvent.click(screen.getByRole('button', { name: /log in/i }))

      expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled()
      expect(screen.getByRole('status')).toBeInTheDocument()

      resolveLogin({ username: 'steve' })
      await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled())
    })
  })

  describe('FRONTEND-001-AC-07: blank fields validate without calling the API', () => {
    it('shows an inline error and does not call authApi.login', async () => {
      render(<LoginPage onLoginSuccess={vi.fn()} />)
      await userEvent.click(screen.getByRole('button', { name: /log in/i }))
      expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0)
      expect(authApi.login).not.toHaveBeenCalled()
    })
  })

  describe('TOOLING-003-AC-01: LoginPage required-field error timing', () => {
    it('shows no error on initial render', () => {
      render(<LoginPage onLoginSuccess={vi.fn()} />)
      expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
    })

    it('shows the error and sets aria-invalid after blurring an empty username field', () => {
      render(<LoginPage onLoginSuccess={vi.fn()} />)
      const username = screen.getByLabelText('Username')
      fireEvent.focus(username)
      fireEvent.blur(username)
      expect(screen.getByText(/username.*required/i)).toBeInTheDocument()
      expect(username).toHaveAttribute('aria-invalid', 'true')
    })

    it('shows the error and sets aria-invalid after blurring an empty password field', () => {
      render(<LoginPage onLoginSuccess={vi.fn()} />)
      const password = screen.getByLabelText('Password')
      fireEvent.focus(password)
      fireEvent.blur(password)
      expect(screen.getByText(/password.*required/i)).toBeInTheDocument()
      expect(password).toHaveAttribute('aria-invalid', 'true')
    })

    it('clears the error once a value is entered', async () => {
      render(<LoginPage onLoginSuccess={vi.fn()} />)
      const username = screen.getByLabelText('Username')
      fireEvent.blur(username)
      await userEvent.type(username, 'steve')
      expect(screen.queryByText(/username.*required/i)).not.toBeInTheDocument()
      expect(username).not.toHaveAttribute('aria-invalid')
    })

    it('shows all empty required field errors on a bare submit attempt', () => {
      render(<LoginPage onLoginSuccess={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
      expect(screen.getByText(/username.*required/i)).toBeInTheDocument()
      expect(screen.getByText(/password.*required/i)).toBeInTheDocument()
    })

    it('marks both fields as required', () => {
      render(<LoginPage onLoginSuccess={vi.fn()} />)
      expect(screen.getByLabelText('Username')).toBeRequired()
      expect(screen.getByLabelText('Password')).toBeRequired()
    })
  })

  describe('TOOLING-003-AC-05: submit stays enabled regardless of validity', () => {
    it('keeps the Log in button enabled after a submit attempt with both fields empty', () => {
      render(<LoginPage onLoginSuccess={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
      expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
    })
  })

  describe('FRONTEND-031-AC-09: "Log in" submit button is primary', () => {
    it('gains buttonVariants.primary', () => {
      render(<LoginPage onLoginSuccess={vi.fn()} />)
      expect(screen.getByRole('button', { name: 'Log in' })).toHaveClass(buttonStyles.primary)
    })
  })
})
