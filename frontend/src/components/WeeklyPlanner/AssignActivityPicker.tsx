import { useEffect, useState } from 'react'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { Activity } from '../../types/activity'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { planApi } from '../../services/planApi'
import type { SubTask } from '../../types/subTask'

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

export interface AssignTarget {
  readonly dayOfWeek: PlanDayOfWeek | null
  readonly slot: PlanSlot | null
}

interface Selection {
  readonly activityId: string | null
  readonly subTaskId: string | null
}

interface AssignActivityPickerProps {
  readonly weekStart: string
  readonly target: AssignTarget
  readonly onSuccess: (occurrence: PlannedOccurrence) => void
  readonly onCancel: () => void
}

export function AssignActivityPicker({
  weekStart,
  target,
  onSuccess,
  onCancel,
}: AssignActivityPickerProps) {
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [subTasksByActivity, setSubTasksByActivity] = useState<Record<string, SubTask[]>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    activityApi
      .getAll()
      .then(async (fetchedActivities) => {
        if (cancelled) return
        setActivities(fetchedActivities)

        const entries = await Promise.all(
          fetchedActivities.map((activity) =>
            subTaskApi
              .getAll(activity.id)
              .then((subTasks) => [activity.id, subTasks] as const),
          ),
        )
        if (!cancelled) {
          setSubTasksByActivity(Object.fromEntries(entries))
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
  }, [])

  const handleAssign = async () => {
    if (!selected) {
      return
    }
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const created = await planApi.create({
        activityId: selected.activityId,
        subTaskId: selected.subTaskId,
        weekStart,
        dayOfWeek: target.dayOfWeek,
        slot: target.slot,
      })
      onSuccess(created)
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section aria-label="Assign to plan">
      <h3>Assign an activity or sub-task</h3>

      {loadError && <p role="alert">{loadError}</p>}
      {activities === null && !loadError && <output>Loading activities…</output>}

      {activities !== null && activities.length === 0 && (
        <p>No activities yet. Add one to your activity bank first.</p>
      )}

      {activities !== null && activities.length > 0 && (
        <ul>
          {activities.map((activity) => {
            const subTasks = subTasksByActivity[activity.id] ?? []
            return (
              <li key={activity.id}>
                <button
                  type="button"
                  aria-pressed={selected?.activityId === activity.id}
                  onClick={() => setSelected({ activityId: activity.id, subTaskId: null })}
                >
                  {activity.name}
                </button>

                {subTasks.length > 0 && (
                  <ul>
                    {subTasks.map((subTask) => (
                      <li key={subTask.id}>
                        <button
                          type="button"
                          aria-pressed={selected?.subTaskId === subTask.id}
                          onClick={() =>
                            setSelected({ activityId: null, subTaskId: subTask.id })
                          }
                        >
                          {subTask.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {submitError && <p role="alert">{submitError}</p>}
      {isSubmitting && <output>Assigning…</output>}

      <button type="button" onClick={handleAssign} disabled={!selected || isSubmitting}>
        Assign
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </section>
  )
}
