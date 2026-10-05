import type { PlanDayOfWeek } from './plan'

export interface WorkDay {
  date: string
  dayOfWeek: PlanDayOfWeek
  workDay: boolean
}
