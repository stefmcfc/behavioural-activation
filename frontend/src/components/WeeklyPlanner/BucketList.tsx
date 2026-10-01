import { useState } from 'react'
import type { ActivityCategory } from '../../types/activity'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { OccurrenceItem } from './OccurrenceItem'
import styles from './BucketList.module.css'

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  ROUTINE: 'Routine',
  NECESSARY: 'Necessary',
  PLEASURABLE: 'Pleasurable',
}

const ALL_CATEGORIES: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']

function computeZeroCategories(
  bucketOccurrences: readonly PlannedOccurrence[],
): ActivityCategory[] {
  if (bucketOccurrences.length === 0) {
    return []
  }
  const counts = new Map<ActivityCategory, number>(ALL_CATEGORIES.map((category) => [category, 0]))
  for (const occurrence of bucketOccurrences) {
    counts.set(occurrence.category, (counts.get(occurrence.category) ?? 0) + 1)
  }
  return ALL_CATEGORIES.filter((category) => (counts.get(category) ?? 0) === 0)
}

interface BucketListProps {
  readonly occurrences: readonly PlannedOccurrence[]
  readonly busyId: string | null
  readonly detailOpenId: string | null
  readonly confirmingRemoveId: string | null
  readonly movingId: string | null
  readonly reorderInFlight: boolean
  readonly onAdd: () => void
  readonly onOpenDetail: (id: string) => void
  readonly onCloseDetail: () => void
  readonly onStartRemove: (id: string) => void
  readonly onConfirmRemove: (id: string) => void
  readonly onCancelRemove: () => void
  readonly onStartMove: (id: string) => void
  readonly onCancelMove: () => void
  readonly onConfirmMove: (id: string, dayOfWeek: PlanDayOfWeek, slot: PlanSlot) => void
  readonly onComplete: (id: string) => void
  readonly onUndo: (id: string) => void
  readonly onCarryForward: (id: string) => void
  readonly onReorder: (occurrenceIds: string[]) => void
}

export function BucketList({
  occurrences,
  busyId,
  detailOpenId,
  confirmingRemoveId,
  movingId,
  reorderInFlight,
  onAdd,
  onOpenDetail,
  onCloseDetail,
  onStartRemove,
  onConfirmRemove,
  onCancelRemove,
  onStartMove,
  onCancelMove,
  onConfirmMove,
  onComplete,
  onUndo,
  onCarryForward,
  onReorder,
}: BucketListProps) {
  const bucketOccurrences = occurrences
    .filter((occurrence) => occurrence.dayOfWeek === null && occurrence.slot === null)
    .slice()
    .sort((a, b) => (a.bucketPosition ?? 0) - (b.bucketPosition ?? 0)) // FRONTEND-010-AC-01
  const zeroCategories = computeZeroCategories(bucketOccurrences)
  const idsInOrder = bucketOccurrences.map((occurrence) => occurrence.id)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const handleMoveUp = (id: string) => {
    const index = idsInOrder.indexOf(id)
    if (index <= 0) return
    const next = [...idsInOrder]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onReorder(next)
  }

  const handleMoveDown = (id: string) => {
    const index = idsInOrder.indexOf(id)
    if (index === -1 || index >= idsInOrder.length - 1) return
    const next = [...idsInOrder]
    ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
    onReorder(next)
  }

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    const originalTargetIndex = idsInOrder.indexOf(targetId)
    const withoutDragged = idsInOrder.filter((id) => id !== draggedId)
    const next = [
      ...withoutDragged.slice(0, originalTargetIndex),
      draggedId,
      ...withoutDragged.slice(originalTargetIndex),
    ]
    onReorder(next)
    setDraggedId(null)
  }

  return (
    <section aria-label="Weekend bucket list" className={styles.panel}>
      <div className={styles.header}>
        <h3>Weekend bucket list</h3>
        <button type="button" onClick={onAdd} aria-label="Add to weekend bucket list">
          Add
        </button>
      </div>

      {zeroCategories.map((category) => (
        <p key={category}>
          No {CATEGORY_LABELS[category]} activities in your bucket list yet.
        </p>
      ))}

      {bucketOccurrences.length === 0 && <p>Your bucket list is empty.</p>}

      {bucketOccurrences.length > 0 && (
        <ul className={styles.list}>
          {bucketOccurrences.map((occurrence, index) => (
            <OccurrenceItem
              key={occurrence.id}
              occurrence={occurrence}
              isBucketItem
              busyId={busyId}
              detailOpenId={detailOpenId}
              confirmingRemoveId={confirmingRemoveId}
              movingId={movingId}
              onOpenDetail={onOpenDetail}
              onCloseDetail={onCloseDetail}
              onStartRemove={onStartRemove}
              onConfirmRemove={onConfirmRemove}
              onCancelRemove={onCancelRemove}
              onStartMove={onStartMove}
              onCancelMove={onCancelMove}
              onConfirmMove={onConfirmMove}
              onMoveToBucket={() => {}}
              onComplete={onComplete}
              onUndo={onUndo}
              onCarryForward={onCarryForward}
              isFirst={index === 0}
              isLast={index === bucketOccurrences.length - 1}
              reorderDisabled={reorderInFlight}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onDragStart={setDraggedId}
              onDragOverItem={(event) => event.preventDefault()}
              onDropOnItem={handleDrop}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
