import { useSyncExternalStore } from 'react'
import type { ActivityCategory } from '../../types/activity'
import { getCategoryColor, subscribeToCategoryColorChanges } from '../../utils/categoryColors'
import { getReadableTextColor } from '../../utils/contrast'
import { CATEGORY_LABELS } from '../../utils/categoryLabels'
import styles from './CategoryChip.module.css'

interface CategoryChipProps {
  readonly category: ActivityCategory
}

export function CategoryChip({ category }: CategoryChipProps) {
  const backgroundColor = useSyncExternalStore(subscribeToCategoryColorChanges, () =>
    getCategoryColor(category),
  )
  const textColor = getReadableTextColor(backgroundColor)

  return (
    <span
      className={styles.chip}
      data-testid={`category-chip-${category}`}
      style={{ backgroundColor, color: textColor }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  )
}
