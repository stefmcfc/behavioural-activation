import { render, screen, waitFor } from '@testing-library/react'
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
      render(<SuggestedActivities activities={[]} onAdded={onAdded} />)

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
      render(<SuggestedActivities activities={[]} onAdded={onAdded} />)

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
      render(<SuggestedActivities activities={[]} onAdded={onAdded} />)

      const button = await screen.findByRole('button', { name: /add go for a walk/i })
      fireEvent.click(button)

      await waitFor(() => expect(button).toBeDisabled())

      resolveCreate(makeActivity({ name: 'Go for a walk' }))
      await waitFor(() => expect(button).not.toBeDisabled())
    })
  })

  describe('FRONTEND-040-AC-03/AC-04: category grouping', () => {
    it('AC-03: renders three fixed-order category group headings', () => {
      render(<SuggestedActivities activities={[]} onAdded={onAdded} />)
      const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
      expect(headings).toEqual(['Routine', 'Necessary', 'Pleasurable'])
    })

    it('AC-04: omits a category heading once every preset in it is already added', () => {
      const existing = PRESET_ACTIVITIES.filter((p) => p.category === 'ROUTINE').map((p) =>
        makeActivity({ name: p.name }),
      )
      render(<SuggestedActivities activities={existing} onAdded={onAdded} />)
      expect(screen.queryByRole('heading', { name: 'Routine' })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-040-AC-05: already-added presets are hidden', () => {
    it('hides a preset once a same-named activity exists, case-insensitively, including archived', () => {
      render(
        <SuggestedActivities
          activities={[makeActivity({ name: 'go FOR a Walk', archived: true })]}
          onAdded={onAdded}
        />,
      )
      expect(screen.queryByRole('button', { name: /add go for a walk/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-040-AC-06: disclosure wraps the suggestions', () => {
    it('renders a <details> element containing the Add buttons', () => {
      render(<SuggestedActivities activities={[]} onAdded={onAdded} />)
      const summary = screen.getByText(/suggested activities/i)
      const details = summary.closest('details')
      expect(details).not.toBeNull()
      expect(details).not.toHaveAttribute('open')
    })
  })
})
