import type { PlannedOccurrence } from '../../types/plan'
import type { CategoryFilter } from '../../utils/categoryFilter'

// FRONTEND-035: extracted out of WeeklyPlanner.tsx (rather than kept as a same-file named export
// alongside the WeeklyPlanner component) purely to keep that file fast-refresh-clean -- oxlint's
// react(only-export-components) rule flags a component file that also exports plain
// functions/constants. No behavioural reason for the split; WeeklyPlanner.test.tsx imports these
// directly for FRONTEND-035-AC-05's unit coverage.

export type StatusFilter = 'ALL' | 'COMPLETED' | 'NOT_COMPLETED'

export const STATUS_FILTER_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NOT_COMPLETED', label: 'Not completed' },
]

// FRONTEND-035-AC-05: an occurrence is dimmed when it fails to match either active filter -- a
// category filter other than "All" that differs from the occurrence's category, or a status
// filter that excludes the occurrence's current completed/not-completed state.
export function computeDimmedIds(
  occurrences: readonly PlannedOccurrence[],
  categoryFilter: CategoryFilter,
  statusFilter: StatusFilter,
): ReadonlySet<string> {
  const dimmed = new Set<string>()
  for (const occurrence of occurrences) {
    const categoryMismatch = categoryFilter !== 'ALL' && occurrence.category !== categoryFilter
    const statusMismatch =
      (statusFilter === 'COMPLETED' && !occurrence.completed) ||
      (statusFilter === 'NOT_COMPLETED' && occurrence.completed)
    if (categoryMismatch || statusMismatch) {
      dimmed.add(occurrence.id)
    }
  }
  return dimmed
}
