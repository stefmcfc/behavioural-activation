import { useState } from 'react'
import { ActivityDrawer } from './ActivityDrawer'
import { AssignActivityPicker } from './AssignActivityPicker'
import type { AssignTarget } from './AssignActivityPicker'
import { BucketList } from './BucketList'
import { Modal } from '../Modal/Modal'
import { PlannerGrid } from './PlannerGrid'
import { usePlanActions } from './usePlanActions'
import { useWorkDays } from './useWorkDays'
import { getMondayOfCurrentWeek, getTodayPlanDayOfWeek } from './planLabels'
import styles from './TodayView.module.css'

// FRONTEND-016: a dedicated single-day view of the real current week's plan -- always "today",
// regardless of whatever week a separately-mounted WeeklyPlanner instance has navigated to
// (AC-03/AC-08). Reuses PlannerGrid/BucketList unmodified (a single-day `days` array already
// produces a one-column grid) and shares the same occurrence fetch/assign/move/complete/undo/
// remove/carry-forward logic as WeeklyPlanner via usePlanActions, parameterized by this view's
// own (non-navigable) weekStart.
export function TodayView() {
  const weekStart = getMondayOfCurrentWeek()
  const plan = usePlanActions(weekStart)
  const workDays = useWorkDays(weekStart)
  const today = getTodayPlanDayOfWeek()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // FRONTEND-048: the drawer (drag-mode ActivityPickerList) and the Assign modal (select-mode
  // ActivityPickerList) are mutually exclusive -- opening one closes the other, so at most one
  // ActivityPickerList instance is ever mounted at a time.
  const handleToggleDrawer = () => {
    setDrawerOpen((open) => {
      const next = !open
      if (next) {
        plan.handleCloseAssign()
      }
      return next
    })
  }

  const handleRequestAssign = (target: AssignTarget) => {
    setDrawerOpen(false)
    plan.setAssignTarget(target)
  }

  return (
    <section>
      <h2>Today</h2>

      <div className={styles.toolbar}>
        <button type="button" onClick={handleToggleDrawer}>
          Browse activities
        </button>
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          {plan.loadError && (
            <p role="alert">
              {plan.loadError}{' '}
              <button type="button" onClick={plan.handleRetry}>
                Retry
              </button>
            </p>
          )}
          {plan.actionError && <p role="alert">{plan.actionError}</p>}
          {workDays.actionError && <p role="alert">{workDays.actionError}</p>}

          {plan.occurrences === null && !plan.loadError && <output>Loading plan…</output>}

          {plan.occurrences !== null && (
            <>
              <PlannerGrid
                weekStart={weekStart}
                days={[today]}
                heading="Today's plan"
                emptyMessage="No activities planned for today."
                occurrences={plan.occurrences}
                busyId={plan.busyId}
                detailOpenId={plan.detailOpenId}
                confirmingRemoveId={plan.confirmingRemoveId}
                movingId={plan.movingId}
                todayColumn={today}
                workDays={workDays.workDaysByDate}
                onToggleWorkDay={workDays.handleToggle}
                onAdd={(dayOfWeek, slot) => handleRequestAssign({ dayOfWeek, slot })}
                onOpenDetail={plan.handleOpenDetail}
                onCloseDetail={plan.handleCloseDetail}
                onStartRemove={plan.setConfirmingRemoveId}
                onConfirmRemove={plan.handleConfirmRemove}
                onCancelRemove={() => plan.setConfirmingRemoveId(null)}
                onStartMove={plan.setMovingId}
                onCancelMove={() => plan.setMovingId(null)}
                onConfirmMove={(id, dayOfWeek, slot) => plan.handleMove(id, { dayOfWeek, slot })}
                onMoveToBucket={(id) => plan.handleMove(id, { dayOfWeek: null, slot: null })}
                onComplete={plan.handleComplete}
                onUndo={plan.handleUndo}
                onUpdateNotes={plan.handleUpdateNotes}
                dragPayload={plan.dragPayload}
                onDragStart={(id) => plan.setDragPayload({ kind: 'occurrence', id })}
                onDragEnd={plan.handleDragEnd}
                onAssignFromDrawer={plan.handleAssignFromDrawer}
              />

              <BucketList
                occurrences={plan.occurrences}
                busyId={plan.busyId}
                detailOpenId={plan.detailOpenId}
                confirmingRemoveId={plan.confirmingRemoveId}
                movingId={plan.movingId}
                reorderInFlight={plan.bucketReorderInFlight}
                onAdd={() => handleRequestAssign({ dayOfWeek: null, slot: null })}
                onOpenDetail={plan.handleOpenDetail}
                onCloseDetail={plan.handleCloseDetail}
                onStartRemove={plan.setConfirmingRemoveId}
                onConfirmRemove={plan.handleConfirmRemove}
                onCancelRemove={() => plan.setConfirmingRemoveId(null)}
                onStartMove={plan.setMovingId}
                onCancelMove={() => plan.setMovingId(null)}
                onConfirmMove={(id, dayOfWeek, slot) => plan.handleMove(id, { dayOfWeek, slot })}
                onMoveToBucket={(id) => plan.handleMove(id, { dayOfWeek: null, slot: null })}
                onComplete={plan.handleComplete}
                onUndo={plan.handleUndo}
                onCarryForward={plan.handleCarryForward}
                onUpdateNotes={plan.handleUpdateNotes}
                onReorder={plan.handleReorderBucket}
                dragPayload={plan.dragPayload}
                onDragStart={(id) => plan.setDragPayload({ kind: 'occurrence', id })}
                onDragEnd={plan.handleDragEnd}
                onAssignFromDrawer={plan.handleAssignFromDrawer}
              />
            </>
          )}
        </div>

        {drawerOpen && (
          <ActivityDrawer
            onDragStartActivity={(activityId) => plan.setDragPayload({ kind: 'activity', activityId })}
            onDragStartSubTask={(subTaskId) => plan.setDragPayload({ kind: 'subtask', subTaskId })}
            onDragEnd={plan.handleDragEnd}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </div>

      <Modal isOpen={plan.assignTarget !== null} titleId="assign-picker-title" onClose={plan.handleCloseAssign}>
        {plan.assignTarget && (
          <AssignActivityPicker
            weekStart={weekStart}
            target={plan.assignTarget}
            onSuccess={plan.handleAssignSuccess}
            onCancel={plan.handleCloseAssign}
          />
        )}
      </Modal>
    </section>
  )
}
