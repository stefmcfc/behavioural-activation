export type ActivityCategory = 'ROUTINE' | 'NECESSARY' | 'PLEASURABLE'

export interface Activity {
  id: string
  name: string
  category: ActivityCategory
  description: string | null
  repeatable: boolean
  archived: boolean
  favourite: boolean
  createdAt: string
  subTaskCount: number
}

export interface ActivityInput {
  name: string
  category: ActivityCategory | null
  description: string | null
  repeatable: boolean
}

// FRONTEND-058: returned by GET /activities/{id}/deletion-impact -- checked before an archived
// activity's delete is allowed to proceed past Confirm delete.
export interface ActivityDeletionImpact {
  plannedOccurrenceCount: number
  completionCount: number
}
