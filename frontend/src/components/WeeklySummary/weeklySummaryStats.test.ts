import { describe, expect, it } from 'vitest'
import { computeStats } from './weeklySummaryStats'
import type { PlannedOccurrence } from '../../types/plan'

function makeOccurrence(overrides: Partial<PlannedOccurrence> = {}): PlannedOccurrence {
  return {
    id: '1',
    activityId: 'a1',
    subTaskId: null,
    name: 'Go for a walk',
    parentActivityName: null,
    category: 'ROUTINE',
    weekStart: '2026-10-05',
    dayOfWeek: 'MONDAY',
    slot: 'MORNING',
    bucketPosition: null,
    recentlyCarriedForward: false,
    completed: false,
    completedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    repeatable: true,
    ...overrides,
  }
}

describe('FRONTEND-037-AC-10: byLocation breakdown', () => {
  it('splits occurrences into WEEKDAY/WEEKEND/BUCKET, each broken down by category', () => {
    const stats = computeStats([
      makeOccurrence({ id: '1', category: 'ROUTINE', dayOfWeek: 'MONDAY', slot: 'MORNING' }),
      makeOccurrence({
        id: '2',
        category: 'NECESSARY',
        dayOfWeek: 'SATURDAY',
        slot: 'AFTERNOON',
      }),
      makeOccurrence({ id: '3', category: 'PLEASURABLE', dayOfWeek: null, slot: null }),
    ])

    expect(stats.byLocation).toHaveLength(3)

    const weekday = stats.byLocation.find((l) => l.location === 'WEEKDAY')!
    const weekend = stats.byLocation.find((l) => l.location === 'WEEKEND')!
    const bucket = stats.byLocation.find((l) => l.location === 'BUCKET')!

    expect(weekday.total).toBe(1)
    expect(weekday.byCategory.find((c) => c.category === 'ROUTINE')?.planned).toBe(1)
    expect(weekend.total).toBe(1)
    expect(weekend.byCategory.find((c) => c.category === 'NECESSARY')?.planned).toBe(1)
    expect(bucket.total).toBe(1)
    expect(bucket.byCategory.find((c) => c.category === 'PLEASURABLE')?.planned).toBe(1)
  })

  it('counts every weekday (Mon-Fri) as WEEKDAY and every weekend day (Sat/Sun) as WEEKEND', () => {
    const stats = computeStats([
      makeOccurrence({ id: '1', dayOfWeek: 'FRIDAY', slot: 'EVENING' }),
      makeOccurrence({ id: '2', dayOfWeek: 'SUNDAY', slot: 'MORNING' }),
    ])

    expect(stats.byLocation.find((l) => l.location === 'WEEKDAY')!.total).toBe(1)
    expect(stats.byLocation.find((l) => l.location === 'WEEKEND')!.total).toBe(1)
  })

  it('returns zero totals for a location with no occurrences, without erroring', () => {
    const stats = computeStats([])

    for (const location of stats.byLocation) {
      expect(location.total).toBe(0)
      for (const categoryStat of location.byCategory) {
        expect(categoryStat.planned).toBe(0)
        expect(categoryStat.completed).toBe(0)
      }
    }
  })

  it('leaves the existing planned/completed/scheduled/bucket/byCategory fields unchanged', () => {
    const stats = computeStats([
      makeOccurrence({ id: '1', completed: true }),
      makeOccurrence({ id: '2', completed: false, dayOfWeek: null, slot: null }),
    ])

    expect(stats.planned).toBe(2)
    expect(stats.completed).toBe(1)
    expect(stats.scheduled).toBe(1)
    expect(stats.bucket).toBe(1)
    expect(stats.byCategory).toHaveLength(3)
  })
})
