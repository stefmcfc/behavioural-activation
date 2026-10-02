import type { PlanDayOfWeek, PlanSlot } from '../../types/plan'

export const ALL_DAYS: readonly PlanDayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

export const DAY_LABELS: Record<PlanDayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
}

export const WEEKDAY_DAYS: readonly PlanDayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
]

export const WEEKEND_DAYS: readonly PlanDayOfWeek[] = ['SATURDAY', 'SUNDAY']

export function parseWeekStart(weekStart: string): Date {
  const [year, month, day] = weekStart.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// FRONTEND-016: moved here from WeeklyPlanner.tsx (pure relocation, no behavior change) so
// TodayView can compute the real current week's Monday identically, independent of whatever
// week a separately-mounted WeeklyPlanner instance has navigated to.
export function getMondayOfCurrentWeek(): string {
  const now = new Date()
  const weekday = now.getDay()
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  return formatDate(monday)
}

// FRONTEND-016: moved here from WeeklyPlanner.tsx (pure relocation, no behavior change) so
// TodayView can compute today's PlanDayOfWeek identically.
export function getTodayPlanDayOfWeek(): PlanDayOfWeek {
  const byJsDay: Record<number, PlanDayOfWeek> = {
    0: 'SUNDAY',
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
    6: 'SATURDAY',
  }
  return byJsDay[new Date().getDay()]
}

export const ALL_SLOTS: readonly PlanSlot[] = ['MORNING', 'AFTERNOON', 'EVENING']

export const SLOT_LABELS: Record<PlanSlot, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  EVENING: 'Evening',
}
