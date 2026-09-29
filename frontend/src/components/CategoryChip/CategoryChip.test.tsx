import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CategoryChip } from './CategoryChip'
import { resetCategoryColor, setCategoryColor } from '../../utils/categoryColors'

describe('CategoryChip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('FRONTEND-005-AC-15/AC-16: renders label on the current colour with computed text colour', () => {
    it('renders the Routine label on the default Routine background with white text', () => {
      render(<CategoryChip category="ROUTINE" />)

      const chip = screen.getByText('Routine')
      expect(chip).toHaveStyle({ backgroundColor: '#0072B2', color: '#ffffff' })
      expect(chip).toHaveAttribute('data-testid', 'category-chip-ROUTINE')
    })

    it('renders the Necessary label with black text on its default background', () => {
      render(<CategoryChip category="NECESSARY" />)

      expect(screen.getByText('Necessary')).toHaveStyle({
        backgroundColor: '#E69F00',
        color: '#000000',
      })
    })

    it('renders the Pleasurable label with black text on its default background', () => {
      render(<CategoryChip category="PLEASURABLE" />)

      expect(screen.getByText('Pleasurable')).toHaveStyle({
        backgroundColor: '#009E73',
        color: '#000000',
      })
    })
  })

  describe('FRONTEND-005-AC-23: re-renders with a new colour when it changes elsewhere, no reload', () => {
    it('updates its background after setCategoryColor is called', () => {
      render(<CategoryChip category="ROUTINE" />)

      act(() => {
        setCategoryColor('ROUTINE', '#123456')
      })

      expect(screen.getByText('Routine')).toHaveStyle({ backgroundColor: '#123456' })
    })

    it('reverts to the default after resetCategoryColor is called', () => {
      setCategoryColor('ROUTINE', '#123456')
      render(<CategoryChip category="ROUTINE" />)

      act(() => {
        resetCategoryColor('ROUTINE')
      })

      expect(screen.getByText('Routine')).toHaveStyle({ backgroundColor: '#0072B2' })
    })
  })
})
