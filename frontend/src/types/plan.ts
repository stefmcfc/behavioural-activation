import type { ActivityCategory } from './activity'

export type PlanDayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export type PlanSlot = 'MORNING' | 'AFTERNOON' | 'EVENING'

export interface PlannedOccurrence {
  id: string
  activityId: string | null
  subTaskId: string | null
  name: string
  parentActivityName: string | null
  category: ActivityCategory
  weekStart: string
  dayOfWeek: PlanDayOfWeek | null
  slot: PlanSlot | null
  completed: boolean
  completedAt: string | null
  createdAt: string
  repeatable: boolean
}

export interface PlannedOccurrenceInput {
  activityId: string | null
  subTaskId: string | null
  weekStart: string
  dayOfWeek: PlanDayOfWeek | null
  slot: PlanSlot | null
}

export interface PlannedOccurrenceMoveInput {
  dayOfWeek: PlanDayOfWeek | null
  slot: PlanSlot | null
}
