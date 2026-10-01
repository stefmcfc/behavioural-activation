import { useState } from 'react'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { ALL_DAYS, ALL_SLOTS, DAY_LABELS, SLOT_LABELS } from './planLabels'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { Modal } from '../Modal/Modal'
import { RepeatableIcon } from '../RepeatableIcon/RepeatableIcon'
import styles from './OccurrenceItem.module.css'

interface OccurrenceItemProps {
  readonly occurrence: PlannedOccurrence
  readonly isBucketItem: boolean
  readonly busyId: string | null
  readonly detailOpenId: string | null
  readonly confirmingRemoveId: string | null
  readonly movingId: string | null
  readonly onOpenDetail: (id: string) => void
  readonly onCloseDetail: () => void
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

function CompletionIcon() {
  return (
    <svg
      className={styles.completionIcon}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label="Completed"
    >
      <path
        d="M3 8.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function OccurrenceItem({
  occurrence,
  isBucketItem,
  busyId,
  detailOpenId,
  confirmingRemoveId,
  movingId,
  onOpenDetail,
  onCloseDetail,
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
  const isDetailOpen = detailOpenId === occurrence.id
  const moveDaySelectId = `move-day-${occurrence.id}`
  const moveSlotSelectId = `move-slot-${occurrence.id}`

  const handleNameClick = () => {
    if (isDetailOpen) {
      onCloseDetail()
    } else {
      onOpenDetail(occurrence.id)
    }
  }

  return (
    <li className={styles.row}>
      {occurrence.subTaskId !== null && occurrence.parentActivityName !== null && (
        <span className={styles.parentActivityName}>{occurrence.parentActivityName}</span>
      )}
      <button type="button" className={styles.nameButton} onClick={handleNameClick}>
        {occurrence.name}
      </button>
      <CategoryChip category={occurrence.category} />
      {isBucketItem && occurrence.repeatable && <RepeatableIcon />}
      {occurrence.completed && <CompletionIcon />}
      {occurrence.completed ? (
        <button
          type="button"
          className={styles.completeButton}
          onClick={() => onUndo(occurrence.id)}
          disabled={isBusy}
        >
          Undo
        </button>
      ) : (
        <button
          type="button"
          className={styles.completeButton}
          onClick={() => onComplete(occurrence.id)}
          disabled={isBusy}
        >
          Complete
        </button>
      )}

      <Modal
        isOpen={isDetailOpen}
        ariaLabel={`${occurrence.name} actions`}
        onClose={onCloseDetail}
        className={styles.detailDialog}
      >
        {isDetailOpen && (
          <>
            <div className={styles.detailScrollBody}>
              <div className={styles.detailHeader}>
                <span className={styles.detailName}>{occurrence.name}</span>
                <CategoryChip category={occurrence.category} />
              </div>
              <p className={styles.detailLocation}>
                {occurrence.dayOfWeek !== null && occurrence.slot !== null
                  ? `${DAY_LABELS[occurrence.dayOfWeek]} · ${SLOT_LABELS[occurrence.slot]}`
                  : 'Weekend bucket list'}
              </p>

              {confirmingRemoveId === occurrence.id && (
                <span className={styles.actions}>
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
                </span>
              )}

              {movingId === occurrence.id && (
                <span className={styles.moveControls}>
                  <span className={styles.moveField}>
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
                  </span>

                  <span className={styles.moveField}>
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
                  </span>

                  <span className={styles.moveActions}>
                    {!isBucketItem && (
                      <button
                        type="button"
                        className={styles.sendToBucketButton}
                        onClick={() => onMoveToBucket(occurrence.id)}
                        disabled={isBusy}
                      >
                        Send to bucket
                      </button>
                    )}
                    <span className={styles.moveConfirmActions}>
                      <button
                        type="button"
                        onClick={() => onConfirmMove(occurrence.id, moveDay, moveSlot)}
                        disabled={isBusy}
                      >
                        Confirm rearrange
                      </button>
                      <button type="button" onClick={onCancelMove} disabled={isBusy}>
                        Cancel
                      </button>
                    </span>
                  </span>
                </span>
              )}

              {confirmingRemoveId !== occurrence.id && movingId !== occurrence.id && (
                <span className={styles.actions}>
                  <button
                    type="button"
                    onClick={() => onStartMove(occurrence.id)}
                    disabled={isBusy}
                  >
                    Rearrange
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartRemove(occurrence.id)}
                    disabled={isBusy}
                  >
                    Remove
                  </button>
                  {isBucketItem && (
                    <button
                      type="button"
                      onClick={() => onCarryForward(occurrence.id)}
                      disabled={isBusy}
                    >
                      Carry forward
                    </button>
                  )}
                </span>
              )}
            </div>

            <div className={styles.footer}>
              <button type="button" onClick={onCloseDetail}>
                Close
              </button>
            </div>
          </>
        )}
      </Modal>
    </li>
  )
}
