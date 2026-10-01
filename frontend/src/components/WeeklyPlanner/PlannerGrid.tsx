import type { CSSProperties } from 'react'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { OccurrenceItem } from './OccurrenceItem'
import { ALL_SLOTS, DAY_LABELS, SLOT_LABELS } from './planLabels'
import styles from './PlannerGrid.module.css'

interface PlannerGridProps {
  readonly days: readonly PlanDayOfWeek[]
  readonly heading: string
  readonly emptyMessage: string
  readonly occurrences: readonly PlannedOccurrence[]
  readonly busyId: string | null
  readonly detailOpenId: string | null
  readonly confirmingRemoveId: string | null
  readonly movingId: string | null
  readonly todayColumn: PlanDayOfWeek | null
  readonly onAdd: (dayOfWeek: PlanDayOfWeek, slot: PlanSlot) => void
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
}

function cellClassName(isToday: boolean): string {
  return isToday ? `${styles.cell} ${styles.today}` : styles.cell
}

function dayLabelClassName(isToday: boolean): string {
  return isToday ? `${styles.dayLabel} ${styles.today}` : styles.dayLabel
}

export function PlannerGrid({
  days,
  heading,
  emptyMessage,
  occurrences,
  busyId,
  detailOpenId,
  confirmingRemoveId,
  movingId,
  todayColumn,
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
}: PlannerGridProps) {
  const scheduled = occurrences.filter(
    (occurrence) => occurrence.dayOfWeek !== null && occurrence.slot !== null,
  )

  return (
    <section aria-label={heading}>
      <h3>{heading}</h3>

      {scheduled.length === 0 && <p>{emptyMessage}</p>}

      <div className={styles.scroll}>
        <div className={styles.grid} style={{ '--day-count': days.length } as CSSProperties}>
          {days.map((day) => (
            <div key={day} className={dayLabelClassName(day === todayColumn)}>
              {DAY_LABELS[day]}
            </div>
          ))}
          {ALL_SLOTS.map((slot) =>
            days.map((day) => {
              const cellOccurrences = scheduled.filter(
                (occurrence) => occurrence.dayOfWeek === day && occurrence.slot === slot,
              )
              return (
                <div key={`${day}-${slot}`} className={cellClassName(day === todayColumn)}>
                  <div className={styles.cellHeader}>
                    <span className={styles.slotLabel}>{SLOT_LABELS[slot]}</span>
                    <button
                      type="button"
                      onClick={() => onAdd(day, slot)}
                      aria-label={`Add to ${DAY_LABELS[day]} ${SLOT_LABELS[slot]}`}
                    >
                      Add
                    </button>
                  </div>
                  <ul className={styles.list}>
                    {cellOccurrences.map((occurrence) => (
                      <OccurrenceItem
                        key={occurrence.id}
                        occurrence={occurrence}
                        isBucketItem={false}
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
                        onMoveToBucket={onMoveToBucket}
                        onComplete={onComplete}
                        onUndo={onUndo}
                        onCarryForward={() => {}}
                      />
                    ))}
                  </ul>
                </div>
              )
            }),
          )}
        </div>
      </div>
    </section>
  )
}
