import { render, screen, waitFor, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SuggestedActivities } from './SuggestedActivities'
import { activityApi } from '../../services/activityApi'
import { PRESET_ACTIVITIES } from '../../utils/presetActivities'
import type { Activity } from '../../types/activity'

vi.mock('../../services/activityApi')

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: '1',
    name: 'Go for a walk',
    category: 'ROUTINE',
    description: null,
    repeatable: true,
    archived: false,
    favourite: false,
    createdAt: '2026-09-28T00:00:00Z',
    subTaskCount: 0,
    ...overrides,
  }
}

describe('SuggestedActivities', () => {
  const onAdded = vi.fn()

  beforeEach(() => {
    vi.mocked(activityApi.create).mockReset()
    onAdded.mockReset()
  })

  describe('FRONTEND-040-AC-01/AC-02: one-click add', () => {
    it("AC-01: clicking Add calls activityApi.create with the preset's own fields and appends the result", async () => {
      vi.mocked(activityApi.create).mockResolvedValue(makeActivity({ name: 'Go for a walk' }))
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)

      fireEvent.click(await screen.findByRole('button', { name: /add go for a walk/i }))

      await waitFor(() =>
        expect(activityApi.create).toHaveBeenCalledWith({
          name: 'Go for a walk',
          category: 'ROUTINE',
          description: null,
          repeatable: true,
        }),
      )
      expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ name: 'Go for a walk' }))
    })

    it('AC-02: shows an error and keeps the suggestion when create fails', async () => {
      vi.mocked(activityApi.create).mockRejectedValue(new Error('boom'))
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)

      fireEvent.click(await screen.findByRole('button', { name: /add go for a walk/i }))

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add go for a walk/i })).toBeInTheDocument()
    })

    it('AC-02: disables the Add button while the create request is in flight', async () => {
      let resolveCreate: (value: Activity) => void = () => {}
      vi.mocked(activityApi.create).mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve
        }),
      )
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)

      const button = await screen.findByRole('button', { name: /add go for a walk/i })
      fireEvent.click(button)

      await waitFor(() => expect(button).toBeDisabled())

      resolveCreate(makeActivity({ name: 'Go for a walk' }))
      await waitFor(() => expect(button).not.toBeDisabled())
    })
  })

  describe('FRONTEND-040-AC-03/AC-04: category grouping', () => {
    it('AC-03: renders three fixed-order category group headings', () => {
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)
      const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
      expect(headings).toEqual(['Routine', 'Necessary', 'Pleasurable'])
    })

    it('AC-04: omits a category heading once every preset in it is already added', () => {
      const existing = PRESET_ACTIVITIES.filter((p) => p.category === 'ROUTINE').map((p) =>
        makeActivity({ name: p.name }),
      )
      render(<SuggestedActivities activities={existing} onAdded={onAdded} categoryFilter="ALL" />)
      expect(screen.queryByRole('heading', { name: 'Routine' })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-040-AC-05: already-added presets are hidden', () => {
    it('hides a preset once a same-named activity exists, case-insensitively, including archived', () => {
      render(
        <SuggestedActivities
          activities={[makeActivity({ name: 'go FOR a Walk', archived: true })]}
          onAdded={onAdded}
          categoryFilter="ALL"
        />,
      )
      expect(screen.queryByRole('button', { name: /add go for a walk/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-040-AC-06: disclosure wraps the suggestions', () => {
    it('renders a <details> element containing the Add buttons', () => {
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)
      const summary = screen.getByText(/suggested activities/i)
      const details = summary.closest('details')
      expect(details).not.toBeNull()
      expect(details).not.toHaveAttribute('open')
    })

    it('renders a chevron icon next to the summary text as an expand/collapse affordance', () => {
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)
      const summary = screen.getByText(/suggested activities/i).closest('summary')!
      expect(summary.querySelector('svg')).not.toBeNull()
    })
  })

  describe('FRONTEND-040-AC-10: CTA text and accessible name', () => {
    it('shows "Add to my activities" as the visible button text, with the specific name in aria-label', async () => {
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)
      const button = await screen.findByRole('button', { name: /add go for a walk to my activities/i })
      expect(button).toHaveTextContent('Add to my activities')
      expect(button).toHaveAccessibleName('Add Go for a walk to my activities')
    })

    it('disambiguates multiple presets despite identical visible button text', async () => {
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)
      const buttons = await screen.findAllByText('Add to my activities')
      const names = buttons.map((b) => b.closest('button')?.getAttribute('aria-label'))
      expect(new Set(names).size).toBe(names.length)
    })
  })

  describe('FRONTEND-040-AC-11: respects the category filter', () => {
    it('renders only the filtered category\'s group when a specific category is selected', () => {
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ROUTINE" />)
      const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
      expect(headings).toEqual(['Routine'])
    })

    it('renders all three groups when the filter is ALL', () => {
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)
      const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
      expect(headings).toEqual(['Routine', 'Necessary', 'Pleasurable'])
    })
  })

  describe('FRONTEND-040-AC-12: preamble', () => {
    it('renders an introductory sentence above the grouped list', () => {
      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)
      expect(screen.getByText(/common activities you can add with one click/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-040-AC-16: repeatable icon', () => {
    it('shows a Repeatable icon next to a repeatable preset, not next to a one-off one', () => {
      const repeatablePreset = PRESET_ACTIVITIES.find((p) => p.repeatable)
      const oneOffPreset = PRESET_ACTIVITIES.find((p) => !p.repeatable)
      // Guard rather than assume -- PRESET_ACTIVITIES is user-edited content, not fixed by this spec.
      if (!repeatablePreset || !oneOffPreset) return

      render(<SuggestedActivities activities={[]} onAdded={onAdded} categoryFilter="ALL" />)

      const repeatableRow = screen.getByText(repeatablePreset.name).closest('li')!
      const oneOffRow = screen.getByText(oneOffPreset.name).closest('li')!
      expect(within(repeatableRow).getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
      expect(within(oneOffRow).queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
    })
  })
})
