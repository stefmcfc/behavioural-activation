import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CategoryPicker } from './CategoryPicker'

describe('CategoryPicker', () => {
  describe('FRONTEND-002-AC-27: renders exactly three category options', () => {
    it('renders Routine, Necessary, and Pleasurable options', () => {
      render(<CategoryPicker value={null} onChange={vi.fn()} />)

      expect(screen.getByLabelText(/routine/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/necessary/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/pleasurable/i)).toBeInTheDocument()
      expect(screen.getAllByRole('radio')).toHaveLength(3)
    })
  })

  describe('FRONTEND-002-AC-28: reflects the selected value and reports changes', () => {
    it('marks the selected option and calls onChange with the mapped category', async () => {
      const onChange = vi.fn()
      render(<CategoryPicker value="NECESSARY" onChange={onChange} />)

      expect(screen.getByLabelText(/necessary/i)).toBeChecked()

      await userEvent.click(screen.getByLabelText(/pleasurable/i))

      expect(onChange).toHaveBeenCalledWith('PLEASURABLE')
    })
  })

  describe('TOOLING-003-AC-03: exposes an invalid state on the fieldset when invalid', () => {
    it('has no invalid state by default', () => {
      render(<CategoryPicker value={null} onChange={vi.fn()} />)
      expect(screen.getByRole('group')).not.toHaveAttribute('aria-invalid', 'true')
    })

    it('sets aria-invalid="true" on the fieldset when invalid is true', () => {
      render(<CategoryPicker value={null} onChange={vi.fn()} invalid />)
      expect(screen.getByRole('group')).toHaveAttribute('aria-invalid', 'true')
    })

    it('clears the invalid state once a category is selected', () => {
      const { rerender } = render(<CategoryPicker value={null} onChange={vi.fn()} invalid />)
      expect(screen.getByRole('group')).toHaveAttribute('aria-invalid', 'true')

      rerender(<CategoryPicker value="ROUTINE" onChange={vi.fn()} invalid={false} />)
      expect(screen.getByRole('group')).not.toHaveAttribute('aria-invalid', 'true')
    })
  })
})
