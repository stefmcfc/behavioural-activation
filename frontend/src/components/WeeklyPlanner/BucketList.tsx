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
}

export function BucketList({
  occurrences,
  busyId,
  detailOpenId,
  confirmingRemoveId,
  movingId,
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
}: BucketListProps) {
  const bucketOccurrences = occurrences.filter(
    (occurrence) => occurrence.dayOfWeek === null && occurrence.slot === null,
  )
  const zeroCategories = computeZeroCategories(bucketOccurrences)

  return (
    <section aria-label="Weekend bucket list" className={styles.panel}>
      <h3>Weekend bucket list</h3>
      <button type="button" onClick={onAdd} aria-label="Add to weekend bucket list">
        Add
      </button>

      {zeroCategories.map((category) => (
        <p key={category}>
          No {CATEGORY_LABELS[category]} activities in your bucket list yet.
        </p>
      ))}

      {bucketOccurrences.length === 0 && <p>Your bucket list is empty.</p>}

      {bucketOccurrences.length > 0 && (
        <ul className={styles.list}>
          {bucketOccurrences.map((occurrence) => (
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
            />
          ))}
        </ul>
      )}
    </section>
  )
}
