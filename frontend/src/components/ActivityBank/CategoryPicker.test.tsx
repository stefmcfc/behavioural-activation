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
})
