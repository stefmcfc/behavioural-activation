import type { ActivityCategory } from '../types/activity'

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  ROUTINE: 'Routine',
  NECESSARY: 'Necessary',
  PLEASURABLE: 'Pleasurable',
}

// Fixed display order, matching CATEGORY_LABELS' own key order.
export const CATEGORY_ORDER: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']
