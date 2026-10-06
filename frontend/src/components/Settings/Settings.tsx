import { useEffect, useState } from 'react'
import type { ActivityCategory } from '../../types/activity'
import type { PlanDayOfWeek } from '../../types/plan'
import { workDayApi } from '../../services/workDayApi'
import { CATEGORY_LABELS } from '../../utils/categoryLabels'
import {
  getCategoryColor,
  resetCategoryColor,
  setCategoryColor,
  subscribeToCategoryColorChanges,
} from '../../utils/categoryColors'
import {
  getThemePreference,
  setThemePreference as persistThemePreference,
  type ThemePreference,
} from '../../utils/theme'
import {
  getGridOrientation,
  setGridOrientation as persistGridOrientation,
  type GridOrientation,
} from '../../utils/gridOrientation'
import { getErrorMessage } from '../../utils/getErrorMessage'
import styles from './Settings.module.css'

const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const GRID_ORIENTATION_OPTIONS: readonly { value: GridOrientation; label: string }[] = [
  { value: 'day-columns', label: 'Days across the top' },
  { value: 'day-rows', label: 'Each day as its own section' },
]

const ALL_CATEGORIES: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']

// FRONTEND-042: defined locally rather than imported from WeeklyPlanner/planLabels.ts's DAY_LABELS,
// matching this file's existing convention of defining its own option lists locally (THEME_OPTIONS,
// GRID_ORIENTATION_OPTIONS, ALL_CATEGORIES above) rather than reaching into another feature folder.
const WORK_DAYS: readonly { value: PlanDayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
]

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getCategoryColorSnapshot(): Record<ActivityCategory, string> {
  return {
    ROUTINE: getCategoryColor('ROUTINE'),
    NECESSARY: getCategoryColor('NECESSARY'),
    PLEASURABLE: getCategoryColor('PLEASURABLE'),
  }
}

export function Settings() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    getThemePreference(),
  )
  const [gridOrientation, setGridOrientation] = useState<GridOrientation>(() =>
    getGridOrientation(),
  )
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => getSystemPrefersDark())
  const [categoryColors, setCategoryColors] = useState<Record<ActivityCategory, string>>(() =>
    getCategoryColorSnapshot(),
  )
  const [workDayPattern, setWorkDayPattern] = useState<PlanDayOfWeek[] | null>(null)
  const [workDayLoadError, setWorkDayLoadError] = useState<string | null>(null)
  const [workDaySaveError, setWorkDaySaveError] = useState<string | null>(null)
  const [workDayRetryCount, setWorkDayRetryCount] = useState(0)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setSystemPrefersDark(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(
    () => subscribeToCategoryColorChanges(() => setCategoryColors(getCategoryColorSnapshot())),
    [],
  )

  // FRONTEND-042-AC-01/AC-03: fetches the recurring pattern on mount (and on Retry), unlike every
  // other fieldset above which reads synchronously from localStorage at initial state. State is
  // only ever updated from inside the promise callbacks, never synchronously in the effect body
  // itself (oxlint's react(set-state-in-effect) rule, same convention as useWorkDays.ts).
  useEffect(() => {
    let cancelled = false

    workDayApi
      .getPattern()
      .then((days) => {
        if (!cancelled) {
          setWorkDayPattern(days)
          setWorkDayLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setWorkDayLoadError(getErrorMessage(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [workDayRetryCount])

  const handleThemeChange = (preference: ThemePreference) => {
    persistThemePreference(preference)
    setThemePreference(preference)
  }

  const handleGridOrientationChange = (orientation: GridOrientation) => {
    persistGridOrientation(orientation)
    setGridOrientation(orientation)
  }

  const handleColorChange = (category: ActivityCategory, hex: string) => {
    setCategoryColor(category, hex)
  }

  const handleReset = (category: ActivityCategory) => {
    resetCategoryColor(category)
  }

  const handleRetryWorkDayPattern = () => {
    setWorkDayPattern(null)
    setWorkDayLoadError(null)
    setWorkDayRetryCount((count) => count + 1)
  }

  // FRONTEND-042-AC-02/AC-04: saves the full new set immediately, no Save button -- state (and
  // therefore every checkbox's checked value) only updates once the server confirms the change, so
  // a rejection naturally leaves every checkbox at its last-successfully-saved state rather than
  // needing a separate explicit revert step.
  const handleToggleWorkDay = async (day: PlanDayOfWeek) => {
    if (!workDayPattern) return
    setWorkDaySaveError(null)
    const newDays = workDayPattern.includes(day)
      ? workDayPattern.filter((existing) => existing !== day)
      : [...workDayPattern, day]
    try {
      const updated = await workDayApi.setPattern(newDays)
      setWorkDayPattern(updated)
    } catch (error) {
      setWorkDaySaveError(getErrorMessage(error))
    }
  }

  return (
    <section>
      <h2>Settings</h2>

      <fieldset>
        <legend>Appearance</legend>
        <ul className={styles.themeList}>
          {THEME_OPTIONS.map((option) => (
            <li key={option.value}>
              <label>
                <input
                  type="radio"
                  name="theme-preference"
                  value={option.value}
                  checked={themePreference === option.value}
                  onChange={() => handleThemeChange(option.value)}
                />
                {option.label}
              </label>
            </li>
          ))}
        </ul>
        {themePreference === 'system' && (
          <p>Currently: {systemPrefersDark ? 'Dark' : 'Light'}</p>
        )}
      </fieldset>

      <fieldset>
        <legend>Weekly grid layout</legend>
        <ul className={styles.themeList}>
          {GRID_ORIENTATION_OPTIONS.map((option) => (
            <li key={option.value}>
              <label>
                <input
                  type="radio"
                  name="grid-orientation"
                  value={option.value}
                  checked={gridOrientation === option.value}
                  onChange={() => handleGridOrientationChange(option.value)}
                />
                {option.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend>Category colours</legend>
        <ul className={styles.colourList}>
          {ALL_CATEGORIES.map((category) => {
            const inputId = `category-color-${category}`
            return (
              <li key={category} className={styles.categoryRow}>
                <input
                  id={inputId}
                  className={styles.swatch}
                  type="color"
                  value={categoryColors[category]}
                  onChange={(event) => handleColorChange(category, event.target.value)}
                />
                <label htmlFor={inputId}>{CATEGORY_LABELS[category]}</label>
                <button
                  type="button"
                  className={styles.resetButton}
                  aria-label={`Reset ${CATEGORY_LABELS[category]} colour to default`}
                  onClick={() => handleReset(category)}
                >
                  Reset to default
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <fieldset>
        <legend>Work days</legend>
        {workDayLoadError && (
          <p role="alert">
            {workDayLoadError}{' '}
            <button type="button" onClick={handleRetryWorkDayPattern}>
              Retry
            </button>
          </p>
        )}
        {workDaySaveError && <p role="alert">{workDaySaveError}</p>}
        {workDayPattern === null && !workDayLoadError && <output>Loading work days…</output>}
        {workDayPattern !== null && (
          <ul className={styles.themeList}>
            {WORK_DAYS.map((day) => (
              <li key={day.value}>
                <label>
                  <input
                    type="checkbox"
                    checked={workDayPattern.includes(day.value)}
                    onChange={() => handleToggleWorkDay(day.value)}
                  />
                  {day.label}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </section>
  )
}
