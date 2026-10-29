# Duplicate an Activity (Frontend)

**Status**: Not started

**Priority**: P2 — a real friction reducer, but nothing else is blocked on it.

**Depends on**: `frontend_spec_002_activity_bank.md` (`ActivityBank.tsx`/`ActivityForm.tsx` base
shape, `activityApi.create`), `frontend_spec_006_repeatable_activities.md`/`frontend_spec_020_
repeatable_icon_in_activity_form.md` (the `repeatable` field/toggle this spec copies unmodified),
`frontend_spec_027_favourite_activities.md` (the `favourite` field/toggle this spec copies
unmodified), `frontend_spec_044_activity_bank_grouping.md` (the per-row action slot — `renderRow
Actions` — this spec's new button is added into)

**Area**: Frontend

**Roadmap version**: V1 (close-out item — see `.claude/v1_work_to_be_delivered.md`)

## Overview

Adds a "Duplicate" action next to each Activity Bank row's existing Edit/Delete (or Unarchive)
controls. Clicking it opens the same Add-activity modal used for a normal create, pre-filled with
the source activity's `name`/`category`/`description`/`repeatable`/`favourite` — not a copy saved
immediately, but a pre-filled form the user can tweak (e.g. rename "Go for a walk" to "Go for a
longer walk") before saving it as a brand-new, fully independent `Activity`. This is purely a
frontend convenience: no new backend endpoint, type, or contract — it composes the existing
`activityApi.create` (and, if the source was favourited, the existing favourite-toggle endpoints)
exactly the way a manual "Add activity" + retype already would, just without the retyping.

Raised in `.claude/SPEC_CANDIDATES.md`'s "Duplicate activity" quick action entry (2026-10-06).
That entry's one open question — whether duplicating should also copy the source's sub-tasks — is
resolved here per `.claude/v1_work_to_be_delivered.md`'s recommendation: **a bare duplicate**. Sub-
tasks are not copied; if the user wants them, they re-add them on the new activity, same as building
any other activity from scratch.

**Resolved ambiguities, not explicit in the originating candidate:**
1. **The name is copied exactly as-is**, with no auto-generated suffix like "(copy)". The point of
   pre-filling is that the user is expected to change whatever differs (most often the name itself)
   before saving — inventing a suffix convention isn't something the candidate asked for, and the
   user already sees and can edit the pre-filled name before it's ever saved.
2. **Duplicate is available on archived rows too**, not just active ones — a real use case (re-
   doing a one-off that auto-archived on completion, per `frontend_spec_006`) exists specifically
   for archived activities, and there's no technical reason to withhold it there.
3. **Duplicate is hidden while a row's delete confirmation is active**, matching the existing
   Edit button's own behaviour in that same state (`ActivityBank.tsx`'s `confirmingDeleteId` branch
   already omits Edit; Duplicate follows the same precedent).

**Out of scope**: any backend change (the existing `POST /api/v1/activities` contract is reused
untouched); copying sub-tasks, archived status, or plan/completion history from the source (the
duplicate always starts unarchived with zero sub-tasks, matching `ActivityForm`'s own existing
create-mode defaults); bulk/multi-select duplication; a distinct "Duplicating: {name}" heading on
the opened form (it reads "Add activity", identical to every other create-mode open).

## Requirements

### Requirement 1 — A Duplicate action is available per activity row

As a user, I want a quick way to start a new activity from an existing one, so building a variant
doesn't mean retyping everything from scratch.

- **FRONTEND-056-AC-01** [AUTO]: `ActivityBank`'s row actions shall render a "Duplicate" button for
  every activity row that is not currently in its delete-confirmation state, whether the row is
  active or archived.
- **FRONTEND-056-AC-02** [AUTO — unwanted behaviour]: While a row's delete confirmation is active
  (`confirmingDeleteId` matches that row), `ActivityBank` shall not render a Duplicate button for
  that row — matching the existing Edit button's behaviour in the same state.

### Requirement 2 — Duplicating opens a pre-filled create form, never an edit of the source

As a user, I want the duplicate to start from the source activity's details without me having to
look them up or retype them, and without risk of accidentally overwriting the original.

- **FRONTEND-056-AC-03** [AUTO]: When "Duplicate" is clicked for an activity, `ActivityBank` shall
  open the Add-activity modal in **create** mode (never edit mode), with its `name`, `category`,
  `description`, and `repeatable` fields pre-filled from the source activity's current values.
- **FRONTEND-056-AC-04** [AUTO]: Where the source activity is favourited, the opened form's
  Favourite toggle shall be pre-checked.
- **FRONTEND-056-AC-05** [AUTO — unwanted behaviour]: The opened form shall not pre-fill or carry
  over the source activity's sub-tasks, archived status, or plan/completion history — the duplicate
  always starts unarchived with no sub-tasks, exactly like `ActivityForm`'s existing blank-create
  defaults.

### Requirement 3 — Saving or cancelling a duplicate behaves like an independent create

As a user, I want the duplicate to become its own activity once I save it, and I want cancelling to
leave both the original and everything else exactly as it was.

- **FRONTEND-056-AC-06** [AUTO]: When the duplicate form is submitted, `ActivityForm` shall call
  `activityApi.create` (never `activityApi.update`), producing a new `Activity` with its own `id`,
  distinct from the source.
- **FRONTEND-056-AC-07** [AUTO]: Editing any field in the duplicate form before submitting shall
  not alter the source activity's own stored values — the two remain fully independent until (and
  unless) the new activity is actually saved.
- **FRONTEND-056-AC-08** [AUTO]: After a successful duplicate save, `ActivityBank` shall add the new
  activity to its list and close the modal, exactly like a normal create (`handleFormSuccess`'s
  existing behaviour, unmodified).
- **FRONTEND-056-AC-09** [AUTO — unwanted behaviour]: If the duplicate form is cancelled or the
  modal is dismissed before saving, then `ActivityBank` shall not create any new activity, and the
  source activity shall remain exactly as it was.

## Component/type changes

No backend change, no changes to `types/activity.ts` or `services/activityApi.ts` — this spec is a
pure composition of existing contracts.

`frontend/src/components/ActivityBank/ActivityForm.tsx` — gains one new optional prop,
`duplicateFrom`, used only to seed initial field state when `mode === 'create'`. Submission logic is
untouched: `mode === 'create'` already calls `activityApi.create`, so a duplicate save is
indistinguishable from a blank create at the network layer.

```tsx
interface ActivityFormProps {
  readonly mode: 'create' | 'edit'
  readonly activity?: Activity
  readonly duplicateFrom?: Activity // new -- only meaningful when mode === 'create'
  readonly onSuccess: (activity: Activity) => void
  readonly onCancel?: () => void
}

export function ActivityForm({ mode, activity, duplicateFrom, onSuccess, onCancel }: ActivityFormProps) {
  const prefill = activity ?? duplicateFrom // edit target takes precedence; duplicate only applies in create mode
  const [name, setName] = useState(prefill?.name ?? '')
  const [category, setCategory] = useState<ActivityCategory | null>(prefill?.category ?? null)
  const [description, setDescription] = useState(prefill?.description ?? '')
  const [repeatable, setRepeatable] = useState(prefill?.repeatable ?? true)
  const [favourite, setFavourite] = useState(prefill?.favourite ?? false)
  // ...rest of the component, including handleSubmit, is unchanged
}
```

`frontend/src/components/ActivityBank/ActivityBank.tsx` — gains a `duplicateSource` state slot
(parallel to the existing `formTarget`, not a replacement for it — `formTarget` stays `'create' |
Activity | null` exactly as today) and a Duplicate button in `renderRowActions`:

```tsx
const [duplicateSource, setDuplicateSource] = useState<Activity | null>(null)

const handleDuplicate = (activity: Activity) => {
  setDuplicateSource(activity)
  setFormTarget('create')
}

const handleCloseForm = () => {
  setFormTarget(null)
  setDuplicateSource(null) // FRONTEND-056-AC-09 -- cancel clears the pending duplicate too
}

const handleFormSuccess = (activity: Activity) => {
  // ...existing body, unchanged...
  setDuplicateSource(null)
  setFormTarget(null)
}
```

`renderRowActions` (both the active and archived branches, never the `confirmingDeleteId` branch —
FRONTEND-056-AC-01/AC-02):

```tsx
<button type="button" onClick={() => handleDuplicate(activity)}>
  Duplicate
</button>
```

The `ActivityForm` render call passes the new prop through, only when creating:

```tsx
<ActivityForm
  key={formTarget === 'create' ? `create-${duplicateSource?.id ?? 'blank'}` : formTarget.id}
  mode={formTarget === 'create' ? 'create' : 'edit'}
  activity={formTarget === 'create' ? undefined : formTarget}
  duplicateFrom={formTarget === 'create' ? (duplicateSource ?? undefined) : undefined}
  onSuccess={handleFormSuccess}
  onCancel={handleCloseForm}
/>
```

Final button placement/styling (plain button, matching Edit/Unarchive's existing untyped treatment,
not `buttonVariants`' `primary`/`destructive`) is left to implementation, same as every other
row-action button on this component today.

## Cross-references

| This spec | Contracts against |
|---|---|
| `ActivityForm.tsx` (`frontend_spec_002_activity_bank.md`) | Extended — new optional `duplicateFrom` prop, submission logic unchanged |
| `ActivityBank.tsx` (`frontend_spec_002_activity_bank.md`/`frontend_spec_044_activity_bank_grouping.md`) | Extended — new `duplicateSource` state, new Duplicate button in `renderRowActions` |
| `activityApi.create` (`services/activityApi.ts`) | Reused unmodified — the only API call this spec makes |
| `repeatable` field (`frontend_spec_006_repeatable_activities.md`) | Reused unmodified — copied into the pre-filled form |
| `favourite` field (`frontend_spec_027_favourite_activities.md`) | Reused unmodified — copied into the pre-filled form, applied via the existing post-create favourite-toggle call already in `ActivityForm` |
| `.claude/SPEC_CANDIDATES.md` | "Duplicate activity" quick action entry — resolved here (bare duplicate, no sub-tasks); removed from that file as part of this change |
| `.claude/v1_work_to_be_delivered.md` | V1 close-out recommendation this spec fulfils |

## Test case sketches (Vitest + RTL, red before implementation)

```tsx
describe('FRONTEND-056-AC-01: Duplicate action is available per row', () => {
  it('renders a Duplicate button for an active activity row', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([makeActivity({ name: 'Go for a walk' })])
    render(<ActivityBank />)
    expect(await screen.findByRole('button', { name: /duplicate/i })).toBeInTheDocument()
  })

  it('renders a Duplicate button for an archived activity row too', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([makeActivity({ name: 'Apply for jobs', archived: true })])
    render(<ActivityBank />)
    await userEvent.click(screen.getByLabelText(/show archived/i))
    expect(await screen.findByRole('button', { name: /duplicate/i })).toBeInTheDocument()
  })
})

describe('FRONTEND-056-AC-02: Duplicate is hidden while confirming delete on that row', () => {
  it('removes the Duplicate button once Delete has been clicked for that row', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([makeActivity({ name: 'Go for a walk' })])
    render(<ActivityBank />)
    await userEvent.click(await screen.findByRole('button', { name: /^delete$/i }))
    expect(screen.queryByRole('button', { name: /duplicate/i })).not.toBeInTheDocument()
  })
})

describe('FRONTEND-056-AC-03/AC-04/AC-05: Duplicate opens a pre-filled create form', () => {
  it('pre-fills name/category/description/repeatable/favourite, never sub-tasks or archived status', async () => {
    const source = makeActivity({
      name: 'Go for a walk',
      category: 'PLEASURABLE',
      description: 'Around the block',
      repeatable: true,
      favourite: true,
      subTaskCount: 3,
      archived: false,
    })
    vi.mocked(activityApi.getAll).mockResolvedValue([source])
    render(<ActivityBank />)

    await userEvent.click(await screen.findByRole('button', { name: /duplicate/i }))

    expect(screen.getByRole('heading', { name: /add activity/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Go for a walk')
    expect(screen.getByLabelText(/description/i)).toHaveValue('Around the block')
    expect(screen.getByLabelText(/repeatable/i)).toBeChecked()
    expect(screen.getByLabelText(/favourite/i)).toBeChecked()
  })
})

describe('FRONTEND-056-AC-06/AC-07/AC-08: saving a duplicate creates an independent new activity', () => {
  it('calls activityApi.create (never update), adds the new row, and leaves the source untouched', async () => {
    const source = makeActivity({ id: 'source-1', name: 'Go for a walk' })
    const created = makeActivity({ id: 'new-1', name: 'Go for a longer walk' })
    vi.mocked(activityApi.getAll).mockResolvedValue([source])
    vi.mocked(activityApi.create).mockResolvedValue(created)
    render(<ActivityBank />)

    await userEvent.click(await screen.findByRole('button', { name: /duplicate/i }))
    await userEvent.clear(screen.getByLabelText(/^name$/i))
    await userEvent.type(screen.getByLabelText(/^name$/i), 'Go for a longer walk')
    await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

    expect(activityApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Go for a longer walk' }),
    )
    expect(activityApi.update).not.toHaveBeenCalled()
    expect(await screen.findByText('Go for a longer walk')).toBeInTheDocument()
    expect(screen.getByText('Go for a walk')).toBeInTheDocument() // source row unchanged
  })
})

describe('FRONTEND-056-AC-09: cancelling a duplicate creates nothing', () => {
  it('does not call activityApi.create when the duplicate form is cancelled', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([makeActivity({ name: 'Go for a walk' })])
    render(<ActivityBank />)

    await userEvent.click(await screen.findByRole('button', { name: /duplicate/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(activityApi.create).not.toHaveBeenCalled()
    expect(screen.getByText('Go for a walk')).toBeInTheDocument()
  })
})
```

## Acceptance Criteria Summary

- [ ] FRONTEND-056-AC-01 — Duplicate button renders per row (active and archived)
- [ ] FRONTEND-056-AC-02 — Duplicate hidden during that row's delete confirmation
- [ ] FRONTEND-056-AC-03 — clicking Duplicate opens a create-mode form pre-filled with name/category/description/repeatable
- [ ] FRONTEND-056-AC-04 — Favourite toggle pre-checked when the source is favourited
- [ ] FRONTEND-056-AC-05 — sub-tasks/archived status/completion history are never carried over
- [ ] FRONTEND-056-AC-06 — submitting calls `activityApi.create`, never `update`, with a new independent id
- [ ] FRONTEND-056-AC-07 — editing the duplicate form before saving never mutates the source
- [ ] FRONTEND-056-AC-08 — successful save adds the new activity and closes the modal, like a normal create
- [ ] FRONTEND-056-AC-09 — cancelling creates nothing and leaves the source unchanged
