import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChevronIcon } from './ChevronIcon'

describe('TOOLING-005-AC-03: ChevronIcon direction variants', () => {
  it.each([
    ['up', '4,10 8,6 12,10'],
    ['down', '4,6 8,10 12,6'],
    ['left', '10,2 4,8 10,14'],
    ['right', '6,2 12,8 6,14'],
  ] as const)('renders the %s polyline', (direction, points) => {
    const { container } = render(<ChevronIcon direction={direction} />)
    expect(container.querySelector('polyline')).toHaveAttribute('points', points)
  })

  it('defaults to the down direction when no direction prop is given', () => {
    const { container } = render(<ChevronIcon />)
    expect(container.querySelector('polyline')).toHaveAttribute('points', '4,6 8,10 12,6')
  })
})
