import { useEffect, useState } from 'react'
import { activityApi } from '../../services/activityApi'
import { ApiError } from '../../types/api'
import type { Activity } from '../../types/activity'
import { ActivityForm } from './ActivityForm'
import { SubTaskList } from './SubTaskList'
import { SuggestedActivities } from './SuggestedActivities'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { Modal } from '../Modal/Modal'
import { RepeatableIcon } from '../RepeatableIcon/RepeatableIcon'
import { FavouriteIcon } from '../FavouriteIcon/FavouriteIcon'
import { type CategoryFilter, CATEGORY_FILTER_OPTIONS } from '../../utils/categoryFilter'
import styles from './ActivityBank.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'

type FormTarget = 'create' | Activity | null

function formTargetTitleId(formTarget: FormTarget): string {
  return `activity-form-title-${formTarget === 'create' || formTarget === null ? 'create' : 'edit'}`
}

function getSubTasksLabel(activity: Activity, isExpanded: boolean): string {
  if (isExpanded) {
    return 'Hide sub-tasks'
  }
  return activity.subTaskCount === 0 ? 'Add sub-tasks' : `Show sub-tasks (${activity.subTaskCount})`
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
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL')
  const [favouriteFilter, setFavouriteFilter] = useState(false)
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null)
  const [unarchiveError, setUnarchiveError] = useState<string | null>(null)
  const [favouritingId, setFavouritingId] = useState<string | null>(null)
  const [favouriteError, setFavouriteError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

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

  const handleToggleFavourite = async (activity: Activity) => {
    setFavouriteError(null)
    setFavouritingId(activity.id)
    try {
      if (activity.favourite) {
        await activityApi.unmarkFavourite(activity.id)
        setActivities((previous) =>
          previous?.map((existing) =>
            existing.id === activity.id ? { ...existing, favourite: false } : existing,
          ) ?? previous,
        )
      } else {
        const updated = await activityApi.markFavourite(activity.id)
        setActivities((previous) =>
          previous?.map((existing) => (existing.id === activity.id ? updated : existing)) ??
          previous,
        )
      }
    } catch (error) {
      setFavouriteError(getErrorMessage(error))
    } finally {
      setFavouritingId(null)
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
    if (formTarget !== 'create' && formTarget !== null && activity.id === expandedActivityId) {
      setRefreshKey((count) => count + 1)
    }
    setFormTarget(null)
  }

  const handleCloseForm = () => setFormTarget(null)

  const handleSuggestionAdded = (activity: Activity) => {
    setActivities((previous) => (previous ? [...previous, activity] : [activity]))
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

  const renderRowActions = (activity: Activity) => {
    const toggleSubTasks = () =>
      setExpandedActivityId((current) => (current === activity.id ? null : activity.id))
    const subTasksLabel = getSubTasksLabel(activity, expandedActivityId === activity.id)

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
            className={buttonStyles.destructive}
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
        <button
          type="button"
          className={buttonStyles.destructive}
          onClick={() => setConfirmingDeleteId(activity.id)}
        >
          Delete
        </button>
      </>
    )
  }

  const visibleActivities = (activities ?? []).filter(
    (activity) =>
      (categoryFilter === 'ALL' || activity.category === categoryFilter) &&
      (!favouriteFilter || activity.favourite),
  )

  return (
    <section>
      <h2>Activity Bank</h2>

      <div className={styles.toolbar}>
        {activities !== null && activities.length > 0 && (
          <>
            <fieldset className={styles.filterFieldset}>
              <legend>Filter by category</legend>
              <ul // NOSONAR(typescript:S6819): deliberate -- the fieldset/legend above already labels
                // this as a category filter group, so the <ul>'s own list semantics (announcing "list,
                // N items") would just be redundant noise for screen reader users.
                className={styles.filterGroup}
                role="presentation"
              >
                {CATEGORY_FILTER_OPTIONS.map((option) => (
                  <li key={option.value}>
                    <label>
                      <input
                        type="radio"
                        name="activity-bank-category-filter"
                        value={option.value}
                        checked={categoryFilter === option.value}
                        onChange={() => setCategoryFilter(option.value)}
                      />
                      {option.label}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            <div className={styles.toolbarDivider} aria-hidden="true" />
          </>
        )}

        <fieldset className={styles.filterFieldset}>
          <legend>Filter by status</legend>
          <div className={styles.statusToggleGroup}>
            <label className={styles.archivedToggle}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />{' '}
              Show archived
            </label>
            <label className={styles.archivedToggle}>
              <input
                type="checkbox"
                checked={favouriteFilter}
                onChange={(event) => setFavouriteFilter(event.target.checked)}
              />{' '}
              Favourites only
            </label>
          </div>
        </fieldset>

        <button
          type="button"
          className={`${styles.addButton} ${buttonStyles.primary}`}
          onClick={() => setFormTarget('create')}
        >
          Add activity
        </button>
      </div>

      <SuggestedActivities
        activities={activities ?? []}
        onAdded={handleSuggestionAdded}
        defaultOpen={activities !== null && activities.length === 0}
      />

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
      {favouriteError && <p role="alert">{favouriteError}</p>}

      {activities === null && !loadError && <output>Loading activities…</output>}

      {activities !== null && activities.length === 0 && (
        <p>No activities yet. Add one below to get started.</p>
      )}

      {activities !== null && activities.length > 0 && visibleActivities.length === 0 && (
        <p>No activities in this category.</p>
      )}

      {visibleActivities.length > 0 && (
        <ul className={styles.list}>
          {visibleActivities.map((activity) => (
            <li key={activity.id} className={styles.row}>
              <button
                type="button"
                className={styles.favouriteToggle}
                aria-pressed={activity.favourite}
                aria-label={activity.favourite ? `Unfavourite ${activity.name}` : `Favourite ${activity.name}`}
                onClick={() => handleToggleFavourite(activity)}
                disabled={favouritingId === activity.id}
              >
                <FavouriteIcon filled={activity.favourite} />
              </button>
              <span>{activity.name}</span> <CategoryChip category={activity.category} />
              {activity.repeatable && <RepeatableIcon />}
              {activity.archived && <span className={styles.archivedLabel}>(Archived)</span>}

              <span className={styles.actions}>{renderRowActions(activity)}</span>

              {activity.description && <p>{activity.description}</p>}

              {expandedActivityId === activity.id && (
                <div className={styles.details}>
                  <SubTaskList
                    key={`${activity.id}-${refreshKey}`}
                    activityId={activity.id}
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
