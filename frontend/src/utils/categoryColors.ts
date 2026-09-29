import type { ActivityCategory } from '../types/activity'

const STORAGE_KEY = 'bap-category-colors'
const CHANGE_EVENT = 'bap-category-colors-changed'

function notifyChange(): void {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

/**
 * Subscribes to category-colour changes made via `setCategoryColor`/`resetCategoryColor`
 * (including changes made by other mounted components), so every `CategoryChip` can re-render
 * with the new colour immediately, without a page reload. Returns an unsubscribe function.
 */
export function subscribeToCategoryColorChanges(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener)
  return () => window.removeEventListener(CHANGE_EVENT, listener)
}

/** Okabe-Ito colourblind-safe palette defaults. */
export const DEFAULT_CATEGORY_COLORS: Record<ActivityCategory, string> = {
  ROUTINE: '#0072B2',
  NECESSARY: '#E69F00',
  PLEASURABLE: '#009E73',
}

type CategoryColorOverrides = Partial<Record<ActivityCategory, string>>

function readOverrides(): CategoryColorOverrides {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as CategoryColorOverrides
    }
    return {}
  } catch {
    return {}
  }
}

function writeOverrides(overrides: CategoryColorOverrides): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

/** Returns the stored override for a category, or its built-in default if none is stored. */
export function getCategoryColor(category: ActivityCategory): string {
  const overrides = readOverrides()
  return overrides[category] ?? DEFAULT_CATEGORY_COLORS[category]
}

/** Persists a new hex override for a category, leaving other categories' overrides untouched. */
export function setCategoryColor(category: ActivityCategory, hex: string): void {
  const overrides = readOverrides()
  overrides[category] = hex
  writeOverrides(overrides)
  notifyChange()
}

/** Removes a category's stored override, reverting it to the built-in default. */
export function resetCategoryColor(category: ActivityCategory): void {
  const overrides = readOverrides()
  delete overrides[category]
  writeOverrides(overrides)
  notifyChange()
}
