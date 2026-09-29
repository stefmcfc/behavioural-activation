import { useState } from 'react'
import type { ActivityCategory } from '../../types/activity'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { ALL_DAYS, ALL_SLOTS, DAY_LABELS, SLOT_LABELS } from './planLabels'

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  ROUTINE: 'Routine',
  NECESSARY: 'Necessary',
  PLEASURABLE: 'Pleasurable',
}

interface OccurrenceItemProps {
  readonly occurrence: PlannedOccurrence
  readonly isBucketItem: boolean
  readonly busyId: string | null
  readonly confirmingRemoveId: string | null
  readonly movingId: string | null
  readonly onStartRemove: (id: string) => void
  readonly onConfirmRemove: (id: string) => void
  readonly onCancelRemove: () => void
  readonly onStartMove: (id: string) => void
  readonly onCancelMove: () => void
  readonly onConfirmMove: (id: string, dayOfWeek: PlanDayOfWeek, slot: PlanSlot) => void
  readonly onMoveToBucket: (id: string) => void
  readonly onComplete: (id: string) => void
  readonly onUndo: (id: string) => void
  readonly onCarryForward: (id: string) => void
}

export function OccurrenceItem({
  occurrence,
  isBucketItem,
  busyId,
  confirmingRemoveId,
  movingId,
  onStartRemove,
  onConfirmRemove,
  onCancelRemove,
  onStartMove,
  onCancelMove,
  onConfirmMove,
  onMoveToBucket,
  onComplete,
  onUndo,
  onCarryForward,
}: OccurrenceItemProps) {
  const [moveDay, setMoveDay] = useState<PlanDayOfWeek>(occurrence.dayOfWeek ?? 'MONDAY')
  const [moveSlot, setMoveSlot] = useState<PlanSlot>(occurrence.slot ?? 'MORNING')
  const isBusy = busyId === occurrence.id
  const moveDaySelectId = `move-day-${occurrence.id}`
  const moveSlotSelectId = `move-slot-${occurrence.id}`

  return (
    <li>
      <span>{occurrence.name}</span> — <span>{CATEGORY_LABELS[occurrence.category]}</span>
      {occurrence.completed && <span> — Completed</span>}

      {confirmingRemoveId === occurrence.id && (
        <>
          <button
            type="button"
            onClick={() => onConfirmRemove(occurrence.id)}
            disabled={isBusy}
          >
            Confirm remove
          </button>
          <button type="button" onClick={onCancelRemove} disabled={isBusy}>
            Cancel
          </button>
        </>
      )}

      {movingId === occurrence.id && (
        <>
          <label htmlFor={moveDaySelectId}>New day</label>
          <select
            id={moveDaySelectId}
            value={moveDay}
            onChange={(event) => setMoveDay(event.target.value as PlanDayOfWeek)}
          >
            {ALL_DAYS.map((day) => (
              <option key={day} value={day}>
                {DAY_LABELS[day]}
              </option>
            ))}
          </select>

          <label htmlFor={moveSlotSelectId}>New slot</label>
          <select
            id={moveSlotSelectId}
            value={moveSlot}
            onChange={(event) => setMoveSlot(event.target.value as PlanSlot)}
          >
            {ALL_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {SLOT_LABELS[slot]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onConfirmMove(occurrence.id, moveDay, moveSlot)}
            disabled={isBusy}
          >
            Confirm move
          </button>
          <button type="button" onClick={onCancelMove} disabled={isBusy}>
            Cancel
          </button>
        </>
      )}

      {confirmingRemoveId !== occurrence.id && movingId !== occurrence.id && (
        <>
          <button type="button" onClick={() => onStartMove(occurrence.id)} disabled={isBusy}>
            Move
          </button>
          {!isBucketItem && (
            <button
              type="button"
              onClick={() => onMoveToBucket(occurrence.id)}
              disabled={isBusy}
            >
              Move to bucket
            </button>
          )}
          <button type="button" onClick={() => onStartRemove(occurrence.id)} disabled={isBusy}>
            Remove
          </button>
          {occurrence.completed ? (
            <button type="button" onClick={() => onUndo(occurrence.id)} disabled={isBusy}>
              Undo
            </button>
          ) : (
            <button type="button" onClick={() => onComplete(occurrence.id)} disabled={isBusy}>
              Complete
            </button>
          )}
          {isBucketItem && (
            <button
              type="button"
              onClick={() => onCarryForward(occurrence.id)}
              disabled={isBusy}
            >
              Carry forward
            </button>
          )}
        </>
      )}
    </li>
  )
}
