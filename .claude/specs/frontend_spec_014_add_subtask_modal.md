# Add/Rename Sub-task Modal (Frontend)

**Status**: Implemented — all 17 ACs verified (2026-09-30), including FRONTEND-014-AC-13 and the
Round 2 amendment's FRONTEND-014-AC-16/AC-17 (modal confirmed legible in a real browser, both Light
and Dark, when triggered from a nested expanded activity row). Full real-browser pass also confirmed
the add→list and rename→prefill→save flows end to end against real Postgres.
**Priority**: P2 — from the "Activity Bank UX improvements" batch raised by the user right after
`frontend_spec_006_repeatable_activities.md` shipped (`.claude/ideas/future_ideas.md`), confirmed
2026-09-30 as worth specifying now, alongside `frontend_spec_013_add_activity_modal.md`.
**Depends on**: `frontend_spec_009_add_picker_modal.md` (the `Modal` primitive this spec wraps
`SubTaskForm` in — **must be implemented first**, same dependency as `frontend_spec_013`),
`frontend_spec_003_sub_tasks.md` (origin of `SubTaskForm.tsx`, `SubTaskList.tsx`),
`frontend_spec_013_add_activity_modal.md` (sibling spec, same relocation pattern applied to a
different form/component — no shared state, only the same reused `Modal` primitive)
**Area**: Frontend (frontend-only — no backend change; `POST`/`PATCH .../sub-tasks`'s request/
response shape is unchanged. No `planner_spec_014_*.md`, same lockstep-numbering precedent as
`frontend_spec_009`/`frontend_spec_013`)
**Roadmap version**: V1 (extends the core Activity Bank's sub-task create/rename interaction from
`product.md`'s V1 row — not V2's tracking/reflection scope, and not AI)

## Overview

Today, `SubTaskList` (rendered inside an expanded activity row in `ActivityBank`) renders
`SubTaskForm` inline at the top of its own sub-task list — in create mode by default, swapped into
edit mode in place when a sub-task's "Rename" is activated. This is the sub-task-scoped version of
the same pattern `frontend_spec_013_add_activity_modal.md` fixes for activities: this spec applies
the identical relocation to `SubTaskForm`, wrapping it in `Modal` (from `frontend_spec_009`) instead
of rendering it inline within an already-nested (activity row → expanded details → sub-task list)
part of the page.

Unlike `frontend_spec_013`, **no category guidance is needed here** — `SubTask.category` is copied
from the parent `Activity` once, at creation time, and is never user-selected (confirmed via the
backend model: `SubTask.java`'s own comment, "category is copied from the parent Activity once, at
creation time, and never updated"; `SubTaskForm.tsx` has no category field at all today). This spec
is a pure relocation, structurally simpler than `frontend_spec_013`.

This ties back to `.claude/HIGH_LEVEL_DESIGN.md`'s US-\* sub-task stories — the same ones
`frontend_spec_003_sub_tasks.md` delivered the first version of; this spec relocates that same
interaction without changing its underlying capability (still `subTaskApi.create`/
`subTaskApi.update`, unchanged request/response shape).

**Confirmed with the user 2026-09-30**, same decisions as `frontend_spec_013` (see that spec's
Overview for the full reasoning, not repeated here):
1. Separate spec from `frontend_spec_013`, even though both reuse `Modal`.
2. Both Create ("Add sub-task") and Rename move into the modal.
3. `frontend_spec_009_add_picker_modal.md` must be implemented first.

**Out of scope**: any redesign of `SubTaskForm`'s own field set (just `name` — unchanged) or
validation. `frontend_spec_013_add_activity_modal.md` (separate spec, the activity-level
equivalent). Any backend change. The read-only sub-task view for archived activities
(`frontend_spec_006_repeatable_activities.md`'s `readOnly` prop on `SubTaskList` — unchanged: while
`readOnly` is `true`, no "Add sub-task"/"Rename" controls render at all, exactly as today, so the
modal is simply never reachable in that state).

## Requirements

### Requirement 1 — Adding a sub-task happens in a modal, not an inline top-of-list form

As a user, I want clicking "Add sub-task" to open a focused dialog, not have a form permanently
sitting at the top of the sub-task list I'm trying to read.

- **FRONTEND-014-AC-01** [AUTO]: While `SubTaskList`'s `formTarget` state is `null`, `SubTaskList`
  shall render no `SubTaskForm` anywhere in the document — replacing today's always-visible,
  always-mounted (while not `readOnly`) create form.
- **FRONTEND-014-AC-02** [AUTO]: Where `readOnly` is `false`, when "Add sub-task" is activated,
  `SubTaskList` shall set `formTarget` to `'create'`.
- **FRONTEND-014-AC-03** [AUTO]: While `formTarget` is `'create'`, `SubTaskList` shall render `Modal`
  with `isOpen` `true`, wrapping `SubTaskForm` in create mode.
- **FRONTEND-014-AC-04** [AUTO]: Where `readOnly` is `true`, `SubTaskList` shall render no "Add
  sub-task" control — unchanged from today.

### Requirement 2 — Renaming a sub-task also happens in the same modal

As a user, I want renaming a sub-task to open the same kind of focused dialog, not swap the
top-of-list form into edit mode in place.

- **FRONTEND-014-AC-05** [AUTO]: Where `readOnly` is `false`, when "Rename" is activated on a
  sub-task row, `SubTaskList` shall set `formTarget` to that row's `SubTask`.
- **FRONTEND-014-AC-06** [AUTO]: While `formTarget` is a `SubTask`, `SubTaskList` shall render
  `Modal` with `isOpen` `true`, wrapping `SubTaskForm` in edit mode for that sub-task — replacing
  today's inline swap-in-place edit form.

### Requirement 3 — Accessible modal naming, and closing behaviour equivalent to today

As a user, I want the dialog announced with a meaningful name, and to be able to back out of it
cleanly — via Cancel, Escape, or clicking outside — with no side effect.

- **FRONTEND-014-AC-07** [AUTO]: `SubTaskForm` shall render a heading carrying an `id` — text "Add
  sub-task" in create mode, "Rename sub-task" in edit mode (matching the trigger control's own
  "Rename" wording, not a generic "Edit") — and `SubTaskList` shall pass that same `id` as `Modal`'s
  `titleId`.
- **FRONTEND-014-AC-08** [AUTO]: `SubTaskForm`'s create-mode submit button shall read "Save sub-task"
  (renamed from today's "Add sub-task", which now names the page-level trigger control instead — the
  two are both present in the document once the modal is open, so must not share an accessible
  name). Edit mode's existing "Save changes" label is unchanged.
- **FRONTEND-014-AC-09** [AUTO]: `SubTaskForm` shall render a Cancel button in create mode
  (previously rendered only when an `onCancel` prop was supplied, which `SubTaskList` only did for
  edit mode), invoking the same `onCancel` prop edit mode already uses.
- **FRONTEND-014-AC-10** [AUTO]: When `SubTaskForm`'s Cancel is activated, or a create/edit
  submission completes successfully, `SubTaskList` shall set `formTarget` to `null` — equivalent to
  today's `onCancel`/`onSuccess` wiring, now also closing the modal.
- **FRONTEND-014-AC-11** [AUTO]: When the dialog is closed via `Modal`'s `onClose` (Escape or a
  backdrop click, per `frontend_spec_009`'s `Modal` contract), `SubTaskList` shall set `formTarget`
  to `null`, with no call to `subTaskApi.create`/`subTaskApi.update`.

### Requirement 4 — Only one modal instance open at a time

As a user, I want activating a second "Add sub-task" or "Rename" while the modal is already open to
just retarget it, not stack a second dialog.

- **FRONTEND-014-AC-12** [AUTO]: While the modal is open for one `formTarget` and a different "Add
  sub-task"/"Rename" control is activated, `SubTaskList` shall update `formTarget` to the new target
  without rendering a second `Modal`/dialog — at most one element with `role="dialog"` shall exist in
  the document at any time.

### Requirement 5 — Real-browser visual verification

As a user, I want the modal to actually look right — legible, sensibly laid out within a nested
expanded-row context — in both themes, not just structurally correct in the DOM.

- **FRONTEND-014-AC-13** [MANUAL]: The modal (backdrop, dialog position) renders correctly in both
  Light and Dark themes, including when triggered from a sub-task list nested inside an expanded
  activity row. Verified by a real-browser check, since jsdom does not render CSS
  (`frontend_conventions.md`'s Testing Strategy note).

### Requirement 6 — Round 2 amendment: consistency with `frontend_spec_013`'s styling refinements

When `frontend_spec_013_add_activity_modal.md` picked up its Round 2 amendment (quiet-label field
typography, right-aligned CTAs, and a scrollable-body + pinned-footer split to fix a clipped-footer
regression once `ActivityForm`'s content grew taller than `Modal`'s `max-height`), the same structural
fix was applied to `SubTaskForm` for consistency, even though its shorter single-field content hadn't
yet been observed to overflow — matching the pattern `AssignActivityPicker`/`ActivityForm` both use,
rather than leaving `SubTaskForm` as the only form in the modal family without it.

- **FRONTEND-014-AC-14** [AUTO]: `SubTaskForm`'s Sub-task name field's `<label>` shall share
  `CategoryPicker`'s quiet-label typography (small, bold, uppercase, letter-spaced), stacked directly
  above its input.
- **FRONTEND-014-AC-15** [AUTO]: `SubTaskForm` shall render its content (heading, Sub-task name field,
  and any validation/submit error) inside an independently-scrollable region, with the Save/Cancel
  footer — right-aligned — outside that region so it stays visible regardless of content height or
  `Modal`'s `max-height`, matching `frontend_spec_013`'s `ActivityForm` fix.
- **FRONTEND-014-AC-16** [MANUAL]: The restyled `SubTaskForm` (quiet label, right-aligned pinned
  footer) renders correctly in both Light and Dark themes in a real browser.
- **FRONTEND-014-AC-17** [AUTO]: `SubTaskForm`'s `.scrollBody` reserves the same horizontal padding
  as `ActivityForm`'s (`frontend_spec_013_add_activity_modal.md`'s `FRONTEND-013-AC-24`), applied for
  consistency even though `SubTaskForm` has no focusable pill today — so a future addition to this
  form doesn't reintroduce the same outline-clipping bug found and fixed there.

## Component/type changes

`SubTaskForm.tsx` (extended — heading, renamed create-mode submit button, create-mode Cancel; Round 2
amendment gives the Sub-task name field the shared quiet-label typography and splits content into a
scrollable body + pinned, right-aligned footer):

```tsx
const headingId = `sub-task-form-title-${mode}`

// ...

<form onSubmit={handleSubmit} noValidate className={styles.form}>
  <div className={styles.scrollBody}>
    <h3 id={headingId}>{mode === 'edit' ? 'Rename sub-task' : 'Add sub-task'}</h3>

    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={nameId}>Sub-task name</label>
      <input id={nameId} /* ... */ />
    </div>

    {validationError && <p>{validationError}</p>}
    {submitError && <p role="alert">{submitError}</p>}
    {isSubmitting && <output>Saving…</output>}
  </div>

  <div className={styles.actions}>
    <button type="submit" disabled={isSubmitting}>
      {mode === 'edit' ? 'Save changes' : 'Save sub-task'}
    </button>
    {onCancel && (
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    )}
  </div>
</form>
```

`SubTaskForm.module.css` (Round 2 amendment — same `.form`/`.scrollBody`/`.fieldLabel`/`.actions`
structure as `ActivityForm.module.css`):

```css
.form { display: flex; flex-direction: column; min-height: 0; }
.scrollBody { overflow-y: auto; min-height: 0; flex: 1 1 auto; padding: 0 6px; margin: 0 -6px; }
.fieldLabel { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.actions { display: flex; justify-content: flex-end; gap: 0.5rem; flex-shrink: 0; border-top: 1px solid var(--border); }
```

`SubTaskList.tsx` (state and rendering — fetch/loading/error/empty states, delete flow, and the
sub-task list's own row markup are all unrelated and unchanged):

```tsx
const [formTarget, setFormTarget] = useState<'create' | SubTask | null>(null)

const handleCloseForm = () => setFormTarget(null)

const handleFormSuccess = (subTask: SubTask) => {
  setSubTasks((previous) => /* unchanged merge logic */)
  setFormTarget(null)
}

// ...

{!readOnly && (
  <button type="button" onClick={() => setFormTarget('create')}>
    Add sub-task
  </button>
)}

{/* ...sub-task list, "Rename" now does setFormTarget(subTask) instead of setEditingSubTaskId(subTask.id) */}

<Modal
  isOpen={formTarget !== null}
  titleId={`sub-task-form-title-${formTarget === 'create' || formTarget === null ? 'create' : 'edit'}`}
  onClose={handleCloseForm}
>
  {formTarget !== null && (
    <SubTaskForm
      key={formTarget === 'create' ? 'create' : formTarget.id}
      mode={formTarget === 'create' ? 'create' : 'edit'}
      activityId={activityId}
      subTask={formTarget === 'create' ? undefined : formTarget}
      onSuccess={handleFormSuccess}
      onCancel={handleCloseForm}
    />
  )}
</Modal>
```

## Cross-references

| This spec | Contracts against |
|---|---|
| `Modal.tsx` (`frontend_spec_009_add_picker_modal.md`) | Reused unmodified — must be implemented first |
| `SubTaskForm.tsx` (`frontend_spec_003_sub_tasks.md`) | Extended — heading + `id`, renamed create-mode submit button, create-mode Cancel |
| `SubTaskList.tsx` | Extended — `formTarget` state replaces `editingSubTaskId`, `Modal` wraps `SubTaskForm` |
| `readOnly` prop (`frontend_spec_006_repeatable_activities.md`) | Unchanged — still gates all of Add/Rename/Delete, the modal is simply unreachable when `true` |
| `POST`/`PATCH /api/v1/activities/{id}/sub-tasks` (`planner_spec_003_sub_tasks.md`) | Unchanged — `subTaskApi.create`/`update`'s request/response shape is untouched |
| `frontend_spec_013_add_activity_modal.md` (sibling, same batch) | Separate spec, identical relocation pattern applied to a different form — no shared state or component beyond `Modal` itself |

`SubTaskForm.test.tsx` and `SubTaskList.test.tsx`'s existing tests assert `name: /add sub-task/i` for
the create-mode submit button (now "Save sub-task") and exercise the always-visible top-of-list form
directly (now conditionally rendered inside `Modal`, requiring "Add sub-task"/"Rename" to be clicked
first) — both will need updating during implementation, not a new AC, the same kind of
implementation-time consequence `frontend_spec_013_add_activity_modal.md`'s Cross-references section
notes for its own tests.

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
const chapterOne: SubTask = {
  id: 's1', activityId: 'a1', name: 'Chapter one', category: 'PLEASURABLE',
  createdAt: '2026-09-01T00:00:00Z',
}

describe('FRONTEND-014-AC-01/AC-02/AC-03: Add sub-task opens a modal, not an inline top-of-list form', () => {
  it('renders no form until Add sub-task is clicked, then opens it in a dialog', async () => {
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

    await screen.findByText(/no sub-tasks yet/i)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /sub-task name/i })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /add sub-task/i }))

    expect(await screen.findByRole('dialog', { name: /add sub-task/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /sub-task name/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-04: readOnly renders no Add sub-task control', () => {
  it('shows no trigger and no dialog is reachable when readOnly', async () => {
    vi.mocked(subTaskApi.getAll).mockResolvedValue([chapterOne])
    render(<SubTaskList activityId="a1" category="PLEASURABLE" readOnly />)

    await screen.findByText('Chapter one')
    expect(screen.queryByRole('button', { name: /add sub-task/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-014-AC-05/AC-06: Rename opens the same modal in edit mode', () => {
  it('opens a dialog titled "Rename sub-task" pre-filled with the row\'s name', async () => {
    vi.mocked(subTaskApi.getAll).mockResolvedValue([chapterOne])
    render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

    await userEvent.click(await screen.findByRole('button', { name: /^rename$/i }))

    expect(await screen.findByRole('dialog', { name: /rename sub-task/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /sub-task name/i })).toHaveValue('Chapter one')
  })
})

describe('FRONTEND-014-AC-08: create-mode submit button is "Save sub-task", not "Add sub-task"', () => {
  it('does not collide with the page-level trigger\'s own label', async () => {
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

    await userEvent.click(screen.getByRole('button', { name: /add sub-task/i }))
    await screen.findByRole('dialog')

    expect(screen.getByRole('button', { name: /^add sub-task$/i })).toBeInTheDocument() // the trigger, still present
    expect(screen.getByRole('button', { name: /^save sub-task$/i })).toBeInTheDocument() // the submit
  })
})

describe('FRONTEND-014-AC-09/AC-10: Cancel in create mode closes with no create call', () => {
  it('calls onCancel equivalent, no subTaskApi.create, and closes the modal', async () => {
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

    await userEvent.click(screen.getByRole('button', { name: /add sub-task/i }))
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(subTaskApi.create).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-014-AC-12: a second Add/Rename while open retargets, never a second dialog', () => {
  it('switches from create to rename without stacking a dialog', async () => {
    vi.mocked(subTaskApi.getAll).mockResolvedValue([chapterOne])
    render(<SubTaskList activityId="a1" category="PLEASURABLE" />)

    await userEvent.click(screen.getByRole('button', { name: /add sub-task/i }))
    await screen.findByRole('dialog', { name: /add sub-task/i })

    await userEvent.click(screen.getByRole('button', { name: /^rename$/i }))

    expect(await screen.findByRole('dialog', { name: /rename sub-task/i })).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
})
```

**Test Case (Green)**: update `SubTaskForm.tsx`/`SubTaskList.tsx` as specified above until every
sketch above (and the remaining ACs not sketched: AC-07, AC-11, AC-13) passes. AC-13 is verified by a
real-browser pass in both Light and Dark, per `frontend_conventions.md`'s Testing Strategy note.

## Acceptance Criteria Summary

- [x] FRONTEND-014-AC-01 — no `SubTaskForm` renders while `formTarget` is `null`
- [x] FRONTEND-014-AC-02 — "Add sub-task" sets `formTarget` to `'create'` (when not `readOnly`)
- [x] FRONTEND-014-AC-03 — `formTarget === 'create'` opens the modal with `SubTaskForm` in create mode
- [x] FRONTEND-014-AC-04 — `readOnly` renders no "Add sub-task" control
- [x] FRONTEND-014-AC-05 — "Rename" sets `formTarget` to that row's `SubTask` (when not `readOnly`)
- [x] FRONTEND-014-AC-06 — `formTarget` as a `SubTask` opens the modal with `SubTaskForm` in edit mode
- [x] FRONTEND-014-AC-07 — `SubTaskForm` heading + `id` wired to `Modal`'s `titleId`
- [x] FRONTEND-014-AC-08 — create-mode submit button renamed "Save sub-task"
- [x] FRONTEND-014-AC-09 — create mode gains a Cancel button, same `onCancel` as edit mode
- [x] FRONTEND-014-AC-10 — Cancel or successful submit sets `formTarget` to `null`
- [x] FRONTEND-014-AC-11 — `Modal`'s `onClose` (Escape/backdrop) sets `formTarget` to `null`, no API call
- [x] FRONTEND-014-AC-12 — a second Add/Rename while open retargets, never a second dialog
- [x] FRONTEND-014-AC-13 — modal renders correctly in Light and Dark (real-browser check)
- [x] FRONTEND-014-AC-14 — Sub-task name label shares the quiet-label typography, stacked above its input
- [x] FRONTEND-014-AC-15 — content scrolls independently of the pinned, right-aligned Save/Cancel footer
- [x] FRONTEND-014-AC-16 — restyled form + pinned footer render correctly in Light and Dark (real-browser check)
- [x] FRONTEND-014-AC-17 — `.scrollBody` reserves the same outline-clearance padding as `ActivityForm`'s, for consistency
