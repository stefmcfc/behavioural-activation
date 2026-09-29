import { useEffect, useState } from 'react'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { ActivityCategory } from '../../types/activity'
import type { SubTask } from '../../types/subTask'
import { SubTaskForm } from './SubTaskForm'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import styles from './SubTaskList.module.css'

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

interface SubTaskListProps {
  readonly activityId: string
  readonly category: ActivityCategory
}

export function SubTaskList({ activityId, category }: SubTaskListProps) {
  const [subTasks, setSubTasks] = useState<SubTask[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingSubTaskId, setEditingSubTaskId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    subTaskApi
      .getAll(activityId)
      .then((data) => {
        if (!cancelled) {
          setSubTasks(data)
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
  }, [activityId, retryCount])

  const handleRetry = () => {
    setSubTasks(null)
    setLoadError(null)
    setRetryCount((count) => count + 1)
  }

  const handleFormSuccess = (subTask: SubTask) => {
    setSubTasks((previous) => {
      if (!previous) {
        return [subTask]
      }
      if (editingSubTaskId) {
        return previous.map((existing) => (existing.id === subTask.id ? subTask : existing))
      }
      return [...previous, subTask]
    })
    setEditingSubTaskId(null)
  }

  const handleConfirmDelete = async (id: string) => {
    setDeleteError(null)
    setDeletingId(id)
    try {
      await subTaskApi.remove(activityId, id)
      setSubTasks((previous) => previous?.filter((subTask) => subTask.id !== id) ?? previous)
      setConfirmingDeleteId(null)
    } catch (error) {
      setDeleteError(getErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  const editingSubTask = subTasks?.find((subTask) => subTask.id === editingSubTaskId)

  return (
    <div>
      <h3>Sub-tasks — {CATEGORY_LABELS[category]}</h3>

      {editingSubTask ? (
        <SubTaskForm
          key={editingSubTask.id}
          mode="edit"
          activityId={activityId}
          subTask={editingSubTask}
          onSuccess={handleFormSuccess}
          onCancel={() => setEditingSubTaskId(null)}
        />
      ) : (
        <SubTaskForm key="create" mode="create" activityId={activityId} onSuccess={handleFormSuccess} />
      )}

      {loadError && (
        <p role="alert">
          {loadError}{' '}
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </p>
      )}
      {deleteError && <p role="alert">{deleteError}</p>}

      {subTasks === null && !loadError && <output>Loading sub-tasks…</output>}

      {subTasks !== null && subTasks.length === 0 && <p>No sub-tasks yet.</p>}

      {subTasks !== null && subTasks.length > 0 && (
        <ul className={styles.list}>
          {subTasks.map((subTask) => (
            <li key={subTask.id} className={`${styles.row} ${styles.nested}`}>
              <span>{subTask.name}</span> <CategoryChip category={subTask.category} />

              {confirmingDeleteId === subTask.id ? (
                <span className={styles.actions}>
                  <button
                    type="button"
                    onClick={() => handleConfirmDelete(subTask.id)}
                    disabled={deletingId === subTask.id}
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(null)}
                    disabled={deletingId === subTask.id}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <span className={styles.actions}>
                  <button type="button" onClick={() => setEditingSubTaskId(subTask.id)}>
                    Rename
                  </button>
                  <button type="button" onClick={() => setConfirmingDeleteId(subTask.id)}>
                    Delete
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
