import { useState, type SubmitEvent } from 'react'
import { activityApi } from '../../services/activityApi'
import { ApiError } from '../../types/api'
import type { Activity, ActivityCategory } from '../../types/activity'
import { CategoryPicker } from './CategoryPicker'
import { CategoryGuidance } from './CategoryGuidance'
import { RepeatableIcon } from '../RepeatableIcon/RepeatableIcon'
import { FavouriteIcon } from '../FavouriteIcon/FavouriteIcon'
import styles from './ActivityForm.module.css'

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
  const [favourite, setFavourite] = useState(activity?.favourite ?? false)
  const [nameTouchedEmpty, setNameTouchedEmpty] = useState(false)
  const [categorySubmitAttempted, setCategorySubmitAttempted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const nameInvalid = nameTouchedEmpty && !name.trim()
  const categoryInvalid = categorySubmitAttempted && !category

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    if (!name.trim() || !category) {
      setNameTouchedEmpty(!name.trim())
      setCategorySubmitAttempted(!category)
      return
    }

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

      // favourite is never part of ActivityRequest (mirrors archived) -- applied via its own
      // dedicated endpoint after create/update succeeds, only when the form's toggle actually
      // changed it, so a no-op edit doesn't fire an extra request.
      let finalResult = result
      if (favourite !== result.favourite) {
        finalResult = favourite
          ? await activityApi.markFavourite(result.id)
          : await activityApi.unmarkFavourite(result.id).then(() => ({ ...result, favourite: false }))
      }

      onSuccess(finalResult)

      if (mode === 'create') {
        setName('')
        setCategory(null)
        setDescription('')
        setRepeatable(true)
        setFavourite(false)
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const nameId = `activity-name-${mode}`
  const nameErrorId = `${nameId}-error`
  const categoryErrorId = `activity-category-${mode}-error`
  const descriptionId = `activity-description-${mode}`
  const repeatableId = `activity-repeatable-${mode}`
  const favouriteId = `activity-favourite-${mode}`
  const headingId = `activity-form-title-${mode}`

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      <div className={styles.scrollBody}>
        <h3 id={headingId}>{mode === 'edit' ? 'Edit activity' : 'Add activity'}</h3>

        <CategoryPicker
          value={category}
          onChange={(selected) => {
            setCategory(selected)
            setCategorySubmitAttempted(false)
          }}
          name={`category-${mode}`}
          invalid={categoryInvalid}
          errorId={categoryErrorId}
        />
        {categoryInvalid && (
          <p id={categoryErrorId} className={styles.fieldError}>
            Please select a category.
          </p>
        )}
        <CategoryGuidance />

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={nameId}>
            Name
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            required
            value={name}
            aria-invalid={nameInvalid ? 'true' : undefined}
            aria-describedby={nameInvalid ? nameErrorId : undefined}
            onChange={(event) => {
              setName(event.target.value)
              if (event.target.value.trim()) {
                setNameTouchedEmpty(false)
              }
            }}
            onBlur={() => setNameTouchedEmpty(!name.trim())}
          />
          {nameInvalid && (
            <p id={nameErrorId} className={styles.fieldError}>
              Name is required.
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={descriptionId}>
            Description
          </label>
          <textarea
            id={descriptionId}
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className={styles.repeatableField}>
          <label htmlFor={repeatableId}>
            <input
              id={repeatableId}
              name="repeatable"
              type="checkbox"
              checked={repeatable}
              onChange={(event) => setRepeatable(event.target.checked)}
            />{' '}
            Repeatable {repeatable && <RepeatableIcon />}
          </label>
          <p className={styles.repeatableHint}>
            Repeatable activities (the default) are things you do again and again, like "Go for a
            walk" — they stay in your Activity Bank indefinitely. Turn this off for a one-off, like
            "Apply for jobs": once every planned occurrence of it is completed, it's automatically
            archived out of your everyday list (you can still view and unarchive it later).
          </p>
        </div>

        <div className={styles.repeatableField}>
          <label htmlFor={favouriteId}>
            <input
              id={favouriteId}
              name="favourite"
              type="checkbox"
              checked={favourite}
              onChange={(event) => setFavourite(event.target.checked)}
            />{' '}
            Favourite <FavouriteIcon filled={favourite} />
          </label>
          <p className={styles.repeatableHint}>
            Favourited activities are pinned to the top of your Activity Bank and the Weekly
            Planner's "Add" picker.
          </p>
        </div>

        {submitError && <p role="alert">{submitError}</p>}
        {isSubmitting && <output>Saving…</output>}
      </div>

      <div className={styles.actions}>
        <button type="submit" disabled={isSubmitting}>
          {mode === 'edit' ? 'Save changes' : 'Save activity'}
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
