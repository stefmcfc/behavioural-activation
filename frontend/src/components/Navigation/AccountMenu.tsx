import { useId } from 'react'
import styles from './AccountMenu.module.css'

interface AccountMenuProps {
  readonly username: string
  readonly onLogout: () => void
}

function PersonIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="8" cy="6.3" r="2.1" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M3.4 12.8a5 5 0 0 1 9.2 0"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AccountMenu({ username, onLogout }: AccountMenuProps) {
  const panelId = useId()
  const titleId = useId()

  return (
    // display:contents (see CSS) -- this wrapper exists purely so :has() can detect the panel's
    // open state and style the trigger accordingly; it introduces no layout box of its own, so
    // the trigger remains a direct flex item of the header exactly as before.
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        popoverTarget={panelId}
        aria-label="Account"
      >
        <PersonIcon />
      </button>
      {/* Positioned via CSS anchor positioning -- see SettingsMenu.tsx's comment for why a
          DOM-tree relative/absolute wrapper doesn't work once the popover is open (top-layer
          promotion changes its containing block to the viewport). */}
      <div id={panelId} popover="auto" aria-labelledby={titleId} className={styles.panel}>
        <h2 id={titleId} className={styles.panelTitle}>
          Account
        </h2>
        <p className={styles.username}>{username}</p>
        <button type="button" className={styles.logoutButton} onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  )
}
