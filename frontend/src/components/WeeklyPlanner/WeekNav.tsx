import { parseWeekStart } from './planLabels'
import { ChevronIcon } from '../icons/ChevronIcon'
import styles from './WeekNav.module.css'

// FRONTEND-036: extracted from WeeklyPlanner.tsx's formerly-inline "Week Commencing" navigation
// (shiftWeek/formatWeekCommencing/ChevronIcon + the weekNav/navButton/chevronIcon markup) so
// WeeklySummary can reuse the identical control without duplicating the date math and SVG markup.
// No behavior change versus the original inline implementation.
// TOOLING-005-AC-04: this used to define its own local ChevronIcon (direction: 'left' | 'right')
// -- now renders the shared components/icons/ChevronIcon, which grew 'left'/'right' support to
// absorb this one, resolving the two-components-same-name collision.
function formatWeekCommencing(weekStart: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseWeekStart(weekStart))
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
