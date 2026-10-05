import { useId } from 'react'
import { Settings } from '../Settings/Settings'
import styles from './SettingsMenu.module.css'

function GearIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M8 1.6v1.9M8 12.5v1.9M14.4 8h-1.9M3.5 8H1.6M12.4 3.6l-1.35 1.35M4.95 11.05 3.6 12.4M12.4 12.4l-1.35-1.35M4.95 4.95 3.6 3.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SettingsMenu() {
  const panelId = useId()

  return (
    // display:contents (see CSS) -- this wrapper exists purely so :has() can detect the panel's
    // open state and style the trigger accordingly; it introduces no layout box of its own, so
    // the trigger remains a direct flex item of the header exactly as before.
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        popoverTarget={panelId}
        aria-label="Settings"
      >
        <GearIcon />
      </button>
      {/* Settings.tsx's own markup is left unchanged per the spec (its <h2>Settings</h2> has no
          id to anchor aria-labelledby to without modifying it) -- the panel is named directly
          with aria-label instead, rather than duplicating a second visible "Settings" heading.
          Positioned via CSS anchor positioning (position-anchor/anchor()) rather than a DOM-tree
          relative/absolute wrapper -- a popover is promoted to the top layer when open, which
          changes its containing block to the viewport, so a wrapper-relative approach doesn't
          actually anchor it to the trigger. */}
      {/* NOSONAR(typescript:S6819): none of <details>/<fieldset>/<optgroup>/<address> fit a
          popover panel -- role="group" + aria-label already gives it a correct accessible name. */}
      <div id={panelId} popover="auto" role="group" aria-label="Settings" className={styles.panel}>
        <Settings />
      </div>
    </div>
  )
}
