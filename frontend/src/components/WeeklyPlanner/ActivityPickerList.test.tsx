import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivityPickerList } from './ActivityPickerList'
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

const jobs: Activity = {
  id: 'activity-3',
  name: 'Apply for jobs',
  category: 'NECESSARY',
  description: null,
  repeatable: false,
  archived: false,
  favourite: false,
  createdAt: '2026-09-01T00:00:00Z',
  subTaskCount: 0,
}

const noop = () => {}

function dragProps(
  overrides: Partial<Parameters<typeof ActivityPickerList>[0]> = {},
): Parameters<typeof ActivityPickerList>[0] {
  return {
    mode: 'drag',
    onDragStartActivity: noop,
    onDragStartSubTask: noop,
    onDragEnd: noop,
    ...overrides,
  }
}

// FRONTEND-028-AC-06 through AC-09: moved here from the now-deleted ActivityDrawer.test.tsx (see
// frontend_spec_028's "Post-ship correction" section, 2026-10-02) -- ActivityDrawer itself was
// removed from the Weekly Planner, but ActivityPickerList's mode="drag" behavior is unchanged and
// reusable, so its coverage lives here directly rather than only being reachable through a wrapper.
describe('FRONTEND-028: ActivityPickerList in drag mode is drag-only', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAllForOwner).mockReset()
  })

  it('AC-06: rows are draggable with no select button', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
    render(<ActivityPickerList {...dragProps()} />)

    const row = (await screen.findByText('Go for a walk')).closest('li')!
    expect(row).toHaveAttribute('draggable', 'true')
    expect(screen.queryByRole('button', { name: 'Go for a walk' })).not.toBeInTheDocument()
  })

  it('AC-06: a sub-task row is also draggable with no select button', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
    render(<ActivityPickerList {...dragProps()} />)

    const row = (await screen.findByText('Send invitations')).closest('li')!
    expect(row).toHaveAttribute('draggable', 'true')
    expect(screen.queryByRole('button', { name: 'Send invitations' })).not.toBeInTheDocument()
  })

  it('AC-07: dragging an activity row calls onDragStartActivity, not onDragStartSubTask', async () => {
    const onDragStartActivity = vi.fn()
    const onDragStartSubTask = vi.fn()
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
    render(<ActivityPickerList {...dragProps({ onDragStartActivity, onDragStartSubTask })} />)

    const row = (await screen.findByText('Go for a walk')).closest('li')!
    fireEvent.dragStart(row)

    expect(onDragStartActivity).toHaveBeenCalledWith('activity-1')
    expect(onDragStartSubTask).not.toHaveBeenCalled()
  })

  it('AC-07: dragging a sub-task row calls onDragStartSubTask, not onDragStartActivity', async () => {
    const onDragStartActivity = vi.fn()
    const onDragStartSubTask = vi.fn()
    vi.mocked(activityApi.getAll).mockResolvedValue([party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
    render(<ActivityPickerList {...dragProps({ onDragStartActivity, onDragStartSubTask })} />)

    const row = (await screen.findByText('Send invitations')).closest('li')!
    fireEvent.dragStart(row)

    expect(onDragStartSubTask).toHaveBeenCalledWith('subtask-1')
    expect(onDragStartActivity).not.toHaveBeenCalled()
  })

  it('AC-08: a dragend with no drop resets the shared drag state', async () => {
    const onDragEnd = vi.fn()
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
    render(<ActivityPickerList {...dragProps({ onDragEnd })} />)

    const row = (await screen.findByText('Go for a walk')).closest('li')!
    fireEvent.dragStart(row)
    fireEvent.dragEnd(row)

    expect(onDragEnd).toHaveBeenCalled()
  })

  it('AC-09: the category filter hides a non-matching activity the same as select mode does', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk, party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations])
    render(<ActivityPickerList {...dragProps()} />)

    await screen.findByText('Go for a walk')
    await userEvent.click(screen.getByText('Filters'))
    await userEvent.click(screen.getByRole('radio', { name: 'Necessary' }))

    expect(screen.queryByText('Go for a walk')).not.toBeInTheDocument()
    expect(screen.getByText('Organise a leaving party')).toBeInTheDocument()
  })
})

// FRONTEND-032-AC-01/AC-02: the three filter fieldsets live inside one collapsed-by-default
// <details> disclosure (see frontend_spec_032_collapsible_filters.md). Confirmed during
// implementation: jsdom (v30, this project's version) correctly flips the native `open` attribute
// when the <summary> is activated -- the toggle mechanics themselves are not the gap. What jsdom
// does NOT model is the browser's own "a closed <details>'s non-summary content is excluded from
// the accessibility tree" rendering behaviour (the same category of limitation as this project's
// already-documented "jsdom doesn't render CSS" gap -- it's UA-stylesheet-driven hiding, not a
// `hidden`/`aria-hidden` attribute, so Testing Library's isInaccessible check can't see it).
// `getByRole('radio', ...)` still finds a collapsed filter's radios in jsdom even without opening
// the disclosure first. Because of that, AC-02's assertions below deliberately verify the real,
// confirmed-working signal (the `open` attribute toggling) plus structural containment (all three
// groups are descendants of the one <details>), rather than asserting on role-query
// visibility/absence, which would pass in jsdom regardless of whether real-browser hiding worked.
describe('FRONTEND-032-AC-01/AC-02: filters live inside one collapsed-by-default disclosure', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAllForOwner).mockReset()
  })

  it('AC-01: the Filters disclosure is collapsed on initial render', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
    render(<ActivityPickerList {...dragProps()} />)

    await screen.findByText('Go for a walk')

    const disclosure = screen.getByText('Filters').closest('details')!
    expect(disclosure).not.toHaveAttribute('open')
  })

  it('AC-02: activating the summary opens the disclosure and reveals all three fieldsets together', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
    render(<ActivityPickerList {...dragProps()} />)

    await screen.findByText('Go for a walk')
    const disclosure = screen.getByText('Filters').closest('details')!

    await userEvent.click(screen.getByText('Filters'))

    expect(disclosure).toHaveAttribute('open')
    expect(within(disclosure).getByRole('group', { name: /category/i })).toBeInTheDocument()
    expect(within(disclosure).getByRole('group', { name: /type/i })).toBeInTheDocument()
    expect(within(disclosure).getByRole('group', { name: /favourite/i })).toBeInTheDocument()
  })

  it('AC-07: filter state resets to All on a fresh mount', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])
    const { unmount } = render(<ActivityPickerList {...dragProps()} />)
    unmount()

    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    render(<ActivityPickerList {...dragProps()} />)
    await userEvent.click(await screen.findByText('Filters'))

    const categoryGroup = screen.getByRole('group', { name: /category/i })
    expect(within(categoryGroup).getByRole('radio', { name: 'All' })).toBeChecked()
  })
})

// frontend_spec_033_bulk_sub_task_fetch.md: ActivityPickerList fetches every sub-task in one bulk
// call (subTaskApi.getAllForOwner()) in parallel with activityApi.getAll(), rather than fanning out
// one subTaskApi.getAll(activityId) call per activity.
describe('FRONTEND-033-AC-02/AC-03/AC-04: bulk fetch replaces the per-activity fan-out', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAllForOwner).mockReset()
  })

  it('AC-03: issues exactly two API calls regardless of activity count', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk, party, jobs])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])

    render(
      <ActivityPickerList
        mode="select"
        selected={null}
        onSelectActivity={vi.fn()}
        onSelectSubTask={vi.fn()}
      />,
    )
    await screen.findByText(walk.name)

    expect(activityApi.getAll).toHaveBeenCalledTimes(1)
    expect(subTaskApi.getAllForOwner).toHaveBeenCalledTimes(1)
    expect(subTaskApi.getAll).not.toHaveBeenCalled()
  })

  it('AC-04: groups the flat sub-task list by activityId, including an empty array for an activity with none', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk, party])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([sendInvitations]) // walk has zero sub-tasks

    render(
      <ActivityPickerList
        mode="select"
        selected={null}
        onSelectActivity={vi.fn()}
        onSelectSubTask={vi.fn()}
      />,
    )

    expect(await screen.findByText(sendInvitations.name)).toBeInTheDocument()
    // walk renders with no sub-task rows beneath it, not an error/missing-key crash
    expect(screen.getByText(walk.name)).toBeInTheDocument()
  })
})
