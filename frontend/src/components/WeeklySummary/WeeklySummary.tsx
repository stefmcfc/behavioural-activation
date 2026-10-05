import { Fragment, useEffect, useState } from 'react'
import { planApi } from '../../services/planApi'
import type { ActivityCategory } from '../../types/activity'
import type { PlannedOccurrence } from '../../types/plan'
import { getCategoryColor } from '../../utils/categoryColors'
import { CATEGORY_LABELS } from '../../utils/categoryLabels'
import { getReadableTextColor } from '../../utils/contrast'
import { CompletionMark } from './CompletionMark'
import { ALL_DAYS, ALL_SLOTS, DAY_LABELS, SLOT_LABELS } from '../WeeklyPlanner/planLabels'
import { WeekNav } from '../WeeklyPlanner/WeekNav'
import { formatDate, getMondayOfCurrentWeek, parseWeekStart } from '../WeeklyPlanner/planLabels'
import { computeStats, type CategoryStat, type LocationStat, type SummaryLocation } from './weeklySummaryStats'
import styles from './WeeklySummary.module.css'

function shiftWeek(weekStart: string, days: number): string {
  const date = parseWeekStart(weekStart)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

const CATEGORY_ORDER: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']

const LOCATION_GROUP_LABELS: Record<SummaryLocation, string> = {
  WEEKDAY: 'Weekday grid',
  WEEKEND: 'Weekend grid',
  BUCKET: 'Weekend bucket',
}

// FRONTEND-037-AC-13: below this share of its bar, a segment can't fit a direct text label inside
// itself with padding -- the label renders just above the bar instead of being dropped to
// tooltip-only (category colours are user-customizable and not guaranteed distinct, so hue alone
// can never carry the identification here).
const SMALL_SEGMENT_SHARE_THRESHOLD = 0.12

interface BreakdownSegmentProps {
  readonly categoryStat: CategoryStat
  readonly locationTotal: number
}

function BreakdownSegment({ categoryStat, locationTotal }: BreakdownSegmentProps) {
  const backgroundColor = getCategoryColor(categoryStat.category)
  const share = locationTotal > 0 ? categoryStat.planned / locationTotal : 0
  const label = `${CATEGORY_LABELS[categoryStat.category]} (${categoryStat.planned})`

  return (
    <div
      className={styles.segment}
      style={{ flexGrow: categoryStat.planned, backgroundColor }}
    >
      {share >= SMALL_SEGMENT_SHARE_THRESHOLD ? (
        <span className={styles.segmentLabelInside} style={{ color: getReadableTextColor(backgroundColor) }}>
          {label}
        </span>
      ) : (
        <span className={styles.segmentLabelOutside}>{label}</span>
      )}
    </div>
  )
}

interface BreakdownChartProps {
  readonly byLocation: readonly LocationStat[]
}

// FRONTEND-037 Requirement 3: three horizontal stacked bars (Weekday grid / Weekend grid /
// Weekend bucket), each proportional in overall length to that location's own total (AC-11) so the
// three stay visually comparable, with category segments always in the fixed Routine->Necessary->
// Pleasurable order (AC-12) and never dropped to tooltip-only labelling (AC-13). One shared legend
// for the whole chart, not one per bar (AC-14).
function BreakdownChart({ byLocation }: BreakdownChartProps) {
  const maxTotal = Math.max(1, ...byLocation.map((location) => location.total))

  return (
    <div className={styles.breakdownChart}>
      <ul className={styles.legend}>
        {CATEGORY_ORDER.map((category) => (
          <li key={category} className={styles.legendItem}>
            <span
              className={styles.legendSwatch}
              style={{ backgroundColor: getCategoryColor(category) }}
              aria-hidden="true"
            />
            {CATEGORY_LABELS[category]}
          </li>
        ))}
      </ul>

      {byLocation.map((locationStat) => (
        <div
          key={locationStat.location}
          role="group"
          aria-label={LOCATION_GROUP_LABELS[locationStat.location]}
          className={styles.locationRow}
        >
          <span className={styles.locationLabel}>{LOCATION_GROUP_LABELS[locationStat.location]}</span>
          <div className={styles.track}>
            {locationStat.total > 0 ? (
              <div
                className={styles.bar}
                style={{ width: `${(locationStat.total / maxTotal) * 100}%` }}
              >
                {locationStat.byCategory
                  .filter((categoryStat) => categoryStat.planned > 0)
                  .map((categoryStat) => (
                    <BreakdownSegment
                      key={categoryStat.category}
                      categoryStat={categoryStat}
                      locationTotal={locationStat.total}
                    />
                  ))}
              </div>
            ) : (
              <span className={styles.emptyLocation}>No activities</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
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

  // FRONTEND-037-AC-01/AC-02: one block per occurrence, completed occurrences first, order within
  // each group otherwise unchanged (no additional sort).
  const completionOrder =
    occurrences !== null
      ? [...occurrences.filter((o) => o.completed), ...occurrences.filter((o) => !o.completed)]
      : []

  // FRONTEND-037-AC-08: the weekend bucket's occurrences, ordered by bucketPosition -- matching
  // BucketList.tsx's own existing ordering (frontend_spec_010).
  const bucketOrder =
    occurrences !== null
      ? occurrences
          .filter((o) => o.dayOfWeek === null)
          .slice()
          .sort((a, b) => (a.bucketPosition ?? 0) - (b.bucketPosition ?? 0))
      : []

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

          {/* FRONTEND-037 Requirement 1: a segmented completion bar -- one block per occurrence,
              completed blocks first, each block hoverable/focusable for its own detail. */}
          <section aria-label="Completion for the week" className={styles.section}>
            <h3>This week at a glance</h3>
            <div className={styles.completionBar}>
              {completionOrder.map((occurrence) => (
                <CompletionMark key={occurrence.id} occurrence={occurrence} shape="block" />
              ))}
            </div>
          </section>

          {/* FRONTEND-037 Requirement 2: a compact, read-only lite grid + lite bucket list -- same
              marks as above, no Add/drag/remove controls. */}
          <section aria-label="Where this week's activities landed" className={styles.section}>
            <h3>Where things landed</h3>
            <div className={styles.liteGrid}>
              <span className={styles.liteGridCorner} aria-hidden="true" />
              {ALL_DAYS.map((day) => (
                <span key={day} className={styles.liteGridDayLabel}>
                  {DAY_LABELS[day]}
                </span>
              ))}
              {ALL_SLOTS.map((slot) => (
                <Fragment key={slot}>
                  <span className={styles.liteGridSlotLabel}>{SLOT_LABELS[slot]}</span>
                  {ALL_DAYS.map((day) => {
                    const cellOccurrences = occurrences.filter(
                      (o) => o.dayOfWeek === day && o.slot === slot,
                    )
                    return (
                      <div key={`${day}-${slot}`} className={styles.liteGridCell}>
                        {cellOccurrences.map((occurrence) => (
                          <CompletionMark key={occurrence.id} occurrence={occurrence} shape="circle" />
                        ))}
                      </div>
                    )
                  })}
                </Fragment>
              ))}
            </div>

            <h4>Weekend bucket</h4>
            <div className={styles.liteBucket}>
              {bucketOrder.map((occurrence) => (
                <CompletionMark key={occurrence.id} occurrence={occurrence} shape="circle" />
              ))}
            </div>
          </section>

          {/* FRONTEND-037 Requirement 3: location x category breakdown chart. */}
          <section aria-label="Breakdown by location and category" className={styles.section}>
            <h3>By location and category</h3>
            <BreakdownChart byLocation={stats.byLocation} />
          </section>
        </div>
      )}
    </section>
  )
}
