import type { Activity, ActivityInput } from '../types/activity'
import { client, request } from './client'

export const activityApi = {
  getAll: (): Promise<Activity[]> =>
    request<{ data: Activity[]; count: number }>(() => client.get('/activities')).then(
      (r) => r.data,
    ),

  create: (input: ActivityInput): Promise<Activity> =>
    request<Activity>(() => client.post('/activities', input)),

  update: (id: string, input: ActivityInput): Promise<Activity> =>
    request<Activity>(() => client.put(`/activities/${id}`, input)),

  remove: (id: string): Promise<void> => request<void>(() => client.delete(`/activities/${id}`)),
}
