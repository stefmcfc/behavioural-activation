import { describe, expect, it } from 'vitest'
import { getReadableTextColor } from './contrast'

describe('FRONTEND-005-AC-26/AC-27/AC-28: getReadableTextColor picks the higher-contrast option', () => {
  it.each([
    ['#ffffff', '#000000'],
    ['#000000', '#ffffff'],
    ['#0072B2', '#ffffff'],
    ['#E69F00', '#000000'],
    ['#009E73', '#000000'],
    ['#777777', '#000000'],
  ])('resolves %s to %s', (background, expected) => {
    expect(getReadableTextColor(background)).toBe(expected)
  })

  it('accepts hex without a leading #', () => {
    expect(getReadableTextColor('0072B2')).toBe('#ffffff')
  })
})
