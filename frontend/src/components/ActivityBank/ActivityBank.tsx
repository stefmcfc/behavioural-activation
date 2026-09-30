import { useEffect, useState } from 'react'
import { activityApi } from '../../services/activityApi'
import { ApiError } from '../../types/api'
import type { Activity } from '../../types/activity'
import { ActivityForm } from './ActivityForm'
import { SubTaskList } from './SubTaskList'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { Modal } from '../Modal/Modal'
import styles from './ActivityBank.module.css'

type FormTarget = 'create' | Activity | null

function formTargetTitleId(formTarget: FormTarget): string {
  return `activity-form-title-${formTarget === 'create' || formTarget === null ? 'create' : 'edit'}`
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
  const [formTarget, setFormTarget] = useState<FormTarget>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null)
  const [unarchiveError, setUnarchiveError] = useState<string | null>(null)

  const fetchActivities = (includeArchived: boolean, onCancelled: () => boolean = () => false) => {
    setLoadError(null)
    activityApi
      .getAll(includeArchived)
      .then((data) => {
        if (!onCancelled()) {
          setActivities(data)
        }
      })
      .catch((error: unknown) => {
        if (!onCancelled()) {
          setLoadError(getErrorMessage(error))
        }
      })
  }

  useEffect(() => {
    let cancelled = false
    fetchActivities(showArchived, () => cancelled)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived])

  const handleRetryLoad = () => {
    fetchActivities(showArchived)
  }

  const handleUnarchive = async (id: string) => {
    setUnarchiveError(null)
    setUnarchivingId(id)
    try {
      await activityApi.unarchive(id)
      setActivities((previous) =>
        previous?.map((activity) =>
          activity.id === id ? { ...activity, archived: false } : activity,
        ) ?? previous,
      )
    } catch (error) {
      setUnarchiveError(getErrorMessage(error))
    } finally {
      setUnarchivingId(null)
    }
  }

  const handleFormSuccess = (activity: Activity) => {
    setActivities((previous) => {
      if (!previous) {
        return [activity]
      }
      if (formTarget !== 'create' && formTarget !== null) {
        return previous.map((existing) => (existing.id === activity.id ? activity : existing))
      }
      return [...previous, activity]
    })
    setFormTarget(null)
  }

  const handleCloseForm = () => setFormTarget(null)

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

  const renderRowActions = (activity: Activity) => {
    const toggleSubTasks = () =>
      setExpandedActivityId((current) => (current === activity.id ? null : activity.id))
    const subTasksLabel = expandedActivityId === activity.id ? 'Hide sub-tasks' : 'Show sub-tasks'

    if (activity.archived) {
      return (
        <>
          <button type="button" onClick={toggleSubTasks}>
            {subTasksLabel}
          </button>
          <button
            type="button"
            onClick={() => handleUnarchive(activity.id)}
            disabled={unarchivingId === activity.id}
          >
            Unarchive
          </button>
        </>
      )
    }

    if (confirmingDeleteId === activity.id) {
      return (
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
      )
    }

    return (
      <>
        <button type="button" onClick={toggleSubTasks}>
          {subTasksLabel}
        </button>
        <button type="button" onClick={() => setFormTarget(activity)}>
          Edit
        </button>
        <button type="button" onClick={() => setConfirmingDeleteId(activity.id)}>
          Delete
        </button>
      </>
    )
  }

  return (
    <section>
      <h2>Activity Bank</h2>

      <div className={styles.toolbar}>
        <label className={styles.archivedToggle}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />{' '}
          Show archived
        </label>

        <button type="button" className={styles.addButton} onClick={() => setFormTarget('create')}>
          Add activity
        </button>
      </div>

      {loadError && (
        <p role="alert">
          {loadError}{' '}
          <button type="button" onClick={handleRetryLoad}>
            Retry
          </button>
        </p>
      )}
      {deleteError && <p role="alert">{deleteError}</p>}
      {unarchiveError && <p role="alert">{unarchiveError}</p>}

      {activities === null && !loadError && <output>Loading activities…</output>}

      {activities !== null && activities.length === 0 && (
        <p>No activities yet. Add one below to get started.</p>
      )}

      {activities !== null && activities.length > 0 && (
        <ul className={styles.list}>
          {activities.map((activity) => (
            <li key={activity.id} className={styles.row}>
              <span>{activity.name}</span> <CategoryChip category={activity.category} />
              {activity.archived && <span className={styles.archivedLabel}>(Archived)</span>}

              <span className={styles.actions}>{renderRowActions(activity)}</span>

              {activity.description && <p>{activity.description}</p>}

              {expandedActivityId === activity.id && (
                <div className={styles.details}>
                  <SubTaskList
                    activityId={activity.id}
                    category={activity.category}
                    readOnly={activity.archived}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={formTarget !== null} titleId={formTargetTitleId(formTarget)} onClose={handleCloseForm}>
        {formTarget !== null && (
          <ActivityForm
            key={formTarget === 'create' ? 'create' : formTarget.id}
            mode={formTarget === 'create' ? 'create' : 'edit'}
            activity={formTarget === 'create' ? undefined : formTarget}
            onSuccess={handleFormSuccess}
            onCancel={handleCloseForm}
          />
        )}
      </Modal>
    </section>
  )
}
