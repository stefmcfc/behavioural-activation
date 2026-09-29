import { beforeEach, describe, expect, it } from 'vitest'
import { applyStoredTheme, getThemePreference, setThemePreference } from './theme'

const STORAGE_KEY = 'bap-theme-preference'

describe('utils/theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  describe('FRONTEND-005-AC-11: applyStoredTheme applies/removes data-theme before first render', () => {
    it('sets data-theme="light" when "light" is stored', () => {
      localStorage.setItem(STORAGE_KEY, 'light')

      applyStoredTheme()

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('sets data-theme="dark" when "dark" is stored', () => {
      localStorage.setItem(STORAGE_KEY, 'dark')

      applyStoredTheme()

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('defaults to no override for an invalid stored value', () => {
      localStorage.setItem(STORAGE_KEY, 'not-a-real-value')

      applyStoredTheme()

      expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    })

    it('defaults to no override when nothing is stored', () => {
      applyStoredTheme()

      expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    })
  })

  describe('getThemePreference', () => {
    it('returns "system" when nothing is stored', () => {
      expect(getThemePreference()).toBe('system')
    })

    it('returns "system" for an invalid stored value', () => {
      localStorage.setItem(STORAGE_KEY, 'nonsense')
      expect(getThemePreference()).toBe('system')
    })

    it('returns the stored preference when valid', () => {
      localStorage.setItem(STORAGE_KEY, 'dark')
      expect(getThemePreference()).toBe('dark')
    })
  })

  describe('setThemePreference', () => {
    it('persists "light" and sets data-theme="light"', () => {
      setThemePreference('light')

      expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('persists "dark" and sets data-theme="dark"', () => {
      setThemePreference('dark')

      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('persists "system" and removes the data-theme attribute', () => {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem(STORAGE_KEY, 'dark')

      setThemePreference('system')

      expect(localStorage.getItem(STORAGE_KEY)).toBe('system')
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    })
  })
})
