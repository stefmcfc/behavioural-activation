import type { Activity, ActivityDeletionImpact, ActivityInput } from '../types/activity'
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

  markFavourite: (id: string): Promise<Activity> =>
    request<Activity>(() => client.post(`/activities/${id}/favourite`)),

  unmarkFavourite: (id: string): Promise<void> =>
    request<void>(() => client.delete(`/activities/${id}/favourite`)),

  // FRONTEND-058-AC-09: checked before Confirm delete on an archived row is allowed to start the
  // undo-window flow -- see ActivityBank.tsx's handleDeleteConfirmed.
  deletionImpact: (id: string): Promise<ActivityDeletionImpact> =>
    request<ActivityDeletionImpact>(() => client.get(`/activities/${id}/deletion-impact`)),
}
