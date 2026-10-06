import { useEffect, useState } from 'react'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { SubTask } from '../../types/subTask'
import { SubTaskForm } from './SubTaskForm'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { Modal } from '../Modal/Modal'
import styles from './SubTaskList.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'

type FormTarget = 'create' | SubTask | null

function formTargetTitleId(formTarget: FormTarget): string {
  return `sub-task-form-title-${formTarget === 'create' || formTarget === null ? 'create' : 'edit'}`
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
  readonly readOnly?: boolean
}

export function SubTaskList({ activityId, readOnly = false }: SubTaskListProps) {
  const [subTasks, setSubTasks] = useState<SubTask[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formTarget, setFormTarget] = useState<FormTarget>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [reorderInFlight, setReorderInFlight] = useState(false)
  const [reorderError, setReorderError] = useState<string | null>(null)

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
      if (formTarget !== 'create' && formTarget !== null) {
        return previous.map((existing) => (existing.id === subTask.id ? subTask : existing))
      }
      return [...previous, subTask]
    })
    setFormTarget(null)
  }

  const handleCloseForm = () => setFormTarget(null)

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

  // FRONTEND-047: sub-tasks are rendered in their persisted manual order rather than the raw
  // array order local state happens to hold -- defensive, since create/rename/delete mutate
  // state in place rather than refetching (mirrors BucketList.tsx's identical sort).
  const sortedSubTasks = (subTasks ?? []).slice().sort((a, b) => a.position - b.position)

  const handleReorder = async (subTaskIds: string[]) => {
    setReorderError(null)
    setReorderInFlight(true)
    try {
      const updated = await subTaskApi.reorder(activityId, subTaskIds)
      setSubTasks(updated)
    } catch (error) {
      setReorderError(getErrorMessage(error))
    } finally {
      setReorderInFlight(false)
    }
  }

  const handleMoveUp = (id: string) => {
    const ids = sortedSubTasks.map((subTask) => subTask.id)
    const index = ids.indexOf(id)
    if (index <= 0) return
    const next = [...ids]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    handleReorder(next)
  }

  const handleMoveDown = (id: string) => {
    const ids = sortedSubTasks.map((subTask) => subTask.id)
    const index = ids.indexOf(id)
    if (index === -1 || index >= ids.length - 1) return
    const next = [...ids]
    ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
    handleReorder(next)
  }

  return (
    <div>
      <div className={styles.header}>
        {subTasks !== null && subTasks.length === 0 && <p>No sub-tasks yet.</p>}
        {!readOnly && (
          <button
            type="button"
            className={`${styles.addButton} ${buttonStyles.primary}`}
            onClick={() => setFormTarget('create')}
          >
            Add sub-task
          </button>
        )}
      </div>

      {loadError && (
        <p role="alert">
          {loadError}{' '}
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </p>
      )}
      {deleteError && <p role="alert">{deleteError}</p>}
      {reorderError && <p role="alert">{reorderError}</p>}

      {subTasks === null && !loadError && <output>Loading sub-tasks…</output>}

      {subTasks !== null && subTasks.length > 0 && (
        <ul className={styles.list}>
          {sortedSubTasks.map((subTask, index) => (
            <li key={subTask.id} className={`${styles.row} ${styles.nested}`}>
              <span>{subTask.name}</span> <CategoryChip category={subTask.category} />

              {!readOnly &&
                (confirmingDeleteId === subTask.id ? (
                  <span className={styles.actions}>
                    <button
                      type="button"
                      className={buttonStyles.destructive}
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
                    <button
                      type="button"
                      className={styles.moveButton}
                      onClick={() => handleMoveUp(subTask.id)}
                      disabled={index === 0 || reorderInFlight}
                      aria-label={`Move ${subTask.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.moveButton}
                      onClick={() => handleMoveDown(subTask.id)}
                      disabled={index === sortedSubTasks.length - 1 || reorderInFlight}
                      aria-label={`Move ${subTask.name} down`}
                    >
                      ↓
                    </button>
                    <button type="button" onClick={() => setFormTarget(subTask)}>
                      Rename
                    </button>
                    <button
                      type="button"
                      className={buttonStyles.destructive}
                      onClick={() => setConfirmingDeleteId(subTask.id)}
                    >
                      Delete
                    </button>
                  </span>
                ))}
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={formTarget !== null} titleId={formTargetTitleId(formTarget)} onClose={handleCloseForm}>
        {formTarget !== null && (
          <SubTaskForm
            key={formTarget === 'create' ? 'create' : formTarget.id}
            mode={formTarget === 'create' ? 'create' : 'edit'}
            activityId={activityId}
            subTask={formTarget === 'create' ? undefined : formTarget}
            onSuccess={handleFormSuccess}
            onCancel={handleCloseForm}
          />
        )}
      </Modal>
    </div>
  )
}
