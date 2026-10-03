import { useEffect, useState } from 'react'
import { planApi } from '../../services/planApi'
import type { PlannedOccurrence } from '../../types/plan'
import { CATEGORY_LABELS } from '../../utils/categoryLabels'
import { WeekNav } from '../WeeklyPlanner/WeekNav'
import { formatDate, getMondayOfCurrentWeek, parseWeekStart } from '../WeeklyPlanner/planLabels'
import { computeStats } from './weeklySummaryStats'
import styles from './WeeklySummary.module.css'

function shiftWeek(weekStart: string, days: number): string {
  const date = parseWeekStart(weekStart)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

// FRONTEND-036: a read-only, client-side-computed view of how a week is going -- planned vs
// completed counts, a per-category breakdown, and a scheduled-vs-bucket split -- derived entirely
// from the existing GET /api/v1/plan response via planApi.getWeek. Deliberately bypasses
// usePlanActions (its complete/undo/move/drag/bucket-reorder machinery has no purpose in a
// read-only summary) in favour of a plain fetch-on-mount, mirroring ActivityBank.tsx's own
// direct-fetch pattern. Owns its own independent weekStart, never synced with WeeklyPlanner's.
export function WeeklySummary() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfCurrentWeek())
  const [occurrences, setOccurrences] = useState<PlannedOccurrence[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Mirrors usePlanActions.ts's own fetch-on-mount effect: state is only ever updated from inside
  // the promise callbacks, never synchronously in the effect body itself (oxlint's
  // react(set-state-in-effect) rule) -- a retry re-triggers this effect via retryCount rather than
  // clearing/re-fetching imperatively from within the effect.
  useEffect(() => {
    let cancelled = false

    planApi
      .getWeek(weekStart)
      .then((data) => {
        if (!cancelled) {
          setOccurrences(data)
          setLoadError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Could not load this week. Please try again.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [weekStart, retryCount])

  const handleRetry = () => {
    setOccurrences(null)
    setLoadError(null)
    setRetryCount((count) => count + 1)
  }

  const handlePreviousWeek = () => {
    setOccurrences(null)
    setLoadError(null)
    setWeekStart((current) => shiftWeek(current, -7))
  }

  const handleNextWeek = () => {
    setOccurrences(null)
    setLoadError(null)
    setWeekStart((current) => shiftWeek(current, 7))
  }

  const stats = occurrences !== null ? computeStats(occurrences) : null
  const completionRate =
    stats !== null && stats.planned > 0 ? Math.round((stats.completed / stats.planned) * 100) : 0

  return (
    <section>
      <h2>Weekly summary</h2>

      <WeekNav weekStart={weekStart} onPrevious={handlePreviousWeek} onNext={handleNextWeek} />

      {loadError && (
        <p role="alert">
          {loadError}{' '}
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </p>
      )}

      {occurrences === null && !loadError && <output>Loading…</output>}

      {occurrences !== null && occurrences.length === 0 && (
        <p>No activities planned for this week.</p>
      )}

      {occurrences !== null && occurrences.length > 0 && stats !== null && (
        <div className={styles.stats}>
          <p className={styles.totals}>
            <strong>
              {stats.completed} of {stats.planned}
            </strong>{' '}
            activities completed ({completionRate}%)
          </p>

          <p>
            {stats.scheduled} scheduled, {stats.bucket} in the weekend bucket
          </p>

          <table className={styles.categoryTable}>
            <caption>By category</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Planned</th>
                <th scope="col">Completed</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCategory.map((row) => (
                <tr key={row.category}>
                  <th scope="row">{CATEGORY_LABELS[row.category]}</th>
                  <td>{row.planned}</td>
                  <td>{row.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
