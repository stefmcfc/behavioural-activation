import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
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

      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

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
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )
      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
    })

    it('renders the authenticated placeholder when the session check succeeds', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )
      expect(await screen.findByText(/steve/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-001-AC-12: logout returns to LoginPage', () => {
    it('calls authApi.logout and renders LoginPage again', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      vi.mocked(authApi.logout).mockResolvedValue(undefined)
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('button', { name: /log out/i }))

      await waitFor(() => expect(authApi.logout).toHaveBeenCalled())
      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-005-AC-01/AC-02/AC-03: tab nav renders, navigates, marks the active tab', () => {
    beforeEach(() => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
    })

    it('renders three tabs and marks Activities as aria-current on the default route', async () => {
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)

      expect(screen.getByRole('link', { name: /activities/i })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(screen.getByRole('link', { name: /weekly planner/i })).not.toHaveAttribute(
        'aria-current',
      )
    })

    it('navigates to /planner and marks it active when its tab is clicked', async () => {
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('link', { name: /weekly planner/i }))

      expect(await screen.findByRole('link', { name: /weekly planner/i })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(screen.getByRole('heading', { name: /weekly planner/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-005-AC-04: root redirects to /activities', () => {
    it('renders the Activities tab as active when loaded at /', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)

      await waitFor(() =>
        expect(screen.getByRole('link', { name: /activities/i })).toHaveAttribute(
          'aria-current',
          'page',
        ),
      )
    })
  })

  describe('FRONTEND-005-AC-05: shared header persists across tab switches', () => {
    it('keeps "Logged in as" visible after switching tabs', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('link', { name: /settings/i }))

      expect(screen.getByText(/logged in as/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-005-AC-06: browser back returns to the previous tab', () => {
    it('renders /activities again after Back following a switch to /planner', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      const router = createMemoryRouter(
        [{ path: '/*', element: <App /> }],
        { initialEntries: ['/activities'] },
      )
      render(<RouterProvider router={router} />)

      await screen.findByText(/steve/i)

      router.navigate('/planner')
      expect(await screen.findByRole('link', { name: /weekly planner/i })).toHaveAttribute(
        'aria-current',
        'page',
      )

      router.navigate(-1)
      expect(await screen.findByRole('link', { name: /activities/i })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })
  })
})
