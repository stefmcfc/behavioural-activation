import type { SubTask, SubTaskInput } from '../types/subTask'
import { client, request } from './client'

export const subTaskApi = {
  getAll: (activityId: string): Promise<SubTask[]> =>
    request<{ data: SubTask[]; count: number }>(() =>
      client.get(`/activities/${activityId}/sub-tasks`),
    ).then((r) => r.data),

  // FRONTEND-033-AC-01: every sub-task owned by the authenticated user, across all their
  // activities, in one call -- used by ActivityPickerList to avoid an N+1 per-activity fan-out.
  getAllForOwner: (): Promise<SubTask[]> =>
    request<{ data: SubTask[]; count: number }>(() => client.get('/sub-tasks')).then(
      (r) => r.data,
    ),

  create: (activityId: string, input: SubTaskInput): Promise<SubTask> =>
    request<SubTask>(() => client.post(`/activities/${activityId}/sub-tasks`, input)),

  update: (activityId: string, id: string, input: SubTaskInput): Promise<SubTask> =>
    request<SubTask>(() => client.patch(`/activities/${activityId}/sub-tasks/${id}`, input)),

  remove: (activityId: string, id: string): Promise<void> =>
    request<void>(() => client.delete(`/activities/${activityId}/sub-tasks/${id}`)),
}
