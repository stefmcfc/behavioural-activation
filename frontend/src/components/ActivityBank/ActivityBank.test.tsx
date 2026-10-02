import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivityBank } from './ActivityBank'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { Activity } from '../../types/activity'
import styles from './ActivityBank.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'

vi.mock('../../services/activityApi')
vi.mock('../../services/subTaskApi')

const walk: Activity = {
  id: '1',
  name: 'Walk',
  category: 'ROUTINE',
  description: 'Around the block',
  repeatable: true,
  archived: false,
  favourite: false,
  createdAt: '2026-09-28T00:00:00Z',
  subTaskCount: 0,
}

const jobs: Activity = {
  id: '2',
  name: 'Apply for jobs',
  category: 'NECESSARY',
  description: null,
  repeatable: false,
  archived: true,
  favourite: false,
  createdAt: '2026-09-28T00:00:00Z',
  subTaskCount: 0,
}

const read: Activity = {
  id: '3',
  name: 'Read a book',
  category: 'PLEASURABLE',
  description: null,
  repeatable: true,
  archived: false,
  favourite: false,
  createdAt: '2026-09-28T00:00:00Z',
  subTaskCount: 0,
}

describe('ActivityBank', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(activityApi.create).mockReset()
    vi.mocked(activityApi.update).mockReset()
    vi.mocked(activityApi.remove).mockReset()
    vi.mocked(activityApi.unarchive).mockReset()
    vi.mocked(activityApi.markFavourite).mockReset()
    vi.mocked(activityApi.unmarkFavourite).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
  })

  describe('FRONTEND-002-AC-07: fetches the list on mount', () => {
    it('calls activityApi.getAll', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      await waitFor(() => expect(activityApi.getAll).toHaveBeenCalled())
    })
  })

  describe('FRONTEND-002-AC-08: shows a loading indicator while the fetch is in flight', () => {
    it('renders an output element until the fetch resolves', async () => {
      let resolveGetAll: (value: Activity[]) => void = () => {}
      vi.mocked(activityApi.getAll).mockReturnValue(
        new Promise((resolve) => {
          resolveGetAll = resolve
        }),
      )
      render(<ActivityBank />)

      expect(screen.getByRole('status')).toBeInTheDocument()

      resolveGetAll([])
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-002-AC-09: empty bank shows an explanatory empty state', () => {
    it('renders an empty-state message, not a blank list', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)
      expect(await screen.findByText(/no activities yet/i)).toBeInTheDocument()
    })
  })

  describe('FRONTEND-002-AC-10: populated list renders name, category, and description', () => {
    it('renders the fetched activities', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      expect(await screen.findByText('Walk')).toBeInTheDocument()
      const list = within(screen.getByRole('list'))
      expect(list.getByText('Routine')).toBeInTheDocument()
      expect(list.getByText('Around the block')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-005-AC-17: category is shown as a CategoryChip, not plain "— Category" text', () => {
    it('renders a CategoryChip, not raw "— Routine" text, in the activity list', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      expect(await screen.findByText('Walk')).toBeInTheDocument()
      expect(screen.getByTestId('category-chip-ROUTINE')).toBeInTheDocument()
      expect(screen.queryByText(/— routine/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-007-AC-19/AC-20: activity rows use the hairline treatment, actions right-aligned', () => {
    it('applies the row class to each activity li and the actions class to its action buttons', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')
      expect(row).toHaveClass(styles.row)
      expect(screen.getByRole('button', { name: 'Edit' }).closest(`.${styles.actions}`)).not.toBeNull()
    })
  })

  describe('FRONTEND-002-AC-11: fetch failure shows an alert', () => {
    it('displays the error in a role="alert" element', async () => {
      vi.mocked(activityApi.getAll).mockRejectedValue({ status: 500, message: 'Server error' })
      render(<ActivityBank />)

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
    })
  })

  describe('FRONTEND-002-AC-15: successful create adds to the list and clears the form', () => {
    it('shows the new activity and resets the form fields', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      vi.mocked(activityApi.create).mockResolvedValue({
        id: '1',
        name: 'Walk',
        category: 'ROUTINE',
        description: null,
        repeatable: true,
        archived: false,
        favourite: false,
        createdAt: '2026-09-28T00:00:00Z',
        subTaskCount: 0,
      })
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /add activity/i }))
      await userEvent.type(screen.getByLabelText(/name/i), 'Walk')
      await userEvent.click(screen.getByLabelText(/routine/i))
      await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

      expect(await screen.findByText('Walk')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-002-AC-18: edit form prefills from existing activity data', () => {
    it("shows the activity's current values in the form fields", async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /edit/i }))

      expect(screen.getByLabelText(/name/i)).toHaveValue('Walk')
      expect(screen.getByLabelText(/description/i)).toHaveValue('Around the block')
    })
  })

  describe('FRONTEND-002-AC-20: successful update replaces the list entry', () => {
    it('shows the updated name in place of the old one', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(activityApi.update).mockResolvedValue({ ...walk, name: 'Walk further' })
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
      await userEvent.clear(screen.getByLabelText(/name/i))
      await userEvent.type(screen.getByLabelText(/name/i), 'Walk further')
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      expect(await screen.findByText('Walk further')).toBeInTheDocument()
      expect(screen.queryByText('Walk', { exact: true })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-013-AC-01/AC-02/AC-03: Add activity opens a modal, not a bottom form', () => {
    it('renders no form until Add activity is clicked, then opens it in a dialog', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      await screen.findByText(/no activities yet/i)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: /^name$/i })).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

      expect(await screen.findByRole('dialog', { name: /add activity/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /^name$/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-013-AC-04/AC-05: Edit opens the same modal in edit mode', () => {
    it('opens a dialog titled "Edit activity" pre-filled with the row\'s data', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /^edit$/i }))

      expect(await screen.findByRole('dialog', { name: /edit activity/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /^name$/i })).toHaveValue('Walk')
    })
  })

  describe('FRONTEND-013-AC-07/AC-08/AC-09: category guidance is always visible with examples', () => {
    it('shows a purpose and example for each category, and the cross-category note', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))
      await screen.findByRole('dialog')

      expect(screen.getByText(/cooking dinner because food is needed/i)).toBeInTheDocument()
      expect(screen.getByText(/a daily walk you always take/i)).toBeInTheDocument()
      expect(screen.getByText(/trying a new recipe because it sounds fun/i)).toBeInTheDocument()
      expect(
        screen.getByText(/same activity can belong to a different category/i),
      ).toBeInTheDocument()
    })
  })

  describe('FRONTEND-013-AC-11: create-mode submit button is "Save activity", not "Add activity"', () => {
    it("does not collide with the page-level trigger's own label", async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))
      await screen.findByRole('dialog')

      expect(screen.getByRole('button', { name: /^add activity$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^save activity$/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-013-AC-12/AC-13: Cancel in create mode closes with no create call', () => {
    it('calls no create and closes the modal', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))
      await screen.findByRole('dialog')

      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(activityApi.create).not.toHaveBeenCalled()
    })
  })

  describe('FRONTEND-013-AC-15: a second Add/Edit while open retargets, never a second dialog', () => {
    it('switches from create to edit without stacking a dialog', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))
      await screen.findByRole('dialog', { name: /add activity/i })

      await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))

      expect(await screen.findByRole('dialog', { name: /edit activity/i })).toBeInTheDocument()
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })
  })

  describe('FRONTEND-002-AC-22/AC-24: delete uses an inline confirm, not window.confirm', () => {
    it('cancelling the inline confirm does not call activityApi.remove', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(activityApi.remove).not.toHaveBeenCalled()
      expect(screen.getByText('Walk')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-002-AC-23/AC-25: confirming delete removes the activity', () => {
    it('calls activityApi.remove and removes the row on success', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(activityApi.remove).mockResolvedValue(undefined)
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

      expect(activityApi.remove).toHaveBeenCalledWith('1')
      await waitFor(() => expect(screen.queryByText('Walk')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-002-AC-26: failed delete shows an alert and keeps the activity', () => {
    it('displays the error and leaves the row in place', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(activityApi.remove).mockRejectedValue({ status: 500, message: 'Server error' })
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /delete/i }))
      await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i)
      expect(screen.getByText('Walk')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-003-AC-01/AC-02: expand/collapse toggles the sub-task checklist', () => {
    it('renders SubTaskList on expand and removes it on collapse', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /sub-tasks/i }))
      expect(subTaskApi.getAll).toHaveBeenCalledWith('1')
      expect(await screen.findByText(/no sub-tasks yet/i)).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /hide sub-tasks/i }))
      expect(screen.queryByText(/no sub-tasks yet/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-006-AC-05: default mount fetch excludes archived activities', () => {
    it('calls activityApi.getAll(false) on mount', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await screen.findByText('Walk')
      expect(activityApi.getAll).toHaveBeenCalledWith(false)
    })
  })

  describe('FRONTEND-006-AC-06: "Show archived" toggle, off by default', () => {
    it('renders an unchecked checkbox', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      expect(screen.getByRole('checkbox', { name: /show archived/i })).not.toBeChecked()
    })
  })

  describe('FRONTEND-006-AC-07/AC-08: toggling "Show archived" refetches and toggles archived visibility', () => {
    it('fetches with includeArchived=true when on, and false again when off', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)
      await screen.findByText('Walk')

      vi.mocked(activityApi.getAll).mockResolvedValueOnce([walk, jobs])
      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))

      expect(activityApi.getAll).toHaveBeenLastCalledWith(true)
      expect(await screen.findByText('(Archived)')).toBeInTheDocument()

      vi.mocked(activityApi.getAll).mockResolvedValueOnce([walk])
      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))

      expect(activityApi.getAll).toHaveBeenLastCalledWith(false)
      await waitFor(() => expect(screen.queryByText('(Archived)')).not.toBeInTheDocument())
    })
  })

  describe('FRONTEND-006-AC-09/AC-10/AC-11: Unarchive replaces the normal actions and restores the activity', () => {
    it('calls unarchive and shows the normal actions again on success', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([jobs])
      vi.mocked(activityApi.unarchive).mockResolvedValue(undefined)
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
      expect(await screen.findByRole('button', { name: /unarchive/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sub-tasks/i })).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /unarchive/i }))

      expect(activityApi.unarchive).toHaveBeenCalledWith('2')
      expect(await screen.findByRole('button', { name: /^edit$/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /unarchive/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-006-AC-15: archived activity sub-tasks are viewable but read-only', () => {
    it('shows sub-tasks with no create form and no Rename/Delete actions', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([jobs])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([
        {
          id: 's1',
          activityId: '2',
          name: 'Update CV',
          category: 'NECESSARY',
          createdAt: '2026-09-29T00:00:00Z',
        },
      ])
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
      await userEvent.click(await screen.findByRole('button', { name: /sub-tasks/i }))

      expect(await screen.findByText('Update CV')).toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: /sub-task name/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-006-AC-13: "Show archived" re-fetch failure shows an alert with a working Retry', () => {
    it('retries the fetch with includeArchived still true, keeping the toggle on', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)
      await screen.findByText('Walk')

      vi.mocked(activityApi.getAll).mockRejectedValueOnce(
        new ApiError(500, 'Something went wrong. Please try again.'),
      )
      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /show archived/i })).toBeChecked()

      vi.mocked(activityApi.getAll).mockResolvedValueOnce([walk, jobs])
      await userEvent.click(screen.getByRole('button', { name: /retry/i }))

      expect(activityApi.getAll).toHaveBeenLastCalledWith(true)
      expect(await screen.findByText('(Archived)')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-006-AC-14: unarchive failure shows an alert and leaves the activity archived', () => {
    it('keeps the Unarchive action visible after a rejected call', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([jobs])
      vi.mocked(activityApi.unarchive).mockRejectedValue(
        new ApiError(500, 'Something went wrong. Please try again.'),
      )
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
      await userEvent.click(await screen.findByRole('button', { name: /unarchive/i }))

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /unarchive/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-017-AC-01: renders a category filter defaulting to All', () => {
    it('renders a "Filter by category" group with all four options, All checked', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await screen.findByText('Walk')

      expect(screen.getByRole('group', { name: /filter by category/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /all/i })).toBeChecked()
      expect(screen.getByRole('radio', { name: /^routine$/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /^necessary$/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /^pleasurable$/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-017-AC-02: selecting a category narrows the list to matching activities', () => {
    it('shows only Pleasurable activities when Pleasurable is selected', async () => {
      const paint: Activity = {
        id: '3',
        name: 'Paint',
        category: 'PLEASURABLE',
        description: null,
        repeatable: false,
        archived: false,
        favourite: false,
        createdAt: '2026-09-28T00:00:00Z',
        subTaskCount: 0,
      }
      vi.mocked(activityApi.getAll).mockResolvedValue([walk, paint])
      render(<ActivityBank />)

      await screen.findByText('Walk')
      await userEvent.click(screen.getByRole('radio', { name: /^pleasurable$/i }))

      expect(screen.queryByText('Walk')).not.toBeInTheDocument()
      expect(screen.getByText('Paint')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-017-AC-03: category filter and Show archived combine with AND logic', () => {
    it('narrows whatever Show archived already includes (active + archived) to the selected category', async () => {
      const oldWalk: Activity = {
        id: '4',
        name: 'Old walk',
        category: 'ROUTINE',
        description: null,
        repeatable: false,
        archived: true,
        favourite: false,
        createdAt: '2026-09-28T00:00:00Z',
        subTaskCount: 0,
      }
      const paint: Activity = {
        id: '3',
        name: 'Paint',
        category: 'PLEASURABLE',
        description: null,
        repeatable: false,
        archived: true,
        favourite: false,
        createdAt: '2026-09-28T00:00:00Z',
        subTaskCount: 0,
      }
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)
      await screen.findByText('Walk')

      vi.mocked(activityApi.getAll).mockResolvedValueOnce([walk, oldWalk, paint])
      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
      await screen.findByText('Old walk')

      await userEvent.click(screen.getByRole('radio', { name: /^routine$/i }))

      expect(screen.getByText('Walk')).toBeInTheDocument()
      expect(screen.getByText('Old walk')).toBeInTheDocument()
      expect(screen.queryByText('Paint')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-017-AC-04: shows a filtered-empty message, not the generic empty state', () => {
    it('shows "No activities in this category." when the filter matches nothing', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await screen.findByText('Walk')
      await userEvent.click(screen.getByRole('radio', { name: /^pleasurable$/i }))

      expect(screen.getByText(/no activities in this category/i)).toBeInTheDocument()
      expect(screen.queryByText(/no activities yet/i)).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-019-AC-01: shows a repeatable icon for a repeatable activity', () => {
    it('renders a RepeatableIcon for an activity with repeatable: true', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')!
      expect(within(row).getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-019-AC-02: shows no repeatable icon for a one-off activity', () => {
    it('renders no RepeatableIcon for an activity with repeatable: false', async () => {
      const renewPassport: Activity = {
        id: '5',
        name: 'Renew passport',
        category: 'NECESSARY',
        description: null,
        repeatable: false,
        archived: false,
        favourite: false,
        createdAt: '2026-09-28T00:00:00Z',
        subTaskCount: 0,
      }
      vi.mocked(activityApi.getAll).mockResolvedValue([renewPassport])
      render(<ActivityBank />)

      const row = (await screen.findByText('Renew passport')).closest('li')!
      expect(within(row).queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-019-AC-03: icon has an accessible name', () => {
    it('labels the icon "Repeatable" for assistive technology', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')!
      expect(within(row).getByLabelText('Repeatable')).toBeInTheDocument()
    })
  })

  describe('FRONTEND-019-AC-04: renders RepeatableIcon before the (Archived) label when both apply', () => {
    it('places the repeatable icon earlier in the DOM than the archived label', async () => {
      const oldRoutine: Activity = {
        id: '6',
        name: 'Old routine',
        category: 'ROUTINE',
        description: null,
        repeatable: true,
        archived: true,
        favourite: false,
        createdAt: '2026-09-28T00:00:00Z',
        subTaskCount: 0,
      }
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)
      await screen.findByText('Walk')

      vi.mocked(activityApi.getAll).mockResolvedValueOnce([walk, oldRoutine])
      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))

      const row = (await screen.findByText('Old routine')).closest('li')!
      const icon = within(row).getByRole('img', { name: /repeatable/i })
      const archivedLabel = within(row).getByText('(Archived)')
      expect(icon.compareDocumentPosition(archivedLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  describe('FRONTEND-018-AC-01: "Add sub-tasks" when an activity has no sub-tasks', () => {
    it('labels the toggle "Add sub-tasks" when subTaskCount is 0', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([{ ...walk, subTaskCount: 0 }])
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')!
      expect(within(row).getByRole('button', { name: 'Add sub-tasks' })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-018-AC-02: "Show sub-tasks (N)" when an activity has sub-tasks', () => {
    it('labels the toggle with the sub-task count when subTaskCount is greater than 0', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([{ ...walk, subTaskCount: 3 }])
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')!
      expect(within(row).getByRole('button', { name: 'Show sub-tasks (3)' })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-018-AC-03: expanded state always reads "Hide sub-tasks", regardless of count', () => {
    it('reads "Hide sub-tasks" once expanded, even for a zero-count activity', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([{ ...walk, subTaskCount: 0 }])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')!
      await userEvent.click(within(row).getByRole('button', { name: 'Add sub-tasks' }))

      expect(within(row).getByRole('button', { name: 'Hide sub-tasks' })).toBeInTheDocument()
    })
  })

  describe('FRONTEND-023-AC-01: refetches sub-tasks when the currently-expanded activity is successfully edited', () => {
    it('calls subTaskApi.getAll again after saving an edit to the expanded activity', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      vi.mocked(activityApi.update).mockResolvedValue({ ...walk, category: 'NECESSARY' })
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /sub-tasks/i }))
      await waitFor(() => expect(subTaskApi.getAll).toHaveBeenCalledTimes(1))

      await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
      const dialog = within(await screen.findByRole('dialog'))
      await userEvent.click(dialog.getByRole('radio', { name: /^necessary$/i }))
      await userEvent.click(dialog.getByRole('button', { name: /save changes/i }))

      await waitFor(() => expect(subTaskApi.getAll).toHaveBeenCalledTimes(2))
    })
  })

  describe('FRONTEND-023-AC-02: does not refetch the open panel when a different activity is edited', () => {
    it('leaves subTaskApi.getAll called only once when a non-expanded activity is edited', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk, read])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      vi.mocked(activityApi.update).mockResolvedValue({ ...read, name: 'Read more books' })
      render(<ActivityBank />)

      const walkRow = (await screen.findByText('Walk')).closest('li')!
      await userEvent.click(within(walkRow).getByRole('button', { name: /sub-tasks/i }))
      await waitFor(() => expect(subTaskApi.getAll).toHaveBeenCalledTimes(1))

      const readRow = (await screen.findByText('Read a book')).closest('li')!
      await userEvent.click(within(readRow).getByRole('button', { name: /^edit$/i }))
      await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => expect(screen.getByText('Read more books')).toBeInTheDocument())
      expect(subTaskApi.getAll).toHaveBeenCalledTimes(1)
    })
  })

  describe('FRONTEND-023-AC-03: does not refetch the open panel when a new activity is created', () => {
    it('leaves subTaskApi.getAll called only once when a new activity is created', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      vi.mocked(activityApi.create).mockResolvedValue({ ...read })
      render(<ActivityBank />)

      await userEvent.click(await screen.findByRole('button', { name: /sub-tasks/i }))
      await waitFor(() => expect(subTaskApi.getAll).toHaveBeenCalledTimes(1))

      await userEvent.click(screen.getByRole('button', { name: /add activity/i }))
      const dialog = within(screen.getByRole('dialog'))
      await userEvent.type(dialog.getByRole('textbox', { name: /^name$/i }), 'Read a book')
      await userEvent.click(dialog.getByRole('radio', { name: /^pleasurable$/i }))
      await userEvent.click(dialog.getByRole('button', { name: /save activity/i }))

      await waitFor(() => expect(screen.getByText('Read a book')).toBeInTheDocument())
      expect(subTaskApi.getAll).toHaveBeenCalledTimes(1)
    })
  })

  describe('FRONTEND-027-AC-01: each activity row has a favourite-toggle button', () => {
    it('renders a favourite toggle reflecting favourite state via aria-pressed', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')!
      expect(
        within(row).getByRole('button', { name: /favourite/i, pressed: false }),
      ).toBeInTheDocument()
    })

    it('renders the toggle on an archived row too', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([jobs])
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
      const row = (await screen.findByText('Apply for jobs')).closest('li')!
      expect(
        within(row).getByRole('button', { name: /favourite/i, pressed: false }),
      ).toBeInTheDocument()
    })
  })

  describe('FRONTEND-027-AC-02: clicking an unfavourited toggle marks it favourite', () => {
    it('calls activityApi.markFavourite and updates state on success', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(activityApi.markFavourite).mockResolvedValue({ ...walk, favourite: true })
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')!
      await userEvent.click(within(row).getByRole('button', { name: /favourite/i, pressed: false }))

      expect(activityApi.markFavourite).toHaveBeenCalledWith('1')
      expect(
        await within(row).findByRole('button', { name: /favourite/i, pressed: true }),
      ).toBeInTheDocument()
    })
  })

  describe('FRONTEND-027-AC-03: clicking a favourited toggle unmarks it', () => {
    it('calls activityApi.unmarkFavourite and updates state on success', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([{ ...walk, favourite: true }])
      vi.mocked(activityApi.unmarkFavourite).mockResolvedValue(undefined)
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')!
      await userEvent.click(within(row).getByRole('button', { name: /favourite/i, pressed: true }))

      expect(activityApi.unmarkFavourite).toHaveBeenCalledWith('1')
      expect(
        await within(row).findByRole('button', { name: /favourite/i, pressed: false }),
      ).toBeInTheDocument()
    })
  })

  describe('FRONTEND-027: favourite toggle failure shows an alert and leaves state unchanged', () => {
    it('keeps the toggle unfavourited after a rejected markFavourite call', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      vi.mocked(activityApi.markFavourite).mockRejectedValue(
        new ApiError(500, 'Something went wrong. Please try again.'),
      )
      render(<ActivityBank />)

      const row = (await screen.findByText('Walk')).closest('li')!
      await userEvent.click(within(row).getByRole('button', { name: /favourite/i, pressed: false }))

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(
        within(row).getByRole('button', { name: /favourite/i, pressed: false }),
      ).toBeInTheDocument()
    })
  })

  describe('FRONTEND-027-AC-04: Activity Bank list preserves backend-provided order', () => {
    it('renders activities in the exact order activityApi.getAll returns', async () => {
      const zebraFavourite: Activity = { ...walk, id: '10', name: 'Zebra', favourite: true }
      const appleActivity: Activity = { ...walk, id: '11', name: 'Apple', favourite: false }
      const mangoActivity: Activity = { ...walk, id: '12', name: 'Mango', favourite: false }
      vi.mocked(activityApi.getAll).mockResolvedValue([zebraFavourite, appleActivity, mangoActivity])
      render(<ActivityBank />)

      await screen.findByText('Zebra')
      const names = within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map((row) => row.textContent)
      expect(names[0]).toContain('Zebra')
      expect(names[1]).toContain('Apple')
      expect(names[2]).toContain('Mango')
    })
  })

  describe('FRONTEND-027-AC-10: renders a "Favourites only" filter, unchecked by default', () => {
    it('renders an unchecked checkbox', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await screen.findByText('Walk')
      expect(screen.getByRole('checkbox', { name: /favourites only/i })).not.toBeChecked()
    })
  })

  describe('FRONTEND-027-AC-11: checking the filter hides non-favourites, composes with the category filter', () => {
    it('shows only favourited Routine activities when both filters are active', async () => {
      const favouritedRoutine: Activity = { ...walk, id: '20', name: 'Favourited routine', category: 'ROUTINE', favourite: true }
      const nonFavouritedRoutine: Activity = { ...walk, id: '21', name: 'Non-favourited routine', category: 'ROUTINE', favourite: false }
      const favouritedPleasurable: Activity = { ...walk, id: '22', name: 'Favourited pleasurable', category: 'PLEASURABLE', favourite: true }
      vi.mocked(activityApi.getAll).mockResolvedValue([
        favouritedRoutine,
        nonFavouritedRoutine,
        favouritedPleasurable,
      ])
      render(<ActivityBank />)

      await screen.findByText('Favourited routine')
      await userEvent.click(screen.getByRole('checkbox', { name: /favourites only/i }))
      await userEvent.click(screen.getByRole('radio', { name: /^routine$/i }))

      expect(screen.getByText('Favourited routine')).toBeInTheDocument()
      expect(screen.queryByText('Non-favourited routine')).not.toBeInTheDocument()
      expect(screen.queryByText('Favourited pleasurable')).not.toBeInTheDocument()
    })
  })

  describe('FRONTEND-031-AC-06: "Add activity" button is primary', () => {
    it('combines styles.addButton with buttonVariants.primary', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      render(<ActivityBank />)

      const addButton = await screen.findByRole('button', { name: 'Add activity' })
      expect(addButton).toHaveClass(styles.addButton)
      expect(addButton).toHaveClass(buttonStyles.primary)
    })
  })

  describe('FRONTEND-031-AC-13: Delete/Confirm delete are destructive; Cancel is not', () => {
    it('applies destructive to Delete and Confirm delete, and no variant to Cancel', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      const deleteButton = await screen.findByRole('button', { name: 'Delete' })
      expect(deleteButton).toHaveClass(buttonStyles.destructive)

      await userEvent.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: 'Confirm delete' })
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      expect(confirmButton).toHaveClass(buttonStyles.destructive)
      expect(cancelButton).not.toHaveClass(buttonStyles.destructive)
      expect(cancelButton).not.toHaveClass(buttonStyles.primary)
    })
  })

  describe('FRONTEND-031-AC-15/AC-16: regression guard -- other ActivityBank buttons stay unstyled', () => {
    it('leaves Edit, favourite toggle, and sub-tasks disclosure with no variant class', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([walk])
      render(<ActivityBank />)

      await screen.findByText('Walk')
      const editButton = screen.getByRole('button', { name: /^edit$/i })
      const favouriteButton = screen.getByRole('button', { name: /favourite/i })
      const subTasksButton = screen.getByRole('button', { name: /sub-tasks/i })

      for (const button of [editButton, favouriteButton, subTasksButton]) {
        expect(button).not.toHaveClass(buttonStyles.primary)
        expect(button).not.toHaveClass(buttonStyles.destructive)
      }
    })

    it('leaves Unarchive with no variant class', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([jobs])
      render(<ActivityBank />)

      await userEvent.click(screen.getByRole('checkbox', { name: /show archived/i }))
      const unarchiveButton = await screen.findByRole('button', { name: /unarchive/i })
      expect(unarchiveButton).not.toHaveClass(buttonStyles.primary)
      expect(unarchiveButton).not.toHaveClass(buttonStyles.destructive)
    })
  })

  describe('FRONTEND-027-AC-12: unchecking the filter restores previously-hidden activities', () => {
    it('restores non-favourited activities after unchecking', async () => {
      const favouritedActivity: Activity = { ...walk, id: '30', name: 'Favourited one', favourite: true }
      const nonFavouritedActivity: Activity = { ...walk, id: '31', name: 'Non-favourited one', favourite: false }
      vi.mocked(activityApi.getAll).mockResolvedValue([favouritedActivity, nonFavouritedActivity])
      render(<ActivityBank />)

      await screen.findByText('Favourited one')
      const checkbox = screen.getByRole('checkbox', { name: /favourites only/i })
      await userEvent.click(checkbox)
      expect(screen.queryByText('Non-favourited one')).not.toBeInTheDocument()

      await userEvent.click(checkbox)
      expect(screen.getByText('Non-favourited one')).toBeInTheDocument()
    })
  })
})
