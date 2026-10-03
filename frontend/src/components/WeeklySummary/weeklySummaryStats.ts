import type { ActivityCategory } from '../../types/activity'
import type { PlannedOccurrence } from '../../types/plan'

export interface CategoryStat {
  readonly category: ActivityCategory
  readonly planned: number
  readonly completed: number
}

export interface WeeklyStats {
  readonly planned: number
  readonly completed: number
  readonly scheduled: number
  readonly bucket: number
  readonly byCategory: readonly CategoryStat[]
}

const CATEGORIES: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']

// FRONTEND-036-AC-09: planned/completed totals (grid-scheduled and bucket occurrences counted
// together), a per-category breakdown, and a scheduled-vs-bucket split -- all derived entirely
// client-side from one week's GET /api/v1/plan response, no new backend field required.
export function computeStats(occurrences: readonly PlannedOccurrence[]): WeeklyStats {
  const planned = occurrences.length
  const completed = occurrences.filter((o) => o.completed).length
  const scheduled = occurrences.filter((o) => o.dayOfWeek !== null).length
  const bucket = planned - scheduled

  const byCategory: readonly CategoryStat[] = CATEGORIES.map((category) => {
    const inCategory = occurrences.filter((o) => o.category === category)
    return {
      category,
      planned: inCategory.length,
      completed: inCategory.filter((o) => o.completed).length,
    }
  })

  return { planned, completed, scheduled, bucket, byCategory }
}
