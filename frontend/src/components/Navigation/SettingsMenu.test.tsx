import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SettingsMenu } from './SettingsMenu'
import { AccountMenu } from './AccountMenu'
import buttonStyles from '../../styles/buttonVariants.module.css'

describe('FRONTEND-030: SettingsMenu popover', () => {
  describe('FRONTEND-030-AC-04: opens to reveal the Appearance and Category colours fieldsets', () => {
    it('shows the existing Settings content after clicking the trigger', async () => {
      render(<SettingsMenu />)

      expect(screen.queryByRole('group', { name: 'Appearance' })).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Settings' }))

      expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Category colours' })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-030-AC-05: clicking the trigger again closes it', () => {
    it('toggles the popover closed on a second click', async () => {
      render(<SettingsMenu />)
      const trigger = screen.getByRole('button', { name: 'Settings' })

      await userEvent.click(trigger)
      expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument()

      await userEvent.click(trigger)
      expect(screen.queryByRole('group', { name: 'Appearance' })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-030-AC-09: opening one popover closes the other', () => {
    it('closes an already-open Settings popover when the Account icon is clicked', async () => {
      render(
        <>
          <SettingsMenu />
          <AccountMenu username="steve" onLogout={() => {}} onPasswordChanged={() => {}} />
        </>,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
      expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Account' }))
      expect(screen.queryByRole('group', { name: 'Appearance' })).not.toBeInTheDocument()
      expect(screen.getByText('steve')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-031-AC-15: regression guard -- trigger stays unstyled', () => {
    it('leaves the Settings trigger with no variant class', () => {
      render(<SettingsMenu />)

      const trigger = screen.getByRole('button', { name: 'Settings' })
      expect(trigger).not.toHaveClass(buttonStyles.primary)
      expect(trigger).not.toHaveClass(buttonStyles.destructive)
    })
  })
})
