import type { ActivityCategory } from '../../types/activity'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import type { DragPayload } from './dragPayload'
import { OccurrenceItem } from './OccurrenceItem'
import styles from './BucketList.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  ROUTINE: 'Routine',
  NECESSARY: 'Necessary',
  PLEASURABLE: 'Pleasurable',
}

const ALL_CATEGORIES: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']

// FRONTEND-035-AC-08: a stable, shared empty default so omitting dimmedOccurrenceIds (every
// pre-existing caller/test) behaves exactly as if nothing were dimmed.
const NO_DIMMED_IDS: ReadonlySet<string> = new Set()

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
  readonly dimmedOccurrenceIds?: ReadonlySet<string>
  readonly onAdd: () => void
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
  readonly onReorder: (occurrenceIds: string[]) => void
  readonly dragPayload: DragPayload | null
  readonly onDragStart: (id: string) => void
  readonly onDragEnd: () => void
  readonly onAssignFromDrawer?: (
    payload: DragPayload,
    dayOfWeek: PlanDayOfWeek | null,
    slot: PlanSlot | null,
  ) => void
}

export function BucketList({
  occurrences,
  busyId,
  detailOpenId,
  confirmingRemoveId,
  movingId,
  reorderInFlight,
  dimmedOccurrenceIds = NO_DIMMED_IDS,
  onAdd,
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
  onReorder,
  dragPayload,
  onDragStart,
  onDragEnd,
  onAssignFromDrawer,
}: BucketListProps) {
  const bucketOccurrences = occurrences
    .filter((occurrence) => occurrence.dayOfWeek === null && occurrence.slot === null)
    .slice()
    .sort((a, b) => (a.bucketPosition ?? 0) - (b.bucketPosition ?? 0)) // FRONTEND-010-AC-01
  const zeroCategories = computeZeroCategories(bucketOccurrences)
  const idsInOrder = bucketOccurrences.map((occurrence) => occurrence.id)

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
    const payload = dragPayload
    onDragEnd()
    if (!payload) return
    if (payload.kind !== 'occurrence') {
      // FRONTEND-028-AC-14: a drawer-origin payload is never already a bucket member — it always
      // gets a brand-new occurrence created in the bucket, never a same-bucket reorder.
      // onAssignFromDrawer is optional -- no Weekly-Planner-owned drag source exists for these
      // payload kinds, but BucketList's own drop-branching stays ready for frontend_spec_016.
      onAssignFromDrawer?.(payload, null, null)
      return
    }
    const id = payload.id
    if (id === targetId) return
    if (idsInOrder.includes(id)) {
      // FRONTEND-010: existing same-bucket reorder, unchanged (not gated by busyId — that flag
      // guards individual-occurrence actions in flight, not this drag-to-reorder path).
      const originalTargetIndex = idsInOrder.indexOf(targetId)
      const withoutDragged = idsInOrder.filter((occurrenceId) => occurrenceId !== id)
      const next = [
        ...withoutDragged.slice(0, originalTargetIndex),
        id,
        ...withoutDragged.slice(originalTargetIndex),
      ]
      onReorder(next)
    } else if (busyId === null) {
      // FRONTEND-026-AC-03: a grid-origin (not-yet-bucketed) occurrence dropped on an existing
      // bucket item demotes it the same as dropping anywhere else in the bucket; it is not
      // spliced into a specific position. FRONTEND-026-AC-06: gated by busyId like the grid side.
      onMoveToBucket(id)
    }
  }

  const handlePanelDrop = () => {
    const payload = dragPayload
    onDragEnd()
    if (!payload) return
    if (payload.kind !== 'occurrence') {
      // FRONTEND-028-AC-13: dropped on empty bucket space — same new-assignment path, no day/slot.
      onAssignFromDrawer?.(payload, null, null)
      return
    }
    const id = payload.id
    if (idsInOrder.includes(id) || busyId !== null) return
    onMoveToBucket(id)
  }

  return (
    <section
      aria-label="Weekend bucket list"
      className={styles.panel}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handlePanelDrop}
    >
      <div className={styles.header}>
        <h3>Weekend bucket list</h3>
        <button
          type="button"
          className={buttonStyles.primary}
          onClick={onAdd}
          aria-label="Add to weekend bucket list"
        >
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
              dimmed={dimmedOccurrenceIds.has(occurrence.id)}
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
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOverItem={(event) => event.preventDefault()}
              onDropOnItem={handleDrop}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
