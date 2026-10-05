import { useState } from 'react'
import type { DragEvent } from 'react'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { ALL_DAYS, ALL_SLOTS, DAY_LABELS, SLOT_LABELS } from './planLabels'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { CompletionIcon } from '../icons/CompletionIcon'
import { Modal } from '../Modal/Modal'
import { RepeatableIcon } from '../RepeatableIcon/RepeatableIcon'
import styles from './OccurrenceItem.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'

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
  readonly onUpdateNotes: (id: string, notes: string | null) => void
  readonly dimmed?: boolean
  readonly isFirst?: boolean
  readonly isLast?: boolean
  readonly reorderDisabled?: boolean
  readonly onMoveUp?: (id: string) => void
  readonly onMoveDown?: (id: string) => void
  readonly onDragStart?: (id: string) => void
  readonly onDragEnd?: () => void
  readonly onDragOverItem?: (event: DragEvent) => void
  readonly onDropOnItem?: (id: string) => void
}

function GripIcon() {
  return (
    <svg className={styles.gripIcon} viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
      <circle cx="3" cy="2" r="1.3" fill="currentColor" />
      <circle cx="7" cy="2" r="1.3" fill="currentColor" />
      <circle cx="3" cy="8" r="1.3" fill="currentColor" />
      <circle cx="7" cy="8" r="1.3" fill="currentColor" />
      <circle cx="3" cy="14" r="1.3" fill="currentColor" />
      <circle cx="7" cy="14" r="1.3" fill="currentColor" />
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
  onUpdateNotes,
  dimmed,
  isFirst,
  isLast,
  reorderDisabled,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onDropOnItem,
}: OccurrenceItemProps) {
  const [moveDay, setMoveDay] = useState<PlanDayOfWeek>(occurrence.dayOfWeek ?? 'MONDAY')
  const [moveSlot, setMoveSlot] = useState<PlanSlot>(occurrence.slot ?? 'MORNING')
  // FRONTEND-043-AC-01/AC-05: seeded from the occurrence's own notes, reset whenever a different
  // occurrence's card opens (by id) or an externally-updated occurrence (e.g. this autosave's own
  // response replacing it in usePlanActions state) comes back in -- otherwise the local draft would
  // fight the just-saved value or leak into the next occurrence rendered in this same list slot.
  // Adjusted during render (React's documented "adjusting state when a prop changes" pattern)
  // rather than in a useEffect, to avoid oxlint's react(set-state-in-effect) cascading-render
  // warning -- usePlanActions.resetForRefetch's own comment documents this same codebase
  // convention elsewhere.
  const [notesDraft, setNotesDraft] = useState(occurrence.notes ?? '')
  const [seenNotes, setSeenNotes] = useState({ id: occurrence.id, notes: occurrence.notes })
  if (occurrence.id !== seenNotes.id || occurrence.notes !== seenNotes.notes) {
    setSeenNotes({ id: occurrence.id, notes: occurrence.notes })
    setNotesDraft(occurrence.notes ?? '')
  }
  const isBusy = busyId === occurrence.id
  const isDetailOpen = detailOpenId === occurrence.id
  const moveDaySelectId = `move-day-${occurrence.id}`
  const moveSlotSelectId = `move-slot-${occurrence.id}`
  const notesTextareaId = `notes-${occurrence.id}`

  const rowClassName = [
    styles.row,
    !isBucketItem && styles.gridDraggable,
    dimmed && styles.dimmed,
  ]
    .filter(Boolean)
    .join(' ')

  const handleNameClick = () => {
    if (isDetailOpen) {
      onCloseDetail()
    } else {
      onOpenDetail(occurrence.id)
    }
  }

  return (
    <li
      className={rowClassName}
      draggable={!isBucketItem}
      onDragStart={!isBucketItem ? () => onDragStart?.(occurrence.id) : undefined}
      onDragEnd={!isBucketItem ? onDragEnd : undefined}
      onDragOver={isBucketItem ? onDragOverItem : undefined}
      onDrop={
        isBucketItem
          ? (event) => {
              // FRONTEND-026: stop this from also bubbling to BucketList's new panel-level
              // drop target, which would otherwise double-handle the same drop.
              event.stopPropagation()
              onDropOnItem?.(occurrence.id)
            }
          : undefined
      }
    >
      {isBucketItem && (
        <span className={styles.reorderControls}>
          <span
            className={styles.dragHandle}
            draggable
            onDragStart={() => onDragStart?.(occurrence.id)}
            onDragEnd={onDragEnd}
            aria-hidden="true"
          >
            <GripIcon />
          </span>
          <button
            type="button"
            className={styles.moveButton}
            onClick={() => onMoveUp?.(occurrence.id)}
            disabled={isFirst || reorderDisabled}
            aria-label={`Move ${occurrence.name} up`}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.moveButton}
            onClick={() => onMoveDown?.(occurrence.id)}
            disabled={isLast || reorderDisabled}
            aria-label={`Move ${occurrence.name} down`}
          >
            ↓
          </button>
        </span>
      )}
      {occurrence.subTaskId !== null && occurrence.parentActivityName !== null && (
        <span className={styles.parentActivityName}>{occurrence.parentActivityName}</span>
      )}
      <button type="button" className={styles.nameButton} onClick={handleNameClick}>
        {occurrence.name}
      </button>
      <CategoryChip category={occurrence.category} />
      {isBucketItem && occurrence.subTaskId === null && occurrence.repeatable && <RepeatableIcon />}
      {occurrence.notes && (
        <span className={styles.notesIndicator} title="Has a note" aria-hidden="true">
          📝
        </span>
      )}
      {occurrence.recentlyCarriedForward && (
        <span className={styles.carriedForwardLabel}>Moved from last week</span>
      )}
      {occurrence.completed && <CompletionIcon />}
      {occurrence.completed ? (
        <button
          type="button"
          className={`${styles.completeButton} ${buttonStyles.primary}`}
          onClick={() => onUndo(occurrence.id)}
          disabled={isBusy}
        >
          Undo
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.completeButton} ${buttonStyles.primary}`}
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

              <label htmlFor={notesTextareaId}>Notes</label>
              <textarea
                id={notesTextareaId}
                className={styles.notesTextarea}
                maxLength={200}
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                onBlur={() => {
                  const trimmed = notesDraft.trim()
                  if (trimmed !== (occurrence.notes ?? '')) {
                    onUpdateNotes(occurrence.id, trimmed || null)
                  }
                }}
              />
              <span className={styles.notesCounter}>{notesDraft.length}/200</span>

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
                    {!isBucketItem && !occurrence.completed && (
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
