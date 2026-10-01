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

export const ALL_SLOTS: readonly PlanSlot[] = ['MORNING', 'AFTERNOON', 'EVENING']

export const SLOT_LABELS: Record<PlanSlot, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  EVENING: 'Evening',
}
