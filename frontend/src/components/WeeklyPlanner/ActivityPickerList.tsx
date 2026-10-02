import { useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { Activity } from '../../types/activity'
import type { SubTask } from '../../types/subTask'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { RepeatableIcon } from '../RepeatableIcon/RepeatableIcon'
import { FavouriteIcon } from '../FavouriteIcon/FavouriteIcon'
import { type CategoryFilter, CATEGORY_FILTER_OPTIONS } from '../../utils/categoryFilter'
// FRONTEND-028-AC-01: this extraction reuses AssignActivityPicker's own CSS module rather than
// introducing a parallel one -- the two components render identical markup/classnames in `select`
// mode, so sharing the module keeps the one `moduleStyles.test.ts` check on this file's selectors
// meaningful for both consumers instead of needing a duplicate check on a second file.
import styles from './AssignActivityPicker.module.css'

type RepeatableFilter = 'ALL' | 'REPEATABLE' | 'ONE_OFF'

const REPEATABLE_FILTER_OPTIONS: readonly { value: RepeatableFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'REPEATABLE', label: 'Repeatable' },
  { value: 'ONE_OFF', label: 'One-off' },
]

type FavouriteFilter = 'ALL' | 'FAVOURITES_ONLY'

const FAVOURITE_FILTER_OPTIONS: readonly { value: FavouriteFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'FAVOURITES_ONLY', label: 'Favourites only' },
]

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

export type ActivityPickerMode = 'select' | 'drag'

export interface ActivityPickerSelection {
  readonly activityId: string | null
  readonly subTaskId: string | null
}

interface ActivityPickerListProps {
  readonly mode: ActivityPickerMode
  /** `select` mode only. */
  readonly selected?: ActivityPickerSelection | null
  readonly onSelectActivity?: (activityId: string) => void
  readonly onSelectSubTask?: (subTaskId: string) => void
  /** `drag` mode only. */
  readonly onDragStartActivity?: (activityId: string) => void
  readonly onDragStartSubTask?: (subTaskId: string) => void
  readonly onDragEnd?: () => void
}

export function ActivityPickerList({
  mode,
  selected,
  onSelectActivity,
  onSelectSubTask,
  onDragStartActivity,
  onDragStartSubTask,
  onDragEnd,
}: ActivityPickerListProps) {
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [subTasksByActivity, setSubTasksByActivity] = useState<Record<string, SubTask[]>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL')
  const [repeatableFilter, setRepeatableFilter] = useState<RepeatableFilter>('ALL')
  const [favouriteFilter, setFavouriteFilter] = useState<FavouriteFilter>('ALL')

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

  const visibleActivities = (activities ?? []).filter((activity) => {
    if (favouriteFilter === 'FAVOURITES_ONLY' && !activity.favourite) return false

    if (repeatableFilter !== 'ALL') {
      const matchesRepeatable =
        repeatableFilter === 'REPEATABLE' ? activity.repeatable : !activity.repeatable
      if (!matchesRepeatable) return false
    }

    if (categoryFilter === 'ALL') return true
    if (activity.category === categoryFilter) return true
    const subTasks = subTasksByActivity[activity.id] ?? []
    return subTasks.some((subTask) => subTask.category === categoryFilter)
  })

  const isDragMode = mode === 'drag'

  const handleActivityDragStart = (activityId: string) => {
    onDragStartActivity?.(activityId)
  }

  const handleSubTaskDragStart = (event: DragEvent, subTaskId: string) => {
    // Stop this from also bubbling to the parent activity row's own onDragStart -- native drag
    // events bubble, and both the sub-task row and its parent activity row are draggable in drag
    // mode, so without this both onDragStartSubTask and onDragStartActivity would fire for the
    // same drag.
    event.stopPropagation()
    onDragStartSubTask?.(subTaskId)
  }

  const handleSubTaskDragEnd = (event: DragEvent) => {
    event.stopPropagation()
    onDragEnd?.()
  }

  return (
    <>
      {activities !== null && activities.length > 0 && (
        <>
          <fieldset className={styles.filterFieldset}>
            <legend>Filter by category</legend>
            <ul className={styles.filterGroup}>
              {CATEGORY_FILTER_OPTIONS.map((option) => (
                <li key={option.value}>
                  <label>
                    <input
                      type="radio"
                      name="assign-picker-category-filter"
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

          <fieldset className={styles.filterFieldset}>
            <legend>Filter by type</legend>
            <ul className={styles.filterGroup}>
              {REPEATABLE_FILTER_OPTIONS.map((option) => (
                <li key={option.value}>
                  <label>
                    <input
                      type="radio"
                      name="assign-picker-repeatable-filter"
                      value={option.value}
                      checked={repeatableFilter === option.value}
                      onChange={() => setRepeatableFilter(option.value)}
                    />
                    {option.label}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className={styles.filterFieldset}>
            <legend>Filter by favourite</legend>
            <ul className={styles.filterGroup}>
              {FAVOURITE_FILTER_OPTIONS.map((option) => (
                <li key={option.value}>
                  <label>
                    <input
                      type="radio"
                      name="assign-picker-favourite-filter"
                      value={option.value}
                      checked={favouriteFilter === option.value}
                      onChange={() => setFavouriteFilter(option.value)}
                    />
                    {option.label}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </>
      )}

      {loadError && <p role="alert">{loadError}</p>}
      {activities === null && !loadError && <output>Loading activities…</output>}

      {activities !== null && activities.length === 0 && (
        <p>No activities yet. Add one to your activity bank first.</p>
      )}

      {activities !== null && activities.length > 0 && visibleActivities.length === 0 && (
        <p>No activities match these filters.</p>
      )}

      {visibleActivities.length > 0 && (
        <ul className={styles.panel}>
          {visibleActivities.map((activity) => {
            const subTasks = (subTasksByActivity[activity.id] ?? []).filter(
              (subTask) => categoryFilter === 'ALL' || subTask.category === categoryFilter,
            )
            return (
              <li
                key={activity.id}
                className={styles.activityGroup}
                draggable={isDragMode}
                onDragStart={isDragMode ? () => handleActivityDragStart(activity.id) : undefined}
                onDragEnd={isDragMode ? onDragEnd : undefined}
              >
                <div className={styles.activityRow}>
                  {mode === 'select' ? (
                    <button
                      type="button"
                      aria-pressed={selected?.activityId === activity.id}
                      onClick={() => onSelectActivity?.(activity.id)}
                    >
                      {activity.name}
                    </button>
                  ) : (
                    <span className={styles.activityName}>{activity.name}</span>
                  )}
                  <CategoryChip category={activity.category} />
                  {activity.repeatable && <RepeatableIcon />}
                  {activity.favourite && <FavouriteIcon />}
                </div>

                {subTasks.length > 0 && (
                  <ul className={styles.subTaskList}>
                    {subTasks.map((subTask) => (
                      <li
                        key={subTask.id}
                        className={styles.subTaskRow}
                        draggable={isDragMode}
                        onDragStart={
                          isDragMode
                            ? (event) => handleSubTaskDragStart(event, subTask.id)
                            : undefined
                        }
                        onDragEnd={isDragMode ? handleSubTaskDragEnd : undefined}
                      >
                        {mode === 'select' ? (
                          <button
                            type="button"
                            aria-pressed={selected?.subTaskId === subTask.id}
                            onClick={() => onSelectSubTask?.(subTask.id)}
                          >
                            {subTask.name}
                          </button>
                        ) : (
                          <span className={styles.activityName}>{subTask.name}</span>
                        )}
                        <CategoryChip category={subTask.category} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
