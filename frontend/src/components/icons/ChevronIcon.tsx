import styles from './ChevronIcon.module.css'

interface ChevronIconProps {
  readonly direction?: 'up' | 'down'
}

// direction defaults to 'down' -- the original, only variant this component had before 'up' was
// added for Move up/down controls (SubTaskList/OccurrenceItem), so every pre-existing disclosure
// call site (SuggestedActivities) is unaffected.
export function ChevronIcon({ direction = 'down' }: ChevronIconProps) {
  const points = direction === 'up' ? '4,10 8,6 12,10' : '4,6 8,10 12,6'
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
