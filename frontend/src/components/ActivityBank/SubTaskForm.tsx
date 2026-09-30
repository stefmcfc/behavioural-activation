import { useState, type FormEvent } from 'react'
import { subTaskApi } from '../../services/subTaskApi'
import { ApiError } from '../../types/api'
import type { SubTask } from '../../types/subTask'
import styles from './SubTaskForm.module.css'

interface SubTaskFormProps {
  readonly mode: 'create' | 'edit'
  readonly activityId: string
  readonly subTask?: SubTask
  readonly onSuccess: (subTask: SubTask) => void
  readonly onCancel?: () => void
}

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

export function SubTaskForm({ mode, activityId, subTask, onSuccess, onCancel }: SubTaskFormProps) {
  const [name, setName] = useState(subTask?.name ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    if (!name.trim()) {
      setValidationError('Name is required.')
      return
    }

    setValidationError(null)
    setIsSubmitting(true)
    try {
      const result =
        mode === 'edit' && subTask
          ? await subTaskApi.update(activityId, subTask.id, { name: name.trim() })
          : await subTaskApi.create(activityId, { name: name.trim() })

      onSuccess(result)

      if (mode === 'create') {
        setName('')
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const nameId = `sub-task-name-${mode}-${subTask?.id ?? 'new'}`
  const headingId = `sub-task-form-title-${mode}`

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      <div className={styles.scrollBody}>
        <h3 id={headingId}>{mode === 'edit' ? 'Rename sub-task' : 'Add sub-task'}</h3>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={nameId}>
            Sub-task name
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {validationError && <p>{validationError}</p>}
        {submitError && <p role="alert">{submitError}</p>}
        {isSubmitting && <output>Saving…</output>}
      </div>

      <div className={styles.actions}>
        <button type="submit" disabled={isSubmitting}>
          {mode === 'edit' ? 'Save changes' : 'Save sub-task'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
