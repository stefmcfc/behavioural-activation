import { parseWeekStart } from './planLabels'
import styles from './WeekNav.module.css'

// FRONTEND-036: extracted from WeeklyPlanner.tsx's formerly-inline "Week Commencing" navigation
// (shiftWeek/formatWeekCommencing/ChevronIcon + the weekNav/navButton/chevronIcon markup) so
// WeeklySummary can reuse the identical control without duplicating the date math and SVG markup.
// No behavior change versus the original inline implementation.
function formatWeekCommencing(weekStart: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseWeekStart(weekStart))
}

function ChevronIcon({ direction }: { readonly direction: 'left' | 'right' }) {
  const points = direction === 'left' ? '10,2 4,8 10,14' : '6,2 12,8 6,14'
  return (
    <svg className={styles.chevronIcon} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
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

interface WeekNavProps {
  readonly weekStart: string
  readonly onPrevious: () => void
  readonly onNext: () => void
}

export function WeekNav({ weekStart, onPrevious, onNext }: WeekNavProps) {
  return (
    <div className={styles.weekNav}>
      <button
        type="button"
        className={styles.navButton}
        onClick={onPrevious}
        aria-label="Previous week"
      >
        <ChevronIcon direction="left" />
      </button>
      <span>Week Commencing {formatWeekCommencing(weekStart)}</span>
      <button
        type="button"
        className={styles.navButton}
        onClick={onNext}
        aria-label="Next week"
      >
        <ChevronIcon direction="right" />
      </button>
    </div>
  )
}
