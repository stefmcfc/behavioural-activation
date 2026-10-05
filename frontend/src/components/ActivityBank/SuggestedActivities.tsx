import { useState } from 'react'
import { activityApi } from '../../services/activityApi'
import { ApiError } from '../../types/api'
import type { Activity } from '../../types/activity'
import { PRESET_ACTIVITIES, type PresetActivity } from '../../utils/presetActivities'
import { CATEGORY_ORDER } from '../../utils/categoryLabels'
import type { CategoryFilter } from '../../utils/categoryFilter'
import { RepeatableIcon } from '../RepeatableIcon/RepeatableIcon'
import { CategoryGroupHeading } from '../CategoryGroupHeading/CategoryGroupHeading'
import { ChevronIcon } from '../icons/ChevronIcon'
import styles from './SuggestedActivities.module.css'

interface SuggestedActivitiesProps {
  readonly activities: Activity[]
  readonly onAdded: (activity: Activity) => void
  readonly defaultOpen?: boolean
  readonly categoryFilter: CategoryFilter
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

export function SuggestedActivities({
  activities,
  onAdded,
  defaultOpen = false,
  categoryFilter,
}: SuggestedActivitiesProps) {
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [errorByName, setErrorByName] = useState<Record<string, string>>({})

  const existingNames = new Set(activities.map((activity) => activity.name.toLowerCase()))
  const remainingPresets = PRESET_ACTIVITIES.filter(
    (preset) => !existingNames.has(preset.name.toLowerCase()),
  )

  // FRONTEND-040-AC-11: respects ActivityBank's existing category filter -- no second, independent
  // filter control.
  const visibleCategories =
    categoryFilter === 'ALL' ? CATEGORY_ORDER : CATEGORY_ORDER.filter((c) => c === categoryFilter)

  const handleAdd = async (preset: PresetActivity) => {
    setErrorByName((previous) => {
      const next = { ...previous }
      delete next[preset.name]
      return next
    })
    setPendingName(preset.name)
    try {
      const activity = await activityApi.create({
        name: preset.name,
        category: preset.category,
        description: null,
        repeatable: preset.repeatable,
      })
      onAdded(activity)
    } catch (error) {
      setErrorByName((previous) => ({ ...previous, [preset.name]: getErrorMessage(error) }))
    } finally {
      setPendingName(null)
    }
  }

  return (
    <details className={styles.details} open={defaultOpen}>
      <summary className={styles.sectionHeading}>
        Suggested activities
        <ChevronIcon />
      </summary>

      {/* FRONTEND-040-AC-12 */}
      <p className={styles.preamble}>A few common activities you can add with one click.
      You can always edit the activity after you've added it to your list</p>

      {visibleCategories.map((category) => {
        const presetsInCategory = remainingPresets.filter((preset) => preset.category === category)
        if (presetsInCategory.length === 0) {
          return null
        }
        return (
          <div key={category}>
            <CategoryGroupHeading category={category} />
            <ul // NOSONAR(typescript:S6819): deliberate -- the heading above already labels this
              // group, so this <ul>'s own list semantics would be redundant noise for screen
              // reader users (matching ActivityBank.tsx's own category-filter group for the same
              // reason).
              role="presentation"
              className={styles.list}
            >
              {presetsInCategory.map((preset) => (
                <li key={preset.name} className={styles.row}>
                  <span>{preset.name}</span>
                  {preset.repeatable && <RepeatableIcon />}
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => handleAdd(preset)}
                    disabled={pendingName === preset.name}
                    aria-label={`Add ${preset.name} to my activities`}
                  >
                    Add to my activities
                  </button>
                  {errorByName[preset.name] && <p role="alert">{errorByName[preset.name]}</p>}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </details>
  )
}
