import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivityDrawer } from './ActivityDrawer'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'

vi.mock('../../services/activityApi')
vi.mock('../../services/subTaskApi')

const noop = () => {}

function drawerProps(overrides: Partial<Parameters<typeof ActivityDrawer>[0]> = {}) {
  return {
    onDragStartActivity: noop,
    onDragStartSubTask: noop,
    onDragEnd: noop,
    onClose: noop,
    ...overrides,
  }
}

describe('FRONTEND-016-AC-10: the "Browse activities" drawer', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
  })

  it('renders a labelled complementary panel with ActivityPickerList in drag mode', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<ActivityDrawer {...drawerProps()} />)

    expect(screen.getByRole('complementary', { name: /activities/i })).toBeInTheDocument()
  })

  it('renders a close control that calls onClose', async () => {
    const onClose = vi.fn()
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<ActivityDrawer {...drawerProps({ onClose })} />)

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})

// FRONTEND-032-AC-05: the "Filters" disclosure is collapsed by default, with zero changes to
// ActivityDrawer.tsx itself -- achieved entirely through its existing, unmodified
// <ActivityPickerList mode="drag" .../> render (frontend_spec_032_collapsible_filters.md).
describe('FRONTEND-032-AC-05: the drawer shows the collapsed Filters disclosure', () => {
  beforeEach(() => {
    vi.mocked(activityApi.getAll).mockReset()
    vi.mocked(subTaskApi.getAll).mockReset()
  })

  it('shows the Filters disclosure collapsed by default', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      {
        id: 'a1',
        name: 'Go for a walk',
        category: 'ROUTINE',
        description: null,
        repeatable: true,
        archived: false,
        favourite: false,
        createdAt: '2026-09-01T00:00:00Z',
        subTaskCount: 0,
      },
    ])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    render(<ActivityDrawer {...drawerProps()} />)

    const disclosure = (await screen.findByText('Filters')).closest('details')!
    expect(disclosure).not.toHaveAttribute('open')
  })
})

// FRONTEND-016-AC-11: ActivityPickerList.tsx's drag-mode rows are reused unmodified (confirmed by
// ActivityPickerList.test.tsx's unchanged drag-start/drag-end coverage); the fix for
// frontend_spec_028's confirmed "no drag affordance" finding (computed cursor: auto, no handle
// icon) is CSS, not component state -- following frontend_conventions.md's established pattern
// (CSS Module class + source-file content assertions, no getComputedStyle) rather than a
// rendered-contrast/computed-style check jsdom can't validate anyway.
describe('FRONTEND-016-AC-11: drawer rows render a visible drag affordance', () => {
  it('styles draggable drawer rows with a grab cursor and a grip-icon affordance', () => {
    const css = readFileSync(resolve(__dirname, './ActivityDrawer.module.css'), 'utf-8')
    expect(css).toMatch(/cursor:\s*grab/)
    expect(css).toMatch(/cursor:\s*grabbing/)
    // A real handle icon, not just a cursor change -- mirrors OccurrenceItem.module.css's
    // .dragHandle/.gripIcon six-dot grip pattern via mask-image + currentColor.
    expect(css).toMatch(/mask-image/)
    expect(css).toMatch(/currentColor/)
  })
})
