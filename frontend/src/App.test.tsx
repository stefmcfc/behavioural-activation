import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'
import { authApi } from './services/authApi'
import { activityApi } from './services/activityApi'
import { planApi } from './services/planApi'
import type { User } from './types/auth'

vi.mock('./services/authApi')
vi.mock('./services/activityApi')
vi.mock('./services/planApi')

describe('App', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockReset()
    vi.mocked(authApi.logout).mockReset()
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    vi.mocked(planApi.getWeek).mockReset()
    vi.mocked(planApi.getWeek).mockResolvedValue([])
  })

  describe('FRONTEND-001-AC-08/AC-09: session check on mount', () => {
    it('calls authApi.me and shows a loading state while it is in flight', async () => {
      let resolveMe: (value: User) => void = () => {}
      vi.mocked(authApi.me).mockReturnValue(
        new Promise((resolve) => {
          resolveMe = resolve
        }),
      )

      render(<App />)

      expect(authApi.me).toHaveBeenCalled()
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /log in/i })).not.toBeInTheDocument()

      resolveMe({ username: 'steve' })
      await screen.findByText(/steve/i)
    })
  })

  describe('FRONTEND-001-AC-10/AC-11: App session gate', () => {
    it('renders LoginPage when the session check returns 401', async () => {
      vi.mocked(authApi.me).mockRejectedValue({ status: 401 })
      render(<App />)
      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
    })

    it('renders the authenticated placeholder when the session check succeeds', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(<App />)
      expect(await screen.findByText(/steve/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-001-AC-12: logout returns to LoginPage', () => {
    it('calls authApi.logout and renders LoginPage again', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      vi.mocked(authApi.logout).mockResolvedValue(undefined)
      render(<App />)

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('button', { name: /log out/i }))

      await waitFor(() => expect(authApi.logout).toHaveBeenCalled())
      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
    })
  })
})
