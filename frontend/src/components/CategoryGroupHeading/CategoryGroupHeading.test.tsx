import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CategoryGroupHeading } from './CategoryGroupHeading'
import { resetCategoryColor, setCategoryColor } from '../../utils/categoryColors'

describe('CategoryGroupHeading', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('FRONTEND-044-AC-02: renders a level-4 heading with the live category colour', () => {
    it('renders the Routine label on the default Routine background with white text', () => {
      render(<CategoryGroupHeading category="ROUTINE" />)

      const heading = screen.getByRole('heading', { level: 4, name: 'Routine' })
      expect(heading).toHaveStyle({ backgroundColor: '#0072B2', color: '#ffffff' })
    })

    it('renders the Necessary label with black text on its default background', () => {
      render(<CategoryGroupHeading category="NECESSARY" />)

      expect(screen.getByRole('heading', { level: 4, name: 'Necessary' })).toHaveStyle({
        backgroundColor: '#E69F00',
        color: '#000000',
      })
    })

    it('renders the Pleasurable label with black text on its default background', () => {
      render(<CategoryGroupHeading category="PLEASURABLE" />)

      expect(screen.getByRole('heading', { level: 4, name: 'Pleasurable' })).toHaveStyle({
        backgroundColor: '#009E73',
        color: '#000000',
      })
    })
  })

  describe('FRONTEND-044-AC-02: re-renders with a new colour when it changes elsewhere, no reload', () => {
    it('updates its background after setCategoryColor is called', () => {
      render(<CategoryGroupHeading category="ROUTINE" />)

      act(() => {
        setCategoryColor('ROUTINE', '#123456')
      })

      expect(screen.getByRole('heading', { level: 4, name: 'Routine' })).toHaveStyle({
        backgroundColor: '#123456',
      })
    })

    it('reverts to the default after resetCategoryColor is called', () => {
      setCategoryColor('ROUTINE', '#123456')
      render(<CategoryGroupHeading category="ROUTINE" />)

      act(() => {
        resetCategoryColor('ROUTINE')
      })

      expect(screen.getByRole('heading', { level: 4, name: 'Routine' })).toHaveStyle({
        backgroundColor: '#0072B2',
      })
    })
  })
})
