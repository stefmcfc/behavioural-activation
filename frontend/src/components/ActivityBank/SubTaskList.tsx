import { useEffect, useRef, useState } from 'react'
import { subTaskApi } from '../../services/subTaskApi'
import type { SubTask } from '../../types/subTask'
import { SubTaskForm } from './SubTaskForm'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { ChevronIcon } from '../icons/ChevronIcon'
import { Modal } from '../Modal/Modal'
import { getErrorMessage } from '../../utils/getErrorMessage'
import styles from './SubTaskList.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'

type FormTarget = 'create' | SubTask | null

// FRONTEND-049: fixed undo window for a deferred delete -- not configurable, see spec.
const UNDO_DELETE_WINDOW_MS = 6000

function formTargetTitleId(formTarget: FormTarget): string {
  return `sub-task-form-title-${formTarget === 'create' || formTarget === null ? 'create' : 'edit'}`
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
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [reorderInFlight, setReorderInFlight] = useState(false)
  const [reorderError, setReorderError] = useState<string | null>(null)
  // FRONTEND-049: ids currently inside their post-confirm undo window -- the row is hidden but
  // subTaskApi.remove has not been called yet. Keyed by id (not a single scalar) so multiple
  // pending deletions are tracked independently (FRONTEND-049-AC-04).
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())
  // Plain setTimeout handles, not React state -- deliberately NOT cleared on unmount (see
  // FRONTEND-049-AC-05): a confirmed deletion must still commit even if the user navigates away.
  const pendingDeleteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Guards setState calls from a deferred-delete timer that fires after unmount -- mirrors the
  // `cancelled` flag convention used by the fetch effect below, but as a ref since the timer
  // outlives any single effect/render.
  const isMountedRef = useRef(true)

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

  // FRONTEND-049-AC-03: the deferred commit itself -- fires when the undo window expires. Not
  // guarded by isMountedRef for the API call (it must still happen after unmount), only for the
  // setState calls that follow it.
  const commitDelete = async (id: string) => {
    delete pendingDeleteTimersRef.current[id]
    try {
      await subTaskApi.remove(activityId, id)
      if (isMountedRef.current) {
        setSubTasks((previous) => previous?.filter((subTask) => subTask.id !== id) ?? previous)
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
  // subTaskApi.remove is not called here, only after the window expires (see commitDelete).
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
  // subTaskApi.remove(...)` call even starts -- so there's a real window, roughly the length of
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

  // FRONTEND-047: sub-tasks are rendered in their persisted manual order rather than the raw
  // array order local state happens to hold -- defensive, since create/rename/delete mutate
  // state in place rather than refetching (mirrors BucketList.tsx's identical sort).
  const sortedSubTasks = (subTasks ?? []).slice().sort((a, b) => a.position - b.position)
  // FRONTEND-049-AC-01: a confirmed deletion hides the row immediately, before the API call --
  // excluded here so Move up/down boundary indices reflect only what's actually visible.
  const visibleSubTasks = sortedSubTasks.filter((subTask) => !pendingDeleteIds.has(subTask.id))

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
        {subTasks !== null && visibleSubTasks.length === 0 && <p>No sub-tasks yet.</p>}
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

      {/* FRONTEND-049-AC-01: a transient, non-persistent status notice per pending deletion --
          role="status" (not "alert") since this isn't an error; dismissed by Undo or by the
          window expiring, never by the user. */}
      {(subTasks ?? [])
        .filter((subTask) => pendingDeleteIds.has(subTask.id))
        .map((subTask) => (
          <p role="status" key={subTask.id}>
            {subTask.name} deleted.{' '}
            <button type="button" onClick={() => handleUndoDelete(subTask.id)}>
              Undo
            </button>
          </p>
        ))}

      {subTasks === null && !loadError && <output>Loading sub-tasks…</output>}

      {subTasks !== null && visibleSubTasks.length > 0 && (
        <ul className={styles.list}>
          {visibleSubTasks.map((subTask, index) => (
            <li key={subTask.id} className={`${styles.row} ${styles.nested}`}>
              {!readOnly && confirmingDeleteId !== subTask.id && (
                <span className={styles.moveControls}>
                  <button
                    type="button"
                    className={styles.moveButton}
                    onClick={() => handleMoveUp(subTask.id)}
                    disabled={index === 0 || reorderInFlight}
                    aria-label={`Move ${subTask.name} up`}
                  >
                    <ChevronIcon direction="up" />
                  </button>
                  <button
                    type="button"
                    className={styles.moveButton}
                    onClick={() => handleMoveDown(subTask.id)}
                    disabled={index === visibleSubTasks.length - 1 || reorderInFlight}
                    aria-label={`Move ${subTask.name} down`}
                  >
                    <ChevronIcon direction="down" />
                  </button>
                </span>
              )}
              <span>{subTask.name}</span> <CategoryChip category={subTask.category} />

              {!readOnly &&
                (confirmingDeleteId === subTask.id ? (
                  <span className={styles.actions}>
                    <button
                      type="button"
                      className={buttonStyles.destructive}
                      onClick={() => handleConfirmDelete(subTask.id)}
                    >
                      Confirm delete
                    </button>
                    <button type="button" onClick={() => setConfirmingDeleteId(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className={styles.actions}>
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
