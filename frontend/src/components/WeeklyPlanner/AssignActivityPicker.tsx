import { useState } from 'react'
import { ApiError } from '../../types/api'
import type { PlanDayOfWeek, PlannedOccurrence, PlanSlot } from '../../types/plan'
import { planApi } from '../../services/planApi'
import { ActivityPickerList, type ActivityPickerSelection } from './ActivityPickerList'
import styles from './AssignActivityPicker.module.css'

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  return 'Something went wrong. Please try again.'
}

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
        <button type="button" onClick={handleAssign} disabled={!selected || isSubmitting}>
          Assign
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  )
}
