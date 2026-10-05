import type { PlanDayOfWeek } from '../types/plan'
import type { WorkDay } from '../types/workDay'
import { client, request } from './client'

export const workDayApi = {
  getPattern: (): Promise<PlanDayOfWeek[]> =>
    request<{ days: PlanDayOfWeek[] }>(() => client.get('/work-days/pattern')).then(
      (r) => r.days,
    ),

  setPattern: (days: PlanDayOfWeek[]): Promise<PlanDayOfWeek[]> =>
    request<{ days: PlanDayOfWeek[] }>(() =>
      client.put('/work-days/pattern', { days }),
    ).then((r) => r.days),

  getWeek: (weekStart: string): Promise<WorkDay[]> =>
    request<{ data: WorkDay[]; count: number }>(() =>
      client.get('/work-days', { params: { weekStart } }),
    ).then((r) => r.data),

  setOverride: (date: string, workDay: boolean): Promise<WorkDay> =>
    request<WorkDay>(() => client.put(`/work-days/${date}`, { workDay })),
}
