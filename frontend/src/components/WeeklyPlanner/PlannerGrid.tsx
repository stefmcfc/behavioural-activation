import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { OccurrenceItem } from './OccurrenceItem'
import { ALL_SLOTS, DAY_LABELS, SLOT_LABELS } from './planLabels'
import styles from './PlannerGrid.module.css'

const WEEKDAYS: readonly PlanDayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
]

interface PlannerGridProps {
  readonly occurrences: readonly PlannedOccurrence[]
  readonly busyId: string | null
  readonly confirmingRemoveId: string | null
  readonly movingId: string | null
  readonly onAdd: (dayOfWeek: PlanDayOfWeek, slot: PlanSlot) => void
  readonly onStartRemove: (id: string) => void
  readonly onConfirmRemove: (id: string) => void
  readonly onCancelRemove: () => void
  readonly onStartMove: (id: string) => void
  readonly onCancelMove: () => void
  readonly onConfirmMove: (id: string, dayOfWeek: PlanDayOfWeek, slot: PlanSlot) => void
  readonly onMoveToBucket: (id: string) => void
  readonly onComplete: (id: string) => void
  readonly onUndo: (id: string) => void
}

export function PlannerGrid({
  occurrences,
  busyId,
  confirmingRemoveId,
  movingId,
  onAdd,
  onStartRemove,
  onConfirmRemove,
  onCancelRemove,
  onStartMove,
  onCancelMove,
  onConfirmMove,
  onMoveToBucket,
  onComplete,
  onUndo,
}: PlannerGridProps) {
  const scheduled = occurrences.filter(
    (occurrence) => occurrence.dayOfWeek !== null && occurrence.slot !== null,
  )

  return (
    <section aria-label="Weekly grid">
      <h3>Week grid</h3>

      {scheduled.length === 0 && <p>No activities planned for this week.</p>}

      <div className={styles.grid}>
        {WEEKDAYS.map((day) => (
          <div key={day} className={styles.day}>
            <h4 className={styles.dayLabel}>{DAY_LABELS[day]}</h4>
            {ALL_SLOTS.map((slot) => {
              const cellOccurrences = scheduled.filter(
                (occurrence) => occurrence.dayOfWeek === day && occurrence.slot === slot,
              )
              return (
                <div key={slot} className={styles.cell}>
                  <h5>{SLOT_LABELS[slot]}</h5>
                  <button
                    type="button"
                    onClick={() => onAdd(day, slot)}
                    aria-label={`Add to ${DAY_LABELS[day]} ${SLOT_LABELS[slot]}`}
                  >
                    Add
                  </button>
                  <ul>
                    {cellOccurrences.map((occurrence) => (
                      <OccurrenceItem
                        key={occurrence.id}
                        occurrence={occurrence}
                        isBucketItem={false}
                        busyId={busyId}
                        confirmingRemoveId={confirmingRemoveId}
                        movingId={movingId}
                        onStartRemove={onStartRemove}
                        onConfirmRemove={onConfirmRemove}
                        onCancelRemove={onCancelRemove}
                        onStartMove={onStartMove}
                        onCancelMove={onCancelMove}
                        onConfirmMove={onConfirmMove}
                        onMoveToBucket={onMoveToBucket}
                        onComplete={onComplete}
                        onUndo={onUndo}
                        onCarryForward={() => {}}
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
