import { useSyncExternalStore } from 'react'
import type { ActivityCategory } from '../../types/activity'
import { CATEGORY_LABELS } from '../../utils/categoryLabels'
import { getCategoryColor, subscribeToCategoryColorChanges } from '../../utils/categoryColors'
import { getReadableTextColor } from '../../utils/contrast'
import styles from './CategoryGroupHeading.module.css'

interface CategoryGroupHeadingProps {
  readonly category: ActivityCategory
}

// FRONTEND-040-AC-09: same live-updating colour/contrast pattern CategoryChip already uses, so a
// Settings colour change applies here immediately too, no reload.
export function CategoryGroupHeading({ category }: CategoryGroupHeadingProps) {
  const backgroundColor = useSyncExternalStore(subscribeToCategoryColorChanges, () =>
    getCategoryColor(category),
  )
  const color = getReadableTextColor(backgroundColor)

  return (
    <h4 className={styles.groupHeading} style={{ backgroundColor, color }}>
      {CATEGORY_LABELS[category]}
    </h4>
  )
}
