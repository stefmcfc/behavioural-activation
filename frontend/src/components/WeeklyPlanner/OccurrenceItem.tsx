import type { DragEvent } from 'react'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { CompletionIcon } from '../icons/CompletionIcon'
import { Modal } from '../Modal/Modal'
import { OccurrenceDetailCard } from './OccurrenceDetailCard'
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

interface ReorderControlsProps {
  readonly occurrenceId: string
  readonly occurrenceName: string
  readonly isFirst?: boolean
  readonly isLast?: boolean
  readonly reorderDisabled?: boolean
  readonly onMoveUp?: (id: string) => void
  readonly onMoveDown?: (id: string) => void
  readonly onDragStart?: (id: string) => void
  readonly onDragEnd?: () => void
}

// Extracted alongside OccurrenceDetailCard (typescript:S3776) -- the bucket drag-handle + Move
// up/down controls, previously inline in OccurrenceItem's own render. Pure extraction, no
// rendered-output change.
function ReorderControls({
  occurrenceId,
  occurrenceName,
  isFirst,
  isLast,
  reorderDisabled,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
}: ReorderControlsProps) {
  return (
    <span className={styles.reorderControls}>
      <span
        className={styles.dragHandle}
        draggable
        onDragStart={() => onDragStart?.(occurrenceId)}
        onDragEnd={onDragEnd}
        aria-hidden="true"
      >
        <GripIcon />
      </span>
      <button
        type="button"
        className={styles.moveButton}
        onClick={() => onMoveUp?.(occurrenceId)}
        disabled={isFirst || reorderDisabled}
        aria-label={`Move ${occurrenceName} up`}
      >
        ↑
      </button>
      <button
        type="button"
        className={styles.moveButton}
        onClick={() => onMoveDown?.(occurrenceId)}
        disabled={isLast || reorderDisabled}
        aria-label={`Move ${occurrenceName} down`}
      >
        ↓
      </button>
    </span>
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
  const isBusy = busyId === occurrence.id
  const isDetailOpen = detailOpenId === occurrence.id

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
        <ReorderControls
          occurrenceId={occurrence.id}
          occurrenceName={occurrence.name}
          isFirst={isFirst}
          isLast={isLast}
          reorderDisabled={reorderDisabled}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
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
          <OccurrenceDetailCard
            occurrence={occurrence}
            isBucketItem={isBucketItem}
            isBusy={isBusy}
            confirmingRemoveId={confirmingRemoveId}
            movingId={movingId}
            onCloseDetail={onCloseDetail}
            onStartRemove={onStartRemove}
            onConfirmRemove={onConfirmRemove}
            onCancelRemove={onCancelRemove}
            onStartMove={onStartMove}
            onCancelMove={onCancelMove}
            onConfirmMove={onConfirmMove}
            onMoveToBucket={onMoveToBucket}
            onCarryForward={onCarryForward}
            onUpdateNotes={onUpdateNotes}
          />
        )}
      </Modal>
    </li>
  )
}
