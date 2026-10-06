import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import App from './App'
import { authApi } from './services/authApi'
import { activityApi } from './services/activityApi'
import { planApi } from './services/planApi'
import * as clientModule from './services/client'
import { ApiError } from './types/api'
import type { User } from './types/auth'
import styles from './App.module.css'

vi.mock('./services/authApi')
vi.mock('./services/activityApi')
vi.mock('./services/planApi')

describe('App', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockReset()
    vi.mocked(authApi.logout).mockReset()
    vi.mocked(authApi.changePassword).mockReset()
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    vi.mocked(planApi.getWeek).mockReset()
    vi.mocked(planApi.getWeek).mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))
      await userEvent.click(screen.getByRole('button', { name: /log out/i }))

      await waitFor(() => expect(authApi.logout).toHaveBeenCalled())
      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-029-AC-01/AC-02: registers the unauthorized handler, scoped to authenticated state', () => {
    it('registers a handler with client.ts on mount', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      const spy = vi.spyOn(clientModule, 'setUnauthorizedHandler')

      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      expect(spy).toHaveBeenCalledWith(expect.any(Function))
    })

    it('AC-02: a 401 firing while the session check is still "checking" has no effect', async () => {
      let resolveMe: (value: User) => void = () => {}
      vi.mocked(authApi.me).mockReturnValue(
        new Promise((resolve) => {
          resolveMe = resolve
        }),
      )
      const spy = vi.spyOn(clientModule, 'setUnauthorizedHandler')

      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      expect(screen.getByRole('status')).toBeInTheDocument()
      const handler = spy.mock.calls[0]?.[0]
      act(() => handler?.())

      expect(screen.getByRole('status')).toBeInTheDocument()
      resolveMe({ username: 'steve' })
      await screen.findByText(/steve/i)
      expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
    })

    it('AC-02: a 401 firing while unauthenticated (e.g. the initial me() check itself) has no effect', async () => {
      vi.mocked(authApi.me).mockRejectedValue({ status: 401 })
      const spy = vi.spyOn(clientModule, 'setUnauthorizedHandler')

      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
      const handler = spy.mock.calls[0]?.[0]
      act(() => handler?.())

      expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-029-AC-03/AC-04: a 401 while authenticated bounces to the login screen with a notice', () => {
    it('transitions to LoginPage and shows the session-expired notice', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      const spy = vi.spyOn(clientModule, 'setUnauthorizedHandler')

      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      const handler = spy.mock.calls[0]?.[0]
      act(() => handler?.())

      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
      expect(screen.getByText(/session has expired/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-029-AC-05: logging back in clears the expired state and resumes normally', () => {
    it('returns to the authenticated shell with no expired notice after a fresh login', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      const spy = vi.spyOn(clientModule, 'setUnauthorizedHandler')

      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      const handler = spy.mock.calls[0]?.[0]
      act(() => handler?.())
      await screen.findByText(/session has expired/i)

      vi.mocked(authApi.login).mockResolvedValue({ username: 'steve' })
      await userEvent.type(screen.getByLabelText(/username/i), 'steve')
      await userEvent.type(screen.getByLabelText(/password/i), 'password')
      await userEvent.click(screen.getByRole('button', { name: /log in/i }))

      expect(await screen.findByText(/steve/i)).toBeInTheDocument()
      expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-029-AC-07: explicit logout shows no session-expired notice', () => {
    it('renders LoginPage with no expired notice after logging out on purpose', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      vi.mocked(authApi.logout).mockResolvedValue(undefined)

      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))
      await userEvent.click(screen.getByRole('button', { name: /log out/i }))

      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
      expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-029-AC-08: a failed login attempt keeps its own inline error', () => {
    it('shows the inline submitError, unaffected by the global 401 handler', async () => {
      vi.mocked(authApi.me).mockRejectedValue({ status: 401 })
      vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, 'Invalid username or password'))

      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await userEvent.type(await screen.findByLabelText(/username/i), 'steve')
      await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
      await userEvent.click(screen.getByRole('button', { name: /log in/i }))

      expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument()
      expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
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

  describe('FRONTEND-016-AC-01/AC-02: Today is a routed, protected top-level tab', () => {
    it('navigates to /today and renders TodayView when the Today tab is clicked', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('link', { name: /today/i }))

      expect(await screen.findByRole('heading', { name: /^today$/i })).toBeInTheDocument()
    })

    it('redirects an unauthenticated visit to /today to the login page', async () => {
      vi.mocked(authApi.me).mockRejectedValue({ status: 401 })
      render(
        <MemoryRouter initialEntries={['/today']}>
          <App />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-036-AC-01/AC-02: Summary is a routed, protected top-level tab', () => {
    it('navigates to /summary and renders WeeklySummary when the Summary tab is clicked', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('link', { name: /summary/i }))

      expect(await screen.findByRole('heading', { name: /weekly summary/i })).toBeInTheDocument()
    })

    it('redirects an unauthenticated visit to /summary to the login page', async () => {
      vi.mocked(authApi.me).mockRejectedValue({ status: 401 })
      render(
        <MemoryRouter initialEntries={['/summary']}>
          <App />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
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
    it('keeps the Settings and Account icons visible after switching tabs', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('link', { name: /weekly planner/i }))

      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument()
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

      await act(async () => {
        await router.navigate('/planner')
      })
      expect(await screen.findByRole('link', { name: /weekly planner/i })).toHaveAttribute(
        'aria-current',
        'page',
      )

      await act(async () => {
        await router.navigate(-1)
      })
      expect(await screen.findByRole('link', { name: /activities/i })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })
  })

  describe('FRONTEND-007-AC-17/AC-18: layout-shell wrapper', () => {
    it('wraps the authenticated header, TabNav, and routed content in one shell container', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      const shell = await screen.findByTestId('app-shell')
      expect(shell).toHaveClass(styles.shell)
      expect(shell).toContainElement(screen.getByRole('link', { name: /activities/i }))
    })

    it('keeps the same shell element (not remounted) when switching tabs', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      const shellBefore = await screen.findByTestId('app-shell')
      await userEvent.click(screen.getByRole('link', { name: /weekly planner/i }))
      const shellAfter = await screen.findByTestId('app-shell')

      expect(shellAfter).toBe(shellBefore)
    })
  })

  describe('FRONTEND-030-AC-01: header row has Title, Settings icon, Account icon, no "Logged in as" text', () => {
    it('renders the Settings and Account trigger buttons and drops the old "Logged in as" paragraph', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText('Behavioural Activation Planner')
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument()
      expect(screen.queryByText(/logged in as/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-030-AC-03: /settings redirects to /activities', () => {
    it('renders the Activity Bank when navigating to /settings', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/settings']}>
          <App />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('heading', { name: 'Activity Bank' })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-030-AC-08: logging out from the Account popover behaves exactly as the old standalone button', () => {
    it('calls authApi.logout and returns to LoginPage', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      vi.mocked(authApi.logout).mockResolvedValue(undefined)
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))
      await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

      await waitFor(() => expect(authApi.logout).toHaveBeenCalled())
      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-050-AC-03: a successful password change from the Account menu logs out with a notice', () => {
    it('shows the "Password changed" notice on LoginPage after a successful change', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      vi.mocked(authApi.changePassword).mockResolvedValue(undefined)
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('button', { name: 'Account' }))
      // The form now lives in a real dialog, opened via its own trigger inside the Account
      // popover -- see AccountMenu.test.tsx's "modal follow-up" describe block for why.
      await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
      await userEvent.type(screen.getByLabelText(/current password/i), 'old-password')
      await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-123')
      await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-123')
      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: /change password/i }),
      )

      expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
      expect(screen.getByText(/password changed/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-030-AC-09: opening Account closes an already-open Settings popover', () => {
    it('closes the Settings popover when the Account icon is clicked', async () => {
      vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
      render(
        <MemoryRouter initialEntries={['/activities']}>
          <App />
        </MemoryRouter>,
      )

      await screen.findByText(/steve/i)
      await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
      expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Account' }))
      expect(screen.queryByRole('group', { name: 'Appearance' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    })
  })
})
