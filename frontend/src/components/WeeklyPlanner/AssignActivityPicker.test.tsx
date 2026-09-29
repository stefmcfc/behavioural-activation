import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssignActivityPicker } from './AssignActivityPicker'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'

vi.mock('../../services/activityApi')
vi.mock('../../services/subTaskApi')
vi.mock('../../services/planApi')

describe('AssignActivityPicker', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
  })

  describe('FRONTEND-006-AC-12: never fetches with includeArchived (regression guard)', () => {
    it('calls activityApi.getAll with no arguments', async () => {
      vi.mocked(activityApi.getAll).mockResolvedValue([])
      vi.mocked(subTaskApi.getAll).mockResolvedValue([])
      render(
        <AssignActivityPicker
          weekStart="2026-09-28"
          target={{ dayOfWeek: 'MONDAY', slot: 'MORNING' }}
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />,
      )

      await waitFor(() => expect(activityApi.getAll).toHaveBeenCalledWith())
    })
  })
})
