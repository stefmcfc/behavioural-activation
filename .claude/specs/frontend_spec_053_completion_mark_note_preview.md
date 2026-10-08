# Weekly Summary Tooltip Shows the Note Itself, Not Just a Hint (Frontend, bug fix)

**Status**: Implemented (2026-10-08)
**Priority**: P3 — bug fix, raised by the user 2026-10-08 after noticing the Weekly Summary
tooltip only ever says ", has a note" with no way to read the note itself without opening the
occurrence's detail card
**Depends on**: `frontend_spec_043_occurrence_notes.md` (introduced `CompletionMark`'s has-notes
hint, `FRONTEND-043-AC-07`, which this spec corrects)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish

## Overview

`frontend_spec_043` gave `CompletionMark` (the Weekly Summary's lite-grid mark) a has-notes hint:
when an occurrence has a note, its tooltip/`aria-label` gets a generic `, has a note` suffix with
no way to read the note's actual content short of opening the occurrence's detail card elsewhere.
Since `notes` is already capped at 200 characters
(`planner_spec_022_occurrence_notes.md`/`FRONTEND-043-AC-04`), there's no length concern with
showing it directly — the user asked for the note's own text in the tooltip instead of the generic
hint.

This is a narrow correction to `FRONTEND-043-AC-07` only: the hint's *content* changes from a fixed
string to the note text; the surrounding `aria-label`/tooltip construction, the has-notes gating
(non-null, non-empty), and every other `CompletionMark` behavior are unchanged.

## Requirements

### Requirement 1: Show the note's own text instead of a generic hint

**User story**: As a user hovering a completion mark in the Weekly Summary, I want to read the
actual note I wrote, so I don't have to leave the Summary tab and open the occurrence's detail
card just to remember what the note says.

#### FRONTEND-053-AC-01 [AUTO]: Tooltip/`aria-label` includes the note's text, not a fixed phrase
**Statement**: While an occurrence's `notes` is non-null and non-empty, the `CompletionMark`
component shall append `, note: ${occurrence.notes}` (the note's own text) to its tooltip text and
`aria-label`, replacing the fixed `, has a note` string `FRONTEND-043-AC-07` previously specified.

**Rationale**: `notes` is already capped at 200 characters server- and client-side
(`FRONTEND-043-AC-04`), so there is no truncation concern — the full note is always short enough to
show directly.

**References**:
- `frontend/src/components/WeeklySummary/CompletionMark.tsx:33` (`notesHint`, the single line this
  AC changes)

#### FRONTEND-053-AC-02 [AUTO]: Still omitted when there is no note (regression guard)
**Statement**: While an occurrence's `notes` is `null` or empty, the `CompletionMark` component
shall append no note-related text to its tooltip or `aria-label` — unchanged from
`FRONTEND-043-AC-07`'s existing gating.

#### FRONTEND-053-AC-03 [AUTO]: Tooltip wraps a long note instead of forcing one unbounded-width line
**Statement**: While the tooltip is visible and contains note text, the `CompletionMark` tooltip
shall wrap onto multiple lines within a bounded width, instead of rendering as a single `nowrap`
line that can grow to the width of the longest (up to 200-character) note.

**Rationale**: The tooltip's existing CSS (`CompletionMark.module.css`) uses `white-space: nowrap`,
sized correctly for the previous short fixed-phrase hint but not for note text up to 200 characters,
which would otherwise overflow the viewport on one unbroken line.

**References**:
- `frontend/src/components/WeeklySummary/CompletionMark.module.css:57` (`.tooltip`'s `white-space:
  nowrap`)
- Precedent for a capped, responsive popover width: `AccountMenu.module.css`/`SettingsMenu.module.css`
  (`max-width: min(90vw, ...)`)

### Requirement 2: Three stacked lines instead of one run-on sentence, status dropped from the visual tooltip

**User story**: As a user hovering a completion mark with a note, I want the tooltip laid out as
clear name/time/note lines rather than one dense sentence, so it reads easily instead of looking
squashed — and I don't need "completed"/"not completed" spelled out in words when the mark's own
ticked/unticked fill already tells me that.

Raised by the user 2026-10-08 immediately after Requirement 1 shipped: the single-sentence tooltip
(`{name} — {location}, {status}, note: {notes}`), now wrapped within a `16rem` box per AC-03, read
as cramped/"squashed" once a real note was appended. The user's fix request was specific: three
lines (name / day-time / notes), and drop completion status from the tooltip entirely — reasoning
by analogy to category, which this same tooltip already conveys via the mark's fill colour alone,
never spelled out in words.

#### FRONTEND-055-AC-01 [AUTO]: Visual tooltip renders as three stacked lines, dropping status
**Statement**: While the `CompletionMark` tooltip is visible, the component shall render it as up
to three separate lines — the occurrence's name, its location (day + slot, or "Weekend bucket"),
and (only while `notes` is non-null and non-empty) a `Notes: ${occurrence.notes}` line — and shall
not include completion status (`"completed"`/`"not completed"`) in this visual tooltip.

**Rationale**: A flex-column layout (one `<span>` per line) replaces the previous single
concatenated string. Status is dropped by design, not just reworded — the mark's own ticked/
unticked fill (`FRONTEND-037-AC-03`) already conveys it to a sighted user, the same way category is
conveyed by fill colour alone elsewhere in this same component, with no redundant text label.

**References**:
- `frontend/src/components/WeeklySummary/CompletionMark.tsx` (tooltip `<span>` block)
- `frontend/src/components/WeeklySummary/CompletionMark.module.css` (`.tooltip` → `display: flex;
  flex-direction: column`)

#### FRONTEND-055-AC-02 [AUTO]: `aria-label` keeps completion status (regression guard, accessibility)
**Statement**: While building the mark's `aria-label`, the `CompletionMark` component shall
continue to include completion status (`"completed"`/`"not completed"`) exactly as before
`FRONTEND-055-AC-01` — this AC applies only to the *visual* tooltip `<span>`, never to the
accessible name.

**Rationale**: A screen reader user only ever gets this `<button>`'s own `aria-label` as its
accessible name — `CompletionIcon`'s own nested `aria-label="Completed"` is overridden once an
ancestor element sets `aria-label` (per the accessible-name computation), so it is never announced
on its own. Dropping status from `aria-label` as well would be a real loss of information for a
screen reader user, not merely redundant text the way it is for a sighted user who can see the
mark's fill. This AC exists specifically to stop `FRONTEND-055-AC-01`'s visual-only change from
being over-applied to the accessible name too.

**References**:
- `frontend/src/components/icons/CompletionIcon.tsx` (`aria-label="Completed"`, overridden by the
  ancestor `<button>`'s own `aria-label`)

## Cross-references

| This spec depends on / contracts against | Why |
|---|---|
| `frontend_spec_043_occurrence_notes.md` | Origin of `CompletionMark`'s has-notes hint (`FRONTEND-043-AC-07`), whose hint *content* this spec replaces |
| `planner_spec_022_occurrence_notes.md` | Backend's 200-character cap on `notes`, which is why no truncation logic is needed here |
| `frontend_spec_037_weekly_summary_visualizations.md` | `FRONTEND-037-AC-03`'s "status via fill, paired with an icon, never colour/fill alone" precedent that `FRONTEND-055-AC-01`'s status-drop reasons from by analogy |

## Implementation notes (for `frontend-dev`)

- **`CompletionMark.tsx`**: change the `notesHint` computation (line 33) from
  ```ts
  const notesHint = occurrence.notes ? ', has a note' : ''
  ```
  to
  ```ts
  const notesHint = occurrence.notes ? `, note: ${occurrence.notes}` : ''
  ```
  No other line in this file needs to change — `aria-label` and the tooltip `<span>` already
  concatenate `notesHint` onto the end of the existing string.
- **`CompletionMark.module.css`**: on `.tooltip`, replace `white-space: nowrap;` with
  `white-space: normal;`, add `max-width: min(85vw, 18rem);` and `text-align: left;` so a long note
  wraps legibly instead of overflowing. Centring (`left: 50%; transform: translateX(-50%);`) stays
  unchanged — only the box's own width/wrapping behavior changes.
- **`CompletionMark.tsx`/`.module.css` (`FRONTEND-055-AC-01`)**: the tooltip `<span>` becomes a flex
  column (`display: flex; flex-direction: column; gap: 0.15rem;`) containing up to three child
  `<span>`s — name (bold, via a new `.tooltipName` class), location, and a conditionally-rendered
  `Notes: ${occurrence.notes}` line — instead of one concatenated string. `aria-label` is left
  untouched (`FRONTEND-055-AC-02`) and still includes `status`; only the visual tooltip's JSX and
  the `notesHint`-adjacent code comment change.

## TDD test case sketches

### CompletionMark.test.tsx

```ts
describe('FRONTEND-053-AC-01/AC-02: note text in the tooltip, replacing the generic hint', () => {
  it('includes the note\'s own text when notes is present', () => {
    render(<CompletionMark occurrence={makeOccurrence({ notes: 'Book A' })} shape="circle" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(expect.stringContaining('Book A'))
  })

  it('omits any note-related text when notes is null', () => {
    render(<CompletionMark occurrence={makeOccurrence({ notes: null })} shape="circle" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(expect.not.stringContaining('note'))
  })
})
```

```tsx
describe('FRONTEND-055-AC-01: visual tooltip is three stacked lines, with no status text', () => {
  it('shows name, location, and a labelled notes line as separate lines', () => {
    render(<CompletionMark occurrence={makeOccurrence({ notes: 'Book A' })} shape="circle" />)
    const tooltip = document.querySelector('[aria-hidden="true"]')
    const lines = Array.from(tooltip?.children ?? []).map((child) => child.textContent)
    expect(lines).toEqual(['Go for a walk', 'Monday Morning', 'Notes: Book A'])
  })

  it('omits the notes line entirely when there is no note', () => {
    render(<CompletionMark occurrence={makeOccurrence({ notes: null })} shape="circle" />)
    const tooltip = document.querySelector('[aria-hidden="true"]')
    const lines = Array.from(tooltip?.children ?? []).map((child) => child.textContent)
    expect(lines).toEqual(['Go for a walk', 'Monday Morning'])
  })

  it('never shows "completed"/"not completed" text, regardless of completion state', () => {
    const { rerender } = render(
      <CompletionMark occurrence={makeOccurrence({ completed: true })} shape="circle" />,
    )
    expect(document.querySelector('[aria-hidden="true"]')).not.toHaveTextContent(/completed/i)
    rerender(<CompletionMark occurrence={makeOccurrence({ completed: false })} shape="circle" />)
    expect(document.querySelector('[aria-hidden="true"]')).not.toHaveTextContent(/completed/i)
  })
})
```

**Test Case (Green)**: update `CompletionMark.tsx`/`.module.css` as above, and update the two
existing `FRONTEND-043-AC-07` tests in `CompletionMark.test.tsx` (which assert the now-removed
`'has a note'` string) to assert the note's own text instead, until both pass.

## Acceptance Criteria Summary

- [x] FRONTEND-053-AC-01: Tooltip/`aria-label` includes the note's text, not a fixed phrase
- [x] FRONTEND-053-AC-02: Still omitted when there is no note (regression guard)
- [x] FRONTEND-053-AC-03: Tooltip wraps a long note instead of forcing one unbounded-width line
- [x] FRONTEND-055-AC-01: Visual tooltip renders as three stacked lines, dropping status
- [x] FRONTEND-055-AC-02: `aria-label` keeps completion status (regression guard, accessibility)

## Summary

Implemented as specced, no deviations, across two rounds in the same session: Requirement 1
(`FRONTEND-053`) landed first; the user then saw it rendered with a real note and asked for the
three-line restructure in Requirement 2 (`FRONTEND-055`) immediately after.
`CompletionMark.tsx`'s `notesHint` interpolates `occurrence.notes` directly for `aria-label`
(unchanged by Requirement 2, per `FRONTEND-055-AC-02`); the visual tooltip `<span>` is now a flex
column of up to three child `<span>`s (name, bold via `.tooltipName`; location; a conditional
`Notes: ...` line), with no status text. `.tooltip` wraps at `max-width: min(85vw, 18rem)` instead
of forcing a single `nowrap` line. The two pre-existing `FRONTEND-043-AC-07` tests in
`CompletionMark.test.tsx` were updated in place for Requirement 1; Requirement 2 added three new
tests asserting the three-line structure and the status-text omission directly (querying the
`aria-hidden` tooltip element's children, since Vitest/jsdom doesn't render the CSS that makes each
`<span>` its own line — confirmed visually in a real browser instead, both themes). Full frontend
suite green (686/686), lint/`tsc -b` clean.
