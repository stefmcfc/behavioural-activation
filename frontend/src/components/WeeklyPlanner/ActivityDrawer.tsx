import { ActivityPickerList } from './ActivityPickerList'
import styles from './ActivityDrawer.module.css'

interface ActivityDrawerProps {
  readonly onDragStartActivity: (activityId: string) => void
  readonly onDragStartSubTask: (subTaskId: string) => void
  readonly onDragEnd: () => void
  readonly onClose: () => void
}

// FRONTEND-028: a drag-only activity/sub-task source, rendered beside the grid/bucket column
// (not an overlay -- see frontend_spec_028's Overview for why: native HTML5 drag-and-drop needs
// the drag source and every drop target on-screen at once).
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
