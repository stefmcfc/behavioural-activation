import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './AccountMenu'
import buttonStyles from '../../styles/buttonVariants.module.css'

describe('FRONTEND-030: AccountMenu popover', () => {
  describe('FRONTEND-030-AC-07: opens to show the username and a Log out button', () => {
    it('shows the username and a Log out button after clicking the trigger', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} />)

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
      render(<AccountMenu username="steve" onLogout={onLogout} />)

      await userEvent.click(screen.getByRole('button', { name: 'Account' }))
      await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

      expect(onLogout).toHaveBeenCalled()
    })
  })

  describe('FRONTEND-031-AC-16: regression guard -- "Log out" stays unstyled', () => {
    it('leaves the Log out button with no variant class', async () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} />)

      await userEvent.click(screen.getByRole('button', { name: 'Account' }))
      const logoutButton = screen.getByRole('button', { name: 'Log out' })
      expect(logoutButton).not.toHaveClass(buttonStyles.primary)
      expect(logoutButton).not.toHaveClass(buttonStyles.destructive)
    })
  })

  describe('FRONTEND-031-AC-15: regression guard -- trigger stays unstyled', () => {
    it('leaves the Account trigger with no variant class', () => {
      render(<AccountMenu username="steve" onLogout={vi.fn()} />)

      const trigger = screen.getByRole('button', { name: 'Account' })
      expect(trigger).not.toHaveClass(buttonStyles.primary)
      expect(trigger).not.toHaveClass(buttonStyles.destructive)
    })
  })
})
