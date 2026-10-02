import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TabNav } from './TabNav'

describe('FRONTEND-005-AC-01/AC-03: TabNav renders labelled links, marks the active one', () => {
  it('renders Activities and Weekly Planner links', () => {
    render(
      <MemoryRouter initialEntries={['/activities']}>
        <TabNav />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Activities' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Weekly Planner' })).toBeInTheDocument()
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
  })
})

describe('FRONTEND-016-AC-01: TabNav gains a Today entry', () => {
  it('renders a Today link routed to /today', () => {
    render(
      <MemoryRouter initialEntries={['/activities']}>
        <TabNav />
      </MemoryRouter>,
    )

    const todayLink = screen.getByRole('link', { name: 'Today' })
    expect(todayLink).toBeInTheDocument()
    expect(todayLink).toHaveAttribute('href', '/today')
  })

  it('marks the Today link active when on /today', () => {
    render(
      <MemoryRouter initialEntries={['/today']}>
        <TabNav />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('FRONTEND-030-AC-02: TabNav no longer lists Settings', () => {
  it('does not render a Settings link', () => {
    render(
      <MemoryRouter initialEntries={['/activities']}>
        <TabNav />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })
})
