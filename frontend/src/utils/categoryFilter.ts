import type { ActivityCategory } from '../types/activity'
import { CATEGORY_LABELS } from './categoryLabels'

export type CategoryFilter = 'ALL' | ActivityCategory

export const CATEGORY_FILTER_OPTIONS: readonly { value: CategoryFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ROUTINE', label: CATEGORY_LABELS.ROUTINE },
  { value: 'NECESSARY', label: CATEGORY_LABELS.NECESSARY },
  { value: 'PLEASURABLE', label: CATEGORY_LABELS.PLEASURABLE },
]
