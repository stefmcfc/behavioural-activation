import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TabNav } from './TabNav'

describe('FRONTEND-005-AC-01/AC-03: TabNav renders three labelled links, marks the active one', () => {
  it('renders Activities, Weekly Planner, and Settings links', () => {
    render(
      <MemoryRouter initialEntries={['/activities']}>
        <TabNav />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Activities' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Weekly Planner' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  it('marks only the active route link with aria-current="page"', () => {
    render(
      <MemoryRouter initialEntries={['/planner']}>
        <TabNav />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Weekly Planner' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Activities' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current')
  })
})
