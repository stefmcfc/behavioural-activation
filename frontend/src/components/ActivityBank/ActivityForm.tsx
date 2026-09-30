import { useState, type FormEvent } from 'react'
import { activityApi } from '../../services/activityApi'
import { ApiError } from '../../types/api'
import type { Activity, ActivityCategory } from '../../types/activity'
import { CategoryPicker } from './CategoryPicker'
import { CategoryGuidance } from './CategoryGuidance'

interface ActivityFormProps {
  readonly mode: 'create' | 'edit'
  readonly activity?: Activity
  readonly onSuccess: (activity: Activity) => void
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

export function ActivityForm({ mode, activity, onSuccess, onCancel }: ActivityFormProps) {
  const [name, setName] = useState(activity?.name ?? '')
  const [category, setCategory] = useState<ActivityCategory | null>(activity?.category ?? null)
  const [description, setDescription] = useState(activity?.description ?? '')
  const [repeatable, setRepeatable] = useState(activity?.repeatable ?? true)
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
    if (!category) {
      setValidationError('Please select a category.')
      return
    }

    setValidationError(null)
    setIsSubmitting(true)
    try {
      const input = {
        name: name.trim(),
        category,
        description: description.trim() ? description.trim() : null,
        repeatable,
      }
      const result =
        mode === 'edit' && activity
          ? await activityApi.update(activity.id, input)
          : await activityApi.create(input)

      onSuccess(result)

      if (mode === 'create') {
        setName('')
        setCategory(null)
        setDescription('')
        setRepeatable(true)
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const nameId = `activity-name-${mode}`
  const descriptionId = `activity-description-${mode}`
  const repeatableId = `activity-repeatable-${mode}`
  const headingId = `activity-form-title-${mode}`

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h3 id={headingId}>{mode === 'edit' ? 'Edit activity' : 'Add activity'}</h3>

      <div>
        <label htmlFor={nameId}>Name</label>
        <input
          id={nameId}
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <CategoryPicker value={category} onChange={setCategory} name={`category-${mode}`} />
      <CategoryGuidance />

      <div>
        <label htmlFor={descriptionId}>Description</label>
        <textarea
          id={descriptionId}
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor={repeatableId}>
          <input
            id={repeatableId}
            name="repeatable"
            type="checkbox"
            checked={repeatable}
            onChange={(event) => setRepeatable(event.target.checked)}
          />
          Repeatable
        </label>
      </div>

      {validationError && <p>{validationError}</p>}
      {submitError && <p role="alert">{submitError}</p>}
      {isSubmitting && <output>Saving…</output>}

      <button type="submit" disabled={isSubmitting}>
        {mode === 'edit' ? 'Save changes' : 'Save activity'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  )
}
