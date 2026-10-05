import styles from './WorkDayIcon.module.css'

interface WorkDayIconProps {
  readonly active?: boolean
}

// FRONTEND-042: a small inline SVG badge icon marking a day as a work day -- follows
// RepeatableIcon.tsx/CompletionIcon.tsx's existing shape (role="img", aria-label, currentColor
// stroke, 16x16 viewBox), plus FavouriteIcon.tsx's active/filled-vs-outline precedent since this
// one is a toggle whose visually-active state must reflect that date's effective workDay flag
// (FRONTEND-042-AC-05). Purely decorative/informational (visual-only per the spec) -- the
// surrounding toggle <button> carries the interactive aria-label/aria-pressed, not this icon.
export function WorkDayIcon({ active = false }: WorkDayIconProps) {
  return (
    <svg
      className={active ? styles.iconActive : styles.icon}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label="Work day"
    >
      <rect
        x="2"
        y="4"
        width="12"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.25 : 1}
      />
      <path
        d="M5.5 4V2.75M10.5 4V2.75"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
