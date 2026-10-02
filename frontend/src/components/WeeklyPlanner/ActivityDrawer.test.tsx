import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivityDrawer } from './ActivityDrawer'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import type { Activity } from '../../types/activity'
import type { SubTask } from '../../types/subTask'

vi.mock('../../services/activityApi')
vi.mock('../../services/subTaskApi')

const walk: Activity = {
  id: 'activity-1',
  name: 'Go for a walk',
  category: 'ROUTINE',
  description: null,
  repeatable: true,
  archived: false,
  favourite: false,
  createdAt: '2026-09-01T00:00:00Z',
  subTaskCount: 0,
}

const party: Activity = {
  id: 'activity-2',
  name: 'Organise a leaving party',
  category: 'NECESSARY',
  description: null,
  repeatable: true,
  archived: false,
  favourite: false,
  createdAt: '2026-09-01T00:00:00Z',
  subTaskCount: 1,
}

const sendInvitations: SubTask = {
  id: 'subtask-1',
  activityId: 'activity-2',
  name: 'Send invitations',
  category: 'PLEASURABLE',
  createdAt: '2026-09-01T00:00:00Z',
}

const noop = () => {}

function dragProps(
  overrides: Partial<Parameters<typeof ActivityDrawer>[0]> = {},
): Parameters<typeof ActivityDrawer>[0] {
  return {
    onDragStartActivity: noop,
    onDragStartSubTask: noop,
    onDragEnd: noop,
    onClose: noop,
    ...overrides,
  }
}

describe('FRONTEND-028: ActivityDrawer is drag-only', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
  })

  it('AC-06: rows are draggable with no select button', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    render(<ActivityDrawer {...dragProps()} />)

    const row = (await screen.findByText('Go for a walk')).closest('li')!
    expect(row).toHaveAttribute('draggable', 'true')
    expect(screen.queryByRole('button', { name: 'Go for a walk' })).not.toBeInTheDocument()
  })

  it('AC-06: a sub-task row is also draggable with no select button', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([sendInvitations])
    render(<ActivityDrawer {...dragProps()} />)

    const row = (await screen.findByText('Send invitations')).closest('li')!
    expect(row).toHaveAttribute('draggable', 'true')
    expect(screen.queryByRole('button', { name: 'Send invitations' })).not.toBeInTheDocument()
  })

  it('AC-07: dragging an activity row calls onDragStartActivity, not onDragStartSubTask', async () => {
    const onDragStartActivity = vi.fn()
    const onDragStartSubTask = vi.fn()
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    render(<ActivityDrawer {...dragProps({ onDragStartActivity, onDragStartSubTask })} />)

    const row = (await screen.findByText('Go for a walk')).closest('li')!
    fireEvent.dragStart(row)

    expect(onDragStartActivity).toHaveBeenCalledWith('activity-1')
    expect(onDragStartSubTask).not.toHaveBeenCalled()
  })

  it('AC-07: dragging a sub-task row calls onDragStartSubTask, not onDragStartActivity', async () => {
    const onDragStartActivity = vi.fn()
    const onDragStartSubTask = vi.fn()
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([sendInvitations])
    render(<ActivityDrawer {...dragProps({ onDragStartActivity, onDragStartSubTask })} />)

    const row = (await screen.findByText('Send invitations')).closest('li')!
    fireEvent.dragStart(row)

    expect(onDragStartSubTask).toHaveBeenCalledWith('subtask-1')
    expect(onDragStartActivity).not.toHaveBeenCalled()
  })

  it('AC-08: a dragend with no drop resets the shared drag state', async () => {
    const onDragEnd = vi.fn()
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    render(<ActivityDrawer {...dragProps({ onDragEnd })} />)

    const row = (await screen.findByText('Go for a walk')).closest('li')!
    fireEvent.dragStart(row)
    fireEvent.dragEnd(row)

    expect(onDragEnd).toHaveBeenCalled()
  })

  it('AC-09: the category filter hides a non-matching activity the same as the modal does', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk, party])
    vi.mocked(subTaskApi.getAll).mockImplementation((activityId) =>
      Promise.resolve(activityId === 'activity-2' ? [sendInvitations] : []),
    )
    render(<ActivityDrawer {...dragProps()} />)

    await screen.findByText('Go for a walk')

    await userEvent.click(screen.getByRole('radio', { name: 'Necessary' }))

    expect(screen.queryByText('Go for a walk')).not.toBeInTheDocument()
    expect(screen.getByText('Organise a leaving party')).toBeInTheDocument()
  })

  it('renders a close control that calls onClose', async () => {
    const onClose = vi.fn()
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    render(<ActivityDrawer {...dragProps({ onClose })} />)

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
