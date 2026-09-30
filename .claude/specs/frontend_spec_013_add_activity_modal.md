# Add/Edit Activity Modal with Category Guidance (Frontend)

**Status**: Implemented — all 28 ACs verified (2026-09-30), including FRONTEND-013-AC-16, the
Round 2 amendment's FRONTEND-013-AC-23/AC-24, and the Round 3 amendment's FRONTEND-013-AC-27/AC-28
(modal, `CategoryGuidance`, coloured category pills (including their focus outline, unclipped), the
repeatable info box, and the "Show archived"/"Add activity" toolbar all confirmed legible in a real
browser, both Light and Dark). Full real-browser pass also confirmed the create→list,
edit→prefill→save, and Cancel flows end to end against real Postgres.
**Priority**: P2 — from the "Activity Bank UX improvements" batch raised by the user right after
`frontend_spec_006_repeatable_activities.md` shipped (`.claude/ideas/future_ideas.md`), confirmed
2026-09-30 as worth specifying now.
**Depends on**: `frontend_spec_009_add_picker_modal.md` (the `Modal` primitive this spec wraps
`ActivityForm` in — **must be implemented first**; this spec imports `Modal.tsx`, it does not
re-specify or duplicate it), `frontend_spec_002_activity_bank.md` (origin of `ActivityForm.tsx`,
`ActivityBank.tsx`, `CategoryPicker.tsx`), `frontend_spec_006_repeatable_activities.md` (most recent
prior state of `ActivityForm`'s fields — adds `repeatable`), `frontend_spec_007_visual_refresh.md`
(CSS Modules + theme custom-properties convention `CategoryGuidance`'s styles follow)
**Area**: Frontend (frontend-only — no backend change; `POST`/`PUT /api/v1/activities`'s request/
response shape is unchanged. Per this project's spec-numbering convention, numbers move in lockstep
across `planner_spec_NNN`/`frontend_spec_NNN` even when only one side has content, so there is
deliberately no `planner_spec_013_*.md` — same precedent as `frontend_spec_009_add_picker_modal.md`)
**Roadmap version**: V1 (extends the core Activity Bank's create/edit interaction from `product.md`'s
V1 row — not V2's tracking/reflection scope, and not AI)

## Overview

Today, `ActivityBank` renders a single `ActivityForm` unconditionally at the very bottom of the
page — in create mode by default, swapped into edit mode (same component instance, same position)
when a row's "Edit" is activated. Both paths send the user's attention to the bottom of a
potentially long list, the same "too much navigation involved" complaint that motivated
`frontend_spec_009_add_picker_modal.md` for the Weekly Planner's "Add" picker. This spec applies the
same fix here: activity creation and editing move into a modal dialog (`Modal`, from
`frontend_spec_009`) that opens at the point of interaction.

Separately, the user raised (`.claude/ideas/future_ideas.md`, "Activity Bank UX improvements"
batch): a new/returning user often doesn't already know the Behavioural Activation framework's
category definitions, and has no guidance in the current bare `CategoryPicker` (three radio buttons
with only a label each) to help pick the right one. This spec adds a `CategoryGuidance` block,
rendered inside the same modal alongside `CategoryPicker`, always visible (not hidden behind further
interaction) — a short purpose statement and one example per category, plus a note that the same
activity can belong to a different category depending on why it's being done, sourced directly from
`.claude/HIGH_LEVEL_DESIGN.md`'s own worked examples ("Cooking dinner because food is needed →
Necessary. Trying a new curry recipe because it sounds enjoyable → Pleasurable. A daily walk as part
of a routine → Routine. A walk somewhere interesting because it is enjoyable → Pleasurable.") and
`.claude/steering/product.md`'s framing (an activity "can be Necessary one day and Pleasurable
another, depending on why it's being done").

This ties back to `.claude/HIGH_LEVEL_DESIGN.md`'s US-001 (add an activity to the catalogue) and
US-002 (categorise it) — the same user stories `frontend_spec_002_activity_bank.md` delivered the
first version of; this spec relocates and adds category guidance to that same interaction without
changing its underlying capability (still `activityApi.create`/`activityApi.update`, unchanged
request/response shape).

**Confirmed with the user 2026-09-30** (resolving three open questions before writing ACs below):
1. This is a **separate spec** from the equivalent sub-task modal
   (`frontend_spec_014_add_subtask_modal.md`) — matching `frontend_spec_009`'s one-spec-per-call-site
   precedent, even though both reuse the same `Modal` primitive.
2. **Both Create and Edit move into the modal** — not create-only. `ActivityForm`'s existing edit-mode
   inline swap-in-place has the identical "attention jumps within a long list" problem as create's
   bottom-of-page position, so both get fixed together rather than leaving Edit as a follow-up.
3. **`frontend_spec_009_add_picker_modal.md` must be implemented first.** It's already fully specced
   and next in the queue; this spec's `Modal` import assumes `Modal.tsx` already exists rather than
   speccing a second copy or a forward-reference.

**Out of scope**: any redesign of `ActivityForm`'s own field set (name/category/description/
repeatable — unchanged, `frontend_spec_006`'s scope) or its validation rules. The equivalent sub-task
modal (`frontend_spec_014_add_subtask_modal.md`, separate spec). `CategoryPicker`'s own radio-button
interaction pattern (unchanged — `CategoryGuidance` is a new, separate, adjacent block, not a rework
of the picker itself). Any backend change. A "filter by category" control or a sub-task count on
`CategoryChip` (separate, unconfirmed ideas in the same `future_ideas.md` batch — not this spec).

## Requirements

### Requirement 1 — Activity creation happens in a modal, not an always-visible bottom-of-page form

As a user, I want clicking "Add activity" to open a focused dialog right there, not have my
attention sent to a form permanently sitting at the bottom of a potentially long activity list.

- **FRONTEND-013-AC-01** [AUTO]: While `ActivityBank`'s `formTarget` state is `null`, `ActivityBank`
  shall render no `ActivityForm` anywhere in the document — replacing today's always-visible,
  always-mounted create form.
- **FRONTEND-013-AC-02** [AUTO]: When "Add activity" is activated, `ActivityBank` shall set
  `formTarget` to `'create'`.
- **FRONTEND-013-AC-03** [AUTO]: While `formTarget` is `'create'`, `ActivityBank` shall render
  `Modal` with `isOpen` `true`, wrapping `ActivityForm` in create mode.

### Requirement 2 — Editing an activity also happens in the same modal

As a user, I want editing an activity to open the same kind of focused dialog, not swap the
page-bottom form into edit mode in place.

- **FRONTEND-013-AC-04** [AUTO]: When "Edit" is activated on an activity row, `ActivityBank` shall
  set `formTarget` to that row's `Activity`.
- **FRONTEND-013-AC-05** [AUTO]: While `formTarget` is an `Activity`, `ActivityBank` shall render
  `Modal` with `isOpen` `true`, wrapping `ActivityForm` in edit mode for that activity — replacing
  today's inline swap-in-place edit form.
- **FRONTEND-013-AC-06** [AUTO]: While `formTarget` is `null`, each activity row's "Edit" control
  shall remain visible and clickable exactly as today — only the destination of activation changes
  (opens the modal instead of swapping the bottom form).

### Requirement 3 — Category guidance helps the user pick a category

As a new or returning user who doesn't already know the Behavioural Activation framework's category
definitions, I want a plain explanation of what Routine/Necessary/Pleasurable mean, with an example
each, visible right where I'm choosing — not something I have to already know or look up elsewhere.

- **FRONTEND-013-AC-07** [AUTO]: `ActivityForm` shall render a `CategoryGuidance` block adjacent to
  `CategoryPicker`, in both create and edit mode, unconditionally visible (not hidden behind a
  tooltip, expand/collapse, or further interaction).
- **FRONTEND-013-AC-08** [AUTO]: `CategoryGuidance` shall display, for each of Routine, Necessary,
  and Pleasurable, a short purpose statement and one concrete example (content per the Component/
  type changes section below, sourced from `HIGH_LEVEL_DESIGN.md`'s worked examples).
- **FRONTEND-013-AC-09** [AUTO]: `CategoryGuidance` shall additionally state that the same activity
  can belong to a different category depending on why it's being done (e.g. cooking dinner because
  food is needed is Necessary; trying a new recipe because it sounds enjoyable is Pleasurable) —
  sourced from `product.md`'s own framing, not a new product decision.

### Requirement 4 — Accessible modal naming, and closing behaviour equivalent to today

As a user, I want the dialog announced with a meaningful name, and to be able to back out of it
cleanly — via Cancel, Escape, or clicking outside — with no side effect, exactly as today's
`onCancel`/`onSuccess` already guarantee.

- **FRONTEND-013-AC-10** [AUTO]: `ActivityForm` shall render a heading carrying an `id` — text "Add
  activity" in create mode, "Edit activity" in edit mode — and `ActivityBank` shall pass that same
  `id` as `Modal`'s `titleId`.
- **FRONTEND-013-AC-11** [AUTO]: `ActivityForm`'s create-mode submit button shall read "Save
  activity" (renamed from today's "Add activity", which now names the page-level trigger control
  instead — the two are both present in the document once the modal is open, so must not share an
  accessible name). Edit mode's existing "Save changes" label is unchanged.
- **FRONTEND-013-AC-12** [AUTO]: `ActivityForm` shall render a Cancel button in create mode
  (previously rendered only in edit mode), invoking the same `onCancel` prop edit mode already uses.
- **FRONTEND-013-AC-13** [AUTO]: When `ActivityForm`'s Cancel is activated, or a create/edit
  submission completes successfully, `ActivityBank` shall set `formTarget` to `null` — equivalent to
  today's `onCancel`/`onSuccess` wiring, now also closing the modal.
- **FRONTEND-013-AC-14** [AUTO]: When the dialog is closed via `Modal`'s `onClose` (Escape or a
  backdrop click, per `frontend_spec_009`'s `Modal` contract), `ActivityBank` shall set `formTarget`
  to `null`, with no call to `activityApi.create`/`activityApi.update`.

### Requirement 5 — Only one modal instance open at a time

As a user, I want activating a second "Add activity" or "Edit" while the modal is already open to
just retarget it, not stack a second dialog.

- **FRONTEND-013-AC-15** [AUTO]: While the modal is open for one `formTarget` and a different "Add
  activity"/"Edit" control is activated, `ActivityBank` shall update `formTarget` to the new target
  without rendering a second `Modal`/dialog — at most one element with `role="dialog"` shall exist in
  the document at any time.

### Requirement 6 — Real-browser visual verification

As a user, I want the modal and its category guidance to actually look right — legible, sensibly
laid out — in both themes, not just structurally correct in the DOM.

- **FRONTEND-013-AC-16** [MANUAL]: The modal (backdrop, dialog position) and `CategoryGuidance`
  (legible at the design system's smaller/quieter text sizes, correct contrast) render correctly in
  both Light and Dark themes. Verified by a real-browser check, since jsdom does not render CSS
  (`frontend_conventions.md`'s Testing Strategy note).

### Requirement 7 — Round 2 amendment: visual polish after first real-browser review

After PR #11 (implementing this spec and `frontend_spec_014_add_subtask_modal.md`) was opened, the
user reviewed real-browser screenshots and asked for five refinements, confirmed 2026-09-30: (1)
Category should appear before Name, not after; (2) Category options should render as coloured pills
matching the app's live category colours, not plain radio buttons; (3) the Name/Description labels
should share the same quiet typography as the Category legend, with the input stacked underneath
rather than inline; (4) Save/Cancel should be right-aligned; (5) an info box near "Repeatable" should
explain what repeatable vs. one-off means in this app's context. Implementing (3)/(4) surfaced a
regression: the taller form (guidance text + new hint) overflowed `Modal`'s
`max-height: min(85vh, 40rem)` with `overflow: hidden`, clipping the Save/Cancel buttons entirely off
-screen and out of the accessibility tree. Fixed by giving `ActivityForm` the same scrollable-body +
pinned-footer split `AssignActivityPicker` already uses (`frontend_spec_009`).

- **FRONTEND-013-AC-17** [AUTO]: `ActivityForm` shall render `CategoryPicker` (and its adjacent
  `CategoryGuidance`) before the Name field, in both create and edit mode.
- **FRONTEND-013-AC-18** [MANUAL]: Each `CategoryPicker` option shall render as a coloured pill using
  that category's live colour from `getCategoryColor` (`utils/categoryColors.ts` — the same
  Settings-customisable colours `CategoryChip` uses), with `getReadableTextColor` applied to the
  selected pill's text, and shall update live if the user changes a category colour in Settings while
  the modal is open (`useSyncExternalStore(subscribeToCategoryColorChanges, ...)`, same mechanism as
  `CategoryChip`). Verified by a real-browser check — colour contrast isn't visible to jsdom.
  Unselected pills use the theme's neutral `--surface`/`--border`, not a category colour.
  Note: this AC also resolves the "awkward fieldset/legend indentation" feedback — replacing the
  bare-`<fieldset>`/radio layout removes the browser's default fieldset border and padding as a
  byproduct of the new pill markup, not a separate change.
- **FRONTEND-013-AC-19** [AUTO]: The Name and Description fields' `<label>` elements shall share
  `CategoryPicker`'s legend typography (small, bold, uppercase, letter-spaced — the shared "quiet
  label" convention already used elsewhere in this app, e.g. `PlannerGrid`'s day/slot labels), each
  stacked directly above its input rather than inline beside it.
- **FRONTEND-013-AC-20** [AUTO]: `ActivityForm`'s Save/Cancel buttons shall be right-aligned within
  their footer row.
- **FRONTEND-013-AC-21** [AUTO]: `ActivityForm` shall render a short explanatory note next to the
  Repeatable checkbox distinguishing repeatable activities (default; recur indefinitely) from one-off
  activities (auto-archived once every planned occurrence is completed — per
  `frontend_spec_006_repeatable_activities.md`'s existing auto-archive behaviour, described here for
  the user, not a new behaviour).
- **FRONTEND-013-AC-22** [AUTO]: `ActivityForm` shall render its content (heading, `CategoryPicker`,
  `CategoryGuidance`, Name, Description, Repeatable + hint, and any validation/submit error) inside an
  independently-scrollable region, with the Save/Cancel footer outside that region so it stays visible
  regardless of content height or `Modal`'s `max-height` — fixing the clipped-footer regression
  described above.
- **FRONTEND-013-AC-23** [MANUAL]: The reordered, coloured-pill, restyled `ActivityForm` (including
  the pinned footer under scroll) renders correctly in both Light and Dark themes, and the Save/Cancel
  footer remains visible and operable after scrolling the form's content in a real browser.

A follow-up real-browser check (same day, user-reported) found a further clipping bug in
`CategoryPicker`'s pills: `.option:focus-within`'s `outline: 2px solid; outline-offset: 2px` (4px of
total extension beyond the pill's border) was silently clipped on its left edge for the first pill in
the row, because `.scrollBody`'s `overflow-y: auto` forces `overflow-x` to compute to `auto` too (per
the CSS overflow spec, one non-`visible` axis forces the other away from `visible`), and `.group`
(`CategoryPicker.module.css`) sits flush against `.scrollBody`'s own content edge with no horizontal
padding to absorb the outline. Confirmed via `getBoundingClientRect()`: the outline's left edge sat
exactly on the scroll clip boundary (zero clearance), clipped by subpixel rounding.

- **FRONTEND-013-AC-24** [MANUAL]: `ActivityForm`'s `.scrollBody` (and `SubTaskForm`'s, for
  consistency — `frontend_spec_014`) reserves enough horizontal padding to fully contain a focused
  pill's outline (`outline-width` + `outline-offset`) without clipping, verified by a real-browser
  check that the first category pill's focus outline renders fully on all four sides when clicked, in
  both Light and Dark themes. `AssignActivityPicker`'s equivalent filter pills (`frontend_spec_009`)
  were checked and found not to exhibit this bug — its filter pills sit inside a padded `.panel`
  wrapper, giving their outline enough clearance already; no fix needed there.

### Requirement 8 — Round 3 amendment: the "Add activity"/"Show archived" toolbar row

After the Round 2 review, the user flagged the `ActivityBank` header row — "Show archived" and "Add
activity", sitting directly under the "Activity Bank" `h2` — as visually inconsistent with the rest
of the app: a plain native checkbox instead of a pill, "Add activity" left-aligned rather than
right-aligned, and no visual grouping to read as a toolbar rather than just more list content.
Confirmed in scope for this spec (not a new spec candidate) because "Add activity" is a control this
spec itself introduced (Requirement 1) — its own presentation is fair game for the same real-browser
polish pass the rest of the spec already went through, not a separate unrelated feature.

- **FRONTEND-013-AC-25** [AUTO]: `ActivityBank` shall render "Show archived" and "Add activity"
  inside a single shared container (`.toolbar`), rather than as bare siblings directly under the
  `<h2>`.
- **FRONTEND-013-AC-26** [AUTO]: Within that container, "Add activity" shall be right-aligned
  (`margin-left: auto` inside a flex row).
- **FRONTEND-013-AC-27** [MANUAL]: The "Show archived" checkbox shall render as a pill using the same
  segmented-control idiom as `CategoryPicker`/Settings' theme picker (visually-hidden native
  checkbox, `:has(input:checked)` for the filled/accent state, `:focus-within` outline) rather than a
  bare native checkbox. Verified by a real-browser check in both Light and Dark that the checked and
  unchecked states are both legible and the focus outline is not clipped (the same class of bug fixed
  by `FRONTEND-013-AC-24` — this new pill is not inside a `.scrollBody`, so it isn't at risk, but the
  real-browser check confirms that directly rather than assuming it).
- **FRONTEND-013-AC-28** [MANUAL]: The `.toolbar` container shall render with a background and border
  that visually distinguish it from the plain list rows below it, reading as a toolbar/header rather
  than another content row — matching the existing bordered-panel treatment already used by
  `AssignActivityPicker`'s `.panel` (`frontend_spec_009`). Verified by a real-browser check in both
  Light and Dark.

## Component/type changes

`utils/categoryGuidance.ts` (new):

```typescript
import type { ActivityCategory } from '../types/activity'

export interface CategoryGuidanceEntry {
  readonly purpose: string
  readonly example: string
}

export const CATEGORY_GUIDANCE: Record<ActivityCategory, CategoryGuidanceEntry> = {
  ROUTINE: {
    purpose:
      "Something you do as a regular habit or part of your normal rhythm — done because it's " +
      'routine, not because it’s urgent or especially enjoyable.',
    example: 'A daily walk you always take.',
  },
  NECESSARY: {
    purpose:
      "Something that needs doing regardless of how it feels — driven by obligation or " +
      'practical need.',
    example: 'Cooking dinner because food is needed.',
  },
  PLEASURABLE: {
    purpose:
      "Something you do mainly because it's enjoyable or rewarding, not because it's routine " +
      'or required.',
    example: 'Trying a new recipe because it sounds fun.',
  },
}
```

`CategoryGuidance.tsx` (new, `frontend/src/components/ActivityBank/`):

```tsx
import { CATEGORY_LABELS } from '../../utils/categoryLabels'
import { CATEGORY_GUIDANCE } from '../../utils/categoryGuidance'
import type { ActivityCategory } from '../../types/activity'
import styles from './CategoryGuidance.module.css'

const ALL_CATEGORIES: readonly ActivityCategory[] = ['ROUTINE', 'NECESSARY', 'PLEASURABLE']

export function CategoryGuidance() {
  return (
    <div className={styles.guidance}>
      {ALL_CATEGORIES.map((category) => (
        <p key={category}>
          <strong>{CATEGORY_LABELS[category]}</strong> — {CATEGORY_GUIDANCE[category].purpose}{' '}
          <em>Example: {CATEGORY_GUIDANCE[category].example}</em>
        </p>
      ))}
      <p>
        The same activity can belong to a different category depending on why you're doing it — a
        walk can be Routine one day and Pleasurable another.
      </p>
    </div>
  )
}
```

`ActivityForm.tsx` (extended — heading, `CategoryGuidance`, renamed create-mode submit button,
create-mode Cancel; Round 2 amendment reorders Category before Name, gives Name/Description the
shared quiet-label typography, and splits content into a scrollable body + pinned, right-aligned
footer):

```tsx
const headingId = `activity-form-title-${mode}`

// ...

<form onSubmit={handleSubmit} noValidate className={styles.form}>
  <div className={styles.scrollBody}>
    <h3 id={headingId}>{mode === 'edit' ? 'Edit activity' : 'Add activity'}</h3>

    <CategoryPicker value={category} onChange={setCategory} name={`category-${mode}`} />
    <CategoryGuidance />

    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={nameId}>Name</label>
      <input id={nameId} /* ... */ />
    </div>

    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={descriptionId}>Description</label>
      <textarea id={descriptionId} /* ... */ />
    </div>

    <div className={styles.repeatableField}>
      <label htmlFor={repeatableId}>
        <input id={repeatableId} type="checkbox" /* ... */ />
        Repeatable
      </label>
      <p className={styles.repeatableHint}>
        Repeatable activities (the default) are things you do again and again, like "Go for a
        walk" — they stay in your Activity Bank indefinitely. Turn this off for a one-off, like
        "Apply for jobs": once every planned occurrence of it is completed, it's automatically
        archived out of your everyday list (you can still view and unarchive it later).
      </p>
    </div>

    {/* validation/submit error, unchanged */}
  </div>

  <div className={styles.actions}>
    <button type="submit" disabled={isSubmitting}>
      {mode === 'edit' ? 'Save changes' : 'Save activity'}
    </button>
    {onCancel && (
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    )}
  </div>
</form>
```

`onCancel` becomes required in practice for both modes once `ActivityBank` always supplies it (the
prop itself can stay optional in the type — no call site outside this spec's scope needs to change).

`CategoryPicker.tsx` (Round 2 amendment — rewritten from plain radio buttons to coloured pills):

```tsx
function CategoryOption({ category, checked, name, onChange }: CategoryOptionProps) {
  const backgroundColor = useSyncExternalStore(subscribeToCategoryColorChanges, () =>
    getCategoryColor(category),
  )
  const textColor = getReadableTextColor(backgroundColor)
  const style = checked ? { backgroundColor, borderColor: backgroundColor, color: textColor } : undefined

  return (
    <label className={styles.option} style={style}>
      <input type="radio" name={name} value={category} checked={checked} onChange={() => onChange(category)} />
      {CATEGORY_LABELS[category]}
    </label>
  )
}
```

`ActivityForm.module.css` (Round 2 amendment — `.form`/`.scrollBody` split, `.fieldLabel` quiet-label
typography, right-aligned `.actions` footer):

```css
.form { display: flex; flex-direction: column; min-height: 0; }
.scrollBody {
  overflow-y: auto;
  min-height: 0;
  flex: 1 1 auto;
  /* padding + matching negative margin: absorbs a focused pill's outline without
     shifting content — overflow-y: auto forces overflow-x to auto too, so any
     child flush against this edge would otherwise clip its own focus outline */
  padding: 0 6px;
  margin: 0 -6px;
}
.fieldLabel { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.actions { display: flex; justify-content: flex-end; gap: 0.5rem; flex-shrink: 0; border-top: 1px solid var(--border); }
```

`ActivityBank.tsx` (state and rendering — the activity list/row markup, `showArchived`, delete/
unarchive flows are all unrelated and unchanged):

```tsx
const [formTarget, setFormTarget] = useState<'create' | Activity | null>(null)

const handleCloseForm = () => setFormTarget(null)

const handleFormSuccess = (activity: Activity) => {
  setActivities((previous) => /* unchanged merge logic */)
  setFormTarget(null)
}

// ...

<button type="button" onClick={() => setFormTarget('create')}>
  Add activity
</button>

{/* ...activity list, "Edit" now does setFormTarget(activity) instead of setEditingActivity(activity) */}

<Modal
  isOpen={formTarget !== null}
  titleId={`activity-form-title-${formTarget === 'create' || formTarget === null ? 'create' : 'edit'}`}
  onClose={handleCloseForm}
>
  {formTarget !== null && (
    <ActivityForm
      key={formTarget === 'create' ? 'create' : formTarget.id}
      mode={formTarget === 'create' ? 'create' : 'edit'}
      activity={formTarget === 'create' ? undefined : formTarget}
      onSuccess={handleFormSuccess}
      onCancel={handleCloseForm}
    />
  )}
</Modal>
```

`CategoryGuidance.module.css` (new, following `frontend_spec_007_visual_refresh.md`'s theme
custom-property convention — small, quiet, secondary text, not competing visually with the picker
itself):

```css
.guidance {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--text);
}

.guidance strong {
  color: var(--text-h);
}

.guidance em {
  font-style: normal;
  opacity: 0.8;
}
```

`ActivityBank.tsx`/`ActivityBank.module.css` (Round 3 amendment — "Show archived"/"Add activity"
toolbar):

```tsx
<div className={styles.toolbar}>
  <label className={styles.archivedToggle}>
    <input type="checkbox" checked={showArchived} onChange={/* ... */} />
    Show archived
  </label>

  <button type="button" className={styles.addButton} onClick={() => setFormTarget('create')}>
    Add activity
  </button>
</div>
```

```css
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px; /* matches AssignActivityPicker's .panel */
  padding: 0.65rem 0.85rem;
  margin-bottom: 1rem;
}

.archivedToggle { /* same segmented-pill idiom as CategoryPicker/.themeList */
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.35rem 0.85rem; border-radius: 999px;
  border: 1px solid var(--border); background: var(--surface);
  font-size: 0.85rem; font-weight: 600; cursor: pointer;
}
.archivedToggle:has(input:checked) { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.archivedToggle:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.archivedToggle input[type='checkbox'] { /* visually-hidden, same clip-rect technique */ }

.addButton { margin-left: auto; }
```

## Cross-references

| This spec | Contracts against |
|---|---|
| `Modal.tsx` (`frontend_spec_009_add_picker_modal.md`) | Reused unmodified — must be implemented first |
| `ActivityForm.tsx` (`frontend_spec_002_activity_bank.md`, extended by `frontend_spec_006_repeatable_activities.md`) | Extended — heading + `id`, `CategoryGuidance`, renamed create-mode submit button, create-mode Cancel |
| `ActivityBank.tsx` | Extended — `formTarget` state replaces `editingActivity`, `Modal` wraps `ActivityForm`; Round 3 amendment: "Show archived"/"Add activity" moved into a shared `.toolbar` container |
| `CategoryPicker.tsx` | Round 2 amendment: rewritten from plain radio buttons to coloured pills (`getCategoryColor`/`getReadableTextColor`, same as `CategoryChip`) |
| `CategoryGuidance.tsx` / `utils/categoryGuidance.ts` (new) | No prior art — new files this spec introduces |
| `POST`/`PUT /api/v1/activities` (`planner_spec_002_activity_bank.md`) | Unchanged — `activityApi.create`/`update`'s request/response shape is untouched |
| `frontend_spec_014_add_subtask_modal.md` (sibling, same batch) | Separate spec, same `Modal` reuse pattern — no shared state or component beyond `Modal` itself |

`ActivityForm.test.tsx` and `ActivityBank.test.tsx`'s existing tests assert `name: /add activity/i`
for the create-mode submit button (now "Save activity") and exercise the always-visible bottom form
directly (now conditionally rendered inside `Modal`, requiring "Add activity"/"Edit" to be clicked
first) — both will need updating during implementation, not a new AC, an implementation-time
consequence of AC-02/AC-03/AC-11 noted here per this project's usual practice
(`frontend_spec_008_occurrence_detail_card.md`'s Test Case notes made the same kind of call-out).

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
const walk: Activity = {
  id: 'a1', name: 'Go for a walk', category: 'ROUTINE', description: null,
  repeatable: true, archived: false, createdAt: '2026-09-01T00:00:00Z',
}

describe('FRONTEND-013-AC-01/AC-02/AC-03: Add activity opens a modal, not a bottom form', () => {
  it('renders no form until Add activity is clicked, then opens it in a dialog', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<ActivityBank />)

    await screen.findByText(/no activities yet/i)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /add activity/i }))

    expect(await screen.findByRole('dialog', { name: /add activity/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-013-AC-04/AC-05: Edit opens the same modal in edit mode', () => {
  it('opens a dialog titled "Edit activity" pre-filled with the row\'s data', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    render(<ActivityBank />)

    await userEvent.click(await screen.findByRole('button', { name: /^edit$/i }))

    expect(await screen.findByRole('dialog', { name: /edit activity/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('Go for a walk')
  })
})

describe('FRONTEND-013-AC-07/AC-08/AC-09: category guidance is always visible with examples', () => {
  it('shows a purpose and example for each category, and the cross-category note', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<ActivityBank />)

    await userEvent.click(screen.getByRole('button', { name: /add activity/i }))
    await screen.findByRole('dialog')

    expect(screen.getByText(/cooking dinner because food is needed/i)).toBeInTheDocument()
    expect(screen.getByText(/a daily walk you always take/i)).toBeInTheDocument()
    expect(screen.getByText(/trying a new recipe because it sounds fun/i)).toBeInTheDocument()
    expect(
      screen.getByText(/same activity can belong to a different category/i),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-013-AC-11: create-mode submit button is "Save activity", not "Add activity"', () => {
  it('does not collide with the page-level trigger\'s own label', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<ActivityBank />)

    await userEvent.click(screen.getByRole('button', { name: /add activity/i }))
    await screen.findByRole('dialog')

    expect(screen.getByRole('button', { name: /^add activity$/i })).toBeInTheDocument() // the trigger, still present
    expect(screen.getByRole('button', { name: /^save activity$/i })).toBeInTheDocument() // the submit
  })
})

describe('FRONTEND-013-AC-12/AC-13: Cancel in create mode closes with no create call', () => {
  it('calls onCancel equivalent, no activityApi.create, and closes the modal', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    render(<ActivityBank />)

    await userEvent.click(screen.getByRole('button', { name: /add activity/i }))
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(activityApi.create).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-013-AC-15: a second Add/Edit while open retargets, never a second dialog', () => {
  it('switches from create to edit without stacking a dialog', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([walk])
    render(<ActivityBank />)

    await userEvent.click(screen.getByRole('button', { name: /add activity/i }))
    await screen.findByRole('dialog', { name: /add activity/i })

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))

    expect(await screen.findByRole('dialog', { name: /edit activity/i })).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
})
```

**Test Case (Green)**: implement `utils/categoryGuidance.ts`, `CategoryGuidance.tsx`/`.module.css`,
and update `ActivityForm.tsx`/`ActivityBank.tsx` as specified above until every sketch above (and the
remaining ACs not sketched: AC-06, AC-10, AC-14, AC-16) passes. AC-16 is verified by a real-browser
pass in both Light and Dark, per `frontend_conventions.md`'s Testing Strategy note.

## Acceptance Criteria Summary

- [x] FRONTEND-013-AC-01 — no `ActivityForm` renders while `formTarget` is `null`
- [x] FRONTEND-013-AC-02 — "Add activity" sets `formTarget` to `'create'`
- [x] FRONTEND-013-AC-03 — `formTarget === 'create'` opens the modal with `ActivityForm` in create mode
- [x] FRONTEND-013-AC-04 — "Edit" sets `formTarget` to that row's `Activity`
- [x] FRONTEND-013-AC-05 — `formTarget` as an `Activity` opens the modal with `ActivityForm` in edit mode
- [x] FRONTEND-013-AC-06 — each row's "Edit" control is unchanged at rest, only its destination changes
- [x] FRONTEND-013-AC-07 — `CategoryGuidance` renders adjacent to `CategoryPicker`, always visible
- [x] FRONTEND-013-AC-08 — a purpose + example per category, from `HIGH_LEVEL_DESIGN.md`'s examples
- [x] FRONTEND-013-AC-09 — the same-activity-different-category note, from `product.md`'s framing
- [x] FRONTEND-013-AC-10 — `ActivityForm` heading + `id` wired to `Modal`'s `titleId`
- [x] FRONTEND-013-AC-11 — create-mode submit button renamed "Save activity"
- [x] FRONTEND-013-AC-12 — create mode gains a Cancel button, same `onCancel` as edit mode
- [x] FRONTEND-013-AC-13 — Cancel or successful submit sets `formTarget` to `null`
- [x] FRONTEND-013-AC-14 — `Modal`'s `onClose` (Escape/backdrop) sets `formTarget` to `null`, no API call
- [x] FRONTEND-013-AC-15 — a second Add/Edit while open retargets, never a second dialog
- [x] FRONTEND-013-AC-16 — modal + guidance render correctly in Light and Dark (real-browser check)
- [x] FRONTEND-013-AC-17 — Category (+ guidance) renders before Name
- [x] FRONTEND-013-AC-18 — Category options render as coloured, live-updating pills
- [x] FRONTEND-013-AC-19 — Name/Description labels share the quiet-label typography, stacked above their inputs
- [x] FRONTEND-013-AC-20 — Save/Cancel are right-aligned
- [x] FRONTEND-013-AC-21 — a repeatable-vs-one-off explanatory note renders next to the checkbox
- [x] FRONTEND-013-AC-22 — content scrolls independently of the pinned Save/Cancel footer
- [x] FRONTEND-013-AC-23 — reordered/restyled form + pinned footer render correctly in Light and Dark (real-browser check)
- [x] FRONTEND-013-AC-24 — a focused category pill's outline is never clipped by `.scrollBody`'s overflow (real-browser check)
- [x] FRONTEND-013-AC-25 — "Show archived" + "Add activity" share a single `.toolbar` container
- [x] FRONTEND-013-AC-26 — "Add activity" is right-aligned within the toolbar
- [x] FRONTEND-013-AC-27 — "Show archived" renders as a pill (segmented-control idiom), legible checked/unchecked, unclipped focus outline (real-browser check)
- [x] FRONTEND-013-AC-28 — the toolbar has a background/border reading as a header, not a list row (real-browser check)
