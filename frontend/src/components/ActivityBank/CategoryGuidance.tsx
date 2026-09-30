import { CATEGORY_LABELS } from '../../utils/categoryLabels'
import { CATEGORY_GUIDANCE } from '../../utils/categoryGuidance'
import type { ActivityCategory } from '../../types/activity'
import styles from './CategoryGuidance.module.css'

const ALL_CATEGORIES: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']

export function CategoryGuidance() {
  return (
    <div className={styles.guidance}>
      {ALL_CATEGORIES.map((category) => (
        <p key={category}>
          <strong>{CATEGORY_LABELS[category]}</strong> — {CATEGORY_GUIDANCE[category].purpose}{' '}
          <em>Example: {CATEGORY_GUIDANCE[category].example}</em>
        </p>
      ))}
      <p>
        The same activity can belong to a different category depending on why you're doing it — a
        walk can be Routine one day and Pleasurable another.
      </p>
    </div>
  )
}
