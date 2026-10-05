import type { ActivityCategory } from '../../types/activity'
import type { PlannedOccurrence } from '../../types/plan'
import { WEEKDAY_DAYS, WEEKEND_DAYS, parseWeekStart } from '../WeeklyPlanner/planLabels'

export interface CategoryStat {
  readonly category: ActivityCategory
  readonly planned: number
  readonly completed: number
}

export type SummaryLocation = 'WEEKDAY' | 'WEEKEND' | 'BUCKET'

export interface LocationStat {
  readonly location: SummaryLocation
  readonly byCategory: readonly CategoryStat[]
  readonly total: number
}

export interface WeeklyStats {
  readonly planned: number
  readonly completed: number
  readonly scheduled: number
  readonly bucket: number
  readonly byLocation: readonly LocationStat[]
}

const CATEGORIES: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']

const LOCATIONS: readonly SummaryLocation[] = ['WEEKDAY', 'WEEKEND', 'BUCKET']

// FRONTEND-037-AC-10: WEEKDAY/WEEKEND membership is derived from planLabels.ts's existing
// WEEKDAY_DAYS/WEEKEND_DAYS constants, not a second hardcoded day list -- BUCKET is simply
// dayOfWeek === null (unscheduled, weekend bucket).
function locationOf(occurrence: PlannedOccurrence): SummaryLocation {
  const { dayOfWeek } = occurrence
  if (dayOfWeek === null) {
    return 'BUCKET'
  }
  if (WEEKDAY_DAYS.includes(dayOfWeek)) {
    return 'WEEKDAY'
  }
  return WEEKEND_DAYS.includes(dayOfWeek) ? 'WEEKEND' : 'BUCKET'
}

function byCategoryFor(occurrences: readonly PlannedOccurrence[]): readonly CategoryStat[] {
  return CATEGORIES.map((category) => {
    const inCategory = occurrences.filter((o) => o.category === category)
    return {
      category,
      planned: inCategory.length,
      completed: inCategory.filter((o) => o.completed).length,
    }
  })
}

function computeByLocation(occurrences: readonly PlannedOccurrence[]): readonly LocationStat[] {
  return LOCATIONS.map((location) => {
    const inLocation = occurrences.filter((o) => locationOf(o) === location)
    return {
      location,
      byCategory: byCategoryFor(inLocation),
      total: inLocation.length,
    }
  })
}

// FRONTEND-036-AC-09: planned/completed totals (grid-scheduled and bucket occurrences counted
// together) and a scheduled-vs-bucket split -- all derived entirely client-side from one week's
// GET /api/v1/plan response, no new backend field required.
// FRONTEND-037-AC-10: also computes byLocation -- the same occurrences split by WEEKDAY/WEEKEND/
// BUCKET, each further broken down by category, for Requirement 3's breakdown chart.
// FRONTEND-039-AC-08: the top-level per-category numeric breakdown (byCategory) that used to live
// here was dropped once WeeklySummary.tsx stopped rendering the old numeric "By category" table --
// byCategoryFor() is still used internally by computeByLocation(), just not exposed at this level.
export function computeStats(occurrences: readonly PlannedOccurrence[]): WeeklyStats {
  const planned = occurrences.length
  const completed = occurrences.filter((o) => o.completed).length
  const scheduled = occurrences.filter((o) => o.dayOfWeek !== null).length
  const bucket = planned - scheduled

  const byLocation = computeByLocation(occurrences)

  return { planned, completed, scheduled, bucket, byLocation }
}

// FRONTEND-039-AC-04: a week is "past" once its last day (weekStart + 6, the Sunday) is strictly
// before the reference date -- comparing calendar dates only (not time-of-day), so a reference
// moment later on that same Sunday still counts as "this week," not past. Accepts an optional
// reference date so callers/tests aren't tied to the real system clock.
export function isPastWeek(weekStart: string, today: Date = new Date()): boolean {
  const lastDay = parseWeekStart(weekStart)
  lastDay.setDate(lastDay.getDate() + 6)
  lastDay.setHours(0, 0, 0, 0)

  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  return lastDay.getTime() < todayDateOnly.getTime()
}
