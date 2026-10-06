import styles from './ChevronIcon.module.css'

interface ChevronIconProps {
  readonly direction?: 'up' | 'down' | 'left' | 'right'
}

// direction defaults to 'down' -- the original, only variant this component had before 'up' was
// added for Move up/down controls (SubTaskList/OccurrenceItem), so every pre-existing disclosure
// call site (SuggestedActivities) is unaffected. 'left'/'right' were added by TOOLING-005 to unify
// this component with WeekNav.tsx's own near-identical local ChevronIcon, reusing its exact
// polyline point values rather than inventing new ones.
const POINTS_BY_DIRECTION = {
  up: '4,10 8,6 12,10',
  down: '4,6 8,10 12,6',
  left: '10,2 4,8 10,14',
  right: '6,2 12,8 6,14',
} as const

export function ChevronIcon({ direction = 'down' }: ChevronIconProps) {
  const points = POINTS_BY_DIRECTION[direction]
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
