import { useEffect, useMemo, useState } from 'react'
import { workDayApi } from '../../services/workDayApi'
import { ApiError } from '../../types/api'
import type { WorkDay } from '../../types/workDay'

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  return 'Something went wrong. Please try again.'
}

// FRONTEND-042: a usePlanActions-style hook, independently fetching one week's effective work-day
// status (planner_spec_021's GET /api/v1/work-days) so WeeklyPlanner and TodayView can each mount
// it on their own weekStart without depending on one another (AC-09), and refetch whenever
// weekStart changes (AC-10, effect keyed on weekStart mirroring usePlanActions' own).
export function useWorkDays(weekStart: string) {
  const [workDays, setWorkDays] = useState<WorkDay[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Mirrors WeeklySummary.tsx/usePlanActions.ts's own fetch effect: state is only ever updated
  // from inside the promise callbacks, never synchronously in the effect body itself (oxlint's
  // react(set-state-in-effect) rule) -- a weekStart change simply re-triggers this effect and
  // replaces workDays once the new week's data arrives (AC-10).
  useEffect(() => {
    let cancelled = false

    workDayApi
      .getWeek(weekStart)
      .then((data) => {
        if (!cancelled) {
          setWorkDays(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(getErrorMessage(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [weekStart])

  const workDaysByDate = useMemo(() => {
    const map = new Map<string, boolean>()
    workDays?.forEach((workDay) => map.set(workDay.date, workDay.workDay))
    return map
  }, [workDays])

  // FRONTEND-042-AC-06: await-then-update, not optimistic, mirroring usePlanActions' handleMove/
  // handleComplete -- the badge only flips once the server confirms the new value.
  const handleToggle = async (date: string) => {
    setActionError(null)
    const current = workDaysByDate.get(date) ?? false
    try {
      const updated = await workDayApi.setOverride(date, !current)
      setWorkDays((previous) => {
        if (!previous) return previous
        const exists = previous.some((workDay) => workDay.date === updated.date)
        return exists
          ? previous.map((workDay) => (workDay.date === updated.date ? updated : workDay))
          : [...previous, updated]
      })
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  return {
    workDays,
    workDaysByDate,
    loadError,
    actionError,
    handleToggle,
  }
}
