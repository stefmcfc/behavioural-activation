# Weekly Summary Page Visual Refinements (Frontend)

**Status**: Implemented (2026-10-03) — all 20 ACs green, including all 5 `[MANUAL]` real-browser
checks. The segmented completion bar, lite weekly grid + lite bucket list, and location × category
breakdown chart all render in `WeeklySummary.tsx`, backed by a new shared `CompletionMark`
component, an extracted `CompletionIcon`, and `weeklySummaryStats.ts`'s new `byLocation` breakdown.
`npm test` (542 passed), `npm run lint` (clean), and `npx tsc -b --noEmit` (clean) all pass.

Real-browser verification covered all three visualizations in both Light and Dark (`AC-15`); the
full edge-case set the user specifically asked to be tested, via `localStorage`/color-input
JS-dispatch against the real Settings colour pickers rather than relying on the OS-native colour
picker dialog automation can't drive directly: a category colour set to `#000000` in Dark theme and
separately `#ffffff` in Light theme, both confirmed to still render a visible, bordered mark even in
the not-completed (no-icon, no-text) state — the actual risk case (`AC-19`); two categories
(Routine/Necessary) set to the identical hex, confirmed the completion bar still resolves each
occurrence's completed/not-completed state correctly and the breakdown chart still shows them as two
separately labelled, gap-separated segments, not one merged block (`AC-20`); and, going a step
further than the spec's own `AC-16` wording ("the same hex" could read as two-or-three), all **three**
categories set to one identical hex — the breakdown chart remained fully readable via its direct
labels and the fixed segment order/gaps alone (`AC-16`). Keyboard-only Tab navigation from a blurred
document body landed on a real `CompletionMark` button and revealed the identical detail text a
mouse hover would, confirmed via `document.activeElement` plus a visible on-screen tooltip (`AC-17`).

**One non-blocking finding from manual verification, not an AC violation**: the breakdown chart's
segment colours and legend swatches do not live-update when a category colour is changed in Settings
mid-session (confirmed via a fresh page load showing the change correctly) — unlike `CompletionMark`,
which the implementer wired to `subscribeToCategoryColorChanges`/`useSyncExternalStore` matching
`CategoryChip`'s existing pattern, the breakdown chart's own category-colour reads were not given the
same live-subscription treatment. No AC in this spec required live Settings-sync for the breakdown
chart specifically (unlike `frontend_spec_034`, which was a dedicated spec for exactly this kind of
gap elsewhere), so this isn't a spec violation — flagged here for visibility/future consideration,
not acted on.
**Priority**: P2 — V1 polish, refining the just-shipped `frontend_spec_036`
**Depends on**: `frontend_spec_036_weekly_summary.md` (origin of `WeeklySummary.tsx`,
`weeklySummaryStats.ts`'s `computeStats`, this page and its existing plain-text stats, kept
unchanged by this spec), `frontend_spec_005_navigation_and_theme.md` (origin of
`utils/categoryColors.ts`'s `getCategoryColor`/`subscribeToCategoryColorChanges`, the Okabe-Ito
default palette, and its Settings colour-picker customization — see Overview for why this spec
cannot assume the three category colours are mutually distinct), `frontend_spec_035_weekly_
planner_filter.md` (origin of the `opacity: 0.55` "muted" visual convention this spec reuses for
not-completed marks), `planner_spec_004_week_planning.md` (`PlannedOccurrence` shape — `category`,
`completed`, `dayOfWeek`, `slot`, `name` — everything these visualizations read; already fetched by
`WeeklySummary`, no new fields)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 polish

## Overview

`frontend_spec_036_weekly_summary.md` shipped the Weekly Summary tab with plain text/table stats: a
"`X of Y` activities completed (`Z`%)" line, a scheduled-vs-bucket split, and a category breakdown
table. This spec adds three richer, at-a-glance visualizations to the same page, all still computed
entirely client-side from the same `GET /api/v1/plan` response `WeeklySummary` already fetches — no
backend change.

**Researched via the `dataviz` skill and `modern-web-guidance` before drafting these requirements**:

- The app's actual category colours (`#0072b2`/`#e69f00`/`#009e73`, `utils/categoryColors.ts`'s
  Okabe-Ito defaults) were run through the dataviz skill's palette validator. Light mode: all
  CVD/lightness/chroma checks **PASS**; one **WARN** — `#e69f00`'s contrast against the light surface
  is 2.19:1, below the 3:1 mark-contrast guideline. A WARN is "not dismissable" per that skill — it
  requires a label or table-view relief channel, which `frontend_spec_036`'s kept table (and this
  spec's own direct labels, see Requirement 3) already provides. Dark mode: the lightness-band check
  **FAILS** for `#e69f00` (too light for a dark-surface mark) — a pre-existing characteristic of the
  single flat hex this app already uses everywhere (chips, grid cells) in both themes, not a
  regression this spec introduces or should fix by inventing a second, dark-tuned category palette.
  Documented here as a known, accepted characteristic, not an AC of this spec.
- The skill's form-choice table maps "part-to-whole" to a stacked bar, and its anti-patterns list
  explicitly calls out "a donut/pie for comparing close values" in favour of a bar — directly
  shaping Requirement 3's chart form (see below).
- **Category colours are not guaranteed mutually distinct.** They're user-customizable via Settings'
  colour pickers with no constraint preventing two, or all three, from being set to the same hex
  (e.g. a deliberate monochrome preference). Requirement 3's breakdown chart is the one visualization
  in this spec whose entire point is distinguishing categories from each other, so it cannot rely on
  hue alone — see that requirement's direct-labelling and fixed-ordering ACs.
- Checked `modern-web-guidance`'s tooltip guidance (`interest-triggered-tooltips`): `interestfor`/
  `popover="hint"` has limited availability (Chrome/Edge 142+ only, no Firefox/Safari, and the
  guidance's own fallback path requires layering three separate polyfills). This project has no
  existing polyfill infrastructure and no stated non-Baseline browser-support policy, so adopting it
  here would be disproportionate complexity for a V1-polish feature. **This spec instead uses a
  plain CSS-only `:hover`/`:focus-visible` tooltip** on a real `<button>` trigger — native keyboard
  operability, zero JS, Baseline-safe — with the detail text also carried in the button's
  `aria-label` so screen readers get it regardless of hover state (see Requirement 1's
  `FRONTEND-037-AC-04`).

**Status encoding, decided with the user**: completed vs. not-completed is a lightness/opacity
modulation of the occurrence's own category hue — full strength when completed, the existing
`opacity: 0.55` "muted" treatment (`frontend_spec_035`) when not — always paired with a checkmark
icon, never colour alone. This keeps category identity visible throughout Requirements 1–2 and,
per the user's own point above, degrades gracefully under a monochrome category-colour setup: the
completed/not-completed signal never depended on the three hues being distinguishable from each
other in the first place, only on each mark's own full-vs-muted contrast against itself.

**A second, more fundamental edge case the user raised: what if a category colour is white, black,
or otherwise close to the page surface itself?** The native `<input type="color">` picker in
Settings accepts any hex with no validation — nothing stops a user picking `#ffffff` or `#000000`.
`CategoryChip` (the one existing place category colour already renders as a filled shape) tolerates
this because it always shows the category's name as text inside the chip — even if the fill
visually disappears into the page, the chip's `getReadableTextColor`-computed text stays legible.
Requirements 1–2's marks are **decorative-only** (a circle/block with, at most, a checkmark icon —
no text by default), so a fill that matches or nearly matches the page surface would render a
literally invisible, contentless button, especially in the not-completed (0.55-opacity) state,
which has neither text nor an icon to fall back on. **Fix: every mark gets a visible
`border: 1px solid var(--border-strong)` regardless of its fill colour** — a visibility floor that
doesn't depend on hue, lightness, or opacity at all (see `FRONTEND-037-AC-18`). Requirement 3's
segments are protected the same way `CategoryChip` already is (every segment always carries a
direct text label, `FRONTEND-037-AC-13`) plus an explicit surface gap between adjacent segments
(`FRONTEND-037-AC-12`, revised below) so two segments sharing an identical or near-identical colour
still read as visually distinct shapes, not one merged blob.

**Kept, not replaced**: `frontend_spec_036`'s existing plain-text stats (the completed-count line,
the scheduled/bucket split, the category table) are untouched by this spec. The three new
visualizations render alongside them. This is the accessible fallback the dataviz skill requires
for any value shown only via hover/focus tooltips — already built, reused rather than duplicated.

**Out of scope**: any backend change, any mood/trend/historical data (still V1 polish, not V2 — same
boundary `frontend_spec_036` already drew), persisting these visualizations' appearance as a user
preference (e.g. no "hide this chart" toggle), and any change to `PlannerGrid`/`BucketList`
themselves (Requirement 2's "lite grid" is a new, separate, read-only rendering, not a reused or
modified `PlannerGrid`).

## Shared building blocks

**Not-completed marks use `opacity: 0.55`, not a new colour token.** Reuses `frontend_spec_035`'s
exact existing "muted" value and meaning — simpler than deriving a desaturated hex per theme, and
keeps one consistent visual vocabulary for "de-emphasised" across the app.

**`CompletionIcon` is extracted** from its current home inline in `OccurrenceItem.tsx` into
`frontend/src/components/icons/CompletionIcon.tsx` — this spec is its second consumer (the
segmented bar and lite grid both need it), matching this project's established "extract on second
use" convention (e.g. `WeekNav`'s extraction in `frontend_spec_036`). `OccurrenceItem.tsx` is
updated to import the extracted component in place of its own inline definition — no visual change.

**A new shared tooltip pattern**, used by both Requirement 1 and Requirement 2 (no new dependency,
no Popover API — see Overview for why): each mark is a `<button type="button">` with:
- An `aria-label` carrying the full detail string (e.g. `"Walk, Monday Morning, completed"` or
  `"Apply for jobs, Weekend bucket, not completed"`) — always present, independent of hover state.
- A visually-presented tooltip `<span>` (`position: absolute`, hidden by default, shown via
  `:hover`/`:focus-visible` on the button) duplicating the same text for sighted users — the
  opacity/visibility transition gated behind `@media (prefers-reduced-motion: no-preference)`,
  matching this project's one existing gated transition (`index.css`'s button hover-shadow lift).
- A hit target of at least 24px regardless of the mark's visual size (padding on the button, not
  just the painted circle/block), per the dataviz skill's interaction guidance.

**`weeklySummaryStats.ts` gains one addition**: a `byLocation` breakdown (counts per `WEEKDAY`/
`WEEKEND`/`BUCKET` location × `ActivityCategory`, for Requirement 3). Requirements 1–2 render
directly from the already-fetched `PlannedOccurrence[]` the component holds — no new derived shape
needed beyond partitioning by `completed`.

## Requirements

### Requirement 1 — Segmented completion bar

As a user, I want to see at a glance how much of this week is done versus not, with enough detail
per block that I can identify which specific activity each one represents.

- **FRONTEND-037-AC-01** [AUTO]: Given a week with at least one occurrence, `WeeklySummary` shall
  render a horizontal bar of exactly `stats.planned` blocks, one per occurrence.
- **FRONTEND-037-AC-02** [AUTO]: Completed occurrences' blocks shall render before (to the left of)
  not-completed occurrences' blocks; order within each group follows the occurrences' existing
  array order (no additional sort).
- **FRONTEND-037-AC-03** [AUTO]: Each block's background colour shall be its occurrence's category
  colour (`getCategoryColor(occurrence.category)`) at full opacity when completed, or the same
  colour at `opacity: 0.55` when not completed; a completed block additionally renders the
  `CompletionIcon`.
- **FRONTEND-037-AC-04** [AUTO]: Each block shall be a `<button type="button">` with an `aria-label`
  containing the occurrence's name and either its day/slot (e.g. "Monday Morning") or "Weekend
  bucket" if it has no `dayOfWeek`/`slot`, plus its completed/not-completed state.
- **FRONTEND-037-AC-05** [AUTO]: Given a week with zero occurrences, `WeeklySummary` shall render no
  completion bar (the existing empty-state message, unchanged, already covers this case).
- **FRONTEND-037-AC-18** [AUTO]: Every block (and, by the same shared `CompletionMark` component,
  every Requirement 2 circle) shall render with a visible `border: 1px solid var(--border-strong)`
  regardless of its category colour — a hue-independent visibility floor for the case where a
  user-chosen category colour matches or nearly matches the page surface (e.g. white in Light theme,
  black in Dark theme), which would otherwise render an invisible, contentless mark in the
  not-completed state (no text, and no icon until completed).

### Requirement 2 — Lite weekly grid and lite bucket list

As a user, I want a compact, read-only overview of where this week's activities landed and which
are done, without the full weekly grid's interactive controls.

- **FRONTEND-037-AC-06** [AUTO]: `WeeklySummary` shall render a 7-day × 3-slot grid (`ALL_DAYS` ×
  `ALL_SLOTS` from `planLabels.ts` — the full week, not tabbed Weekday/Weekend) with no Add buttons
  and no drag/rearrange/remove controls.
- **FRONTEND-037-AC-07** [AUTO]: Each grid cell shall render one small circle per occurrence
  scheduled in that day/slot (zero, one, or more, wrapping within the cell), using the same colour/
  opacity/`CompletionIcon`/tooltip treatment as Requirement 1's blocks (`FRONTEND-037-AC-03`/
  `AC-04`).
- **FRONTEND-037-AC-08** [AUTO]: Below the grid, `WeeklySummary` shall render the weekend bucket's
  occurrences as a flat, wrapped row of the same circles, ordered by `bucketPosition` (matching
  `BucketList`'s existing ordering), with no reorder/drag controls.
- **FRONTEND-037-AC-09** [AUTO]: An empty cell or an empty bucket renders no placeholder circle —
  nothing extra beyond what Requirement 1 already omits for a fully empty week.

### Requirement 3 — Location × category breakdown chart

As a user, I want to see how this week's activities split between the weekday grid, the weekend
grid, and the weekend bucket, broken down by category — in a form I can read accurately even if I've
set two or more category colours to look similar or identical.

- **FRONTEND-037-AC-10** [AUTO]: `weeklySummaryStats.ts`'s `computeStats` (or a sibling function)
  shall compute `byLocation`: for each of `WEEKDAY` (scheduled, `dayOfWeek` in `WEEKDAY_DAYS`),
  `WEEKEND` (scheduled, `dayOfWeek` in `WEEKEND_DAYS`), and `BUCKET` (`dayOfWeek === null`), a count
  per `ActivityCategory`.
- **FRONTEND-037-AC-11** [AUTO]: `WeeklySummary` shall render three horizontal stacked bars, one per
  location, each bar's total length proportional to that location's total occurrence count (not
  independently stretched to 100% each) so the three locations stay visually comparable.
- **FRONTEND-037-AC-12** [AUTO]: Within every bar, segments shall render in the fixed order Routine
  → Necessary → Pleasurable regardless of their values, coloured by `getCategoryColor` at full
  opacity (this chart does not encode completion state — no muting here), separated from their
  neighbours by a visible 2px surface-coloured gap — so two segments sharing an identical or
  near-identical category colour still read as distinct shapes, not one merged block (matches the
  dataviz skill's standard stacked-bar mark spec, and covers the same white/black/near-surface
  colour edge case `FRONTEND-037-AC-18` addresses for Requirements 1–2).
- **FRONTEND-037-AC-13** [AUTO]: Every segment shall carry a direct text label naming its category
  and count — inside the segment when it fits with padding, otherwise placed just outside/above the
  bar — never dropped to tooltip-only, since hue alone cannot be trusted to distinguish categories
  (user-customizable colours; see Overview).

  **Amended 2026-10-06** (ID unchanged): the original "fit inside, else float outside the bar" rule
  measured fit against the segment's share of its own bar — but `AC-11` already scales each bar's
  overall width down to its location's share of the busiest location's total, so a segment's share
  of its own (possibly already-shrunk) bar does not reflect its real rendered pixel width. In
  practice this let a short, low-total bar (e.g. a 4-occurrence weekend bucket, 17% of a 23-total
  weekday bar's track width) render a "fits inside" label that actually overflowed and collided with
  its neighbour. Corrected to measure a segment's share of the *whole track*
  (`planned / maxTotal`, algebraically equivalent to `share-of-own-bar × bar's-own-share-of-track`)
  against two tiers: the full "Category (N)" label down to 12% of the track, a count-only "(N)" down
  to 4%, and — only below that, where neither fits even without clipping — no inline label at all.
  The "float outside the bar" fallback is also dropped: `AC-11`'s bars are *stacked*, so an interior
  segment has no free end to float a label past without colliding with a sibling's own floated label,
  which is exactly the collision this amendment fixes. In its place every segment (labelled or not)
  gets the same hover/focus-visible tooltip pattern `CompletionMark` already uses (`AC-17`), carrying
  the full "Category (N)" text — so a segment that drops its inline label is reachable by mouse and
  keyboard alike, not literally tooltip-only in the sense the original wording warned against
  (identity is never color-alone: the legend plus this tooltip still name every segment).
- **FRONTEND-037-AC-14** [AUTO]: A legend naming the three categories (in the same fixed order)
  shall render once for the whole chart, not once per bar.

### Requirement 4 — Visual and accessibility verification

- **FRONTEND-037-AC-15** [MANUAL]: All three visualizations render legibly in both Light and Dark
  themes, verified by a real-browser check against a week with a realistic mix of categories and
  completion states (not an empty or fully-complete week) — jsdom cannot render CSS
  (`frontend_conventions.md`'s Testing Strategy note).
- **FRONTEND-037-AC-16** [MANUAL]: With all three category colours set to the same hex in Settings
  (the monochrome case), Requirement 3's breakdown chart remains readable — each bar's segments are
  still distinguishable via their direct labels and fixed order, confirmed by a real-browser check.
- **FRONTEND-037-AC-17** [MANUAL]: Tabbing (keyboard-only, no mouse) to a completion-bar block or
  lite-grid circle reveals the same detail a mouse hover would, confirmed by a real-browser check.
- **FRONTEND-037-AC-19** [MANUAL]: With a category colour set to `#ffffff` in Light theme (and
  separately, a category colour set to `#000000` in Dark theme), every mark in that category
  — completed and not-completed, block and circle — remains visibly present via its
  `FRONTEND-037-AC-18` border, confirmed by a real-browser check; the not-completed (no-icon,
  no-text) state is the one actually at risk and must be specifically checked, not just the
  completed state.
- **FRONTEND-037-AC-20** [MANUAL]: With two categories (not all three) set to the same hex in
  Settings, a week containing occurrences in both of those categories renders correctly in all three
  visualizations: Requirements 1–2's marks still show the correct completed/not-completed state per
  occurrence regardless of the shared hue, and Requirement 3's breakdown chart still shows both
  categories as visually separated segments (via the `FRONTEND-037-AC-12` surface gap) with distinct
  labels, confirmed by a real-browser check.

## Component/type changes

`frontend/src/components/icons/CompletionIcon.tsx` (new — extracted from `OccurrenceItem.tsx`,
identical SVG/markup, no visual change):

```tsx
export function CompletionIcon() {
  return (
    <svg
      className={styles.completionIcon}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label="Completed"
    >
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
```

`frontend/src/components/WeeklySummary/weeklySummaryStats.ts` (extended):

```typescript
export type SummaryLocation = 'WEEKDAY' | 'WEEKEND' | 'BUCKET'

export interface LocationStat {
  readonly location: SummaryLocation
  readonly byCategory: readonly CategoryStat[]
  readonly total: number
}

export interface WeeklyStats {
  // ...existing fields unchanged...
  readonly byLocation: readonly LocationStat[]
}
```

*(Implementer note: derive `WEEKDAY`/`WEEKEND` membership from `planLabels.ts`'s existing
`WEEKDAY_DAYS`/`WEEKEND_DAYS` constants — don't hardcode a second day list.)*

`frontend/src/components/WeeklySummary/CompletionMark.tsx` (new — the shared circle/block +
tooltip, used by both Requirement 1 and Requirement 2):

```tsx
interface CompletionMarkProps {
  readonly occurrence: PlannedOccurrence
  readonly shape: 'block' | 'circle'
}

export function CompletionMark({ occurrence, shape }: CompletionMarkProps) {
  const color = getCategoryColor(occurrence.category)
  const location = occurrence.dayOfWeek !== null && occurrence.slot !== null
    ? `${DAY_LABELS[occurrence.dayOfWeek]} ${SLOT_LABELS[occurrence.slot]}`
    : 'Weekend bucket'
  const status = occurrence.completed ? 'completed' : 'not completed'

  return (
    <button
      type="button"
      className={shape === 'block' ? styles.block : styles.circle}
      style={{ backgroundColor: color, opacity: occurrence.completed ? 1 : 0.55 }}
      aria-label={`${occurrence.name}, ${location}, ${status}`}
    >
      {occurrence.completed && <CompletionIcon />}
      <span className={styles.tooltip} aria-hidden="true">
        {occurrence.name} — {location}
      </span>
    </button>
  )
}
```

*(Implementer note: this is a starting sketch, not exact final markup — adapt as needed, e.g. if
`aria-hidden` on the tooltip span plus the button's own `aria-label` turns out to double-announce
content in a specific screen reader during manual testing, adjust accordingly. The core contract —
one accessible name covering hover-equivalent detail, a visual tooltip for sighted users, full
opacity + icon when completed vs. 0.55 opacity when not — is what the ACs above actually require.)*

`CompletionMark.module.css` (new — `FRONTEND-037-AC-18`'s hue-independent visibility floor, a fixed
border on every mark regardless of its fill colour):

```css
.block,
.circle {
  border: 1px solid var(--border-strong);
}
```

## Cross-references

| This spec | Contracts against |
|---|---|
| `frontend/src/components/icons/CompletionIcon.tsx` (new) | Extracted from `OccurrenceItem.tsx`, which is updated to import it; no visual change |
| `frontend/src/components/WeeklySummary/CompletionMark.tsx` (new) | Shared by Requirement 1 (shape `"block"`) and Requirement 2 (shape `"circle"`) |
| `frontend/src/components/WeeklySummary/weeklySummaryStats.ts` | Extended — new `byLocation`/`LocationStat`/`SummaryLocation` exports; existing exports unchanged |
| `frontend/src/components/WeeklySummary/WeeklySummary.tsx` | Extended — renders the three new visualizations alongside its existing unchanged stats |
| `utils/categoryColors.ts` | `getCategoryColor`/`subscribeToCategoryColorChanges`, unchanged — reused directly |
| `planLabels.ts` | `ALL_DAYS`, `ALL_SLOTS`, `WEEKDAY_DAYS`, `WEEKEND_DAYS`, `DAY_LABELS`, `SLOT_LABELS` — all reused unchanged |
| `OccurrenceItem.module.css` | Origin of the `opacity: 0.55` muted convention this spec's not-completed marks reuse (`frontend_spec_035`) |

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
// weeklySummaryStats.test.ts additions

describe('FRONTEND-037-AC-10: byLocation breakdown', () => {
  it('splits occurrences into WEEKDAY/WEEKEND/BUCKET, each broken down by category', () => {
    const stats = computeStats([
      makeOccurrence({ category: 'ROUTINE', dayOfWeek: 'MONDAY', slot: 'MORNING' }),
      makeOccurrence({ category: 'NECESSARY', dayOfWeek: 'SATURDAY', slot: 'AFTERNOON' }),
      makeOccurrence({ category: 'PLEASURABLE', dayOfWeek: null, slot: null }),
    ])

    const weekday = stats.byLocation.find((l) => l.location === 'WEEKDAY')!
    const weekend = stats.byLocation.find((l) => l.location === 'WEEKEND')!
    const bucket = stats.byLocation.find((l) => l.location === 'BUCKET')!

    expect(weekday.total).toBe(1)
    expect(weekday.byCategory.find((c) => c.category === 'ROUTINE')?.planned).toBe(1)
    expect(weekend.total).toBe(1)
    expect(bucket.total).toBe(1)
  })
})
```

```tsx
// WeeklySummary.test.tsx additions

describe('FRONTEND-037-AC-01/AC-02/AC-03: completion bar renders blocks, completed first', () => {
  it('renders one block per occurrence, completed before not-completed', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      makeOccurrence({ name: 'Walk', completed: true }),
      makeOccurrence({ name: 'Read', completed: false }),
    ])
    render(<WeeklySummary />)

    const blocks = await screen.findAllByRole('button', { name: /walk|read/i })
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toHaveAccessibleName(/walk/i)
    expect(blocks[0]).not.toHaveStyle({ opacity: '0.55' })
    expect(blocks[1]).toHaveAccessibleName(/read/i)
    expect(blocks[1]).toHaveStyle({ opacity: '0.55' })
  })
})

describe('FRONTEND-037-AC-04: each mark carries a full detail aria-label', () => {
  it('names the activity, its day/slot, and completion state', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      makeOccurrence({ name: 'Walk', dayOfWeek: 'MONDAY', slot: 'MORNING', completed: true }),
    ])
    render(<WeeklySummary />)

    expect(
      await screen.findByRole('button', { name: /walk.*monday morning.*completed/i }),
    ).toBeInTheDocument()
  })

  it('labels a bucket item with "Weekend bucket" instead of a day/slot', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      makeOccurrence({ name: 'Apply for jobs', dayOfWeek: null, slot: null, completed: false }),
    ])
    render(<WeeklySummary />)

    expect(
      await screen.findByRole('button', { name: /apply for jobs.*weekend bucket.*not completed/i }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-037-AC-06/AC-07: lite grid renders a circle per scheduled occurrence', () => {
  it('places a circle in the correct day/slot cell', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      makeOccurrence({ name: 'Walk', dayOfWeek: 'TUESDAY', slot: 'EVENING' }),
    ])
    render(<WeeklySummary />)

    expect(await screen.findByRole('button', { name: /walk.*tuesday evening/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-037-AC-11/AC-12/AC-13/AC-14: breakdown chart renders labelled, ordered segments', () => {
  it('renders three location bars with category-labelled segments in fixed order', async () => {
    vi.mocked(planApi.getWeek).mockResolvedValue([
      makeOccurrence({ category: 'PLEASURABLE', dayOfWeek: 'MONDAY', slot: 'MORNING' }),
      makeOccurrence({ category: 'ROUTINE', dayOfWeek: 'MONDAY', slot: 'AFTERNOON' }),
    ])
    render(<WeeklySummary />)

    const weekdayBar = await screen.findByRole('group', { name: /weekday grid/i })
    const segments = within(weekdayBar).getAllByText(/routine|necessary|pleasurable/i)
    expect(segments[0]).toHaveTextContent(/routine/i)
    expect(segments[1]).toHaveTextContent(/pleasurable/i)
  })
})

describe('FRONTEND-037-AC-18: every mark has a visible border regardless of fill colour', () => {
  it('applies the border class/style even when the category colour is white', async () => {
    vi.mocked(getCategoryColor).mockReturnValue('#ffffff')
    vi.mocked(planApi.getWeek).mockResolvedValue([makeOccurrence({ name: 'Walk', completed: false })])
    render(<WeeklySummary />)

    const block = await screen.findByRole('button', { name: /walk/i })
    expect(block).toHaveClass(styles.block)
    // the .block class itself carries the border in CompletionMark.module.css -- this asserts the
    // class is applied regardless of fill colour, not the computed border style directly (jsdom
    // doesn't render CSS; a real-browser pass, FRONTEND-037-AC-19, confirms visible appearance)
  })
})

describe('FRONTEND-037-AC-20 (regression): two categories sharing one colour still resolve correctly per-occurrence', () => {
  it('shows correct completed/not-completed state for each occurrence despite a shared category colour', async () => {
    vi.mocked(getCategoryColor).mockReturnValue('#5f7a5e') // same hex for both categories below
    vi.mocked(planApi.getWeek).mockResolvedValue([
      makeOccurrence({ name: 'Walk', category: 'ROUTINE', completed: true }),
      makeOccurrence({ name: 'Read', category: 'NECESSARY', completed: false }),
    ])
    render(<WeeklySummary />)

    const walkBlock = await screen.findByRole('button', { name: /walk/i })
    const readBlock = await screen.findByRole('button', { name: /read/i })
    expect(walkBlock).not.toHaveStyle({ opacity: '0.55' })
    expect(readBlock).toHaveStyle({ opacity: '0.55' })
  })

  it('still renders both categories as separately labelled breakdown-chart segments', async () => {
    vi.mocked(getCategoryColor).mockReturnValue('#5f7a5e')
    vi.mocked(planApi.getWeek).mockResolvedValue([
      makeOccurrence({ category: 'ROUTINE', dayOfWeek: 'MONDAY', slot: 'MORNING' }),
      makeOccurrence({ category: 'NECESSARY', dayOfWeek: 'MONDAY', slot: 'AFTERNOON' }),
    ])
    render(<WeeklySummary />)

    const weekdayBar = await screen.findByRole('group', { name: /weekday grid/i })
    expect(within(weekdayBar).getByText(/routine/i)).toBeInTheDocument()
    expect(within(weekdayBar).getByText(/necessary/i)).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement the shared `CompletionIcon` extraction, `CompletionMark`,
`weeklySummaryStats.ts`'s `byLocation` addition, and `WeeklySummary.tsx`'s three new sections until
every sketch above passes. `FRONTEND-037-AC-15`/`AC-16`/`AC-17`/`AC-19`/`AC-20` are verified
manually, per their own statements, in a real browser.

## Acceptance Criteria Summary

- [x] FRONTEND-037-AC-01 — completion bar renders one block per occurrence
- [x] FRONTEND-037-AC-02 — completed blocks render before not-completed blocks
- [x] FRONTEND-037-AC-03 — block colour/opacity/icon reflects category + completion state
- [x] FRONTEND-037-AC-04 — each mark's `aria-label` carries name, day/slot or bucket, and status
- [x] FRONTEND-037-AC-05 — a zero-occurrence week renders no completion bar
- [x] FRONTEND-037-AC-06 — lite grid covers all 7 days × 3 slots, no interactive controls
- [x] FRONTEND-037-AC-07 — each cell renders one circle per scheduled occurrence, wrapping as needed
- [x] FRONTEND-037-AC-08 — lite bucket list renders bucket occurrences as ordered circles
- [x] FRONTEND-037-AC-09 — empty cells/bucket render no placeholder
- [x] FRONTEND-037-AC-10 — `byLocation` breakdown computed correctly per location × category
- [x] FRONTEND-037-AC-11 — three stacked bars, length proportional to each location's total
- [x] FRONTEND-037-AC-12 — segments always in fixed order, separated by a visible surface gap
- [x] FRONTEND-037-AC-13 — full label, else count-only, else no inline label — measured against the
      whole track (amended 2026-10-06); every segment, labelled or not, carries a hover/focus tooltip
- [x] FRONTEND-037-AC-14 — one shared legend, not per-bar
- [x] FRONTEND-037-AC-15 — all three visualizations legible in Light and Dark (real-browser check)
- [x] FRONTEND-037-AC-16 — breakdown chart stays readable under monochrome category colours (real-browser check)
- [x] FRONTEND-037-AC-17 — keyboard focus reveals the same detail as mouse hover (real-browser check)
- [x] FRONTEND-037-AC-18 — every mark has a visible border regardless of fill colour
- [x] FRONTEND-037-AC-19 — white (Light)/black (Dark) category colours still render visible marks, especially not-completed (real-browser check)
- [x] FRONTEND-037-AC-20 — two categories sharing one colour still resolve correctly per-occurrence and stay visually separated in the breakdown chart (real-browser check)
