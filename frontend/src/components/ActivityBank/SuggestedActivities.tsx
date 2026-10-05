import { useState } from 'react'
import { activityApi } from '../../services/activityApi'
import { ApiError } from '../../types/api'
import type { Activity, ActivityCategory } from '../../types/activity'
import { PRESET_ACTIVITIES, type PresetActivity } from '../../utils/presetActivities'
import { CATEGORY_LABELS } from '../../utils/categoryLabels'

interface SuggestedActivitiesProps {
  readonly activities: Activity[]
  readonly onAdded: (activity: Activity) => void
  readonly defaultOpen?: boolean
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

// Fixed display order, matching CATEGORY_LABELS' own key order.
const CATEGORY_ORDER: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']

export function SuggestedActivities({ activities, onAdded, defaultOpen = false }: SuggestedActivitiesProps) {
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [errorByName, setErrorByName] = useState<Record<string, string>>({})

  const existingNames = new Set(activities.map((activity) => activity.name.toLowerCase()))
  const remainingPresets = PRESET_ACTIVITIES.filter(
    (preset) => !existingNames.has(preset.name.toLowerCase()),
  )

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
    <details open={defaultOpen}>
      <summary>Suggested activities</summary>

      {CATEGORY_ORDER.map((category) => {
        const presetsInCategory = remainingPresets.filter((preset) => preset.category === category)
        if (presetsInCategory.length === 0) {
          return null
        }
        return (
          <div key={category}>
            <h4>{CATEGORY_LABELS[category]}</h4>
            {/* NOSONAR(typescript:S6819): deliberate -- the <h4> above already labels this group,
                so this <ul>'s own list semantics would be redundant noise for screen reader users
                (matching ActivityBank.tsx's own category-filter group for the same reason). */}
            <ul role="presentation">
              {presetsInCategory.map((preset) => (
                <li key={preset.name}>
                  <span>{preset.name}</span>{' '}
                  <button
                    type="button"
                    onClick={() => handleAdd(preset)}
                    disabled={pendingName === preset.name}
                  >
                    {`Add ${preset.name}`}
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
