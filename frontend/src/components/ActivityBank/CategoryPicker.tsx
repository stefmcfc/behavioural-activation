import type { ActivityCategory } from '../../types/activity'

interface CategoryOption {
  value: ActivityCategory
  label: string
}

const CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { value: 'ROUTINE', label: 'Routine' },
  { value: 'NECESSARY', label: 'Necessary' },
  { value: 'PLEASURABLE', label: 'Pleasurable' },
]

interface CategoryPickerProps {
  readonly value: ActivityCategory | null
  readonly onChange: (category: ActivityCategory) => void
  readonly name?: string
}

export function CategoryPicker({ value, onChange, name = 'category' }: CategoryPickerProps) {
  return (
    <fieldset>
      <legend>Category</legend>
      {CATEGORY_OPTIONS.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}
