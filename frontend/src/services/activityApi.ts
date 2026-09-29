import type { Activity, ActivityInput } from '../types/activity'
import { client, request } from './client'

export const activityApi = {
  getAll: (includeArchived = false): Promise<Activity[]> =>
    request<{ data: Activity[]; count: number }>(() =>
      client.get('/activities', includeArchived ? { params: { includeArchived: true } } : undefined),
    ).then((r) => r.data),

  create: (input: ActivityInput): Promise<Activity> =>
    request<Activity>(() => client.post('/activities', input)),

  update: (id: string, input: ActivityInput): Promise<Activity> =>
    request<Activity>(() => client.put(`/activities/${id}`, input)),

  remove: (id: string): Promise<void> => request<void>(() => client.delete(`/activities/${id}`)),

  archive: (id: string): Promise<Activity> =>
    request<Activity>(() => client.post(`/activities/${id}/archive`)),

  unarchive: (id: string): Promise<void> =>
    request<void>(() => client.delete(`/activities/${id}/archive`)),
}
