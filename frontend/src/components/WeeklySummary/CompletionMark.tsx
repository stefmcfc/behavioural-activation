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
  // FRONTEND-055-AC-02: status stays in the accessible name even though the visual tooltip below
  // drops it -- the mark's ticked/unticked fill (FRONTEND-037-AC-03) conveys completion visually,
  // but a screen reader user only gets this button's own aria-label, not CompletionIcon's nested
  // one (overridden once an ancestor sets aria-label), so dropping it here would be a real loss of
  // information, not just redundant text.
  const notesHint = occurrence.notes ? `, note: ${occurrence.notes}` : ''
  // The completed checkmark renders via currentColor -- computed per the mark's own (user-
  // customizable, arbitrary) fill colour, same approach as CategoryChip's text, so the icon stays
  // legible against every possible category colour rather than assuming a fixed accent token.
  const iconColor = getReadableTextColor(color)

  return (
    <button
      type="button"
      className={shape === 'block' ? styles.block : styles.circle}
      style={{ backgroundColor: color, color: iconColor, opacity: occurrence.completed ? 1 : 0.55 }}
      aria-label={`${occurrence.name}, ${location}, ${status}${notesHint}`}
    >
      {occurrence.completed && <CompletionIcon />}
      {/* FRONTEND-055-AC-01: three stacked lines (name / location / notes) instead of one run-on
          sentence -- status is dropped here (not just reworded) since the mark's own ticked/
          unticked fill already conveys it visually, the same reasoning category relies on its
          fill colour alone for in this same tooltip. */}
      <span className={styles.tooltip} aria-hidden="true">
        <span className={styles.tooltipName}>{occurrence.name}</span>
        <span>{location}</span>
        {occurrence.notes && <span>Notes: {occurrence.notes}</span>}
      </span>
    </button>
  )
}
