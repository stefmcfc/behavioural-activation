import { describe, it, expect } from 'vitest'
import { getErrorMessage } from './getErrorMessage'
import { ApiError } from '../types/api'

describe('TOOLING-005-AC-01: getErrorMessage', () => {
  it('returns the ApiError message', () => {
    expect(getErrorMessage(new ApiError(404, 'Not found'))).toBe('Not found')
  })

  it("returns a plain object error's string message field", () => {
    expect(getErrorMessage({ message: 'Network error' })).toBe('Network error')
  })

  it('falls back to a generic message for anything else', () => {
    expect(getErrorMessage('a plain string')).toBe('Something went wrong. Please try again.')
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.')
  })
})
