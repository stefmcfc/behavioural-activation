export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'bap-theme-preference'

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** Reads the stored theme preference, treating a missing or invalid value as "system". */
export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  return isThemePreference(stored) ? stored : 'system'
}

function applyDataTheme(preference: ThemePreference): void {
  if (preference === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', preference)
  }
}

/**
 * Reads `bap-theme-preference` from `localStorage` (treating a missing or invalid value as
 * "system") and sets/removes the `data-theme` attribute on `document.documentElement`
 * accordingly. Synchronous, and intended to be called at the top of `main.tsx` before
 * `createRoot(...).render()` so the correct theme is applied before first paint.
 */
export function applyStoredTheme(): void {
  applyDataTheme(getThemePreference())
}

/** Persists the theme preference to `localStorage` and applies it immediately. */
export function setThemePreference(preference: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, preference)
  applyDataTheme(preference)
}
