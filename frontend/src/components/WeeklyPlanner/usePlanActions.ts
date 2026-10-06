import { useEffect, useState } from 'react'
import { planApi } from '../../services/planApi'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import type { AssignTarget } from './AssignActivityPicker'
import type { DragPayload } from './dragPayload'
import { getErrorMessage } from '../../utils/getErrorMessage'

// FRONTEND-016: extracted from WeeklyPlanner.tsx's pre-existing body (occurrence fetch plus every
// assign/move/complete/undo/remove/carry-forward/reorder/drag handler) so WeeklyPlanner and the new
// TodayView can share one implementation instead of drifting apart as two copies. Each caller
// supplies its own `weekStart` -- WeeklyPlanner keeps its own navigable week; TodayView always
// passes the real current week's Monday (see each component). Week-navigation state, the Weekday/
// Weekend grid-tab concept, and each component's own `todayColumn` computation are view-specific and
// stay local to each component, not here.
export function usePlanActions(weekStart: string) {
  const [occurrences, setOccurrences] = useState<PlannedOccurrence[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [detailOpenId, setDetailOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bucketReorderInFlight, setBucketReorderInFlight] = useState(false)
  // FRONTEND-026-AC-01 / FRONTEND-028: a single shared drag state, so a drag starting in
  // PlannerGrid, BucketList, or (FRONTEND-016's) ActivityDrawer is visible to every drop handler.
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
  const handleUpdateNotes = async (id: string, notes: string | null) => {
    setActionError(null)
    setBusyId(id)
    try {
      const updated = await planApi.updateNotes(id, notes)
      setOccurrences(
        (previous) => previous?.map((occurrence) => (occurrence.id === id ? updated : occurrence)) ?? previous,
      )
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  // FRONTEND-016-AC-14: a drawer-origin drag has no existing occurrence id yet to key busyId by,
  // so it gets its own in-flight guard, mirroring frontend_spec_028's now-removed WeeklyPlanner
  // implementation.
  const [isAssigningFromDrawer, setIsAssigningFromDrawer] = useState(false)

  const handleDragEnd = () => setDragPayload(null)

  // Exposed so a caller that's about to change `weekStart` (WeeklyPlanner's Previous/Next week)
  // can clear stale data first, same as frontend_spec_004's original design -- called from the
  // event handler that changes weekStart, not from inside the effect below (setState synchronously
  // inside an effect body trips oxlint's react(set-state-in-effect) cascading-render warning).
  const resetForRefetch = () => {
    setOccurrences(null)
    setLoadError(null)
  }

  useEffect(() => {
    let cancelled = false

    planApi
      .getWeek(weekStart)
      .then((data) => {
        if (!cancelled) {
          setOccurrences(data)
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
  }, [weekStart, retryCount])

  const handleRetry = () => {
    resetForRefetch()
    setRetryCount((count) => count + 1)
  }

  const handleAssignSuccess = (occurrence: PlannedOccurrence) => {
    setOccurrences((previous) => (previous ? [...previous, occurrence] : [occurrence]))
    setAssignTarget(null)
  }

  const handleCloseAssign = () => setAssignTarget(null)

  const handleMove = async (
    id: string,
    input: { dayOfWeek: PlanDayOfWeek | null; slot: PlanSlot | null },
  ) => {
    setActionError(null)
    setBusyId(id)
    try {
      const updated = await planApi.move(id, input)
      setOccurrences(
        (previous) => previous?.map((occurrence) => (occurrence.id === id ? updated : occurrence)) ?? previous,
      )
      setMovingId(null)
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const handleConfirmRemove = async (id: string) => {
    setActionError(null)
    setBusyId(id)
    try {
      await planApi.remove(id)
      setOccurrences(
        (previous) => previous?.filter((occurrence) => occurrence.id !== id) ?? previous,
      )
      setConfirmingRemoveId(null)
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const handleComplete = async (id: string) => {
    setActionError(null)
    setBusyId(id)
    try {
      const updated = await planApi.complete(id)
      setOccurrences(
        (previous) => previous?.map((occurrence) => (occurrence.id === id ? updated : occurrence)) ?? previous,
      )
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const handleUndo = async (id: string) => {
    setActionError(null)
    setBusyId(id)
    try {
      await planApi.undoCompletion(id)
      setOccurrences(
        (previous) =>
          previous?.map((occurrence) =>
            occurrence.id === id ? { ...occurrence, completed: false, completedAt: null } : occurrence,
          ) ?? previous,
      )
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const handleOpenDetail = (id: string) => {
    if (confirmingRemoveId && confirmingRemoveId !== id) {
      setConfirmingRemoveId(null)
    }
    if (movingId && movingId !== id) {
      setMovingId(null)
    }
    setDetailOpenId(id)
  }

  const handleCloseDetail = () => {
    setDetailOpenId(null)
    setConfirmingRemoveId(null)
    setMovingId(null)
  }

  const handleReorderBucket = async (occurrenceIds: string[]) => {
    setActionError(null)
    setBucketReorderInFlight(true)
    try {
      const updated = await planApi.reorderBucket(weekStart, occurrenceIds)
      setOccurrences((previous) => {
        if (!previous) return previous
        const updatedById = new Map(updated.map((occurrence) => [occurrence.id, occurrence]))
        return previous.map((occurrence) => updatedById.get(occurrence.id) ?? occurrence)
      })
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setBucketReorderInFlight(false)
    }
  }

  const handleCarryForward = async (id: string) => {
    setActionError(null)
    setBusyId(id)
    try {
      await planApi.carryForward(id)
      setOccurrences(
        (previous) => previous?.filter((occurrence) => occurrence.id !== id) ?? previous,
      )
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  // FRONTEND-016-AC-14: a drawer-origin drag has no existing occurrence -- it needs a brand-new
  // one created via the same endpoint AssignActivityPicker's "Assign" already uses, mirroring
  // handleAssignSuccess's append-to-local-state, gated by isAssigningFromDrawer rather than the
  // occurrence-keyed busyId (there's no occurrence id yet to key by).
  const handleAssignFromDrawer = async (
    payload: DragPayload,
    dayOfWeek: PlanDayOfWeek | null,
    slot: PlanSlot | null,
  ) => {
    if (isAssigningFromDrawer || payload.kind === 'occurrence') return
    setActionError(null)
    setIsAssigningFromDrawer(true)
    try {
      const created = await planApi.create({
        activityId: payload.kind === 'activity' ? payload.activityId : null,
        subTaskId: payload.kind === 'subtask' ? payload.subTaskId : null,
        weekStart,
        dayOfWeek,
        slot,
      })
      setOccurrences((previous) => (previous ? [...previous, created] : [created]))
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setIsAssigningFromDrawer(false)
    }
  }

  return {
    occurrences,
    loadError,
    actionError,
    assignTarget,
    confirmingRemoveId,
    movingId,
    detailOpenId,
    busyId,
    bucketReorderInFlight,
    dragPayload,
    isAssigningFromDrawer,
    handleRetry,
    resetForRefetch,
    handleAssignSuccess,
    handleCloseAssign,
    handleMove,
    handleConfirmRemove,
    handleComplete,
    handleUndo,
    handleOpenDetail,
    handleCloseDetail,
    handleReorderBucket,
    handleCarryForward,
    handleUpdateNotes,
    handleDragEnd,
    handleAssignFromDrawer,
    setAssignTarget,
    setConfirmingRemoveId,
    setMovingId,
    setDragPayload,
  }
}
