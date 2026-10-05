# Per-Occurrence Notes (Frontend)

**Status**: Implemented (2026-10-05)
**Priority**: P3 — new feature, raised by the user as an idea 2026-10-06, scoped into a spec
2026-10-06
**Depends on**: `planner_spec_022_occurrence_notes.md` (the backend endpoint this consumes),
`frontend_spec_008_occurrence_detail_card.md` (the detail-card `Modal` this spec extends),
`frontend_spec_036_weekly_summary.md`/`frontend_spec_037_weekly_summary_visualizations.md`
(`CompletionMark`'s tooltip, which gains a has-notes hint)
**Area**: Frontend
**Roadmap version**: V1 polish

## Overview

Pairs with `planner_spec_022_occurrence_notes.md`. Adds a `notes` field to the `PlannedOccurrence`
type, a textarea inside the existing occurrence detail card (`OccurrenceItem.tsx`'s `Modal`) that
autosaves on blur, a 200-character live counter, and a lightweight has-notes indicator in two
places: the occurrence tile itself (grid and bucket list) and the Weekly Summary's lite-grid
tooltip (`CompletionMark`). No explicit "Save" button — matches the user's explicit preference for
autosave-on-blur over an extra click.

## Requirements

### Requirement 1: Edit a note in the occurrence detail card

**User story**: As a user, I want to type a short note for one occurrence and have it save
automatically, so I don't need an extra button click for something this small.

#### FRONTEND-043-AC-01 [AUTO]: Textarea seeded from the occurrence's current note
**Statement**: When the occurrence detail card (`OccurrenceItem`'s `Modal`) opens for an
occurrence, the `OccurrenceItem` component shall render a `<textarea>` whose value is the
occurrence's `notes` field, or an empty string if `notes` is `null`.

**Rationale**: The textarea must reflect existing state, not always start blank.

**References**:
- Type: `PlannedOccurrence.notes` (new field, `frontend/src/types/plan.ts`)
- Component: `frontend/src/components/WeeklyPlanner/OccurrenceItem.tsx` (detail `Modal`,
  lines 190-319 before this change)

#### FRONTEND-043-AC-02 [AUTO]: Autosave on blur when the note changed
**Statement**: When the notes `<textarea>` loses focus and its trimmed value differs from the
occurrence's current `notes` (or `''` if `null`), the `OccurrenceItem` component shall call
`onUpdateNotes(occurrence.id, trimmedValue || null)` — mirroring `ActivityForm.tsx`'s existing
trim-or-null pattern for its `description` field (`ActivityForm.tsx:63`).

**Rationale**: Autosave-on-blur was the user's explicit choice over an explicit "Save notes"
button. Trimming avoids persisting a whitespace-only "note" as distinct from no note.

**References**:
- Precedent: `ActivityForm.tsx:63` (`description: description.trim() ? description.trim() : null`)
- `planApi.updateNotes` (new function)

#### FRONTEND-043-AC-03 [AUTO]: No save call when the value didn't change
**Statement**: When the notes `<textarea>` loses focus and its trimmed value is unchanged from the
occurrence's current `notes`, the `OccurrenceItem` component shall not call `onUpdateNotes`.

**Rationale**: Avoid a no-op network call every time the card is merely opened and closed without
editing the note.

#### FRONTEND-043-AC-04 [AUTO]: 200-character limit with a live counter
**Statement**: While the notes `<textarea>` is rendered, the `OccurrenceItem` component shall
enforce `maxLength={200}` on the input and display a live "`n`/200" character count beneath it.

**Rationale**: Matches the backend's `@Size(max = 200)` validation
(`planner_spec_022_occurrence_notes.md`, `PLANNER-022-AC-03`) with an equivalent client-side
limit and visible feedback — a genuinely new UI pattern for this codebase (no existing textarea,
including `ActivityForm`'s `description` field, has a character counter).

#### FRONTEND-043-AC-05 [AUTO]: Textarea resets when a different occurrence's card opens
**Statement**: When the detail card is closed for one occurrence and subsequently opened for a
different occurrence, the `OccurrenceItem` component shall display that second occurrence's own
`notes` value (or empty string), not the first occurrence's draft text.

**Rationale**: `OccurrenceItem` is rendered once per occurrence (keyed by occurrence id in its
parent list), so this is naturally satisfied by seeding local textarea state from the `occurrence`
prop and resetting whenever `occurrence.id` changes — called out explicitly here as a regression
risk given the component is list-rendered and ids change between renders of different items.

### Requirement 2: Surface that an occurrence has a note, without opening it

**User story**: As a user, I want to tell at a glance which occurrences have a note, so I don't
have to open every occurrence's detail card just to check.

#### FRONTEND-043-AC-06 [AUTO]: Has-notes indicator on the tile
**Statement**: While an occurrence's `notes` is non-null and non-empty, the `OccurrenceItem`
component shall render a small, non-interactive icon/marker on the tile row (near `CategoryChip`/
`RepeatableIcon`), and shall not render it otherwise.

**Rationale**: A lightweight visual hint, confirmed with the user as wanted in addition to the
detail-card editor itself. Non-interactive because the tile's name button already opens the
detail card (`handleNameClick`, `OccurrenceItem.tsx:101-107`) — no need for a second click target.

**References**:
- `OccurrenceItem.tsx` tile row, lines 158-169 before this change

#### FRONTEND-043-AC-07 [AUTO]: Has-notes hint in the Weekly Summary tooltip
**Statement**: While an occurrence's `notes` is non-null and non-empty, the `CompletionMark`
component shall append a hint (e.g. `"Has a note"`) to its tooltip text and `aria-label`, and
shall not append it otherwise.

**Rationale**: Confirmed with the user as the second surfacing location. `CompletionMark`'s
existing `aria-label`/tooltip construction (`CompletionMark.tsx:40,44`) already concatenates
name/location/status into one string — this appends one more clause to the same string.

**References**:
- `frontend/src/components/WeeklySummary/CompletionMark.tsx:36-47`

## Cross-references

| This spec depends on / contracts against | Why |
|---|---|
| `planner_spec_022_occurrence_notes.md` | Backend endpoint (`PATCH /api/v1/plan/occurrences/{id}/notes`) and `PlannedOccurrenceResponse.notes` field this spec consumes |
| `frontend_spec_008_occurrence_detail_card.md` | The detail-card `Modal` this spec adds a textarea to |
| `frontend_spec_036_weekly_summary.md` / `frontend_spec_037_weekly_summary_visualizations.md` | `CompletionMark`, whose tooltip gains the has-notes hint |
| `frontend/src/components/ActivityBank/ActivityForm.tsx` | Trim-or-null pattern this spec's autosave mirrors (line 63) |
| `frontend/src/components/WeeklyPlanner/usePlanActions.ts` | Gains the new `handleUpdateNotes` handler, following existing handlers' busy-state-guard shape |

## Implementation notes (for `frontend-dev`)

- **`frontend/src/types/plan.ts`**: add `notes: string | null` to the `PlannedOccurrence`
  interface (lines 14-30).
- **`frontend/src/services/planApi.ts`**: new function alongside `move`/`carryForward`:
  ```ts
  updateNotes: (id: string, notes: string | null): Promise<PlannedOccurrence> =>
    request<PlannedOccurrence>(() => client.patch(`/plan/occurrences/${id}/notes`, { notes })),
  ```
- **`frontend/src/components/WeeklyPlanner/usePlanActions.ts`**: new handler, mirroring
  `handleCarryForward`'s shape (lines 194-207):
  ```ts
  const handleUpdateNotes = async (id: string, notes: string | null) => {
    setActionError(null)
    setBusyId(id)
    try {
      const updated = await planApi.updateNotes(id, notes)
      setOccurrences(
        (previous) => previous?.map((occurrence) => (occurrence.id === id ? updated : occurrence)) ?? previous,
      )
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setBusyId(null)
    }
  }
  ```
  Exposed from the hook's return object and threaded down as a new `onUpdateNotes` prop the same
  way `onCarryForward` already is, through `WeeklyPlanner.tsx`/`PlannerGrid.tsx`/`BucketList.tsx`/
  `TodayView.tsx` to `OccurrenceItem`.
- **`OccurrenceItem.tsx`**:
  - New local state: `const [notesDraft, setNotesDraft] = useState(occurrence.notes ?? '')`, reset
    via a `useEffect` keyed on `occurrence.id` (and ideally `occurrence.notes`, so an externally
    updated occurrence — e.g. after the autosave response replaces it in `usePlanActions` state —
    doesn't fight the local draft).
  - New textarea between `.detailLocation` (line 203-207) and the remove-confirm/move/actions
    block (line 209 onward):
    ```tsx
    <label htmlFor={notesTextareaId}>Notes</label>
    <textarea
      id={notesTextareaId}
      maxLength={200}
      value={notesDraft}
      onChange={(event) => setNotesDraft(event.target.value)}
      onBlur={() => {
        const trimmed = notesDraft.trim()
        if (trimmed !== (occurrence.notes ?? '')) {
          onUpdateNotes(occurrence.id, trimmed || null)
        }
      }}
    />
    <span className={styles.notesCounter}>{notesDraft.length}/200</span>
    ```
  - Has-notes indicator on the tile (near line 164-165, alongside `CategoryChip`/`RepeatableIcon`):
    a small icon with a `title` attribute, rendered when `occurrence.notes` is truthy.
- **`CompletionMark.tsx`**: extend the `aria-label` (line 40) and tooltip text (line 44) to append
  a has-notes hint when `occurrence.notes` is truthy, e.g.:
  ```ts
  const notesHint = occurrence.notes ? ', has a note' : ''
  // aria-label={`${occurrence.name}, ${location}, ${status}${notesHint}`}
  // tooltip: {occurrence.name} — {location}, {status}{occurrence.notes ? ', has a note' : ''}
  ```

## TDD test case sketches

### planApi.test.ts

```ts
describe('FRONTEND-043-AC-02: updateNotes', () => {
  it('PATCHes /plan/occurrences/{id}/notes with the notes body', async () => {
    // mirrors the existing FRONTEND-004-AC-03 move() test's mock-client setup
    await planApi.updateNotes('occ-1', 'Book A')
    expect(mockPatch).toHaveBeenCalledWith('/plan/occurrences/occ-1/notes', { notes: 'Book A' })
  })
})
```

### OccurrenceItem.test.tsx

```ts
describe('FRONTEND-043-AC-01: textarea seeded from notes', () => {
  it('renders the occurrence\'s existing note when the detail card opens', () => {
    render(<OccurrenceItem occurrence={{ ...baseOccurrence, notes: 'Book A' }} detailOpenId={baseOccurrence.id} ... />)
    expect(screen.getByLabelText('Notes')).toHaveValue('Book A')
  })

  it('renders an empty textarea when notes is null', () => {
    render(<OccurrenceItem occurrence={{ ...baseOccurrence, notes: null }} detailOpenId={baseOccurrence.id} ... />)
    expect(screen.getByLabelText('Notes')).toHaveValue('')
  })
})

describe('FRONTEND-043-AC-02/AC-03: autosave on blur', () => {
  it('calls onUpdateNotes with the trimmed value when it changed', async () => {
    const onUpdateNotes = vi.fn()
    render(<OccurrenceItem occurrence={{ ...baseOccurrence, notes: null }} onUpdateNotes={onUpdateNotes} detailOpenId={baseOccurrence.id} ... />)
    const textarea = screen.getByLabelText('Notes')
    await userEvent.type(textarea, '  Book A  ')
    await userEvent.tab()
    expect(onUpdateNotes).toHaveBeenCalledWith(baseOccurrence.id, 'Book A')
  })

  it('does not call onUpdateNotes when the value is unchanged', async () => {
    const onUpdateNotes = vi.fn()
    render(<OccurrenceItem occurrence={{ ...baseOccurrence, notes: 'Book A' }} onUpdateNotes={onUpdateNotes} detailOpenId={baseOccurrence.id} ... />)
    await userEvent.click(screen.getByLabelText('Notes'))
    await userEvent.tab()
    expect(onUpdateNotes).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-043-AC-04: character limit and counter', () => {
  it('caps input at 200 characters and shows a live count', async () => {
    render(<OccurrenceItem occurrence={{ ...baseOccurrence, notes: null }} detailOpenId={baseOccurrence.id} ... />)
    const textarea = screen.getByLabelText('Notes')
    expect(textarea).toHaveAttribute('maxLength', '200')
    await userEvent.type(textarea, 'Book A')
    expect(screen.getByText('6/200')).toBeInTheDocument()
  })
})

describe('FRONTEND-043-AC-06: has-notes tile indicator', () => {
  it('shows the indicator when notes is present', () => {
    render(<OccurrenceItem occurrence={{ ...baseOccurrence, notes: 'Book A' }} ... />)
    expect(screen.getByTitle(/note/i)).toBeInTheDocument()
  })

  it('does not show the indicator when notes is null', () => {
    render(<OccurrenceItem occurrence={{ ...baseOccurrence, notes: null }} ... />)
    expect(screen.queryByTitle(/note/i)).not.toBeInTheDocument()
  })
})
```

### CompletionMark.test.tsx

```ts
describe('FRONTEND-043-AC-07: has-notes tooltip hint', () => {
  it('appends the hint to the tooltip and aria-label when notes is present', () => {
    render(<CompletionMark occurrence={{ ...baseOccurrence, notes: 'Book A' }} shape="circle" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(expect.stringContaining('has a note'))
  })

  it('omits the hint when notes is null', () => {
    render(<CompletionMark occurrence={{ ...baseOccurrence, notes: null }} shape="circle" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(expect.not.stringContaining('has a note'))
  })
})
```

**Test Case (Green)**: implement the type/service/hook/component changes above until every
sketch passes.

## Summary

Implemented exactly as specced, with one implementation deviation (noted below) and one
additional test beyond the sketches.

- **Test count**: 10 new tests (8 in `OccurrenceItem.test.tsx` — AC-01 x2, AC-02/AC-03 x3 including
  one extra whitespace-clears-to-null case, AC-04 x1, AC-05 x1, AC-06 x2; 2 in `planApi.test.ts` —
  the sketched update case plus a clear-to-`null` case; 2 in the new `CompletionMark.test.tsx`), plus
  one new end-to-end integration test in `WeeklyPlanner.test.tsx` exercising the full
  textarea-blur → `planApi.updateNotes` wiring through `usePlanActions`/`WeeklyPlanner`/`PlannerGrid`/
  `OccurrenceItem`. Full suite: 616 passed (43 files), 0 regressions. `npm run lint` (oxlint): clean.
  `tsc -b`: clean.
- **Deviation — AC-05's reset mechanism**: the implementation notes' sketch (`useEffect` keyed on
  `occurrence.id`/`occurrence.notes`) triggers oxlint's `react(set-state-in-effect)`
  cascading-render warning (a lint rule this codebase already treats as a real finding —
  `usePlanActions.ts`'s own `resetForRefetch` comment documents the same constraint). Used React's
  documented "adjust state during render" pattern instead (compare `occurrence.id`/`occurrence.notes`
  against a small `seenNotes` state snapshot each render, call `setNotesDraft` synchronously in the
  render body when they differ) — behaviourally identical (verified by the same AC-05 test case the
  spec sketched), no `useEffect` involved. No other deviations: endpoint path, field names, and the
  trim-or-null/autosave-on-blur behaviour all match the spec as written.
- **Real finding**: adding a required (non-optional) `notes: string | null` field to
  `PlannedOccurrence` required updating every existing test fixture across the codebase that builds
  a `PlannedOccurrence` literal (`OccurrenceItem.test.tsx`, `PlannerGrid.test.tsx`,
  `BucketList.test.tsx`, `CrossSectionDrag.test.tsx`, `WeeklyPlanner.test.tsx`, `TodayView.test.tsx`,
  `weeklySummaryStats.test.ts`, `WeeklySummary.test.tsx`) plus every caller threading
  `onCarryForward`-shaped props through `PlannerGrid`/`BucketList` (same files, plus their harnesses
  in `CrossSectionDrag.test.tsx`). None of this was caught by `vitest` alone (esbuild strips types
  without checking) — only `tsc -b` catches a missing-required-field regression here, so that was
  run explicitly as part of verifying this change even though the task's Definition of Done only
  names `npm test`/`npm run lint`.

## Acceptance Criteria Summary

- [x] FRONTEND-043-AC-01: Textarea seeded from the occurrence's current note
- [x] FRONTEND-043-AC-02: Autosave on blur when the note changed
- [x] FRONTEND-043-AC-03: No save call when the value didn't change
- [x] FRONTEND-043-AC-04: 200-character limit with a live counter
- [x] FRONTEND-043-AC-05: Textarea resets when a different occurrence's card opens
- [x] FRONTEND-043-AC-06: Has-notes indicator on the tile
- [x] FRONTEND-043-AC-07: Has-notes hint in the Weekly Summary tooltip
