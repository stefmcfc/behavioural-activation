import { useState } from 'react'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { ALL_DAYS, ALL_SLOTS, DAY_LABELS, SLOT_LABELS } from './planLabels'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import styles from './OccurrenceItem.module.css'

interface OccurrenceDetailCardProps {
  readonly occurrence: PlannedOccurrence
  readonly isBucketItem: boolean
  readonly isBusy: boolean
  readonly confirmingRemoveId: string | null
  readonly movingId: string | null
  readonly onCloseDetail: () => void
  readonly onStartRemove: (id: string) => void
  readonly onConfirmRemove: (id: string) => void
  readonly onCancelRemove: () => void
  readonly onStartMove: (id: string) => void
  readonly onCancelMove: () => void
  readonly onConfirmMove: (id: string, dayOfWeek: PlanDayOfWeek, slot: PlanSlot) => void
  readonly onMoveToBucket: (id: string) => void
  readonly onCarryForward: (id: string) => void
  readonly onUpdateNotes: (id: string, notes: string | null) => void
}

interface NotesFieldProps {
  readonly occurrence: PlannedOccurrence
  readonly onUpdateNotes: (id: string, notes: string | null) => void
}

// FRONTEND-043-AC-01/AC-05: seeded from the occurrence's own notes, reset whenever a different
// occurrence's card opens (by id) or an externally-updated occurrence (e.g. this autosave's own
// response replacing it in usePlanActions state) comes back in -- otherwise the local draft would
// fight the just-saved value or leak into the next occurrence rendered in this same list slot.
// Adjusted during render (React's documented "adjusting state when a prop changes" pattern)
// rather than in a useEffect, to avoid oxlint's react(set-state-in-effect) cascading-render
// warning -- usePlanActions.resetForRefetch's own comment documents this same codebase
// convention elsewhere.
function NotesField({ occurrence, onUpdateNotes }: NotesFieldProps) {
  const [notesDraft, setNotesDraft] = useState(occurrence.notes ?? '')
  const [seenNotes, setSeenNotes] = useState({ id: occurrence.id, notes: occurrence.notes })
  if (occurrence.id !== seenNotes.id || occurrence.notes !== seenNotes.notes) {
    setSeenNotes({ id: occurrence.id, notes: occurrence.notes })
    setNotesDraft(occurrence.notes ?? '')
  }
  const notesTextareaId = `notes-${occurrence.id}`

  return (
    <>
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
    </>
  )
}

interface ConfirmRemoveActionsProps {
  readonly occurrenceId: string
  readonly isBusy: boolean
  readonly onConfirmRemove: (id: string) => void
  readonly onCancelRemove: () => void
}

function ConfirmRemoveActions({
  occurrenceId,
  isBusy,
  onConfirmRemove,
  onCancelRemove,
}: ConfirmRemoveActionsProps) {
  return (
    <span className={styles.actions}>
      <button type="button" onClick={() => onConfirmRemove(occurrenceId)} disabled={isBusy}>
        Confirm remove
      </button>
      <button type="button" onClick={onCancelRemove} disabled={isBusy}>
        Cancel
      </button>
    </span>
  )
}

interface MoveControlsProps {
  readonly occurrence: PlannedOccurrence
  readonly isBucketItem: boolean
  readonly isBusy: boolean
  readonly onConfirmMove: (id: string, dayOfWeek: PlanDayOfWeek, slot: PlanSlot) => void
  readonly onCancelMove: () => void
  readonly onMoveToBucket: (id: string) => void
}

function MoveControls({
  occurrence,
  isBucketItem,
  isBusy,
  onConfirmMove,
  onCancelMove,
  onMoveToBucket,
}: MoveControlsProps) {
  const [moveDay, setMoveDay] = useState<PlanDayOfWeek>(occurrence.dayOfWeek ?? 'MONDAY')
  const [moveSlot, setMoveSlot] = useState<PlanSlot>(occurrence.slot ?? 'MORNING')
  const moveDaySelectId = `move-day-${occurrence.id}`
  const moveSlotSelectId = `move-slot-${occurrence.id}`

  return (
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
  )
}

interface DefaultActionsProps {
  readonly occurrence: PlannedOccurrence
  readonly isBucketItem: boolean
  readonly isBusy: boolean
  readonly onStartMove: (id: string) => void
  readonly onStartRemove: (id: string) => void
  readonly onCarryForward: (id: string) => void
}

function DefaultActions({
  occurrence,
  isBucketItem,
  isBusy,
  onStartMove,
  onStartRemove,
  onCarryForward,
}: DefaultActionsProps) {
  return (
    <span className={styles.actions}>
      <button type="button" onClick={() => onStartMove(occurrence.id)} disabled={isBusy}>
        Rearrange
      </button>
      <button type="button" onClick={() => onStartRemove(occurrence.id)} disabled={isBusy}>
        Remove
      </button>
      {isBucketItem && (
        <button type="button" onClick={() => onCarryForward(occurrence.id)} disabled={isBusy}>
          Carry forward
        </button>
      )}
    </span>
  )
}

// Extracted from OccurrenceItem.tsx (typescript:S3776 -- cognitive complexity) -- this is the
// content of the detail-card Modal, previously three nested conditional sub-states inline in
// OccurrenceItem's own render. Each sub-state is now its own small component, scored
// independently by Sonar, so no single function carries all of the branching at once. Pure
// extraction: no rendered-output change, verified against the existing OccurrenceItem test suite.
export function OccurrenceDetailCard({
  occurrence,
  isBucketItem,
  isBusy,
  confirmingRemoveId,
  movingId,
  onCloseDetail,
  onStartRemove,
  onConfirmRemove,
  onCancelRemove,
  onStartMove,
  onCancelMove,
  onConfirmMove,
  onMoveToBucket,
  onCarryForward,
  onUpdateNotes,
}: OccurrenceDetailCardProps) {
  return (
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

        <NotesField occurrence={occurrence} onUpdateNotes={onUpdateNotes} />

        {confirmingRemoveId === occurrence.id && (
          <ConfirmRemoveActions
            occurrenceId={occurrence.id}
            isBusy={isBusy}
            onConfirmRemove={onConfirmRemove}
            onCancelRemove={onCancelRemove}
          />
        )}

        {movingId === occurrence.id && (
          <MoveControls
            occurrence={occurrence}
            isBucketItem={isBucketItem}
            isBusy={isBusy}
            onConfirmMove={onConfirmMove}
            onCancelMove={onCancelMove}
            onMoveToBucket={onMoveToBucket}
          />
        )}

        {confirmingRemoveId !== occurrence.id && movingId !== occurrence.id && (
          <DefaultActions
            occurrence={occurrence}
            isBucketItem={isBucketItem}
            isBusy={isBusy}
            onStartMove={onStartMove}
            onStartRemove={onStartRemove}
            onCarryForward={onCarryForward}
          />
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" onClick={onCloseDetail}>
          Close
        </button>
      </div>
    </>
  )
}
