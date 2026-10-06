import type { ActivityCategory } from './activity'

export interface SubTask {
  id: string
  activityId: string
  name: string
  category: ActivityCategory
  createdAt: string
  position: number
}

export interface SubTaskInput {
  name: string
}
