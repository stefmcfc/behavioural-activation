// FRONTEND-028: the lifted drag state shared between PlannerGrid, BucketList, and the new
// ActivityDrawer. Widens frontend_spec_026's bare `draggedId: string | null` (always an existing
// PlannedOccurrence id) into a discriminated union so a drawer-origin drag (no occurrence yet) can
// be represented too.
export type DragPayload =
  | { readonly kind: 'occurrence'; readonly id: string }
  | { readonly kind: 'activity'; readonly activityId: string }
  | { readonly kind: 'subtask'; readonly subTaskId: string }
