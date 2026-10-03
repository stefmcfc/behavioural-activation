import styles from './CompletionIcon.module.css'

// FRONTEND-037: extracted from OccurrenceItem.tsx (its first consumer) -- this spec's segmented
// completion bar and lite grid/bucket (via CompletionMark) are its second consumer, matching this
// project's established "extract on second use" convention (e.g. WeekNav's extraction in
// frontend_spec_036). Identical SVG/markup to the original inline definition -- no visual change.
export function CompletionIcon() {
  return (
    <svg
      className={styles.completionIcon}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label="Completed"
    >
      <path
        d="M3 8.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
