import { useSyncExternalStore, type CSSProperties } from 'react'
import type { ActivityCategory } from '../../types/activity'
import { getCategoryColor, subscribeToCategoryColorChanges } from '../../utils/categoryColors'
import { getReadableTextColor } from '../../utils/contrast'
import { CATEGORY_LABELS } from '../../utils/categoryLabels'
import styles from './CategoryPicker.module.css'

const ALL_CATEGORIES: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']

interface CategoryOptionProps {
  readonly category: ActivityCategory
  readonly checked: boolean
  readonly name: string
  readonly onChange: (category: ActivityCategory) => void
}

function CategoryOption({ category, checked, name, onChange }: CategoryOptionProps) {
  const backgroundColor = useSyncExternalStore(subscribeToCategoryColorChanges, () =>
    getCategoryColor(category),
  )
  const textColor = getReadableTextColor(backgroundColor)
  const style: CSSProperties | undefined = checked
    ? { backgroundColor, borderColor: backgroundColor, color: textColor }
    : undefined

  return (
    <label className={styles.option} style={style}>
      <input
        type="radio"
        name={name}
        value={category}
        checked={checked}
        onChange={() => onChange(category)}
      />
      {CATEGORY_LABELS[category]}
    </label>
  )
}

interface CategoryPickerProps {
  readonly value: ActivityCategory | null
  readonly onChange: (category: ActivityCategory) => void
  readonly name?: string
  /** Set once a submit attempt was made with no category chosen; cleared as soon as one is picked. */
  readonly invalid?: boolean
  /** Id of the error message element to associate via aria-describedby when `invalid` is true. */
  readonly errorId?: string
}

export function CategoryPicker({
  value,
  onChange,
  name = 'category',
  invalid = false,
  errorId,
}: CategoryPickerProps) {
  return (
    <fieldset
      className={styles.fieldset}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={invalid ? errorId : undefined}
    >
      <legend>Category</legend>
      <div className={styles.group}>
        {ALL_CATEGORIES.map((category) => (
          <CategoryOption
            key={category}
            category={category}
            checked={value === category}
            name={name}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  )
}
