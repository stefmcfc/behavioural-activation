import { useState } from 'react'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { planApi } from '../../services/planApi'
import { ActivityPickerList, type ActivityPickerSelection } from './ActivityPickerList'
import { getErrorMessage } from '../../utils/getErrorMessage'
import styles from './AssignActivityPicker.module.css'
import buttonStyles from '../../styles/buttonVariants.module.css'

export interface AssignTarget {
  readonly dayOfWeek: PlanDayOfWeek | null
  readonly slot: PlanSlot | null
}

interface AssignActivityPickerProps {
  readonly weekStart: string
  readonly target: AssignTarget
  readonly onSuccess: (occurrence: PlannedOccurrence) => void
  readonly onCancel: () => void
}

export function AssignActivityPicker({
  weekStart,
  target,
  onSuccess,
  onCancel,
}: AssignActivityPickerProps) {
  const [selected, setSelected] = useState<ActivityPickerSelection | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAssign = async () => {
    if (!selected) {
      return
    }
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const created = await planApi.create({
        activityId: selected.activityId,
        subTaskId: selected.subTaskId,
        weekStart,
        dayOfWeek: target.dayOfWeek,
        slot: target.slot,
      })
      onSuccess(created)
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className={styles.scrollBody}>
        <h3 id="assign-picker-title">Assign an activity or sub-task</h3>

        <ActivityPickerList
          mode="select"
          selected={selected}
          onSelectActivity={(activityId) => setSelected({ activityId, subTaskId: null })}
          onSelectSubTask={(subTaskId) => setSelected({ activityId: null, subTaskId })}
        />

        {submitError && <p role="alert">{submitError}</p>}
        {isSubmitting && <output>Assigning…</output>}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={buttonStyles.primary}
          onClick={handleAssign}
          disabled={!selected || isSubmitting}
        >
          Assign
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  )
}
