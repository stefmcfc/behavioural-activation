export type ActivityCategory = 'ROUTINE' | 'NECESSARY' | 'PLEASURABLE'

export interface Activity {
  id: string
  name: string
  category: ActivityCategory
  description: string | null
  createdAt: string
}

export interface ActivityInput {
  name: string
  category: ActivityCategory | null
  description: string | null
}
