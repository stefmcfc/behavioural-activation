import { ActivityPickerList } from './ActivityPickerList'
import styles from './ActivityDrawer.module.css'

interface ActivityDrawerProps {
  readonly onDragStartActivity: (activityId: string) => void
  readonly onDragStartSubTask: (subTaskId: string) => void
  readonly onDragEnd: () => void
  readonly onClose: () => void
}

// FRONTEND-016 (Requirement 5): a drag-only activity/sub-task source, rendered beside TodayView's
// single-day grid/bucket column (not an overlay -- native HTML5 drag-and-drop needs the drag
// source and every drop target on-screen at once). Reintroduces frontend_spec_028's
// ActivityDrawer, removed from the Weekly Planner after real-use feedback (see that spec's
// "Post-ship correction" section), fixed here per this spec's Requirement 5: a visible drag
// affordance (AC-11, in ActivityDrawer.module.css) addresses the confirmed "no indication rows
// were draggable" finding; the Weekly Planner's 5-column illegible-squeeze problem doesn't apply
// to a single-day grid.
export function ActivityDrawer({
  onDragStartActivity,
  onDragStartSubTask,
  onDragEnd,
  onClose,
}: ActivityDrawerProps) {
  return (
    <aside aria-labelledby="activity-drawer-heading" className={styles.drawer}>
      <div className={styles.header}>
        <h3 id="activity-drawer-heading">Browse activities</h3>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <ActivityPickerList
        mode="drag"
        onDragStartActivity={onDragStartActivity}
        onDragStartSubTask={onDragStartSubTask}
        onDragEnd={onDragEnd}
      />
    </aside>
  )
}
