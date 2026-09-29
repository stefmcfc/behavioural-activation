import { useEffect, useState } from 'react'
import type { ActivityCategory } from '../../types/activity'
import { CATEGORY_LABELS } from '../../utils/categoryLabels'
import {
  DEFAULT_CATEGORY_COLORS,
  getCategoryColor,
  resetCategoryColor,
  setCategoryColor,
  subscribeToCategoryColorChanges,
} from '../../utils/categoryColors'
import { getThemePreference, setThemePreference, type ThemePreference } from '../../utils/theme'
import styles from './Settings.module.css'

const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
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
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    getThemePreference(),
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
    setThemePreference(preference)
    setThemePreferenceState(preference)
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
        {THEME_OPTIONS.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="theme-preference"
              value={option.value}
              checked={themePreference === option.value}
              onChange={() => handleThemeChange(option.value)}
            />
            {option.label}
          </label>
        ))}
        {themePreference === 'system' && (
          <p>Currently: {systemPrefersDark ? 'Dark' : 'Light'}</p>
        )}
      </fieldset>

      <fieldset>
        <legend>Category colours</legend>
        {ALL_CATEGORIES.map((category) => {
          const inputId = `category-color-${category}`
          return (
            <div key={category} className={styles.categoryRow}>
              <label htmlFor={inputId}>{CATEGORY_LABELS[category]} colour</label>
              <input
                id={inputId}
                type="color"
                value={categoryColors[category]}
                onChange={(event) => handleColorChange(category, event.target.value)}
              />
              <button type="button" onClick={() => handleReset(category)}>
                Reset {CATEGORY_LABELS[category]} to default
              </button>
              <span className={styles.defaultHint}>
                Default: {DEFAULT_CATEGORY_COLORS[category]}
              </span>
            </div>
          )
        })}
      </fieldset>
    </section>
  )
}
