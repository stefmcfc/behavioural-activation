import { useEffect, useRef, useState } from 'react'
import { activityApi } from '../../services/activityApi'
import type { Activity } from '../../types/activity'
import { ActivityForm } from './ActivityForm'
import { SubTaskList } from './SubTaskList'
import { SuggestedActivities } from './SuggestedActivities'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { CategoryGroupHeading } from '../CategoryGroupHeading/CategoryGroupHeading'
import { Modal } from '../Modal/Modal'
import { RepeatableIcon } from '../RepeatableIcon/RepeatableIcon'
import { FavouriteIcon } from '../FavouriteIcon/FavouriteIcon'
import { ChevronIcon } from '../icons/ChevronIcon'
import { type CategoryFilter, CATEGORY_FILTER_OPTIONS } from '../../utils/categoryFilter'
import { CATEGORY_ORDER } from '../../utils/categoryLabels'
import { getErrorMessage } from '../../utils/getErrorMessage'
import styles from './ActivityBank.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'

type FormTarget = 'create' | Activity | null

function formTargetTitleId(formTarget: FormTarget): string {
  return `activity-form-title-${formTarget === 'create' || formTarget === null ? 'create' : 'edit'}`
}

// FRONTEND-049: fixed undo window for a deferred delete -- not configurable, see spec.
const UNDO_DELETE_WINDOW_MS = 6000

function getSubTasksLabel(activity: Activity, isExpanded: boolean): string {
  if (isExpanded) {
    return 'Hide sub-tasks'
  }
  return activity.subTaskCount === 0 ? 'Add sub-tasks' : `Show sub-tasks (${activity.subTaskCount})`
}

export function ActivityBank() {
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formTarget, setFormTarget] = useState<FormTarget>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // FRONTEND-049: ids currently inside their post-confirm undo window -- the row is hidden but
  // activityApi.remove has not been called yet. Keyed by id (not a single scalar) so multiple
  // pending deletions are tracked independently (FRONTEND-049-AC-04).
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())
  // Plain setTimeout handles, not React state -- deliberately NOT cleared on unmount (see
  // FRONTEND-049-AC-05): a confirmed deletion must still commit even if the user navigates away.
  const pendingDeleteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Guards setState calls from a deferred-delete timer that fires after unmount -- mirrors the
  // `cancelled` flag convention used by the fetch effect below, but as a ref since the timer
  // outlives any single effect/render.
  const isMountedRef = useRef(true)
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL')
  const [favouriteFilter, setFavouriteFilter] = useState(false)
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null)
  const [unarchiveError, setUnarchiveError] = useState<string | null>(null)
  const [favouritingId, setFavouritingId] = useState<string | null>(null)
  const [favouriteError, setFavouriteError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  // FRONTEND-058-AC-02/AC-03: Archive is the only destructive-ish action reachable from an active
  // row -- mirrors handleUnarchive's existing no-confirm shape exactly.
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  // FRONTEND-058-AC-09 through AC-13: the impact check gating an archived row's Confirm delete.
  const [impactCheckingId, setImpactCheckingId] = useState<string | null>(null)
  const [impactWarning, setImpactWarning] = useState<
    { id: string; plannedOccurrenceCount: number; completionCount: number } | null
  >(null)
  const [impactError, setImpactError] = useState<{ id: string; message: string } | null>(null)

  // Deliberately does not reset loadError itself -- loadError is already null on initial mount, so
  // the mount effect below has no synchronous setState call of its own (avoids oxlint's
  // react(set-state-in-effect) cascading-render warning for a no-op reset); handleRetryLoad resets
  // it explicitly instead, since that call is a genuine "clear the previous error" state change.
  const fetchActivities = (onCancelled: () => boolean = () => false) => {
    activityApi
      .getAll(true)
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

  // FRONTEND-058-AC-04: always fetches with includeArchived: true on mount -- partitioned
  // client-side into visibleActivities/archivedActivities below, replacing the previous
  // showArchived-conditional fetch/refetch.
  useEffect(() => {
    let cancelled = false
    fetchActivities(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [])

  // Real bug found in manual browser verification (2026-10-29): this effect originally only set
  // isMountedRef.current = false in its cleanup, never resetting it to true in its setup. React's
  // <StrictMode> (main.tsx wraps the whole app in it) deliberately double-invokes every effect on
  // initial mount in development -- mount, run effects, simulate unmount (run cleanups), simulate
  // remount (run effect setups again) -- on the SAME component instance. That cleanup-then-resetup
  // dance ran this effect's cleanup once immediately after mount, leaving isMountedRef.current
  // permanently false for the rest of the instance's real lifetime, since nothing ever set it back
  // to true. That silently disabled commitDelete's own state updates (both the success path that
  // removes a row and the failure path that restores one) for every deletion, in every real
  // browser dev session -- the DELETE call itself still fired correctly, but the UI never reflected
  // it completing (the undo notice stayed stuck forever). Production builds don't double-invoke
  // effects, so this never manifested there, and React Testing Library's render() doesn't wrap in
  // StrictMode by default, so the entire automated suite was blind to it -- only real-browser
  // verification caught it. Fix: set isMountedRef.current = true in the setup too, not just rely on
  // useRef(true)'s one-time initial value.
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      // Deliberately NOT clearing pendingDeleteTimersRef's timers here (FRONTEND-049-AC-05) --
      // a confirmed deletion must still commit after unmount, not be silently cancelled.
    }
  }, [])

  const handleRetryLoad = () => {
    setLoadError(null)
    fetchActivities()
  }

  // FRONTEND-058-AC-02/AC-03: direct, unconfirmed archive -- mirrors handleUnarchive's own
  // no-confirm shape. On success the activity now has archived: true, so it renders in the
  // archived section (via archivedActivities below) instead of "My Activities".
  const handleArchive = async (id: string) => {
    setArchiveError(null)
    setArchivingId(id)
    try {
      const updated = await activityApi.archive(id)
      setActivities((previous) =>
        previous?.map((existing) => (existing.id === id ? updated : existing)) ?? previous,
      )
    } catch (error) {
      setArchiveError(getErrorMessage(error))
    } finally {
      setArchivingId(null)
    }
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

  // FRONTEND-049-AC-03: the deferred commit itself -- fires when the undo window expires. Not
  // guarded by isMountedRef for the API call (it must still happen after unmount), only for the
  // setState calls that follow it.
  const commitDelete = async (id: string) => {
    delete pendingDeleteTimersRef.current[id]
    try {
      await activityApi.remove(id)
      if (isMountedRef.current) {
        setActivities((previous) => previous?.filter((activity) => activity.id !== id) ?? previous)
        setPendingDeleteIds((previous) => {
          const next = new Set(previous)
          next.delete(id)
          return next
        })
      }
    } catch (error) {
      if (isMountedRef.current) {
        setDeleteError(getErrorMessage(error))
        setPendingDeleteIds((previous) => {
          const next = new Set(previous)
          next.delete(id)
          return next
        })
      }
    }
  }

  // FRONTEND-049-AC-01: confirming delete hides the row and starts the undo window immediately --
  // activityApi.remove is not called here, only after the window expires (see commitDelete).
  const handleConfirmDelete = (id: string) => {
    setDeleteError(null)
    setConfirmingDeleteId(null)
    setPendingDeleteIds((previous) => {
      const next = new Set(previous)
      next.add(id)
      return next
    })
    pendingDeleteTimersRef.current[id] = setTimeout(() => {
      commitDelete(id)
    }, UNDO_DELETE_WINDOW_MS)
  }

  // FRONTEND-049-AC-02: Undo cancels the pending timer and restores the row -- the delete API is
  // never called for this id.
  //
  // Real bug found in manual browser verification (2026-10-29): commitDelete deletes this id's
  // pendingDeleteTimersRef entry SYNCHRONOUSLY the instant the timer fires, before its `await
  // activityApi.remove(id)` call even starts -- so there's a real window, roughly the length of
  // that network round-trip, where the timer has already fired (the delete is irreversibly in
  // motion) but the Undo button is still rendered and clickable (pendingDeleteIds hasn't been
  // updated yet -- that only happens once the await resolves). Clicking Undo in that window must
  // be a no-op, not an optimistic "restored" update: if it unconditionally cleared
  // pendingDeleteIds, the row would briefly render as a normal, safe row again, then silently
  // vanish a second time (or show an error) once commitDelete's real result arrives -- a false
  // "it's safe" signal to the user while the row is still actually being deleted. Only clear
  // pendingDeleteIds when a live timer was actually found and cancelled; otherwise, let
  // commitDelete's own success/failure branch be the sole source of truth for this id's state.
  const handleUndoDelete = (id: string) => {
    const timer = pendingDeleteTimersRef.current[id]
    if (!timer) {
      return
    }
    clearTimeout(timer)
    delete pendingDeleteTimersRef.current[id]
    setPendingDeleteIds((previous) => {
      const next = new Set(previous)
      next.delete(id)
      return next
    })
  }

  // FRONTEND-058-AC-09/AC-10/AC-11/AC-13: replaces the direct setConfirmingDeleteId(null) +
  // handleConfirmDelete(id) call Confirm-delete used to make on an active row -- now checks the
  // activity's deletion impact first. handleConfirmDelete itself (the actual deferred-delete/
  // undo-window starter) is unchanged from frontend_spec_049.
  const handleDeleteConfirmed = async (id: string) => {
    setImpactError(null)
    setImpactCheckingId(id)
    try {
      const impact = await activityApi.deletionImpact(id)
      setImpactCheckingId(null)
      if (impact.plannedOccurrenceCount === 0 && impact.completionCount === 0) {
        handleConfirmDelete(id)
      } else {
        setImpactWarning({ id, ...impact })
      }
    } catch (error) {
      setImpactCheckingId(null)
      setImpactError({ id, message: getErrorMessage(error) })
    }
  }

  // FRONTEND-058-AC-12: "Delete anyway" enters the same undo-window flow as the zero-impact case.
  const handleDeleteAnyway = (id: string) => {
    setImpactWarning(null)
    handleConfirmDelete(id)
  }

  // FRONTEND-058-AC-14: Cancel at any stage (first confirm, impact-warning, impact-error) returns
  // to idle with no API call for that attempt.
  const handleCancelArchivedDelete = (id: string) => {
    setConfirmingDeleteId(null)
    if (impactWarning?.id === id) {
      setImpactWarning(null)
    }
    if (impactError?.id === id) {
      setImpactError(null)
    }
  }

  const renderRowActions = (activity: Activity) => {
    const toggleSubTasks = () =>
      setExpandedActivityId((current) => (current === activity.id ? null : activity.id))
    const subTasksLabel = getSubTasksLabel(activity, expandedActivityId === activity.id)

    if (activity.archived) {
      if (impactWarning?.id === activity.id) {
        return (
          <>
            <p>
              This activity has {impactWarning.plannedOccurrenceCount} planned occurrence(s),{' '}
              {impactWarning.completionCount} of them completed. Deleting it will remove those
              too.
            </p>
            <button
              type="button"
              className={buttonStyles.destructive}
              onClick={() => handleDeleteAnyway(activity.id)}
            >
              Delete anyway
            </button>
            <button type="button" onClick={() => handleCancelArchivedDelete(activity.id)}>
              Cancel
            </button>
          </>
        )
      }

      if (impactError?.id === activity.id) {
        return (
          <>
            <p role="alert">
              {impactError.message}{' '}
              <button type="button" onClick={() => handleDeleteConfirmed(activity.id)}>
                Retry
              </button>
            </p>
            <button type="button" onClick={() => handleCancelArchivedDelete(activity.id)}>
              Cancel
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
              onClick={() => handleDeleteConfirmed(activity.id)}
              disabled={impactCheckingId === activity.id}
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => handleCancelArchivedDelete(activity.id)}
              disabled={impactCheckingId === activity.id}
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
          <button
            type="button"
            onClick={() => handleUnarchive(activity.id)}
            disabled={unarchivingId === activity.id}
          >
            Unarchive
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

    // FRONTEND-058-AC-01: an active row's only exit is Archive -- Delete/Confirm delete/Cancel are
    // never reachable from here.
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
          onClick={() => handleArchive(activity.id)}
          disabled={archivingId === activity.id}
        >
          Archive
        </button>
      </>
    )
  }

  const visibleActivities = (activities ?? []).filter(
    (activity) =>
      !activity.archived &&
      !pendingDeleteIds.has(activity.id) &&
      (categoryFilter === 'ALL' || activity.category === categoryFilter) &&
      (!favouriteFilter || activity.favourite),
  )

  // FRONTEND-058-AC-04/AC-07: archived activities render only in their own section, never
  // interleaved into "My Activities" -- the favourite filter deliberately does not apply here (it
  // stays scoped to pinning/filtering the active list), but the category filter does (it's a
  // page-level toolbar control shared by both sections).
  const archivedActivities = (activities ?? []).filter(
    (activity) =>
      activity.archived &&
      !pendingDeleteIds.has(activity.id) &&
      (categoryFilter === 'ALL' || activity.category === categoryFilter),
  )

  // FRONTEND-044-AC-03/AC-04: fixed category order, respecting the existing category filter --
  // partitioned via .filter() (never re-sorted) so within-group order stays exactly what the
  // backend already provides.
  const visibleCategories =
    categoryFilter === 'ALL' ? CATEGORY_ORDER : CATEGORY_ORDER.filter((c) => c === categoryFilter)

  const renderActivityRow = (activity: Activity) => (
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

      <h3 className={styles.sectionHeading}>My Activities</h3>

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
      {archiveError && <p role="alert">{archiveError}</p>}

      {/* FRONTEND-049-AC-01: a transient, non-persistent status notice per pending deletion --
          role="status" (not "alert") since this isn't an error; dismissed by Undo or by the
          window expiring, never by the user. */}
      {(activities ?? [])
        .filter((activity) => pendingDeleteIds.has(activity.id))
        .map((activity) => (
          <p role="status" key={activity.id}>
            {activity.name} deleted.{' '}
            <button type="button" onClick={() => handleUndoDelete(activity.id)}>
              Undo
            </button>
          </p>
        ))}

      {activities === null && !loadError && <output>Loading activities…</output>}

      {activities !== null && activities.length === 0 && (
        <p>No activities yet. Add one below to get started.</p>
      )}

      {activities !== null && activities.length > 0 && visibleActivities.length === 0 && (
        <p>No activities in this category.</p>
      )}

      {visibleActivities.length > 0 &&
        visibleCategories.map((category) => {
          const activitiesInCategory = visibleActivities.filter((a) => a.category === category)
          if (activitiesInCategory.length === 0) {
            return null
          }
          return (
            <div key={category}>
              <CategoryGroupHeading category={category} />
              <ul // NOSONAR(typescript:S6819): deliberate -- the heading above already labels
                // this group, so this <ul>'s own list semantics would be redundant noise for
                // screen reader users (matching SuggestedActivities.tsx's own category-group
                // <ul> for the same reason).
                className={styles.list}
                role="presentation"
              >
                {activitiesInCategory.map((activity) => renderActivityRow(activity))}
              </ul>
            </div>
          )
        })}

      {/* FRONTEND-058-AC-04/AC-05/AC-06: archived activities live in their own, closed-by-default
          section -- structurally the same <details>/<summary> + category-grouping idiom as
          SuggestedActivities.tsx, reused a third time in this codebase. Always closed by default,
          regardless of content (unlike SuggestedActivities' empty-bank auto-open). */}
      <details className={styles.archivedDetails}>
        <summary className={styles.sectionHeading}>
          Archived activities ({archivedActivities.length})
          <ChevronIcon />
        </summary>

        {archivedActivities.length === 0 && <p>No archived activities.</p>}

        {archivedActivities.length > 0 &&
          visibleCategories.map((category) => {
            const activitiesInCategory = archivedActivities.filter((a) => a.category === category)
            if (activitiesInCategory.length === 0) {
              return null
            }
            return (
              <div key={category}>
                <CategoryGroupHeading category={category} />
                <ul // NOSONAR(typescript:S6819): deliberate -- same reasoning as the "My
                  // Activities" group above.
                  className={styles.list}
                  role="presentation"
                >
                  {activitiesInCategory.map((activity) => renderActivityRow(activity))}
                </ul>
              </div>
            )
          })}
      </details>

      <SuggestedActivities
        activities={activities ?? []}
        onAdded={handleSuggestionAdded}
        defaultOpen={activities !== null && activities.length === 0}
        categoryFilter={categoryFilter}
      />

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
