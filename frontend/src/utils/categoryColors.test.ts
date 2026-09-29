import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_CATEGORY_COLORS,
  getCategoryColor,
  resetCategoryColor,
  setCategoryColor,
  subscribeToCategoryColorChanges,
} from './categoryColors'

const STORAGE_KEY = 'bap-category-colors'

describe('utils/categoryColors', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('DEFAULT_CATEGORY_COLORS', () => {
    it('matches the Okabe-Ito default hexes', () => {
      expect(DEFAULT_CATEGORY_COLORS).toEqual({
        ROUTINE: '#0072B2',
        NECESSARY: '#E69F00',
        PLEASURABLE: '#009E73',
      })
    })
  })

  describe('getCategoryColor', () => {
    it('returns the built-in default when nothing is stored', () => {
      expect(getCategoryColor('ROUTINE')).toBe('#0072B2')
    })

    it('returns the stored override when present', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ROUTINE: '#123456' }))
      expect(getCategoryColor('ROUTINE')).toBe('#123456')
    })

    it('falls back to the default for malformed stored JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json')
      expect(getCategoryColor('NECESSARY')).toBe('#E69F00')
    })
  })

  describe('setCategoryColor', () => {
    it('persists a new hex for a category without touching the others', () => {
      setCategoryColor('ROUTINE', '#123456')

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
        ROUTINE: '#123456',
      })
      expect(getCategoryColor('ROUTINE')).toBe('#123456')
      expect(getCategoryColor('NECESSARY')).toBe('#E69F00')
    })
  })

  describe('resetCategoryColor', () => {
    it('removes the stored override for a category, leaving other overrides intact', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ROUTINE: '#123456', NECESSARY: '#654321' }),
      )

      resetCategoryColor('ROUTINE')

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored).not.toHaveProperty('ROUTINE')
      expect(stored).toHaveProperty('NECESSARY', '#654321')
      expect(getCategoryColor('ROUTINE')).toBe('#0072B2')
    })
  })

  describe('subscribeToCategoryColorChanges', () => {
    it('notifies subscribers on setCategoryColor and resetCategoryColor', () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToCategoryColorChanges(listener)

      setCategoryColor('ROUTINE', '#123456')
      expect(listener).toHaveBeenCalledTimes(1)

      resetCategoryColor('ROUTINE')
      expect(listener).toHaveBeenCalledTimes(2)

      unsubscribe()
      setCategoryColor('ROUTINE', '#654321')
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })
})
