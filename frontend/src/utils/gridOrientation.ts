export type GridOrientation = 'day-columns' | 'day-rows'

const STORAGE_KEY = 'bap-grid-orientation'

function isGridOrientation(value: string | null): value is GridOrientation {
  return value === 'day-columns' || value === 'day-rows'
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
 * Persists the grid-orientation preference to localStorage. Unlike `theme.ts`, there is no
 * `applyStored...()` counterpart called from `main.tsx` — orientation only affects `PlannerGrid`'s
 * own render output, not anything paint-order-sensitive at the document level, so a mount-time
 * `useState(() => getGridOrientation())` read inside `PlannerGrid` is sufficient (FRONTEND-012-AC-10).
 */
export function setGridOrientation(orientation: GridOrientation): void {
  localStorage.setItem(STORAGE_KEY, orientation)
}
