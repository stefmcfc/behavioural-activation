import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Settings } from './Settings'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { workDayApi } from '../../services/workDayApi'
import { ApiError } from '../../types/api'
import buttonStyles from '../../styles/buttonVariants.module.css'

vi.mock('../../services/workDayApi')

describe('Settings', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.mocked(workDayApi.getPattern).mockReset().mockResolvedValue([])
    vi.mocked(workDayApi.setPattern).mockReset()
  })

  describe('FRONTEND-005-AC-07: shows Light/Dark/System, defaulting to System when unset', () => {
    it('renders a labelled option group with System checked by default', () => {
      render(<Settings />)

      expect(screen.getByRole('radio', { name: /^light$/i })).not.toBeChecked()
      expect(screen.getByRole('radio', { name: /^dark$/i })).not.toBeChecked()
      expect(screen.getByRole('radio', { name: /^system$/i })).toBeChecked()
    })

    it('reflects a previously stored preference', () => {
      localStorage.setItem('bap-theme-preference', 'dark')

      render(<Settings />)

      expect(screen.getByRole('radio', { name: /^dark$/i })).toBeChecked()
    })
  })

  describe('FRONTEND-005-AC-08/AC-09: selecting Dark persists and applies data-theme immediately', () => {
    it('sets data-theme="dark" on <html> and persists it when Dark is chosen', async () => {
      render(<Settings />)

      await userEvent.click(screen.getByRole('radio', { name: /^dark$/i }))

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(localStorage.getItem('bap-theme-preference')).toBe('dark')
    })

    it('sets data-theme="light" on <html> and persists it when Light is chosen', async () => {
      render(<Settings />)

      await userEvent.click(screen.getByRole('radio', { name: /^light$/i }))

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      expect(localStorage.getItem('bap-theme-preference')).toBe('light')
    })
  })

  describe('FRONTEND-005-AC-10/AC-14: System removes the data-theme override', () => {
    it('clears data-theme when switching from Dark back to System', async () => {
      localStorage.setItem('bap-theme-preference', 'dark')
      document.documentElement.setAttribute('data-theme', 'dark')
      render(<Settings />)

      await userEvent.click(screen.getByRole('radio', { name: /^system$/i }))

      expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
      expect(localStorage.getItem('bap-theme-preference')).toBe('system')
    })
  })

  describe('FRONTEND-005-AC-13: System mode shows the currently-in-effect OS theme', () => {
    it('shows "Currently: Dark" when matchMedia reports prefers-color-scheme: dark', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      )
      localStorage.setItem('bap-theme-preference', 'system')

      render(<Settings />)

      expect(screen.getByText(/currently.*dark/i)).toBeInTheDocument()

      vi.unstubAllGlobals()
    })

    it('does not show the currently-in-effect line when Light/Dark is explicitly chosen', () => {
      localStorage.setItem('bap-theme-preference', 'dark')

      render(<Settings />)

      expect(screen.queryByText(/currently/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-005-AC-20/AC-21: one labelled colour picker per category, defaulting correctly', () => {
    it('renders a colour input per category defaulting to the built-in hex', () => {
      render(<Settings />)

      expect(screen.getByLabelText(/^routine$/i)).toHaveValue('#0072b2')
      expect(screen.getByLabelText(/^necessary$/i)).toHaveValue('#e69f00')
      expect(screen.getByLabelText(/^pleasurable$/i)).toHaveValue('#009e73')
    })

    it('reflects a stored override', () => {
      localStorage.setItem('bap-category-colors', JSON.stringify({ ROUTINE: '#123456' }))

      render(<Settings />)

      expect(screen.getByLabelText(/^routine$/i)).toHaveValue('#123456')
    })
  })

  describe('FRONTEND-005-AC-22/AC-23: changing a colour persists it and live-updates rendered chips', () => {
    it('updates a rendered CategoryChip immediately after a colour change, no reload', async () => {
      render(
        <>
          <Settings />
          <CategoryChip category="ROUTINE" />
        </>,
      )

      fireEvent.change(screen.getByLabelText(/^routine$/i), { target: { value: '#123456' } })

      expect(localStorage.getItem('bap-category-colors')).toContain('#123456')
      expect(screen.getByTestId('category-chip-ROUTINE')).toHaveStyle({
        backgroundColor: '#123456',
      })
    })
  })

  describe('FRONTEND-005-AC-24/AC-25: reset to default reverts colour and stored override', () => {
    it('removes the ROUTINE override and reverts the input + chip to the default hex', async () => {
      localStorage.setItem('bap-category-colors', JSON.stringify({ ROUTINE: '#123456' }))
      render(
        <>
          <Settings />
          <CategoryChip category="ROUTINE" />
        </>,
      )

      await userEvent.click(screen.getByRole('button', { name: /reset.*routine/i }))

      expect(JSON.parse(localStorage.getItem('bap-category-colors') ?? '{}')).not.toHaveProperty(
        'ROUTINE',
      )
      expect(screen.getByLabelText(/^routine$/i)).toHaveValue('#0072b2')
      expect(screen.getByTestId('category-chip-ROUTINE')).toHaveStyle({
        backgroundColor: '#0072B2',
      })
    })

    it('renders a "Reset to default" control for each category', () => {
      render(<Settings />)

      expect(screen.getByRole('button', { name: /reset.*routine/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reset.*necessary/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reset.*pleasurable/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-031-AC-16: regression guard -- "Reset to default" stays unstyled', () => {
    it('leaves the Reset to default buttons with no variant class', () => {
      render(<Settings />)

      const resetButton = screen.getByRole('button', { name: /reset.*routine/i })
      expect(resetButton).not.toHaveClass(buttonStyles.primary)
      expect(resetButton).not.toHaveClass(buttonStyles.destructive)
    })
  })

  describe('FRONTEND-012-AC-03/AC-04: grid layout toggle renders and persists a selection', () => {
    it('defaults to "Days across the top" checked when nothing is stored', () => {
      render(<Settings />)

      expect(screen.getByRole('radio', { name: /days across the top/i })).toBeChecked()
      expect(
        screen.getByRole('radio', { name: /each day as its own section/i }),
      ).not.toBeChecked()
    })

    it('reflects a previously stored "day-rows" preference', () => {
      localStorage.setItem('bap-grid-orientation', 'day-rows')

      render(<Settings />)

      expect(screen.getByRole('radio', { name: /each day as its own section/i })).toBeChecked()
    })

    it('persists "day-rows" to localStorage when chosen', async () => {
      render(<Settings />)

      await userEvent.click(screen.getByRole('radio', { name: /each day as its own section/i }))

      expect(localStorage.getItem('bap-grid-orientation')).toBe('day-rows')
      expect(screen.getByRole('radio', { name: /each day as its own section/i })).toBeChecked()
    })
  })

  describe('FRONTEND-042-AC-01/AC-02: Work days fieldset reflects and saves the recurring pattern', () => {
    it('shows checked days from the fetched pattern, and saves on toggle', async () => {
      vi.mocked(workDayApi.getPattern).mockResolvedValue(['MONDAY', 'TUESDAY'])
      vi.mocked(workDayApi.setPattern).mockResolvedValue(['MONDAY', 'TUESDAY', 'WEDNESDAY'])
      render(<Settings />)

      expect(await screen.findByRole('checkbox', { name: 'Monday' })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Wednesday' })).not.toBeChecked()

      await userEvent.click(screen.getByRole('checkbox', { name: 'Wednesday' }))

      expect(workDayApi.setPattern).toHaveBeenCalledWith(['MONDAY', 'TUESDAY', 'WEDNESDAY'])
      expect(await screen.findByRole('checkbox', { name: 'Wednesday' })).toBeChecked()
    })

    it('unchecking a day saves the pattern without it', async () => {
      vi.mocked(workDayApi.getPattern).mockResolvedValue(['MONDAY', 'TUESDAY'])
      vi.mocked(workDayApi.setPattern).mockResolvedValue(['TUESDAY'])
      render(<Settings />)

      await userEvent.click(await screen.findByRole('checkbox', { name: 'Monday' }))

      expect(workDayApi.setPattern).toHaveBeenCalledWith(['TUESDAY'])
      expect(await screen.findByRole('checkbox', { name: 'Monday' })).not.toBeChecked()
    })

    it('renders all 7 days Monday through Sunday', async () => {
      vi.mocked(workDayApi.getPattern).mockResolvedValue([])
      render(<Settings />)

      expect(await screen.findByRole('checkbox', { name: 'Monday' })).toBeInTheDocument()
      for (const day of ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
        expect(screen.getByRole('checkbox', { name: day })).toBeInTheDocument()
      }
    })
  })

  describe('FRONTEND-042-AC-03: a failure loading the pattern shows an inline error with retry', () => {
    it('shows an alert with a Retry button that re-fetches on click', async () => {
      vi.mocked(workDayApi.getPattern).mockRejectedValueOnce(new ApiError(500, 'Server error'))
      render(<Settings />)

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.queryByRole('checkbox', { name: 'Monday' })).not.toBeInTheDocument()

      vi.mocked(workDayApi.getPattern).mockResolvedValueOnce(['MONDAY'])
      await userEvent.click(screen.getByRole('button', { name: /retry/i }))

      expect(await screen.findByRole('checkbox', { name: 'Monday' })).toBeChecked()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-042-AC-04: a failure saving a change shows an error and reverts the checkbox', () => {
    it('shows an alert and leaves the checkbox at its last-saved state when setPattern rejects', async () => {
      vi.mocked(workDayApi.getPattern).mockResolvedValue(['MONDAY'])
      vi.mocked(workDayApi.setPattern).mockRejectedValue(new ApiError(500, 'Server error'))
      render(<Settings />)

      await userEvent.click(await screen.findByRole('checkbox', { name: 'Wednesday' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByRole('checkbox', { name: 'Wednesday' })).not.toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Monday' })).toBeChecked()
    })
  })
})
