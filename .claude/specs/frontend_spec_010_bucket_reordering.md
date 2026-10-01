# Weekend Bucket List Manual Reordering (Frontend)

**Status**: Implemented (2026-10-01) — all 16 ACs green. `FRONTEND-010-AC-08` (real-mouse
drag-and-drop) couldn't be automated (tooling limitation — see Summary) but was manually confirmed
by the user (2026-10-01).
**Priority**: P2 — chunk 3a of the Weekly Planner UX batch raised after
`frontend_spec_006_repeatable_activities.md` shipped. Chunks 1–2 (occurrence detail card, "Add"
picker modal — `frontend_spec_008_occurrence_detail_card.md`, `frontend_spec_009_add_picker_modal.md`)
were specced but not yet implemented when this spec was originally written — **both have since
shipped** (2026-09-30), before this spec's own implementation; see Summary for how that affected the
real prop shape this spec's implementation was written against. Chunk 3b (automatic carry-forward of
stale bucket items) is a separate, independent spec pair —
`planner_spec_011_bucket_carry_forward_automation.md` and possibly a paired frontend spec — with no
dependency on this one in either direction.
**Depends on**: `planner_spec_010_bucket_reordering.md` (paired backend spec — `bucketPosition`,
`PUT /api/v1/plan/bucket/order`), `frontend_spec_004_week_planning.md` (origin of `BucketList.tsx`,
`OccurrenceItem.tsx`, `WeeklyPlanner.tsx`, `PlannerGrid.tsx`, `planApi`, `types/plan.ts`),
`frontend_spec_007_visual_refresh.md` (CSS Modules + theme custom-properties convention this spec's
new drag-handle/button styles follow), `frontend_spec_008_occurrence_detail_card.md` (its
`FRONTEND-008-AC-01` at-rest-tile contract is amended, additively, by this spec — see Requirement 5
below; was not yet implemented when this spec was originally written, **since shipped** — see Summary
for how the real `detailOpenId`/`onOpenDetail` shape it introduced was reconciled with this spec's
new reorder props during implementation)
**Area**: Frontend
**Roadmap version**: V1 (extends the weekend bucket list UX from `product.md`'s V1 row / US-007
"Create a weekend bucket list" — not V2's tracking/reflection scope, and not AI)

## Summary

Implemented per the spec's own sketches, with one real bug found and fixed in them:

- **`handleDrop`'s index math in the spec's own sketch was wrong** against its own
  `FRONTEND-010-AC-07` test case. The sketch computed the drop target's index *within the
  dragged-item-removed array*, which for dragging the first item onto the third (order `a,b,c`)
  produces `[b,a,c]`, not the sketch's own asserted `[b,c,a]`. Fixed by computing the target's index
  in the *original* full list, before removing the dragged item, then splicing into the
  dragged-removed array at that index — verified by hand-tracing the corrected math against the
  exact scenario in `FRONTEND-010-AC-07`'s test, which now passes with the sketch's original
  (correct) expected assertion unchanged.
- `OccurrenceItem`/`BucketList`'s real current prop lists already included `detailOpenId`/
  `onOpenDetail`/`onCloseDetail` from `frontend_spec_008_occurrence_detail_card.md`, which hadn't
  shipped yet when this spec was written — kept those intact alongside the new reorder props.
- CSS: `.dragHandle` is a quiet, secondary affordance (`opacity: 0.6`, `cursor: grab`/`grabbing`) so
  it doesn't compete visually with the name/category/complete-button; `.moveButton` matches this
  file's existing small-inline-button treatment (hover/focus-visible via `--accent-bg`/
  `--accent-border`/`--accent-ink`), with a `disabled` state at `opacity: 0.4`.
- Full suite: 299 Vitest tests (up from 286), 0 regressions; `oxlint`/`tsc -b --noEmit` clean —
  independently re-run, not just trusting the implementing agent's own report.
- Real-browser verified (Light + Dark, live dev data, after restarting the backend to pick up the
  new migration/endpoint): the grip handle and Move up/down controls render on every bucket row;
  Move up/down disabled correctly at the list boundaries; clicking Move down swapped "Apply for
  jobs"/"Go for a walk" and the new order **persisted across a full page reload**, confirming the
  real `PUT /api/v1/plan/bucket/order` round-trip (not just client-side state).
- **`FRONTEND-010-AC-08` (a real mouse drag gesture) could not be verified by Claude.** The available
  Chrome-automation tool's drag primitive synthesizes a plain mouse-selection drag, not a native
  HTML5 `draggable`/`dragstart` gesture — attempting it over the grip handle produced a text-selection
  highlight, not a reorder, confirming the gesture never reached the `onDragStart` handler. This
  matches a real, known limitation of CDP-level mouse-event synthesis against native HTML5 DnD, not a
  bug in the implementation — the underlying drop-handler logic this gesture would exercise is
  already covered by `FRONTEND-010-AC-07`'s automated test (dispatching real `dragstart`/`drop` DOM
  events directly, which passes). **The user manually confirmed the real drag gesture themselves
  (2026-10-01)**, closing out the one gap this tooling limitation left open.

## Overview

Consumes `planner_spec_010_bucket_reordering.md`'s new `bucketPosition` field and
`PUT /api/v1/plan/bucket/order` endpoint to let a user arrange their own weekend bucket list order,
instead of always seeing it in whatever order the API happens to return. This ties back to
`.claude/HIGH_LEVEL_DESIGN.md`'s US-007 ("Create a weekend bucket list") — the same user story
`frontend_spec_004_week_planning.md` delivered the first version of; this spec adds manual ordering
to that same flexible list without changing how items enter or leave it.

Two ways to reorder, both driving the same underlying action:

1. **Drag-and-drop** — the first drag-and-drop interaction in this codebase (confirmed via `Grep`
   across `frontend/src/`: no DnD library, no hand-rolled DnD code anywhere). Implemented with the
   native HTML5 Drag and Drop API (`draggable`, `onDragStart`/`onDragOver`/`onDrop`) — no new
   dependency, matching this project's established precedent of reaching for a native platform
   primitive first (`frontend_spec_008_occurrence_detail_card.md`'s inline SVG icon,
   `frontend_spec_009_add_picker_modal.md`'s native `<dialog>`).
2. **Up/down move buttons** — a keyboard-accessible fallback, confirmed necessary because native
   HTML5 drag-and-drop has no keyboard equivalent, and this app has consistently added accessible
   alternatives elsewhere (see the two precedents just listed).

Both paths compute the same thing — the bucket's full new id order — and call one shared reorder
action, so they can never drift out of sync with each other (Requirement 2).

**Scope**: reordering applies within the weekend bucket list only. It does not touch
`PlannerGrid.tsx`'s click-to-assign flow, and it is unrelated to the separate, still-unconfirmed
"drag an activity onto a grid day/slot to assign it" idea in `.claude/ideas/future_ideas.md`
(Requirement 7).

**Tile-conflict with `frontend_spec_008_occurrence_detail_card.md`, resolved**:
`frontend_spec_008_occurrence_detail_card.md`'s `FRONTEND-008-AC-01` (not yet implemented) states
that `OccurrenceItem`'s at-rest tile renders *only* an exhaustive, closed list — an interactive name
control, `CategoryChip`, a completion indicator, and a one-click Complete/Undo control — with "Move,
Move to bucket, Remove, and Carry forward shall not be rendered" at rest. This spec's drag handle and
Move up/Move down controls are new tile-level UI that isn't in that enumerated list. Since neither
spec is implemented yet, `FRONTEND-008-AC-01`'s text has been directly updated (ID unchanged, per
`.claude/steering/ears_format.md`'s "Reference IDs are immutable" rule — only the ID itself is
protected from renumbering/deletion, not the statement text, matching the precedent already set by
`frontend_spec_006_repeatable_activities.md`'s `FRONTEND-006-AC-09`, which was edited in place the
same way) to note this spec's addition. `FRONTEND-010-AC-15` below states this spec's own side of
that same contract.

**Out of scope**: automatic carry-forward (separate spec, no frontend dependency here — see header).
The occurrence detail card itself and its parent-activity-name/completion-icon/today-highlight
requirements (`frontend_spec_008_occurrence_detail_card.md`, separate — this spec resolves the one
point of tile-content conflict above and touches nothing else in that spec). The "Add" picker modal
(`frontend_spec_009_add_picker_modal.md`, separate). Drag-to-assign onto the grid
(`.claude/ideas/future_ideas.md`, unconfirmed, separate). No change to `PlannerGrid.tsx`.

## Requirements

### Requirement 1 — Bucket items render in their persisted manual order

As a user, I want my weekend bucket list to show up in the order I last arranged it, not whatever
order the server happened to return it in.

- **FRONTEND-010-AC-01** [AUTO]: `BucketList` shall render bucket occurrences ordered by
  `bucketPosition` ascending, not by the raw array order `occurrences` arrives in.

### Requirement 2 — Drag handle and up/down controls, one shared reorder action

As a user, I want to rearrange my bucket list either by dragging an item where I want it, or — if I'd
rather not use a mouse — by nudging it up or down with a button, and I want both to behave
identically.

- **FRONTEND-010-AC-02** [AUTO]: For each bucket item, `OccurrenceItem` shall render a `draggable`
  grip-handle element (an inline SVG icon, `aria-hidden="true"` since dragging has no independent
  keyboard-operable affordance — the Move up/Move down buttons are the accessible path for the same
  action) directly on the row, always visible, not gated behind any detail card or other
  click-to-reveal state.
- **FRONTEND-010-AC-03** [AUTO]: For each bucket item, `OccurrenceItem` shall render "Move up" and
  "Move down" buttons, each with an accessible name identifying the item (e.g. `Move {name} up`),
  directly on the row, always visible, not gated behind any detail card or other click-to-reveal
  state.
- **FRONTEND-010-AC-04** [AUTO]: The "Move up" button shall be disabled, and a no-op if activated
  regardless, for the first item in the bucket's current order.
- **FRONTEND-010-AC-05** [AUTO]: The "Move down" button shall be disabled, and a no-op if activated
  regardless, for the last item in the bucket's current order.
- **FRONTEND-010-AC-06** [AUTO]: When "Move up" or "Move down" is activated for a bucket item,
  `BucketList` shall compute the full new order (that item swapped with its immediate neighbour in
  the requested direction) and invoke one shared `onReorder(occurrenceIds)` action with the complete
  ordered id list.
- **FRONTEND-010-AC-07** [AUTO]: When a drop event fires on a bucket item's row with a different
  bucket item as the active drag source, `BucketList` shall compute the full new order (the dragged
  item relocated to the drop target's position, everything else keeping its relative order) and
  invoke the same `onReorder(occurrenceIds)` action used by the Move up/Move down buttons.
- **FRONTEND-010-AC-08** [MANUAL]: A real mouse drag-and-drop gesture (press the grip handle, drag,
  release over another row) visibly reorders the bucket list in a real browser — verified manually,
  since jsdom does not render or reliably simulate a native HTML5 drag-and-drop physical mouse
  interaction; `FRONTEND-010-AC-07`'s automated test exercises the same underlying drop-handler logic
  by simulating `dragstart`/`drop` DOM events directly rather than a full OS-level drag gesture. Route
  to automating later: a real-browser e2e tool (e.g. Playwright), not yet part of this project's
  toolchain.

### Requirement 3 — Submitting the new order, and not showing a wrong order if it fails

As a user, I want my reordering to actually be saved, and I don't want to see a list order that
wasn't really accepted by the server.

- **FRONTEND-010-AC-09** [AUTO]: `planApi` shall expose `reorderBucket(weekStart, occurrenceIds)`,
  calling `PUT /plan/bucket/order` with `{ weekStart, occurrenceIds }` and resolving with the updated
  `PlannedOccurrence[]`.
- **FRONTEND-010-AC-10** [AUTO]: When `onReorder` is invoked (from either the drag-drop or
  Move up/Move down path), `WeeklyPlanner` shall await `planApi.reorderBucket(...)` before updating
  its `occurrences` state with the returned reordered items — the displayed order is never applied
  ahead of the server's response. This matches this codebase's existing `handleMove`/`handleComplete`
  await-then-update pattern; no optimistic-update precedent exists anywhere else in this codebase to
  follow instead, and every mutation here is a low-latency same-origin call, so waiting for the
  response costs negligible perceived delay against the benefit of never showing an order the server
  didn't actually persist.
- **FRONTEND-010-AC-11** [AUTO]: While a reorder request is in flight, `BucketList` shall disable
  every bucket item's drag handle and Move up/Move down buttons — a single in-flight flag covering
  the whole bucket (not the existing per-item `busyId`, since one reorder call can touch every item
  in the list at once, not just one occurrence) — preventing overlapping reorder requests.
- **FRONTEND-010-AC-12** [AUTO]: If `planApi.reorderBucket()` rejects, then `WeeklyPlanner` shall set
  its existing `actionError` state to the resolved error message and render it via the existing
  `role="alert"` element, matching `getErrorMessage()`'s existing handling.
- **FRONTEND-010-AC-13** [AUTO]: If `planApi.reorderBucket()` rejects, then `BucketList` shall
  continue rendering the bucket in its previous (pre-attempted-reorder) order — a direct consequence
  of `FRONTEND-010-AC-10`'s wait-for-response design, restated here as an explicit regression guard:
  a rejected reorder must never leave the displayed list showing an order the server didn't actually
  accept.

### Requirement 4 — Type and service contract

As a developer, I want the frontend's `PlannedOccurrence` type to match the backend's response shape
exactly, so a manual order can round-trip without drift.

- **FRONTEND-010-AC-14** [AUTO]: The `PlannedOccurrence` type shall declare a new
  `bucketPosition: number | null` field, matching `planner_spec_010_bucket_reordering.md`'s
  `PlannedOccurrenceResponse.bucketPosition` 1:1.

### Requirement 5 — Reorder controls are never hidden behind a detail card

As a user, reordering — like marking something complete — is something I do often; I don't want an
extra click to reveal the controls for it every single time.

- **FRONTEND-010-AC-15** [AUTO]: A bucket item's drag handle and Move up/Move down controls shall
  always render directly on its at-rest row, never relocated into a detail card or any other
  click-to-reveal state — regardless of whether `frontend_spec_008_occurrence_detail_card.md`'s
  detail-card restructure has been implemented yet (its `FRONTEND-008-AC-01`, amended above, states
  the same contract from that spec's side). Grid items are unaffected — they never render these
  controls at all (Requirement 6).

### Requirement 6 — Scope: the weekend bucket list only, not the weekly grid

As a user, I only want to reorder my flexible weekend list — my weekday grid is already organised by
day and time slot, and reordering within a slot wouldn't mean anything.

- **FRONTEND-010-AC-16** [AUTO]: For a grid item (`isBucketItem` is `false`), `OccurrenceItem` shall
  render neither a drag handle nor Move up/Move down controls, and `PlannerGrid.tsx`'s existing
  click-to-assign flow shall be unchanged.

## Component/type changes

`types/plan.ts` (extended):

```typescript
export interface PlannedOccurrence {
  id: string
  activityId: string | null
  subTaskId: string | null
  name: string
  category: ActivityCategory
  weekStart: string
  dayOfWeek: PlanDayOfWeek | null
  slot: PlanSlot | null
  bucketPosition: number | null
  completed: boolean
  completedAt: string | null
  createdAt: string
}
```

`services/planApi.ts` (extended):

```typescript
reorderBucket: (weekStart: string, occurrenceIds: string[]): Promise<PlannedOccurrence[]> =>
  request<{ data: PlannedOccurrence[]; count: number }>(() =>
    client.put('/plan/bucket/order', { weekStart, occurrenceIds }),
  ).then((r) => r.data),
```

`BucketList.tsx` — sorts by `bucketPosition`, owns drag state and both order-computation paths, and
gains an `onReorder`/`reorderInFlight` prop pair:

```typescript
interface BucketListProps {
  readonly occurrences: readonly PlannedOccurrence[]
  readonly busyId: string | null
  readonly confirmingRemoveId: string | null
  readonly movingId: string | null
  readonly reorderInFlight: boolean
  readonly onAdd: () => void
  readonly onStartRemove: (id: string) => void
  readonly onConfirmRemove: (id: string) => void
  readonly onCancelRemove: () => void
  readonly onStartMove: (id: string) => void
  readonly onCancelMove: () => void
  readonly onConfirmMove: (id: string, dayOfWeek: PlanDayOfWeek, slot: PlanSlot) => void
  readonly onComplete: (id: string) => void
  readonly onUndo: (id: string) => void
  readonly onCarryForward: (id: string) => void
  readonly onReorder: (occurrenceIds: string[]) => void
}

export function BucketList({ occurrences, reorderInFlight, onReorder, /* ...existing */ }: BucketListProps) {
  const bucketOccurrences = occurrences
    .filter((occurrence) => occurrence.dayOfWeek === null && occurrence.slot === null)
    .slice()
    .sort((a, b) => (a.bucketPosition ?? 0) - (b.bucketPosition ?? 0)) // FRONTEND-010-AC-01

  const idsInOrder = bucketOccurrences.map((occurrence) => occurrence.id)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const handleMoveUp = (id: string) => {
    const index = idsInOrder.indexOf(id)
    if (index <= 0) return
    const next = [...idsInOrder]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onReorder(next)
  }

  const handleMoveDown = (id: string) => {
    const index = idsInOrder.indexOf(id)
    if (index === -1 || index >= idsInOrder.length - 1) return
    const next = [...idsInOrder]
    ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
    onReorder(next)
  }

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    const withoutDragged = idsInOrder.filter((id) => id !== draggedId)
    const targetIndex = withoutDragged.indexOf(targetId)
    const next = [
      ...withoutDragged.slice(0, targetIndex),
      draggedId,
      ...withoutDragged.slice(targetIndex),
    ]
    onReorder(next)
    setDraggedId(null)
  }

  return (
    // ...existing markup, mapping bucketOccurrences with index for isFirst/isLast:
    // <OccurrenceItem
    //   key={occurrence.id}
    //   occurrence={occurrence}
    //   isBucketItem
    //   isFirst={index === 0}
    //   isLast={index === bucketOccurrences.length - 1}
    //   reorderDisabled={reorderInFlight}
    //   onMoveUp={handleMoveUp}
    //   onMoveDown={handleMoveDown}
    //   onDragStart={setDraggedId}
    //   onDragOverItem={(event) => event.preventDefault()}
    //   onDropOnItem={handleDrop}
    //   ...existing props
    // />
  )
}
```

`OccurrenceItem.tsx` — new props, gated on `isBucketItem`:

```typescript
interface OccurrenceItemProps {
  // ...existing props
  readonly isFirst?: boolean
  readonly isLast?: boolean
  readonly reorderDisabled?: boolean
  readonly onMoveUp?: (id: string) => void
  readonly onMoveDown?: (id: string) => void
  readonly onDragStart?: (id: string) => void
  readonly onDragOverItem?: (event: React.DragEvent) => void
  readonly onDropOnItem?: (id: string) => void
}
```

Row markup addition (rendered directly on the row — see Requirement 5):

```tsx
<li
  className={styles.row}
  onDragOver={isBucketItem ? onDragOverItem : undefined}
  onDrop={isBucketItem ? () => onDropOnItem?.(occurrence.id) : undefined}
>
  {isBucketItem && (
    <span className={styles.reorderControls}>
      <span
        className={styles.dragHandle}
        draggable
        onDragStart={() => onDragStart?.(occurrence.id)}
        aria-hidden="true"
      >
        <GripIcon />
      </span>
      <button
        type="button"
        onClick={() => onMoveUp?.(occurrence.id)}
        disabled={isFirst || reorderDisabled}
        aria-label={`Move ${occurrence.name} up`}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onMoveDown?.(occurrence.id)}
        disabled={isLast || reorderDisabled}
        aria-label={`Move ${occurrence.name} down`}
      >
        ↓
      </button>
    </span>
  )}
  {/* ...existing tile/action markup, unchanged */}
</li>
```

`GripIcon` — a small inline SVG, no new dependency (same rationale as `frontend_spec_008`'s
`CompletionIcon`):

```tsx
function GripIcon() {
  return (
    <svg className={styles.gripIcon} viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
      <circle cx="3" cy="2" r="1.3" fill="currentColor" />
      <circle cx="7" cy="2" r="1.3" fill="currentColor" />
      <circle cx="3" cy="8" r="1.3" fill="currentColor" />
      <circle cx="7" cy="8" r="1.3" fill="currentColor" />
      <circle cx="3" cy="14" r="1.3" fill="currentColor" />
      <circle cx="7" cy="14" r="1.3" fill="currentColor" />
    </svg>
  )
}
```

`WeeklyPlanner.tsx` — a dedicated in-flight flag (not the existing per-item `busyId`, per
`FRONTEND-010-AC-11`) and a handler mirroring the existing `handleMove`/`handleComplete` shape:

```typescript
const [bucketReorderInFlight, setBucketReorderInFlight] = useState(false)

const handleReorderBucket = async (occurrenceIds: string[]) => {
  setActionError(null)
  setBucketReorderInFlight(true)
  try {
    const updated = await planApi.reorderBucket(weekStart, occurrenceIds)
    setOccurrences((previous) => {
      if (!previous) return previous
      const updatedById = new Map(updated.map((occurrence) => [occurrence.id, occurrence]))
      return previous.map((occurrence) => updatedById.get(occurrence.id) ?? occurrence)
    })
  } catch (error) {
    setActionError(getErrorMessage(error))
  } finally {
    setBucketReorderInFlight(false)
  }
}
```

`<BucketList>`'s call site gains `reorderInFlight={bucketReorderInFlight}` and
`onReorder={handleReorderBucket}`.

## Cross-references

| This spec | Contracts against |
|---|---|
| `bucketPosition` | `PlannedOccurrenceResponse.bucketPosition` — exact shape from `planner_spec_010_bucket_reordering.md` |
| `PUT /plan/bucket/order` | `PlanController.reorderBucket(...)` — exact request/response shape from `planner_spec_010_bucket_reordering.md` |
| `types/plan.ts` | Extended — `PlannedOccurrence.bucketPosition` |
| `services/planApi.ts` | Extended — `reorderBucket(...)` |
| `BucketList.tsx` | Extended — sorts by `bucketPosition`, owns drag/up-down order computation, `onReorder`/`reorderInFlight` props |
| `OccurrenceItem.tsx` | Extended — drag handle + Move up/Move down controls for bucket items, always at-rest-visible |
| `WeeklyPlanner.tsx` | Extended — `handleReorderBucket`, `bucketReorderInFlight` state, wires `onReorder` into `BucketList` |
| `PlannerGrid.tsx` | Unmodified — no reorder controls, out of scope (Requirement 6) |
| `frontend_spec_004_week_planning.md` | Origin of `BucketList`/`OccurrenceItem`/`WeeklyPlanner`/`planApi`/`types/plan.ts` |
| `frontend_spec_007_visual_refresh.md` | CSS Modules + theme custom-properties convention this spec's new drag-handle/button styles follow |
| `frontend_spec_008_occurrence_detail_card.md` | `FRONTEND-008-AC-01` additively amended by `FRONTEND-010-AC-15` (see Overview/Requirement 5); not yet implemented |
| `frontend_spec_006_repeatable_activities.md` | Precedent for the intra-project "later spec adds an explicit carve-out AC rather than editing an earlier committed AC" pattern (`FRONTEND-006-AC-09`) |
| `planner_spec_010_bucket_reordering.md` | Paired backend spec |
| `planner_spec_011_bucket_carry_forward_automation.md` (sibling, not yet written) | No direct dependency — that spec's automation mutates `bucketPosition` server-side per its own rule; this spec's client only ever reads/submits values the backend already computed |

`OccurrenceItem.test.tsx`, `BucketList.test.tsx`, and `WeeklyPlanner.test.tsx`'s existing test suites
all pass a full prop list to these components today and will need updating for the new
`bucketPosition`/`isFirst`/`isLast`/`reorderDisabled`/`onMoveUp`/`onMoveDown`/`onDragStart`/
`onDragOverItem`/`onDropOnItem`/`onReorder`/`reorderInFlight` props during implementation — not a new
AC, just an implementation-time consequence of the prop-shape change, matching
`frontend_spec_008_occurrence_detail_card.md`'s equivalent note for its own prop-shape change.

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
function bucketOccurrence(overrides: Partial<PlannedOccurrence> = {}): PlannedOccurrence {
  return {
    id: 'o1', activityId: 'a1', subTaskId: null, name: 'Read', category: 'PLEASURABLE',
    weekStart: '2026-10-05', dayOfWeek: null, slot: null, bucketPosition: 0,
    completed: false, completedAt: null, createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

const noop = () => {}
function baseBucketProps(overrides: Partial<Parameters<typeof BucketList>[0]> = {}) {
  return {
    occurrences: [], busyId: null, confirmingRemoveId: null, movingId: null,
    reorderInFlight: false, onAdd: noop, onStartRemove: noop, onConfirmRemove: noop,
    onCancelRemove: noop, onStartMove: noop, onCancelMove: noop, onConfirmMove: noop,
    onComplete: noop, onUndo: noop, onCarryForward: noop, onReorder: noop, ...overrides,
  }
}

describe('FRONTEND-010-AC-01: bucket items render ordered by bucketPosition, not array order', () => {
  it('renders items in bucketPosition order', () => {
    const occurrences = [
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences })} />)

    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items.findIndex((text) => text?.includes('First'))).toBeLessThan(
      items.findIndex((text) => text?.includes('Second')),
    )
  })
})

describe('FRONTEND-010-AC-04/AC-05: Move up/down disabled at the boundaries', () => {
  it('disables Move up on the first item and Move down on the last', () => {
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences })} />)

    expect(screen.getByRole('button', { name: /move first up/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /move second down/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /move first down/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /move second up/i })).not.toBeDisabled()
  })
})

describe('FRONTEND-010-AC-06: Move up/down computes the full swapped order and calls onReorder once', () => {
  it('swaps the activated item with its neighbour above', async () => {
    const onReorder = vi.fn()
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
      bucketOccurrence({ id: 'c', name: 'Third', bucketPosition: 2 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences, onReorder })} />)

    await userEvent.click(screen.getByRole('button', { name: /move second up/i }))

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
  })
})

describe('FRONTEND-010-AC-07: dropping onto another row computes the relocated full order', () => {
  it('moves the dragged item to the drop target position', () => {
    const onReorder = vi.fn()
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'First', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Second', bucketPosition: 1 }),
      bucketOccurrence({ id: 'c', name: 'Third', bucketPosition: 2 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences, onReorder })} />)

    const firstRow = screen.getByText('First').closest('li')!
    const thirdRow = screen.getByText('Third').closest('li')!
    fireEvent.dragStart(firstRow.querySelector('[draggable]')!)
    fireEvent.drop(thirdRow)

    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a'])
  })
})

describe('FRONTEND-010-AC-11: reorder controls are disabled while a reorder request is in flight', () => {
  it('disables every Move up/down button while reorderInFlight is true', () => {
    const occurrences = [
      bucketOccurrence({ id: 'a', name: 'Read', bucketPosition: 0 }),
      bucketOccurrence({ id: 'b', name: 'Write', bucketPosition: 1 }),
    ]
    render(<BucketList {...baseBucketProps({ occurrences, reorderInFlight: true })} />)

    expect(screen.getByRole('button', { name: /move read down/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /move write up/i })).toBeDisabled()
  })
})

describe('FRONTEND-010-AC-16: grid items never render reorder controls', () => {
  it('renders no Move up/down buttons for a grid-scheduled occurrence', () => {
    const gridOccurrence = bucketOccurrence({
      id: 'g1', dayOfWeek: 'MONDAY', slot: 'MORNING', bucketPosition: null,
    })
    render(
      <OccurrenceItem
        occurrence={gridOccurrence}
        isBucketItem={false}
        busyId={null}
        confirmingRemoveId={null}
        movingId={null}
        onStartRemove={noop}
        onConfirmRemove={noop}
        onCancelRemove={noop}
        onStartMove={noop}
        onCancelMove={noop}
        onConfirmMove={noop}
        onMoveToBucket={noop}
        onComplete={noop}
        onUndo={noop}
        onCarryForward={noop}
      />,
    )

    expect(screen.queryByRole('button', { name: /move .* up/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move .* down/i })).not.toBeInTheDocument()
  })
})
```

`FRONTEND-010-AC-02`/`AC-03` (controls render for a bucket item) are exercised implicitly by the
Move up/down assertions above (their disabled/enabled state can't be asserted without the buttons
existing in the first place). `FRONTEND-010-AC-09`/`AC-10`/`AC-12`/`AC-13` are `WeeklyPlanner`-level
tests mirroring `WeeklyPlanner.test.tsx`'s existing `handleMove`/`handleComplete` mocked-`planApi`
pattern: mock `planApi.reorderBucket` to resolve or reject, trigger a Move up/down click, and assert
(resolve case) the displayed order updates only after the mocked promise resolves, or (reject case)
`role="alert"` renders the error message and the bucket's rendered order is unchanged from before the
click. `FRONTEND-010-AC-14` (the type field) is exercised implicitly by every fixture above compiling
against the extended `PlannedOccurrence` type. `FRONTEND-010-AC-08` is verified manually per its own
statement. `FRONTEND-010-AC-15` has no standalone automated test beyond `AC-02`/`AC-03` themselves
(rendering the controls unconditionally on the row already proves they're never gated behind a card).

**Test Case (Green)**: implement `types/plan.ts`, `services/planApi.ts`, `BucketList.tsx`,
`OccurrenceItem.tsx`, and `WeeklyPlanner.tsx` as specified above until every sketch above (and the
remaining ACs not sketched: AC-02, AC-03, AC-08, AC-09, AC-10, AC-12, AC-13, AC-14, AC-15) passes.
AC-08 is verified by a real-browser mouse drag-and-drop pass, per `frontend_conventions.md`'s Testing
Strategy note.

## Acceptance Criteria Summary

- [x] FRONTEND-010-AC-01 — bucket items render ordered by `bucketPosition`, not array order
- [x] FRONTEND-010-AC-02 — a draggable, `aria-hidden` grip handle renders on every bucket item's row
- [x] FRONTEND-010-AC-03 — Move up/Move down buttons with accessible names render on every bucket item's row
- [x] FRONTEND-010-AC-04 — Move up disabled/no-op on the first item
- [x] FRONTEND-010-AC-05 — Move down disabled/no-op on the last item
- [x] FRONTEND-010-AC-06 — Move up/down computes the full swapped order and calls `onReorder` once
- [x] FRONTEND-010-AC-07 — dropping on another row computes the full relocated order via `onReorder`
- [x] FRONTEND-010-AC-08 — real-browser mouse drag-and-drop check (manual)
- [x] FRONTEND-010-AC-09 — `planApi.reorderBucket(...)` calls `PUT /plan/bucket/order`
- [x] FRONTEND-010-AC-10 — `WeeklyPlanner` awaits the response before updating displayed order (no optimistic update)
- [x] FRONTEND-010-AC-11 — all reorder controls disabled while a reorder request is in flight
- [x] FRONTEND-010-AC-12 — a rejected reorder sets `actionError`, rendered via `role="alert"`
- [x] FRONTEND-010-AC-13 — a rejected reorder leaves the previously-displayed order unchanged
- [x] FRONTEND-010-AC-14 — `PlannedOccurrence.bucketPosition` type field added
- [x] FRONTEND-010-AC-15 — reorder controls always at-rest-visible, additively amending `FRONTEND-008-AC-01`
- [x] FRONTEND-010-AC-16 — grid items never render reorder controls; `PlannerGrid.tsx` unchanged
