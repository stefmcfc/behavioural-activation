import type { ActivityCategory } from './activity'

export interface SubTask {
  id: string
  activityId: string
  name: string
  category: ActivityCategory
  createdAt: string
}

export interface SubTaskInput {
  name: string
}
