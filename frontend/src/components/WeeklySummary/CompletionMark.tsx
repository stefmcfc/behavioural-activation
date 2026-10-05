import { useSyncExternalStore } from 'react'
import type { PlannedOccurrence } from '../../types/plan'
import { getCategoryColor, subscribeToCategoryColorChanges } from '../../utils/categoryColors'
import { getReadableTextColor } from '../../utils/contrast'
import { CompletionIcon } from '../icons/CompletionIcon'
import { DAY_LABELS, SLOT_LABELS } from '../WeeklyPlanner/planLabels'
import styles from './CompletionMark.module.css'

interface CompletionMarkProps {
  readonly occurrence: PlannedOccurrence
  readonly shape: 'block' | 'circle'
}

// FRONTEND-037: the shared mark used by Requirement 1's segmented completion bar (shape="block")
// and Requirement 2's lite grid/bucket (shape="circle"). Status (completed/not) is an opacity
// modulation of the occurrence's own category colour -- full strength when completed, the existing
// 0.55 "muted" treatment (frontend_spec_035) when not -- always paired with CompletionIcon, never
// colour alone (FRONTEND-037-AC-03). Every mark gets a fixed border regardless of fill colour
// (FRONTEND-037-AC-18, CompletionMark.module.css), since these marks are decorative-only and have
// no fallback text like CategoryChip's computed text colour.
export function CompletionMark({ occurrence, shape }: CompletionMarkProps) {
  const color = useSyncExternalStore(subscribeToCategoryColorChanges, () =>
    getCategoryColor(occurrence.category),
  )
  const location =
    occurrence.dayOfWeek !== null && occurrence.slot !== null
      ? `${DAY_LABELS[occurrence.dayOfWeek]} ${SLOT_LABELS[occurrence.slot]}`
      : 'Weekend bucket'
  const status = occurrence.completed ? 'completed' : 'not completed'
  // The completed checkmark renders via currentColor -- computed per the mark's own (user-
  // customizable, arbitrary) fill colour, same approach as CategoryChip's text, so the icon stays
  // legible against every possible category colour rather than assuming a fixed accent token.
  const iconColor = getReadableTextColor(color)

  return (
    <button
      type="button"
      className={shape === 'block' ? styles.block : styles.circle}
      style={{ backgroundColor: color, color: iconColor, opacity: occurrence.completed ? 1 : 0.55 }}
      aria-label={`${occurrence.name}, ${location}, ${status}`}
    >
      {occurrence.completed && <CompletionIcon />}
      <span className={styles.tooltip} aria-hidden="true">
        {occurrence.name} — {location}, {status}
      </span>
    </button>
  )
}
