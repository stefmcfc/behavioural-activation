# Automatic Carry-Forward for Incomplete Bucket Items (Frontend)

**Status**: Not started
**Priority**: P2 — small, paired with the backend automation spec; makes an otherwise-silent
relocation visible rather than confusing.
**Depends on**: `planner_spec_011_bucket_carry_forward_automation.md` (paired backend spec —
`PlannedOccurrenceResponse.recentlyCarriedForward`, the field this spec consumes),
`frontend_spec_004_week_planning.md` (origin of `OccurrenceItem.tsx`, `BucketList.tsx`,
`types/plan.ts`, `planApi`), `frontend_spec_007_visual_refresh.md` (CSS Modules + theme
custom-properties convention this spec's new label style follows)
**Area**: Frontend
**Roadmap version**: V1 (extends the core planner's weekend bucket list from `product.md`'s V1 row
— not V2's tracking/reflection scope, and not AI)

## Overview

Paired with `planner_spec_011_bucket_carry_forward_automation.md`, which makes an incomplete
weekend-bucket item whose `weekStart` has fallen behind the real current week jump automatically to
the current week the next time the plan is fetched, rather than requiring the user to manually hit
"Carry forward" themselves. This ties back to `.claude/HIGH_LEVEL_DESIGN.md`'s US-007 (the weekend
bucket list).

**Why a frontend indicator is warranted (resolved in the backend spec's Overview, restated here for
this half's own rationale)**: unlike a completed bucket item (which stays visibly marked in place,
so its continued presence is self-explanatory) or a *manually* triggered carry-forward (the user
just clicked the button themselves, so there's no "where did this come from" moment), an
automatically-migrated item can appear in the current week's bucket list on a fetch the user didn't
consciously associate with moving anything. Bucket items render with no `weekStart`/date at all
today (`BucketList.tsx`/`OccurrenceItem.tsx`), so without a signal, a freshly-migrated item is
visually indistinguishable from something the user just added. Given this app's explicit "neutral
language, review over scorecard, don't let a missed activity read as failure" product stance
(`product.md`), this spec adds the smallest possible signal — one label, no new interaction, no
redesign of `OccurrenceItem`'s structure (that stays `frontend_spec_008_occurrence_detail_card.md`'s
territory) — rather than leaving the relocation unexplained.

**Out of scope**: everything `planner_spec_011_bucket_carry_forward_automation.md` itself scopes
out (bucket drag-and-drop reordering, the occurrence detail card, the "Add" picker modal, the grid
orientation toggle, any change to grid-scheduled occurrences, the existing manual carry-forward
button/flow — unchanged). No restructuring of `OccurrenceItem.tsx`'s tile layout beyond adding this
one conditional label — if `frontend_spec_008_occurrence_detail_card.md`'s tile/detail-card split
lands before or after this spec, integrating the label into that structure is an implementation-time
detail, not a reason to block either spec on the other (same "field/structure ordering is an
integration detail, not fixed by any one spec" note as the backend spec's own field-ordering note
re: `parentActivityName`/`bucketPosition`). No change to `planApi.getWeek(...)`'s call shape — the
new field arrives passively on the existing response, no new request parameter.

## Requirements

### Requirement 1 — The `PlannedOccurrence` type carries the backend's new signal

As a developer consuming the plan API, I want the frontend's type for a planned occurrence to match
the backend's response shape exactly, so a freshly-migrated item's signal isn't silently dropped or
mistyped.

- **FRONTEND-011-AC-01** [AUTO]: The `PlannedOccurrence` type (`types/plan.ts`) shall declare a new
  `recentlyCarriedForward: boolean` field, matching
  `planner_spec_011_bucket_carry_forward_automation.md`'s
  `PlannedOccurrenceResponse.recentlyCarriedForward` 1:1.

### Requirement 2 — A neutral, visible label explains a freshly-migrated item

As a user, I want to understand at a glance why an item I don't remember adding just now is sitting
in my current bucket list, so it doesn't feel like something appeared out of nowhere or that I'm
being called out for missing it.

- **FRONTEND-011-AC-02** [AUTO]: Where `occurrence.recentlyCarriedForward` is `true`, `OccurrenceItem`
  shall render a visible label (e.g. "Moved from last week") on the tile, alongside its existing
  name/category/completion elements.
- **FRONTEND-011-AC-03** [AUTO]: Where `occurrence.recentlyCarriedForward` is `false`, `OccurrenceItem`
  shall render no such label.
- **FRONTEND-011-AC-04** [AUTO]: The label's wording shall not imply fault, lateness, or failure on
  the user's part (e.g. no "Overdue"/"Missed"/"Late" wording) — matching this product's neutral-
  language principle (`product.md`, `frontend_conventions.md`'s Error Handling section note on the
  same principle).
- **FRONTEND-011-AC-05** [MANUAL]: The label is visually distinguishable from the tile's surrounding
  text without reading as an alarm/warning state (no red/urgent styling — a muted/secondary-text
  treatment, matching the `CategoryChip`/completion-icon precedent of using theme custom properties
  rather than hardcoded colour) in both Light and Dark themes — verified by a real-browser check,
  since jsdom cannot render CSS/contrast (`frontend_conventions.md`'s Testing Strategy note).

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
  recentlyCarriedForward: boolean
  completed: boolean
  completedAt: string | null
  createdAt: string
}
```

`OccurrenceItem.tsx` — one new conditional element alongside the existing completion text, no other
structural change:

```tsx
<span>{occurrence.name}</span> <CategoryChip category={occurrence.category} />
{occurrence.completed && <span> — Completed</span>}
{occurrence.recentlyCarriedForward && (
  <span className={styles.carriedForwardLabel}> — Moved from last week</span>
)}
```

`OccurrenceItem.module.css` — new `.carriedForwardLabel` rule using the existing theme custom
properties (e.g. a muted secondary text colour), not a hardcoded value, per
`frontend_spec_007_visual_refresh.md`'s established convention.

No change to `BucketList.tsx`'s own props or rendering — it already passes each `occurrence` object
through to `OccurrenceItem` unmodified, so the new field arrives for free once `types/plan.ts` and
`OccurrenceItem.tsx` are updated. No change to `planApi.ts` — `getWeek(...)`'s response shape gains
the field passively.

## Cross-references

| This spec | Contracts against |
|---|---|
| `types/plan.ts` | Extended — `PlannedOccurrence.recentlyCarriedForward` |
| `PlannedOccurrenceResponse.recentlyCarriedForward` (`planner_spec_011_bucket_carry_forward_automation.md`) | Exact shape this field mirrors |
| `OccurrenceItem.tsx` | Extended — one new conditional label |
| `OccurrenceItem.module.css` | Extended — new `.carriedForwardLabel` rule, theme custom properties |
| `BucketList.tsx` (`frontend_spec_004_week_planning.md`) | Unmodified — passes `occurrence` through as today |
| `planApi.ts` (`frontend_spec_004_week_planning.md`) | Unmodified — response shape change only |
| `frontend_spec_008_occurrence_detail_card.md` | Not yet implemented as of this spec's drafting — if its tile/detail-card restructuring lands before or after this spec, integrating this label into that structure is an implementation-time detail, not a blocking dependency either way |

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
const baseOccurrence: PlannedOccurrence = {
  id: 'o1', activityId: 'a1', subTaskId: null, name: 'Go for a walk', category: 'PLEASURABLE',
  weekStart: '2026-10-12', dayOfWeek: null, slot: null, recentlyCarriedForward: false,
  completed: false, completedAt: null, createdAt: '2026-09-21T00:00:00Z',
}

const noop = () => {}
function baseProps(overrides: Partial<Parameters<typeof OccurrenceItem>[0]> = {}) {
  return {
    occurrence: baseOccurrence, isBucketItem: true, busyId: null, confirmingRemoveId: null,
    movingId: null, onStartRemove: noop, onConfirmRemove: noop, onCancelRemove: noop,
    onStartMove: noop, onCancelMove: noop, onConfirmMove: noop, onMoveToBucket: noop,
    onComplete: noop, onUndo: noop, onCarryForward: noop, ...overrides,
  }
}

describe('FRONTEND-011-AC-02/AC-03: the "moved from last week" label only renders when flagged', () => {
  it('renders the label when recentlyCarriedForward is true, and omits it otherwise', () => {
    const { rerender } = render(
      <OccurrenceItem
        {...baseProps({ occurrence: { ...baseOccurrence, recentlyCarriedForward: true } })}
      />,
    )
    expect(screen.getByText(/moved from last week/i)).toBeInTheDocument()

    rerender(<OccurrenceItem {...baseProps()} />)
    expect(screen.queryByText(/moved from last week/i)).not.toBeInTheDocument()
  })
})

describe('FRONTEND-011-AC-04: the label never uses fault/lateness wording', () => {
  it('does not render "overdue", "missed", or "late" anywhere on a carried-forward item', () => {
    render(
      <OccurrenceItem
        {...baseProps({ occurrence: { ...baseOccurrence, recentlyCarriedForward: true } })}
      />,
    )
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/missed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\blate\b/i)).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement `types/plan.ts` and `OccurrenceItem.tsx`/`OccurrenceItem.module.css`
as specified above until every sketch above (and FRONTEND-011-AC-01, exercised implicitly by
compilation once the type field exists, matching `frontend_spec_008`'s treatment of similarly
structural ACs) passes. FRONTEND-011-AC-05 is verified by a real-browser pass in both Light and Dark,
per `frontend_conventions.md`'s Testing Strategy note.

## Acceptance Criteria Summary

- [ ] FRONTEND-011-AC-01 — `PlannedOccurrence.recentlyCarriedForward: boolean` type field added
- [ ] FRONTEND-011-AC-02 — the "Moved from last week" label renders when `recentlyCarriedForward` is `true`
- [ ] FRONTEND-011-AC-03 — no label renders when `recentlyCarriedForward` is `false`
- [ ] FRONTEND-011-AC-04 — the label never uses fault/lateness wording
- [ ] FRONTEND-011-AC-05 — the label is visually distinguishable but non-alarming in both themes (real-browser check)
