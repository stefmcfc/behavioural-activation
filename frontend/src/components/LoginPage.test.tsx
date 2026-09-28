import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginPage } from './LoginPage'
import { authApi } from '../services/authApi'
import type { User } from '../types/auth'

vi.mock('../services/authApi')

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset()
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
      expect(screen.getByText(/required/i)).toBeInTheDocument()
      expect(authApi.login).not.toHaveBeenCalled()
    })
  })
})
