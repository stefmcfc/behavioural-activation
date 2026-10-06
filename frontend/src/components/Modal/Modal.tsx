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
      // showModal() already autofocuses the first focusable descendant per spec (e.g. a form's
      // first input) when one exists -- only fall back to focusing the dialog container itself
      // when nothing inside it was focusable, so callers still get a defined post-open focus
      // target. Unconditionally calling dialog.focus() here would steal focus straight back off
      // that autofocused element, firing a blur on it while still empty -- which any blur-timed
      // "touched empty" validation (e.g. this project's LoginPage-style forms) reads as the user
      // having left it blank, showing a required error nobody actually triggered.
      if (!dialog.contains(document.activeElement)) {
        dialog.focus()
      }
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
    <dialog // NOSONAR(typescript:S6847, typescript:S1082): the onClick below only detects a click
      // landing on the backdrop (see the handler's own target-equality check) to close the dialog as
      // a mouse-only convenience -- it's never the sole way to close: Escape (native <dialog> behavior)
      // and each caller's own Cancel/Close button remain fully keyboard-accessible.
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-label={ariaLabel}
      closedby="any" // NOSONAR(typescript:S6747): valid, standard HTML attribute (closedby) -- Sonar's
      // bundled TS/DOM type definitions haven't caught up yet; @types/react 19.2.18 already types it.
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
