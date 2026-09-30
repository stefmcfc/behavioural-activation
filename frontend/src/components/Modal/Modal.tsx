import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Modal.module.css'

interface ModalProps {
  readonly isOpen: boolean
  /** Points to a visible heading's id. Provide this or `ariaLabel`, not both. */
  readonly titleId?: string
  /** Accessible name for dialogs with no single visible heading to label them. */
  readonly ariaLabel?: string
  readonly onClose: () => void
  readonly children: ReactNode
  /** Merged onto the dialog's own class, e.g. to override the default width. */
  readonly className?: string
}

export function Modal({ isOpen, titleId, ariaLabel, onClose, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const closingProgrammaticallyRef = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null
      dialog.showModal()
      dialog.focus()
    } else if (!isOpen && dialog.open) {
      // isOpen already reflects the caller's desired state here (e.g. a sibling instance
      // became the active one) -- close() still fires the native 'close' event below, but
      // there's no fresh close decision to report back, so skip calling onClose for it.
      closingProgrammaticallyRef.current = true
      dialog.close()
    }
  }, [isOpen])

  const handleNativeClose = () => {
    previouslyFocusedRef.current?.focus()
    if (closingProgrammaticallyRef.current) {
      closingProgrammaticallyRef.current = false
      return
    }
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-label={ariaLabel}
      className={className ? `${styles.dialog} ${className}` : styles.dialog}
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
