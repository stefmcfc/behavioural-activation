import { useEffect, useState } from 'react'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { Activity } from '../../types/activity'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { planApi } from '../../services/planApi'
import type { SubTask } from '../../types/subTask'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { RepeatableIcon } from '../RepeatableIcon/RepeatableIcon'
import { FavouriteIcon } from '../FavouriteIcon/FavouriteIcon'
import { type CategoryFilter, CATEGORY_FILTER_OPTIONS } from '../../utils/categoryFilter'
import styles from './AssignActivityPicker.module.css'

type RepeatableFilter = 'ALL' | 'REPEATABLE' | 'ONE_OFF'

const REPEATABLE_FILTER_OPTIONS: readonly { value: RepeatableFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'REPEATABLE', label: 'Repeatable' },
  { value: 'ONE_OFF', label: 'One-off' },
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
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL')
  const [repeatableFilter, setRepeatableFilter] = useState<RepeatableFilter>('ALL')
  const [favouriteFilter, setFavouriteFilter] = useState(false)

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

  const visibleActivities = (activities ?? []).filter((activity) => {
    if (favouriteFilter && !activity.favourite) return false

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

  return (
    <>
      <div className={styles.scrollBody}>
      <h3 id="assign-picker-title">Assign an activity or sub-task</h3>

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
            <label>
              <input
                type="checkbox"
                checked={favouriteFilter}
                onChange={(event) => setFavouriteFilter(event.target.checked)}
              />{' '}
              Favourites only
            </label>
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
              <li key={activity.id} className={styles.activityGroup}>
                <div className={styles.activityRow}>
                  <button
                    type="button"
                    aria-pressed={selected?.activityId === activity.id}
                    onClick={() => setSelected({ activityId: activity.id, subTaskId: null })}
                  >
                    {activity.name}
                  </button>
                  <CategoryChip category={activity.category} />
                  {activity.repeatable && <RepeatableIcon />}
                  {activity.favourite && <FavouriteIcon />}
                </div>

                {subTasks.length > 0 && (
                  <ul className={styles.subTaskList}>
                    {subTasks.map((subTask) => (
                      <li key={subTask.id} className={styles.subTaskRow}>
                        <button
                          type="button"
                          aria-pressed={selected?.subTaskId === subTask.id}
                          onClick={() =>
                            setSelected({ activityId: null, subTaskId: subTask.id })
                          }
                        >
                          {subTask.name}
                        </button>
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

      {submitError && <p role="alert">{submitError}</p>}
      {isSubmitting && <output>Assigning…</output>}
      </div>

      <div className={styles.footer}>
        <button type="button" onClick={handleAssign} disabled={!selected || isSubmitting}>
          Assign
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  )
}
