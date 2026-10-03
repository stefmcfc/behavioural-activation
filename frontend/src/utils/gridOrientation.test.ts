import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getGridOrientation,
  setGridOrientation,
  subscribeToGridOrientationChanges,
} from './gridOrientation'

const STORAGE_KEY = 'bap-grid-orientation'

describe('utils/gridOrientation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('FRONTEND-012-AC-01: getGridOrientation defaults to day-columns', () => {
    it('returns "day-columns" when nothing is stored', () => {
      expect(getGridOrientation()).toBe('day-columns')
    })

    it('returns "day-columns" for an invalid stored value', () => {
      localStorage.setItem(STORAGE_KEY, 'nonsense')
      expect(getGridOrientation()).toBe('day-columns')
    })

    it('returns the stored value when valid', () => {
      localStorage.setItem(STORAGE_KEY, 'day-rows')
      expect(getGridOrientation()).toBe('day-rows')
    })
  })

  describe('FRONTEND-012-AC-02: setGridOrientation persists the value', () => {
    it('writes "day-rows" to localStorage', () => {
      setGridOrientation('day-rows')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('day-rows')
    })

    it('writes "day-columns" to localStorage', () => {
      setGridOrientation('day-columns')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('day-columns')
    })
  })

  describe('FRONTEND-034-AC-01: setGridOrientation notifies subscribers', () => {
    it('calls a subscribed listener when the orientation changes', () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToGridOrientationChanges(listener)

      setGridOrientation('day-rows')

      expect(listener).toHaveBeenCalledTimes(1)
      unsubscribe()
    })

    it('stops notifying after unsubscribe', () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToGridOrientationChanges(listener)
      unsubscribe()

      setGridOrientation('day-rows')

      expect(listener).not.toHaveBeenCalled()
    })
  })
})
