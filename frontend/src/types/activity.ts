export type ActivityCategory = 'ROUTINE' | 'NECESSARY' | 'PLEASURABLE'

export interface Activity {
  id: string
  name: string
  category: ActivityCategory
  description: string | null
  repeatable: boolean
  archived: boolean
  createdAt: string
}

export interface ActivityInput {
  name: string
  category: ActivityCategory | null
  description: string | null
  repeatable: boolean
}
