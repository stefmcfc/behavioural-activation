import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Modal } from './Modal'

function TestHarness({ initialOpen }: { readonly initialOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen)
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      <Modal isOpen={isOpen} titleId="t" onClose={() => setIsOpen(false)}>
        <h3 id="t">Title</h3>
        <button type="button" onClick={() => setIsOpen(false)}>
          Content Cancel
        </button>
      </Modal>
    </>
  )
}

describe('FRONTEND-009-AC-01/AC-02: closed by default, opens on isOpen becoming true', () => {
  it('has no dialog role until Open is clicked', async () => {
    render(<TestHarness initialOpen={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog', { name: 'Title' })).toBeInTheDocument()
  })
})

describe('FRONTEND-009-AC-04/AC-05: focus moves in on open, back to the opener on close', () => {
  it('focuses the dialog, then restores focus to the Open button on close', async () => {
    render(<TestHarness initialOpen={false} />)
    const openButton = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(openButton)

    expect(await screen.findByRole('dialog')).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Content Cancel' }))
    expect(openButton).toHaveFocus()
  })
})

describe('FRONTEND-009-AC-06: clicking the dialog backdrop closes it', () => {
  it('closes when the click target is the dialog element itself', async () => {
    render(<TestHarness initialOpen={true} />)
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(dialog)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('does not close when the click target is inside the content', async () => {
    render(<TestHarness initialOpen={true} />)
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByText('Title'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('FRONTEND-009-AC-07: aria-labelledby wires to the caller-supplied heading', () => {
  it('exposes the accessible name from the id-matched heading', async () => {
    render(<TestHarness initialOpen={true} />)
    expect(await screen.findByRole('dialog', { name: 'Title' })).toBeInTheDocument()
  })
})

describe('FRONTEND-009-AC-08: the native close event calls onClose exactly once', () => {
  it('calls onClose once when the dialog fires its close event', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} titleId="t" onClose={onClose}>
        <h3 id="t">Title</h3>
      </Modal>,
    )
    const dialog = await screen.findByRole('dialog')

    fireEvent(dialog, new Event('close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
