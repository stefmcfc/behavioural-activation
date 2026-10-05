import type {
  PlannedOccurrence,
  PlannedOccurrenceInput,
  PlannedOccurrenceMoveInput,
} from '../types/plan'
import { client, request } from './client'

export const planApi = {
  getWeek: (weekStart: string): Promise<PlannedOccurrence[]> =>
    request<{ data: PlannedOccurrence[]; count: number }>(() =>
      client.get('/plan', { params: { weekStart } }),
    ).then((r) => r.data),

  create: (input: PlannedOccurrenceInput): Promise<PlannedOccurrence> =>
    request<PlannedOccurrence>(() => client.post('/plan/occurrences', input)),

  move: (id: string, input: PlannedOccurrenceMoveInput): Promise<PlannedOccurrence> =>
    request<PlannedOccurrence>(() => client.patch(`/plan/occurrences/${id}`, input)),

  remove: (id: string): Promise<void> =>
    request<void>(() => client.delete(`/plan/occurrences/${id}`)),

  complete: (id: string): Promise<PlannedOccurrence> =>
    request<PlannedOccurrence>(() => client.post(`/plan/occurrences/${id}/completion`)),

  undoCompletion: (id: string): Promise<void> =>
    request<void>(() => client.delete(`/plan/occurrences/${id}/completion`)),

  carryForward: (id: string): Promise<PlannedOccurrence> =>
    request<PlannedOccurrence>(() => client.post(`/plan/occurrences/${id}/carry-forward`)),

  updateNotes: (id: string, notes: string | null): Promise<PlannedOccurrence> =>
    request<PlannedOccurrence>(() => client.patch(`/plan/occurrences/${id}/notes`, { notes })),

  reorderBucket: (weekStart: string, occurrenceIds: string[]): Promise<PlannedOccurrence[]> =>
    request<{ data: PlannedOccurrence[]; count: number }>(() =>
      client.put('/plan/bucket/order', { weekStart, occurrenceIds }),
    ).then((r) => r.data),
}
