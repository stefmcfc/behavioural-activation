# Repeatable Icon in the Weekend Bucket List (Frontend)

**Status**: Implemented — `PlannedOccurrence.repeatable: boolean` added to
`frontend/src/types/plan.ts`; `OccurrenceItem.tsx` renders the shared `RepeatableIcon`
(`frontend/src/components/RepeatableIcon/RepeatableIcon.tsx`) between `CategoryChip` and the
completion indicator, gated on `isBucketItem && occurrence.repeatable`. All 3 ACs covered by
tests in `OccurrenceItem.test.tsx`, including the AC-03 regression guard for grid cells. The
sibling backend change (`planner_spec_013_repeatable_on_occurrence.md`) had already landed
(uncommitted) in the working tree by the time this was implemented, so the frontend type matches
the real API shape. Real-browser verification not performed by the implementing agent (no browser
automation tooling available in that session) — recommend a manual check of the weekend bucket
list (light + dark theme) before considering this fully done per the project's Definition of Done.
**Priority**: P3 — small UX polish, nothing else blocked on it
**Depends on**: `planner_spec_013_repeatable_on_occurrence.md` (adds `repeatable` to
`PlannedOccurrenceResponse` — this spec cannot be implemented ahead of that one landing),
`frontend_spec_019_repeatable_activity_icon.md` (origin of `RepeatableIcon`, reused as-is),
`frontend_spec_008_occurrence_detail_card.md` (`OccurrenceItem`'s current decluttered tile shape —
see Overview for why this spec deliberately does not extend to grid cells)
**Area**: Frontend
**Roadmap version**: N/A — UX polish, not tied to a V1–V5 theme

## Overview

Once `planner_spec_013_repeatable_on_occurrence.md` exposes `repeatable` on `PlannedOccurrence`, this
spec shows the `RepeatableIcon` (from `frontend_spec_019`) on weekend bucket list items.

**Deliberately scoped to the bucket list only, not weekly grid cells** — confirmed with the user
2026-10-01. `OccurrenceItem.tsx` is the single shared component rendering both weekly grid cells
(`PlannerGrid.tsx`, `isBucketItem={false}`) and bucket list items (`BucketList.tsx`,
`isBucketItem={true}`) — there is no separate bucket-only component, so this spec gates the icon's
render on the existing `isBucketItem` prop rather than adding a new one. This choice is intentional,
not an oversight: `frontend_spec_008_occurrence_detail_card.md` was built specifically in response to
the user's "far too much noise in the calendar" complaint, deliberately reducing each grid tile down
to just name/`CategoryChip`/completion-icon, with everything else moved into a detail card. Adding
another icon to every grid tile would partially reintroduce the density that spec removed. Bucket
items don't carry that same density pressure (no day/slot grid to cram into), so the icon is safe to
add there without the same tradeoff. If the grid is reconsidered later, that's a separate decision
for a future spec, not implied by this one.

`OccurrenceItem.tsx`'s current row markup (lines 86–95):

```tsx
<li className={styles.row}>
  {occurrence.subTaskId !== null && occurrence.parentActivityName !== null && (
    <span className={styles.parentActivityName}>{occurrence.parentActivityName}</span>
  )}
  <button type="button" className={styles.nameButton} onClick={handleNameClick}>
    {occurrence.name}
  </button>
  <CategoryChip category={occurrence.category} />
  {occurrence.completed && <CompletionIcon />}
  ...
```

The `RepeatableIcon` renders between `<CategoryChip />` and `{occurrence.completed && <CompletionIcon />}`,
gated on both `isBucketItem` and `occurrence.repeatable` — matching
`frontend_spec_019`'s DOM-order precedent (chip, then repeatable indicator, then completion
indicator) and its implicit true-only treatment (no icon for one-off bucket items).

## Requirement 1: Show the repeatable icon on weekend bucket list items only

**User story**: As someone reviewing my weekend bucket list, I want to see which items are
repeatable activities versus one-off, the same way I can in the Activity Bank, without that same
indicator adding density to the weekly grid where it isn't needed.

### FRONTEND-021-AC-01 [AUTO]: Icon renders on a repeatable bucket item
**Statement**: While `isBucketItem` is `true` and the occurrence's `repeatable` is `true`, the
`OccurrenceItem` component shall render a `RepeatableIcon` between `CategoryChip` and the completion
indicator.

**Rationale**: The core feature.

**References**:
- Component reused as-is: `RepeatableIcon` (per `frontend_spec_019`/`frontend_spec_020`).
- Type: `PlannedOccurrence.repeatable` (`frontend/src/types/plan.ts`, added by
  `planner_spec_013_repeatable_on_occurrence.md`'s frontend-type counterpart change).

**Test Case (Red)**:
```tsx
it('FRONTEND-021-AC-01: shows the repeatable icon for a repeatable bucket item', () => {
  render(<OccurrenceItem {...baseProps} occurrence={{ ...bucketOccurrence, repeatable: true }} isBucketItem />)
  expect(screen.getByRole('img', { name: /repeatable/i })).toBeInTheDocument()
})
```

**Test Case (Green)**: render `{isBucketItem && occurrence.repeatable && <RepeatableIcon />}` between
`<CategoryChip />` and the `CompletionIcon` block.

### FRONTEND-021-AC-02 [AUTO]: No icon for a one-off bucket item
**Statement**: While `isBucketItem` is `true` and the occurrence's `repeatable` is `false`, the
`OccurrenceItem` component shall render no `RepeatableIcon`.

**Rationale**: Matches the established implicit, true-only treatment.

**References**: Related: `FRONTEND-021-AC-01`.

**Test Case (Red)**:
```tsx
it('FRONTEND-021-AC-02: shows no repeatable icon for a one-off bucket item', () => {
  render(<OccurrenceItem {...baseProps} occurrence={{ ...bucketOccurrence, repeatable: false }} isBucketItem />)
  expect(screen.queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
})
```

**Test Case (Green)**: the `occurrence.repeatable &&` guard from `FRONTEND-021-AC-01` already
satisfies this — explicit regression guard, matching this project's established "false case" AC
pattern.

### FRONTEND-021-AC-03 [AUTO]: No icon on grid cells, even for a repeatable occurrence
**Statement**: While `isBucketItem` is `false` (a weekly grid cell), the `OccurrenceItem` component
shall render no `RepeatableIcon`, regardless of the occurrence's `repeatable` value.

**Rationale**: This is the AC that actually encodes the user's confirmed scoping decision (bucket
list only) as a test, not just prose in the Overview — without it, a future change could silently
extend the icon to grid cells by accident (e.g. someone "simplifying" the gate to just
`occurrence.repeatable &&`) with no test catching the regression.

**References**: Related: `FRONTEND-021-AC-01`. This AC is the direct regression guard for the
Overview's scoping decision.

**Test Case (Red)**:
```tsx
it('FRONTEND-021-AC-03: shows no repeatable icon on a grid cell, even when repeatable is true', () => {
  render(<OccurrenceItem {...baseProps} occurrence={{ ...gridOccurrence, repeatable: true }} isBucketItem={false} />)
  expect(screen.queryByRole('img', { name: /repeatable/i })).not.toBeInTheDocument()
})
```

**Test Case (Green)**: the `isBucketItem &&` half of the guard from `FRONTEND-021-AC-01`.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `repeatable` field this spec consumes | `planner_spec_013_repeatable_on_occurrence.md` (`PlannedOccurrenceResponse.repeatable`) |
| `PlannedOccurrence` type | `frontend/src/types/plan.ts` |
| `RepeatableIcon` component (reused, not reinvented) | `frontend/src/components/ActivityBank/ActivityBank.tsx` (per `frontend_spec_019`) |
| Shared render target (grid + bucket) | `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` |
| `isBucketItem` prop (existing, reused as the scoping gate) | `OccurrenceItem.tsx`, set by `PlannerGrid.tsx` (`false`) and `BucketList.tsx` (`true`) |
| Decluttering precedent this spec deliberately doesn't undo for grid cells | `frontend_spec_008_occurrence_detail_card.md` |

## Acceptance Criteria Summary

- [x] FRONTEND-021-AC-01 [AUTO]: Icon renders on a repeatable bucket item
- [x] FRONTEND-021-AC-02 [AUTO]: No icon for a one-off bucket item
- [x] FRONTEND-021-AC-03 [AUTO]: No icon on grid cells, even for a repeatable occurrence (regression guard for the scoping decision)
