import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import type { DragPayload } from './dragPayload'
import { OccurrenceItem } from './OccurrenceItem'
import { ALL_DAYS, ALL_SLOTS, DAY_LABELS, SLOT_LABELS, parseWeekStart } from './planLabels'
import { getGridOrientation, subscribeToGridOrientationChanges } from '../../utils/gridOrientation'
import styles from './PlannerGrid.module.css'

function getDayDate(weekStart: string, day: PlanDayOfWeek): number {
  const date = parseWeekStart(weekStart)
  date.setDate(date.getDate() + ALL_DAYS.indexOf(day))
  return date.getDate()
}

interface PlannerGridProps {
  readonly weekStart: string
  readonly days: readonly PlanDayOfWeek[]
  readonly heading: string
  readonly emptyMessage: string
  readonly occurrences: readonly PlannedOccurrence[]
  readonly busyId: string | null
  readonly detailOpenId: string | null
  readonly confirmingRemoveId: string | null
  readonly movingId: string | null
  readonly todayColumn: PlanDayOfWeek | null
  readonly dimmedOccurrenceIds?: ReadonlySet<string>
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
  readonly dragPayload: DragPayload | null
  readonly onDragStart: (id: string) => void
  readonly onDragEnd: () => void
  readonly onAssignFromDrawer?: (
    payload: DragPayload,
    dayOfWeek: PlanDayOfWeek | null,
    slot: PlanSlot | null,
  ) => void
}

// FRONTEND-035-AC-08: a stable, shared empty default so omitting dimmedOccurrenceIds (every
// pre-existing caller/test) behaves exactly as if nothing were dimmed.
const NO_DIMMED_IDS: ReadonlySet<string> = new Set()

function cellClassName(isToday: boolean): string {
  return isToday ? `${styles.cell} ${styles.today}` : styles.cell
}

function dayLabelClassName(isToday: boolean): string {
  return isToday ? `${styles.dayLabel} ${styles.today}` : styles.dayLabel
}

function dayHeadingClassName(isToday: boolean): string {
  return isToday ? `${styles.dayHeading} ${styles.today}` : styles.dayHeading
}

export function PlannerGrid({
  weekStart,
  days,
  heading,
  emptyMessage,
  occurrences,
  busyId,
  detailOpenId,
  confirmingRemoveId,
  movingId,
  todayColumn,
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
  dragPayload,
  onDragStart,
  onDragEnd,
  onAssignFromDrawer,
}: PlannerGridProps) {
  const [orientation, setOrientation] = useState(() => getGridOrientation())

  useEffect(
    () => subscribeToGridOrientationChanges(() => setOrientation(getGridOrientation())),
    [],
  )

  const scheduled = occurrences.filter(
    (occurrence) => occurrence.dayOfWeek !== null && occurrence.slot !== null,
  )

  const handleDrop = (targetDay: PlanDayOfWeek, targetSlot: PlanSlot) => {
    const payload = dragPayload
    onDragEnd()
    if (payload === null) return
    if (payload.kind !== 'occurrence') {
      // FRONTEND-028-AC-10: a drawer-origin drag has no existing occurrence to move -- it needs a
      // brand-new one created, not frontend_spec_025/026's existing move/demote/promote branch.
      // onAssignFromDrawer is optional -- no Weekly-Planner-owned drag source exists for these
      // payload kinds, but PlannerGrid's own drop-branching stays ready for frontend_spec_016.
      onAssignFromDrawer?.(payload, targetDay, targetSlot)
      return
    }
    const id = payload.id
    if (busyId !== null) return
    const dragged = occurrences.find((occurrence) => occurrence.id === id)
    if (!dragged) return
    if (dragged.dayOfWeek === targetDay && dragged.slot === targetSlot) return
    onConfirmMove(id, targetDay, targetSlot)
  }

  const renderCell = (day: PlanDayOfWeek, slot: PlanSlot): ReactNode => {
    const cellOccurrences = scheduled.filter(
      (occurrence) => occurrence.dayOfWeek === day && occurrence.slot === slot,
    )
    return (
      <div
        key={`${day}-${slot}`}
        className={cellClassName(day === todayColumn)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => handleDrop(day, slot)}
      >
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
              onMoveToBucket={onMoveToBucket}
              onComplete={onComplete}
              onUndo={onUndo}
              onCarryForward={() => {}}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </ul>
      </div>
    )
  }

  return (
    <section aria-label={heading} className={styles.section}>
      <h3>{heading}</h3>

      {scheduled.length === 0 && <p>{emptyMessage}</p>}

      <div className={styles.scroll}>
        {orientation === 'day-rows' ? (
          <div className={styles.rows}>
            {days.map((day) => {
              const isToday = day === todayColumn
              return (
                <section key={day} className={styles.daySection} aria-label={DAY_LABELS[day]}>
                  <h4 className={dayHeadingClassName(isToday)}>
                    <span>{getDayDate(weekStart, day)}</span>
                    <span>{DAY_LABELS[day]}</span>
                  </h4>
                  <div className={styles.daySlots}>
                    {ALL_SLOTS.map((slot) => renderCell(day, slot))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className={styles.grid} style={{ '--day-count': days.length } as CSSProperties}>
            {days.map((day) => (
              <div key={day} className={dayLabelClassName(day === todayColumn)}>
                <span>{getDayDate(weekStart, day)}</span>
                <span>{DAY_LABELS[day]}</span>
              </div>
            ))}
            {ALL_SLOTS.map((slot) => days.map((day) => renderCell(day, slot)))}
          </div>
        )}
      </div>
    </section>
  )
}
