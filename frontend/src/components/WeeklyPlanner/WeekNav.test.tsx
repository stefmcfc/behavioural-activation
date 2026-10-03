import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WeekNav } from './WeekNav'

describe('FRONTEND-036-AC-05: WeekNav renders the week label and fires callbacks', () => {
  it('shows the "Week Commencing" label and calls onPrevious/onNext when the chevron buttons are clicked', async () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    render(<WeekNav weekStart="2026-09-28" onPrevious={onPrevious} onNext={onNext} />)

    expect(screen.getByText(/week commencing/i)).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Previous week'))
    await userEvent.click(screen.getByLabelText('Next week'))

    expect(onPrevious).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('has no visible text on the chevron buttons and hides the icon from assistive tech', () => {
    render(<WeekNav weekStart="2026-09-28" onPrevious={vi.fn()} onNext={vi.fn()} />)

    const previous = screen.getByLabelText('Previous week')
    expect(previous.textContent?.trim()).toBe('')
    expect(previous.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
