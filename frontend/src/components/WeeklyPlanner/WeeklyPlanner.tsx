import { useEffect, useState } from 'react'
import { planApi } from '../../services/planApi'
import { ApiError } from '../../types/api'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { AssignActivityPicker, type AssignTarget } from './AssignActivityPicker'
import { BucketList } from './BucketList'
import { PlannerGrid } from './PlannerGrid'

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

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMondayOfCurrentWeek(): string {
  const now = new Date()
  const weekday = now.getDay()
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  return formatDate(monday)
}

function shiftWeek(weekStart: string, days: number): string {
  const [year, month, day] = weekStart.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

export function WeeklyPlanner() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfCurrentWeek())
  const [occurrences, setOccurrences] = useState<PlannedOccurrence[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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
    setOccurrences(null)
    setLoadError(null)
    setRetryCount((count) => count + 1)
  }

  const handlePreviousWeek = () => {
    setOccurrences(null)
    setLoadError(null)
    setWeekStart((current) => shiftWeek(current, -7))
  }

  const handleNextWeek = () => {
    setOccurrences(null)
    setLoadError(null)
    setWeekStart((current) => shiftWeek(current, 7))
  }

  const handleAssignSuccess = (occurrence: PlannedOccurrence) => {
    setOccurrences((previous) => (previous ? [...previous, occurrence] : [occurrence]))
    setAssignTarget(null)
  }

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

  return (
    <section>
      <h2>Weekly planner</h2>

      <div>
        <button type="button" onClick={handlePreviousWeek}>
          Previous week
        </button>
        <span>Week of {weekStart}</span>
        <button type="button" onClick={handleNextWeek}>
          Next week
        </button>
      </div>

      {loadError && (
        <p role="alert">
          {loadError}{' '}
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </p>
      )}
      {actionError && <p role="alert">{actionError}</p>}

      {occurrences === null && !loadError && <output>Loading plan…</output>}

      {occurrences !== null && (
        <>
          <PlannerGrid
            occurrences={occurrences}
            busyId={busyId}
            confirmingRemoveId={confirmingRemoveId}
            movingId={movingId}
            onAdd={(dayOfWeek, slot) => setAssignTarget({ dayOfWeek, slot })}
            onStartRemove={setConfirmingRemoveId}
            onConfirmRemove={handleConfirmRemove}
            onCancelRemove={() => setConfirmingRemoveId(null)}
            onStartMove={setMovingId}
            onCancelMove={() => setMovingId(null)}
            onConfirmMove={(id, dayOfWeek, slot) => handleMove(id, { dayOfWeek, slot })}
            onMoveToBucket={(id) => handleMove(id, { dayOfWeek: null, slot: null })}
            onComplete={handleComplete}
            onUndo={handleUndo}
          />

          <BucketList
            occurrences={occurrences}
            busyId={busyId}
            confirmingRemoveId={confirmingRemoveId}
            movingId={movingId}
            onAdd={() => setAssignTarget({ dayOfWeek: null, slot: null })}
            onStartRemove={setConfirmingRemoveId}
            onConfirmRemove={handleConfirmRemove}
            onCancelRemove={() => setConfirmingRemoveId(null)}
            onStartMove={setMovingId}
            onCancelMove={() => setMovingId(null)}
            onConfirmMove={(id, dayOfWeek, slot) => handleMove(id, { dayOfWeek, slot })}
            onComplete={handleComplete}
            onUndo={handleUndo}
            onCarryForward={handleCarryForward}
          />
        </>
      )}

      {assignTarget && (
        <AssignActivityPicker
          weekStart={weekStart}
          target={assignTarget}
          onSuccess={handleAssignSuccess}
          onCancel={() => setAssignTarget(null)}
        />
      )}
    </section>
  )
}
