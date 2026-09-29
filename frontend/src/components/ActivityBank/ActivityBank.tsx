import { useEffect, useState } from 'react'
import { activityApi } from '../../services/activityApi'
import { ApiError } from '../../types/api'
import type { Activity, ActivityCategory } from '../../types/activity'
import { ActivityForm } from './ActivityForm'
import { SubTaskList } from './SubTaskList'

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  ROUTINE: 'Routine',
  NECESSARY: 'Necessary',
  PLEASURABLE: 'Pleasurable',
}

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

export function ActivityBank() {
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    activityApi
      .getAll()
      .then((data) => {
        if (!cancelled) {
          setActivities(data)
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

  const handleFormSuccess = (activity: Activity) => {
    setActivities((previous) => {
      if (!previous) {
        return [activity]
      }
      if (editingActivity) {
        return previous.map((existing) => (existing.id === activity.id ? activity : existing))
      }
      return [...previous, activity]
    })
    setEditingActivity(null)
  }

  const handleConfirmDelete = async (id: string) => {
    setDeleteError(null)
    setDeletingId(id)
    try {
      await activityApi.remove(id)
      setActivities((previous) => previous?.filter((activity) => activity.id !== id) ?? previous)
      setConfirmingDeleteId(null)
    } catch (error) {
      setDeleteError(getErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section>
      <h2>Activity Bank</h2>

      <ActivityForm
        key={editingActivity?.id ?? 'create'}
        mode={editingActivity ? 'edit' : 'create'}
        activity={editingActivity ?? undefined}
        onSuccess={handleFormSuccess}
        onCancel={editingActivity ? () => setEditingActivity(null) : undefined}
      />

      {loadError && <p role="alert">{loadError}</p>}
      {deleteError && <p role="alert">{deleteError}</p>}

      {activities === null && !loadError && <output>Loading activities…</output>}

      {activities !== null && activities.length === 0 && (
        <p>No activities yet. Add one above to get started.</p>
      )}

      {activities !== null && activities.length > 0 && (
        <ul>
          {activities.map((activity) => (
            <li key={activity.id}>
              <span>{activity.name}</span> — <span>{CATEGORY_LABELS[activity.category]}</span>
              {activity.description && <p>{activity.description}</p>}

              {confirmingDeleteId === activity.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleConfirmDelete(activity.id)}
                    disabled={deletingId === activity.id}
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(null)}
                    disabled={deletingId === activity.id}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setEditingActivity(activity)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => setConfirmingDeleteId(activity.id)}>
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedActivityId((current) =>
                        current === activity.id ? null : activity.id,
                      )
                    }
                  >
                    {expandedActivityId === activity.id ? 'Hide sub-tasks' : 'Show sub-tasks'}
                  </button>
                </>
              )}

              {expandedActivityId === activity.id && (
                <SubTaskList activityId={activity.id} category={activity.category} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
