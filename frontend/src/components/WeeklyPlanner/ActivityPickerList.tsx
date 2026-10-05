import { useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import { activityApi } from '../../services/activityApi'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { Activity } from '../../types/activity'
import type { SubTask } from '../../types/subTask'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { CategoryGroupHeading } from '../CategoryGroupHeading/CategoryGroupHeading'
import { RepeatableIcon } from '../RepeatableIcon/RepeatableIcon'
import { FavouriteIcon } from '../FavouriteIcon/FavouriteIcon'
import { type CategoryFilter, CATEGORY_FILTER_OPTIONS } from '../../utils/categoryFilter'
import { CATEGORY_ORDER } from '../../utils/categoryLabels'
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

// FRONTEND-045-AC-07: mirrors ActivityBank.tsx's own getSubTasksLabel wording convention, but
// takes the locally category-filtered sub-task count directly rather than activity.subTaskCount,
// which doesn't reflect the active category filter.
function getSubTasksToggleLabel(count: number, isExpanded: boolean): string {
  return isExpanded ? 'Hide sub-tasks' : `Show sub-tasks (${count})`
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
  // FRONTEND-045-AC-06/AC-10, extended to drag mode by FRONTEND-046-AC-04/AC-06: single-expansion
  // sub-task disclosure state, shared by both modes -- mirrors ActivityBank.tsx's own
  // expandedActivityId pattern. The `select`-mode instance (AssignActivityPicker) and `drag`-mode
  // instance (ActivityDrawer) are never mounted simultaneously, so each has entirely independent
  // local state.
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // FRONTEND-033-AC-02/AC-03: activityApi.getAll() and subTaskApi.getAllForOwner() are fetched in
    // parallel -- there's no data dependency between them, since the bulk sub-task endpoint isn't
    // scoped by activity id -- then the flat sub-task list is grouped by activityId client-side,
    // replacing the previous one-subTaskApi.getAll()-call-per-activity fan-out.
    Promise.all([activityApi.getAll(), subTaskApi.getAllForOwner()])
      .then(([fetchedActivities, allSubTasks]) => {
        if (cancelled) return

        const grouped: Record<string, SubTask[]> = Object.fromEntries(
          fetchedActivities.map((activity) => [activity.id, [] as SubTask[]]),
        )
        for (const subTask of allSubTasks) {
          grouped[subTask.activityId] ??= []
          grouped[subTask.activityId].push(subTask)
        }

        setActivities(fetchedActivities)
        setSubTasksByActivity(grouped)
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
        // FRONTEND-032-AC-01/AC-02: all three filters share one collapsed-by-default disclosure
        // rather than each being its own always-visible block -- see
        // frontend_spec_032_collapsible_filters.md. Closed by default is safe because
        // categoryFilter/repeatableFilter/favouriteFilter (AC-07) already reset to 'ALL' on every
        // fresh mount, so there's never a non-default filter hidden behind a closed disclosure the
        // user didn't open themselves.
        <details className={styles.filtersDisclosure}>
          <summary className={styles.filtersSummary}>Filters</summary>

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
        </details>
      )}

      {loadError && <p role="alert">{loadError}</p>}
      {activities === null && !loadError && <output>Loading activities…</output>}

      {activities !== null && activities.length === 0 && (
        <p>No activities yet. Add one to your activity bank first.</p>
      )}

      {activities !== null && activities.length > 0 && visibleActivities.length === 0 && (
        <p>No activities match these filters.</p>
      )}

      {/* FRONTEND-045-AC-01/AC-02/AC-03/AC-04, extended to drag mode by FRONTEND-046-AC-01/AC-02/
          AC-03: both modes share the identical category-grouping + collapsible-sub-tasks
          derivation (CATEGORY_ORDER sections, reusing ActivityBank.tsx's own precedent,
          partitioned with .filter() only -- no new sort -- plus a per-activity collapsed-by-
          default sub-task disclosure, FRONTEND-045-AC-06 through AC-11 / FRONTEND-046-AC-04
          through AC-09). frontend_spec_046 deliberately superseded the previous
          FRONTEND-045-AC-05/AC-12 regression guards that kept this block select-mode-only and
          drag mode flat/always-expanded -- only the leaf row content below now differs per mode:
          a select button (select mode) vs. a plain draggable span (drag mode). */}
      {visibleActivities.length > 0 &&
        CATEGORY_ORDER.map((category) => {
          const activitiesInCategory = visibleActivities.filter((a) => a.category === category)
          if (activitiesInCategory.length === 0) {
            return null
          }
          return (
            <div key={category}>
              <CategoryGroupHeading category={category} />
              <ul className={styles.panel}>
                {activitiesInCategory.map((activity) => {
                  const subTasks = (subTasksByActivity[activity.id] ?? []).filter(
                    (subTask) => categoryFilter === 'ALL' || subTask.category === categoryFilter,
                  )
                  const isExpanded = expandedActivityId === activity.id
                  const toggleSubTasks = () =>
                    setExpandedActivityId((current) =>
                      current === activity.id ? null : activity.id,
                    )

                  return (
                    <li
                      key={activity.id}
                      className={styles.activityGroup}
                      draggable={isDragMode}
                      onDragStart={
                        isDragMode ? () => handleActivityDragStart(activity.id) : undefined
                      }
                      onDragEnd={isDragMode ? onDragEnd : undefined}
                    >
                      <div className={styles.activityRow}>
                        {isDragMode ? (
                          <span className={styles.activityName}>{activity.name}</span>
                        ) : (
                          <button
                            type="button"
                            aria-pressed={selected?.activityId === activity.id}
                            onClick={() => onSelectActivity?.(activity.id)}
                          >
                            {activity.name}
                          </button>
                        )}
                        <CategoryChip category={activity.category} />
                        {activity.repeatable && <RepeatableIcon />}
                        {activity.favourite && <FavouriteIcon />}
                        {subTasks.length > 0 && (
                          <span className={styles.actions}>
                            {/* FRONTEND-046-AC-08: explicitly draggable={false}, overriding the
                                draggable ancestor <li> above (in drag mode) -- without this, a
                                click with any pointer movement on this nested control risks the
                                browser starting a native drag of the whole activity row instead
                                of registering the click. Harmless in select mode, where the
                                ancestor <li> is never draggable in the first place. */}
                            <button type="button" draggable={false} onClick={toggleSubTasks}>
                              {getSubTasksToggleLabel(subTasks.length, isExpanded)}
                            </button>
                          </span>
                        )}
                      </div>

                      {subTasks.length > 0 && isExpanded && (
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
                              {isDragMode ? (
                                <span className={styles.activityName}>{subTask.name}</span>
                              ) : (
                                <button
                                  type="button"
                                  aria-pressed={selected?.subTaskId === subTask.id}
                                  onClick={() => onSelectSubTask?.(subTask.id)}
                                >
                                  {subTask.name}
                                </button>
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
            </div>
          )
        })}
    </>
  )
}
