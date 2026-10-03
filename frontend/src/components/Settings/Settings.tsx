import { useEffect, useState } from 'react'
import type { ActivityCategory } from '../../types/activity'
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
  const [gridOrientation, setGridOrientationState] = useState<GridOrientation>(() =>
    getGridOrientation(),
  )
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => getSystemPrefersDark())
  const [categoryColors, setCategoryColors] = useState<Record<ActivityCategory, string>>(() =>
    getCategoryColorSnapshot(),
  )

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

  const handleThemeChange = (preference: ThemePreference) => {
    persistThemePreference(preference)
    setThemePreference(preference)
  }

  const handleGridOrientationChange = (orientation: GridOrientation) => {
    persistGridOrientation(orientation)
    setGridOrientationState(orientation)
  }

  const handleColorChange = (category: ActivityCategory, hex: string) => {
    setCategoryColor(category, hex)
  }

  const handleReset = (category: ActivityCategory) => {
    resetCategoryColor(category)
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
    </section>
  )
}
