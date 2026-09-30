import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Modal.module.css'

interface ModalProps {
  readonly isOpen: boolean
  readonly titleId: string
  readonly onClose: () => void
  readonly children: ReactNode
}

export function Modal({ isOpen, titleId, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null
      dialog.showModal()
      dialog.focus()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  const handleNativeClose = () => {
    previouslyFocusedRef.current?.focus()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={styles.dialog}
      onClose={handleNativeClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          dialogRef.current?.close()
        }
      }}
    >
      {children}
    </dialog>
  )
}
