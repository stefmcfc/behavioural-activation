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

## Cross-references

| This spec depends on / contracts against | Why |
|---|---|
| `frontend_spec_043_occurrence_notes.md` | Origin of `CompletionMark`'s has-notes hint (`FRONTEND-043-AC-07`), whose hint *content* this spec replaces |
| `planner_spec_022_occurrence_notes.md` | Backend's 200-character cap on `notes`, which is why no truncation logic is needed here |

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
  `white-space: normal;`, add `max-width: min(85vw, 16rem);` and `text-align: left;` so a long note
  wraps legibly instead of overflowing. Centring (`left: 50%; transform: translateX(-50%);`) stays
  unchanged — only the box's own width/wrapping behavior changes.

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

**Test Case (Green)**: update `CompletionMark.tsx`/`.module.css` as above, and update the two
existing `FRONTEND-043-AC-07` tests in `CompletionMark.test.tsx` (which assert the now-removed
`'has a note'` string) to assert the note's own text instead, until both pass.

## Acceptance Criteria Summary

- [x] FRONTEND-053-AC-01: Tooltip/`aria-label` includes the note's text, not a fixed phrase
- [x] FRONTEND-053-AC-02: Still omitted when there is no note (regression guard)
- [x] FRONTEND-053-AC-03: Tooltip wraps a long note instead of forcing one unbounded-width line

## Summary

Implemented as specced, no deviations. `CompletionMark.tsx`'s `notesHint` now interpolates
`occurrence.notes` directly instead of a fixed phrase; `.tooltip` wraps at `max-width: min(85vw,
16rem)` instead of forcing a single `nowrap` line. The two pre-existing `FRONTEND-043-AC-07` tests
in `CompletionMark.test.tsx` were updated in place (same `describe` removed in favour of this
spec's own, asserting the note text itself rather than the old fixed string) rather than left
duplicated. Full frontend suite green; verified in a real browser (both themes) that a near-200-
character note wraps inside the tooltip instead of overflowing the viewport.
