export type GridOrientation = 'day-columns' | 'day-rows'

const STORAGE_KEY = 'bap-grid-orientation'
const CHANGE_EVENT = 'bap-grid-orientation-changed'

function isGridOrientation(value: string | null): value is GridOrientation {
  return value === 'day-columns' || value === 'day-rows'
}

function notifyChange(): void {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

/**
 * Subscribes to grid-orientation changes made via `setGridOrientation` (including changes made by
 * other mounted components, e.g. the Settings popover sitting over the current page), so any
 * mounted `PlannerGrid` can re-render with the new orientation immediately, without a page reload.
 * Returns an unsubscribe function. Mirrors `utils/categoryColors.ts`'s
 * `subscribeToCategoryColorChanges()` exactly.
 */
export function subscribeToGridOrientationChanges(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener)
  return () => window.removeEventListener(CHANGE_EVENT, listener)
}

/**
 * Reads the stored grid-orientation preference, treating a missing or invalid value as
 * "day-columns" — today's only layout, preserved as the default so existing users see no change.
 */
export function getGridOrientation(): GridOrientation {
  const stored = localStorage.getItem(STORAGE_KEY)
  return isGridOrientation(stored) ? stored : 'day-columns'
}

/**
 * Persists the grid-orientation preference to localStorage and notifies any subscribed listeners
 * (e.g. a mounted `PlannerGrid`) so they can re-render with the new value immediately. Unlike
 * `theme.ts`, there is no `applyStored...()` counterpart called from `main.tsx` — orientation only
 * affects `PlannerGrid`'s own render output, not anything paint-order-sensitive at the document
 * level.
 */
export function setGridOrientation(orientation: GridOrientation): void {
  localStorage.setItem(STORAGE_KEY, orientation)
  notifyChange()
}
