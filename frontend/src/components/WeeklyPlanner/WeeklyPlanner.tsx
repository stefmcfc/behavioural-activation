import { useState } from 'react'
import { AssignActivityPicker } from './AssignActivityPicker'
import { BucketList } from './BucketList'
import { Modal } from '../Modal/Modal'
import { PlannerGrid } from './PlannerGrid'
import { usePlanActions } from './usePlanActions'
import {
  WEEKDAY_DAYS,
  WEEKEND_DAYS,
  formatDate,
  getMondayOfCurrentWeek,
  getTodayPlanDayOfWeek,
  parseWeekStart,
} from './planLabels'
import styles from './WeeklyPlanner.module.css'

function shiftWeek(weekStart: string, days: number): string {
  const date = parseWeekStart(weekStart)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

function formatWeekCommencing(weekStart: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseWeekStart(weekStart))
}

function ChevronIcon({ direction }: { readonly direction: 'left' | 'right' }) {
  const points = direction === 'left' ? '10,2 4,8 10,14' : '6,2 12,8 6,14'
  return (
    <svg className={styles.chevronIcon} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type GridTab = 'WEEKDAYS' | 'WEEKEND'

function getDefaultGridTab(): GridTab {
  const day = new Date().getDay()
  return day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAYS'
}

export function WeeklyPlanner() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfCurrentWeek())
  const [gridTab, setGridTab] = useState<GridTab>(() => getDefaultGridTab())
  const plan = usePlanActions(weekStart)
  const todayColumn = weekStart === getMondayOfCurrentWeek() ? getTodayPlanDayOfWeek() : null

  const handlePreviousWeek = () => {
    plan.resetForRefetch()
    setWeekStart((current) => shiftWeek(current, -7))
  }

  const handleNextWeek = () => {
    plan.resetForRefetch()
    setWeekStart((current) => shiftWeek(current, 7))
  }

  return (
    <section>
      <h2>Weekly planner</h2>

      <div className={styles.weekNav}>
        <button
          type="button"
          className={styles.navButton}
          onClick={handlePreviousWeek}
          aria-label="Previous week"
        >
          <ChevronIcon direction="left" />
        </button>
        <span>Week Commencing {formatWeekCommencing(weekStart)}</span>
        <button
          type="button"
          className={styles.navButton}
          onClick={handleNextWeek}
          aria-label="Next week"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      {plan.loadError && (
        <p role="alert">
          {plan.loadError}{' '}
          <button type="button" onClick={plan.handleRetry}>
            Retry
          </button>
        </p>
      )}
      {plan.actionError && <p role="alert">{plan.actionError}</p>}

      {plan.occurrences === null && !plan.loadError && <output>Loading plan…</output>}

      {plan.occurrences !== null && (
        <>
          <fieldset className={styles.tabFieldset}>
            <legend>View</legend>
            <div className={styles.tabGroup}>
              <label className={styles.tabOption}>
                <input
                  type="radio"
                  name="grid-tab"
                  checked={gridTab === 'WEEKDAYS'}
                  onChange={() => setGridTab('WEEKDAYS')}
                />{' '}
                Weekdays
              </label>
              <label className={styles.tabOption}>
                <input
                  type="radio"
                  name="grid-tab"
                  checked={gridTab === 'WEEKEND'}
                  onChange={() => setGridTab('WEEKEND')}
                />{' '}
                Weekend
              </label>
            </div>
          </fieldset>

          <PlannerGrid
            weekStart={weekStart}
            days={gridTab === 'WEEKDAYS' ? WEEKDAY_DAYS : WEEKEND_DAYS}
            heading={gridTab === 'WEEKDAYS' ? 'Week grid' : 'Weekend grid'}
            emptyMessage={
              gridTab === 'WEEKDAYS'
                ? 'No activities planned for this week.'
                : 'No activities planned for the weekend.'
            }
            occurrences={plan.occurrences}
            busyId={plan.busyId}
            detailOpenId={plan.detailOpenId}
            confirmingRemoveId={plan.confirmingRemoveId}
            movingId={plan.movingId}
            todayColumn={todayColumn}
            onAdd={(dayOfWeek, slot) => plan.setAssignTarget({ dayOfWeek, slot })}
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
            dragPayload={plan.dragPayload}
            onDragStart={(id) => plan.setDragPayload({ kind: 'occurrence', id })}
            onDragEnd={plan.handleDragEnd}
          />

          <BucketList
            occurrences={plan.occurrences}
            busyId={plan.busyId}
            detailOpenId={plan.detailOpenId}
            confirmingRemoveId={plan.confirmingRemoveId}
            movingId={plan.movingId}
            reorderInFlight={plan.bucketReorderInFlight}
            onAdd={() => plan.setAssignTarget({ dayOfWeek: null, slot: null })}
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
            onReorder={plan.handleReorderBucket}
            dragPayload={plan.dragPayload}
            onDragStart={(id) => plan.setDragPayload({ kind: 'occurrence', id })}
            onDragEnd={plan.handleDragEnd}
          />
        </>
      )}

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
