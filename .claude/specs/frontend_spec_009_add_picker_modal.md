# "Add" Opens a Picker Modal (Frontend)

**Status**: Implemented — all 23 ACs verified (2026-09-30), including FRONTEND-009-AC-23 (modal
backdrop/positioning confirmed in a real browser, both Light and Dark). Real-browser pass also
confirmed the full click-Add→pick→Assign happy path and Escape-to-close with focus returning to the
originating "Add" control.
**Priority**: P2 — chunk 2 of 4 from the Weekly Planner "too much noise"/navigation-friction UX
batch raised after `frontend_spec_006_repeatable_activities.md` shipped. Chunk 1 (occurrence detail
card) is `frontend_spec_008_occurrence_detail_card.md`, not yet implemented.
**Depends on**: `frontend_spec_004_week_planning.md` (origin of `AssignActivityPicker.tsx`,
`WeeklyPlanner.tsx`, `PlannerGrid.tsx`, `BucketList.tsx`, the `assignTarget`/`AssignTarget` state
shape), `frontend_spec_006_repeatable_activities.md` (most recent prior state of the activity/
sub-task data the picker lists), `frontend_spec_007_visual_refresh.md` (CSS Modules + theme
custom-properties convention the new `Modal` component's styles follow), `frontend_spec_008_occurrence_detail_card.md`
(sibling chunk of the same UX batch, **not yet implemented** — this spec is written against the
actual current `main` state of `WeeklyPlanner.tsx`/`OccurrenceItem.tsx`, not that spec's
not-yet-real proposed `detailOpenId`/`onOpenDetail` shape; both specs touch `WeeklyPlanner.tsx` but
in unrelated regions — 008's detail-card state vs. this spec's `assignTarget`/modal state — so
implementation order between them has no functional dependency, only the usual one-spec-pair-in-
flight-at-a-time sequencing from `CLAUDE.md`)
**Area**: Frontend (frontend-only — no backend change; `POST /api/v1/plan/occurrences`'s request/
response shape is unchanged. Per this project's spec-numbering convention, numbers move in lockstep
across `planner_spec_NNN`/`frontend_spec_NNN` even when only one side has content, so there is
deliberately no `planner_spec_009_*.md` — same precedent as `frontend_spec_005_navigation_and_theme.md`/
`frontend_spec_007_visual_refresh.md`)
**Roadmap version**: V1 (extends the core planner's assign-to-plan interaction from `product.md`'s
V1 row — not V2's tracking/reflection scope, and not AI)

## Overview

Today, activating "Add" on a weekly-grid cell (`PlannerGrid`) or the weekend bucket list
(`BucketList`) sets `WeeklyPlanner`'s `assignTarget` state, and `<AssignActivityPicker>` is then
rendered unconditionally at the very bottom of `WeeklyPlanner`'s JSX — after both `PlannerGrid` and
`BucketList` in document order. Clicking "Add" on, say, Monday Morning jumps the user's attention
away to a picker rendered far down the page with no visual or spatial connection to where they
clicked. This is the "too much navigation involved" complaint from the same UX batch that produced
`frontend_spec_008`.

This spec relocates `AssignActivityPicker` into a real modal dialog that opens at the point of
interaction, instead of an always-in-document-flow section at the page bottom. It ties back to
`.claude/HIGH_LEVEL_DESIGN.md`'s US-004 (plan an activity) — the same user story
`frontend_spec_004_week_planning.md` delivered the first version of; this spec relocates and adds
focus management to that same interaction without changing its underlying capability.

This is the **first modal/dialog primitive in this codebase** — confirmed via `frontend/package.json`
(`axios`, `react`, `react-dom`, `react-router-dom` only; no `@testing-library` — no focus-trap or
modal library) and via `Glob`/`Grep` across `frontend/src/` (no `<dialog>` usage, no
`Modal`/`Dialog` component). The implementation is the native HTML `<dialog>` element
(`showModal()`/`close()`), which gives focus containment, a `::backdrop`, native top-layer
rendering (so no portal is needed to visually escape `WeeklyPlanner`'s scroll/stacking context —
`<dialog>` shown via `showModal()` renders above everything else regardless of its position in the
DOM tree), and Escape-to-close semantics with zero new dependencies. Nothing in `tech.md` or
`frontend_conventions.md` rules this out — this is a personal, self-hosted, single-user app
targeting modern evergreen browsers (`tech.md`'s hosting section), so there is no legacy-browser
fallback concern, and it matches this project's established no-icon-library/no-modal-library
precedent (`frontend_spec_008` made the identical "no new dependency" call for its inline SVG
completion icon).

A small, reusable `Modal` wrapper (`frontend/src/components/Modal/Modal.tsx`) is built alongside
this spec's one call site. `.claude/SPEC_CANDIDATES.md`'s now-retired "Weekly planner: 'Add' opens
a picker modal" candidate entry explicitly anticipated this ("can reuse whatever modal primitive
that spec establishes... implementation-time call, not a reason to combine the specs"). `Modal`
is deliberately minimal — `isOpen`, an `aria-labelledby` target id, an `onClose` callback, and a
`children` content slot; open/close, backdrop-click, and focus in/out. It does **not** build
multi-modal stacking, a portal/context provider system, or size/variant props — no other call site
needs them yet, and building for one doesn't need speculative abstraction (see `CLAUDE.md`'s
"don't add features beyond what the task requires"). The (separate, unconfirmed) "Add-activity
modal with category guidance" idea for the Activity Bank (`.claude/ideas/future_ideas.md`) is a
different feature with a different trigger — not this spec, even though it may eventually reuse
`Modal`.

**Out of scope**: any redesign of `AssignActivityPicker`'s own selection UX (activity/sub-task
list, single-selection `aria-pressed` pattern) — relocation only, not a redesign. The occurrence
detail card (`frontend_spec_008`, separate, already specced). Weekend bucket drag-and-drop
reordering + automatic carry-forward, and the weekly grid orientation toggle (separate confirmed
candidates in `.claude/SPEC_CANDIDATES.md`, not written up here). Any backend change —
`planApi.create(...)`'s request/response shape is unchanged. A general-purpose modal system
supporting multiple simultaneous modals or variant props beyond this one call site's needs (see
above — a deliberate constraint, not an oversight). The Activity Bank's separate, unconfirmed
"Add-activity modal" idea.

## Requirements

### Requirement 1 — A reusable `Modal` primitive wrapping native `<dialog>`

As a developer building this and future modal call sites, I want one small, correctly-behaved
dialog wrapper — backed by the platform's own `<dialog>` element — rather than reinventing focus
management and backdrop handling per call site.

- **FRONTEND-009-AC-01** [AUTO]: While `Modal`'s `isOpen` prop is `false`, the underlying `<dialog>`
  element shall carry no `open` attribute, and its content shall not be exposed in the accessibility
  tree (`role="dialog"` shall not be queryable).
- **FRONTEND-009-AC-02** [AUTO]: When `Modal`'s `isOpen` prop transitions from `false` to `true`,
  `Modal` shall call the underlying `<dialog>` element's `showModal()` method.
- **FRONTEND-009-AC-03** [AUTO]: When `Modal`'s `isOpen` prop transitions from `true` to `false`,
  `Modal` shall call the underlying `<dialog>` element's `close()` method.
- **FRONTEND-009-AC-04** [AUTO]: When `Modal` opens, it shall move keyboard focus to the `<dialog>`
  element itself (a `tabIndex={-1}` dialog, explicitly `.focus()`ed immediately after `showModal()`)
  — a single, deterministic target chosen over relying on the browser's default "first focusable
  descendant" behaviour, since the picker's first focusable control depends on its own loading
  state.
- **FRONTEND-009-AC-05** [AUTO]: When the dialog closes, for any reason, `Modal` shall return
  keyboard focus to whichever element held focus immediately before the dialog opened.
- **FRONTEND-009-AC-06** [AUTO]: When a click event's `target` is the `<dialog>` element itself
  (a click that lands on the dialog's own backdrop/padding area, not on any element within
  `children`), `Modal` shall call the dialog's `close()` method.
- **FRONTEND-009-AC-07** [AUTO]: `Modal` shall render `aria-labelledby={titleId}` on the `<dialog>`
  element, where `titleId` is a prop supplied by the caller referencing the `id` of a heading
  rendered within `children` — `Modal` does not render its own title text, avoiding a duplicate
  heading alongside content that already has one.
- **FRONTEND-009-AC-08** [AUTO]: When the dialog's native `close` event fires — whatever the cause
  (an explicit `close()` call from AC-03/AC-06, or the browser's own Escape-triggered default
  close-on-cancel behaviour) — `Modal` shall call its `onClose` prop exactly once for that closing.

**Note on browser-native vs. implementation-controlled behaviour**: `<dialog>` shown via
`showModal()` is exposed with `role="dialog"` and `aria-modal="true"` automatically by the browser
— this is standard HTML-to-ARIA mapping, not something `Modal` authors explicitly, so no AC asserts
it as `Modal`'s own responsibility. Escape-key handling is likewise native (the browser fires a
`cancel` event, whose default action closes the dialog) — AC-08 is written around the resulting
`close` event specifically so it is testable regardless of whether a test simulates a raw Escape
keypress or dispatches the native events directly; either way it exercises the same
implementation-controlled `onClose` wiring.

### Requirement 2 — Activating "Add" opens the picker as a modal, not an inline bottom section

As a user, I want clicking "Add" on a grid cell or the bucket list to open the picker right where I
clicked, not send my attention to the bottom of the page.

- **FRONTEND-009-AC-09** [AUTO]: When "Add" is activated on a `PlannerGrid` cell (a given
  `dayOfWeek`/`slot`), `WeeklyPlanner` shall set `assignTarget` to `{ dayOfWeek, slot }` — unchanged
  from today — and, as a consequence, render `Modal` with `isOpen` `true`, wrapping
  `AssignActivityPicker`.
- **FRONTEND-009-AC-10** [AUTO]: When "Add" is activated on `BucketList`, `WeeklyPlanner` shall set
  `assignTarget` to `{ dayOfWeek: null, slot: null }` — unchanged from today — and, as a consequence,
  render `Modal` with `isOpen` `true`, wrapping `AssignActivityPicker`.
- **FRONTEND-009-AC-11** [AUTO]: While `assignTarget` is `null`, `WeeklyPlanner` shall render `Modal`
  with `isOpen` `false`.

### Requirement 3 — The picker's own content and behaviour are unchanged inside the modal

As a user, I want the actual business of picking an activity or sub-task to work exactly as it does
today — this spec only moves where it appears.

- **FRONTEND-009-AC-12** [AUTO]: `AssignActivityPicker`, rendered inside `Modal`, shall still fetch
  activities via `activityApi.getAll()` and, per activity, sub-tasks via
  `subTaskApi.getAll(activity.id)`, and shall still render the existing single-selection
  toggle-button pattern (`aria-pressed`) for activities and sub-tasks — unchanged from today.
- **FRONTEND-009-AC-13** [AUTO]: `AssignActivityPicker`'s existing loading (`Loading activities…`),
  error (`role="alert"`), and empty (`No activities yet...`) states shall render unchanged when
  hosted inside `Modal`.
- **FRONTEND-009-AC-14** [AUTO]: `AssignActivityPicker`'s Assign and Cancel buttons, and the Assign
  button's existing disabled-while-submitting/no-selection behaviour, shall render and behave
  unchanged inside `Modal`.

### Requirement 4 — Closing the modal, equivalent to today's `onCancel`/`onSuccess`

As a user, I want to be able to back out of the picker cleanly — via Cancel, Escape, or clicking
outside it — with no side effect, and for a successful Assign to close it automatically.

- **FRONTEND-009-AC-15** [AUTO]: When `AssignActivityPicker`'s Cancel button is activated,
  `WeeklyPlanner` shall set `assignTarget` to `null` (equivalent to today's `onCancel`), with no
  call to `planApi.create`.
- **FRONTEND-009-AC-16** [AUTO]: When `AssignActivityPicker`'s Assign completes successfully,
  `WeeklyPlanner` shall append the created occurrence to `occurrences` and set `assignTarget` to
  `null` (equivalent to today's `onSuccess`), closing the modal.
- **FRONTEND-009-AC-17** [AUTO]: When the dialog is closed via the browser's native Escape/cancel
  behaviour (`Modal`'s `onClose`, per AC-08), `WeeklyPlanner` shall set `assignTarget` to `null`,
  with no call to `planApi.create`.
- **FRONTEND-009-AC-18** [AUTO]: When the dialog is closed via a backdrop click (`Modal`'s
  `onClose`, per AC-06/AC-08), `WeeklyPlanner` shall set `assignTarget` to `null`, with no call to
  `planApi.create`.

### Requirement 5 — Focus moves to the modal on open, and back to the trigger on close

As a keyboard or screen-reader user, I want opening the picker to take me straight into it, and
closing it to put me back exactly where I was — genuinely new behaviour, since today's inline
bottom-of-page section has no focus management at all.

- **FRONTEND-009-AC-19** [AUTO]: When "Add" is activated on a grid cell or the bucket list, focus
  shall move into the dialog (per `Modal`'s AC-04), not remain on the "Add" control that was
  clicked.
- **FRONTEND-009-AC-20** [AUTO]: When the modal is closed by any of the four paths in Requirement 4,
  focus shall return to the specific "Add" control that opened it (per `Modal`'s AC-05, verified
  here against the real grid-cell and bucket-list "Add" buttons).

### Requirement 6 — Only one modal instance open at a time

As a user, I want activating a second "Add" while the picker is already open to just retarget it,
not stack a second dialog on top.

- **FRONTEND-009-AC-21** [AUTO]: While the modal is open for one `assignTarget` and a different
  "Add" control is activated, `WeeklyPlanner` shall update `assignTarget` to the new target without
  rendering a second `Modal`/dialog — at most one element with `role="dialog"` shall exist in the
  document at any time.

### Requirement 7 — Dialog has an accessible name

As a screen-reader user, I want the dialog announced with a meaningful name when it opens.

- **FRONTEND-009-AC-22** [AUTO]: `AssignActivityPicker`'s existing `<h3>Assign an activity or
  sub-task</h3>` heading shall carry an `id`, and `WeeklyPlanner` shall pass that same `id` as
  `Modal`'s `titleId`, so the dialog's accessible name (queryable via
  `getByRole('dialog', { name: /assign an activity or sub-task/i })`) is "Assign an activity or
  sub-task".

### Requirement 8 — Real-browser visual verification

As a user, I want the modal to actually look like a modal — dimmed backdrop, sensibly positioned —
in both themes, not just structurally correct in the DOM.

- **FRONTEND-009-AC-23** [MANUAL]: The modal visually overlays the page correctly — the `::backdrop`
  dims the page behind it, and the dialog itself is centered/positioned sensibly — in both Light and
  Dark themes. Verified by a real-browser check, since jsdom does not render CSS/backdrop
  (`frontend_conventions.md`'s Testing Strategy note). No automation route exists for this today;
  a future visual-regression tool (not present in this project) would be the route to automate it.

## Component/type changes

`Modal.tsx` (new — `frontend/src/components/Modal/`, matching this project's convention for
reusable, non-page-specific components getting their own directory under `src/components/`, e.g.
`CategoryChip/`, `Navigation/`, rather than a flat file like the page-level `LoginPage.tsx`):

```typescript
interface ModalProps {
  readonly isOpen: boolean
  readonly titleId: string
  readonly onClose: () => void
  readonly children: React.ReactNode
}

export function Modal({ isOpen, titleId, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null
      dialog.showModal()
      dialog.focus()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  const handleNativeClose = () => {
    previouslyFocusedRef.current?.focus()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={styles.dialog}
      onClose={handleNativeClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          dialogRef.current?.close()
        }
      }}
    >
      {children}
    </dialog>
  )
}
```

`Modal` is mounted unconditionally by `WeeklyPlanner` (its `isOpen` prop toggles, rather than the
component itself mounting/unmounting) so the native `close` event — fired for Escape and backdrop
paths, not just explicit `close()` calls — has a stable `Modal` instance to flow back into
`onClose`. `AssignActivityPicker` itself keeps its existing conditional-render shape inside
`Modal`'s `children` (`{assignTarget && <AssignActivityPicker ... />}`), so it still mounts fresh
each time `assignTarget` goes from `null` to non-null — unchanged from today, and what makes
Requirement 6 ("second Add replaces the target") behaviourally identical to today's existing
conditional-render behaviour rather than something new.

`Modal.module.css` (new, following `frontend_spec_007_visual_refresh.md`'s theme
custom-property convention):

```css
.dialog {
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
  padding: 1.25rem;
  width: min(90vw, 32rem);
}

.dialog::backdrop {
  background: rgba(0, 0, 0, 0.45);
}
```

`AssignActivityPicker.tsx` (minimal change — an `id` on its existing heading; content otherwise
untouched):

```tsx
<h3 id="assign-picker-title">Assign an activity or sub-task</h3>
```

The existing outer `<section aria-label="Assign to plan">` wrapper becomes redundant once the
`<dialog>` itself carries `aria-labelledby` — it may be dropped as a natural consequence of the
move (a plumbing detail, not new picker UX), but keeping it causes no conflict either; not asserted
by any AC above.

`WeeklyPlanner.tsx` (assign-related state and rendering only — `detailOpenId`/etc. from
`frontend_spec_008` are a separate, unrelated region of this same file):

```tsx
const handleCloseAssign = () => setAssignTarget(null)

// ...

<Modal isOpen={assignTarget !== null} titleId="assign-picker-title" onClose={handleCloseAssign}>
  {assignTarget && (
    <AssignActivityPicker
      weekStart={weekStart}
      target={assignTarget}
      onSuccess={handleAssignSuccess}
      onCancel={handleCloseAssign}
    />
  )}
</Modal>
```

`PlannerGrid.tsx`'s `onAdd` and `BucketList.tsx`'s `onAdd` props and call sites are unchanged —
both already just set `assignTarget`, which is all Requirement 2 requires.

## Cross-references

| This spec | Contracts against |
|---|---|
| `Modal.tsx` (new) | No prior art in this codebase — first modal/dialog primitive |
| `AssignActivityPicker.tsx` (`frontend_spec_004_week_planning.md`) | Relocated into `Modal`, content/behaviour unchanged except a new heading `id` |
| `WeeklyPlanner.tsx` | Extended — `Modal` wraps `AssignActivityPicker`, `handleCloseAssign` replaces the inline `() => setAssignTarget(null)` cancel/close callback |
| `PlannerGrid.tsx` / `BucketList.tsx` (`frontend_spec_004_week_planning.md`) | Unmodified — `onAdd` call sites already set `assignTarget`, no prop changes needed |
| CSS Modules + theme custom properties (`frontend_spec_007_visual_refresh.md`) | Reused — `Modal.module.css` follows the same `*.module.css` + `var(--...)` convention |
| `frontend_spec_008_occurrence_detail_card.md` | Sibling chunk of the same UX batch, not yet implemented — touches `WeeklyPlanner.tsx` in an unrelated region (`detailOpenId` vs. this spec's `assignTarget`/`Modal` state) |
| `POST /api/v1/plan/occurrences` (`planner_spec_004_week_planning.md`) | Unchanged — `planApi.create(...)`'s request/response shape is untouched by this spec |

`WeeklyPlanner.test.tsx`'s existing assign-flow tests (`FRONTEND-004-AC-20/21/22`, `AC-39`) already
assert `expect(screen.queryByRole('dialog')).not.toBeInTheDocument()` after a successful assign —
written ahead of this spec, but it becomes a real, meaningful regression check for AC-16 once
`Modal` exists; no change needed to that assertion, just note it during implementation rather than
assuming it needs updating.

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
// Modal.test.tsx

function TestHarness({ initialOpen }: { readonly initialOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen)
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      <Modal isOpen={isOpen} titleId="t" onClose={() => setIsOpen(false)}>
        <h3 id="t">Title</h3>
        <button type="button" onClick={() => setIsOpen(false)}>
          Content Cancel
        </button>
      </Modal>
    </>
  )
}

describe('FRONTEND-009-AC-01/AC-02: closed by default, opens on isOpen becoming true', () => {
  it('has no dialog role until Open is clicked', async () => {
    render(<TestHarness initialOpen={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog', { name: 'Title' })).toBeInTheDocument()
  })
})

describe('FRONTEND-009-AC-04/AC-05: focus moves in on open, back to the opener on close', () => {
  it('focuses the dialog, then restores focus to the Open button on close', async () => {
    render(<TestHarness initialOpen={false} />)
    const openButton = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(openButton)

    expect(await screen.findByRole('dialog')).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Content Cancel' }))
    expect(openButton).toHaveFocus()
  })
})

describe('FRONTEND-009-AC-06: clicking the dialog backdrop closes it', () => {
  it('closes when the click target is the dialog element itself', async () => {
    render(<TestHarness initialOpen={true} />)
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(dialog)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('does not close when the click target is inside the content', async () => {
    render(<TestHarness initialOpen={true} />)
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByText('Title'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('FRONTEND-009-AC-07: aria-labelledby wires to the caller-supplied heading', () => {
  it('exposes the accessible name from the id-matched heading', async () => {
    render(<TestHarness initialOpen={true} />)
    expect(await screen.findByRole('dialog', { name: 'Title' })).toBeInTheDocument()
  })
})

describe('FRONTEND-009-AC-08: the native close event calls onClose exactly once', () => {
  it('calls onClose once when the dialog fires its close event', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal isOpen={true} titleId="t" onClose={onClose}>
        <h3 id="t">Title</h3>
      </Modal>,
    )
    const dialog = await screen.findByRole('dialog')

    fireEvent(dialog, new Event('close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

```typescript
// WeeklyPlanner.test.tsx additions

describe('FRONTEND-009-AC-09/AC-19: grid Add opens the modal and moves focus into it', () => {
  it('opens a dialog labelled for assignment when a grid cell Add is activated', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    const addButton = await screen.findByRole('button', { name: /add.*monday.*morning/i })
    await userEvent.click(addButton)

    expect(
      await screen.findByRole('dialog', { name: /assign an activity or sub-task/i }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-009-AC-15/AC-20: Cancel closes the modal with no create call, focus returns to Add', () => {
  it('closes on Cancel, calls no create, and returns focus to the Add control', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    const addButton = await screen.findByRole('button', { name: /add.*monday.*morning/i })
    await userEvent.click(addButton)
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(planApi.create).not.toHaveBeenCalled()
    expect(addButton).toHaveFocus()
  })
})

describe('FRONTEND-009-AC-16: successful assign appends the occurrence and closes the modal', () => {
  it('closes after a successful assign', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([
      { id: 'a1', name: 'Go for a walk', category: 'ROUTINE', description: null, repeatable: true, archived: false, createdAt: '2026-09-01T00:00:00Z' },
    ])
    vi.mocked(subTaskApi.getAll).mockResolvedValue([])
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    vi.mocked(planApi.create).mockResolvedValue(walk)
    render(<WeeklyPlanner />)

    await userEvent.click(await screen.findByRole('button', { name: /add.*monday.*morning/i }))
    await userEvent.click(await screen.findByRole('button', { name: /go for a walk/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm|assign/i }))

    expect(await screen.findByText('Go for a walk')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-009-AC-21: a second Add while open replaces the target, no second dialog', () => {
  it('retargets to the bucket list without stacking a second dialog', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([])
    vi.mocked(planApi.getWeek).mockResolvedValue([])
    render(<WeeklyPlanner />)

    await userEvent.click(await screen.findByRole('button', { name: /add.*monday.*morning/i }))
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByRole('button', { name: /add to weekend bucket list/i }))

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
})
```

**Test Case (Green)**: create `Modal.tsx`/`Modal.module.css` and update `AssignActivityPicker.tsx`
(heading `id` only) and `WeeklyPlanner.tsx` (wrap the existing conditional `AssignActivityPicker`
render in `Modal`, add `handleCloseAssign`) as specified above until every sketch above (and the
remaining ACs not sketched: AC-03, AC-10, AC-11, AC-12, AC-13, AC-14, AC-17, AC-18, AC-22, AC-23)
passes. AC-23 is verified by a real-browser pass in both Light and Dark, per
`frontend_conventions.md`'s Testing Strategy note. AC-17/AC-18 (Escape and backdrop-click closing
via `WeeklyPlanner`) are the same `Modal`-level mechanism as AC-06/AC-08, exercised again at the
`WeeklyPlanner` integration level.

## Acceptance Criteria Summary

- [x] FRONTEND-009-AC-01 — closed `Modal` has no `open` attribute, no `role="dialog"` exposed
- [x] FRONTEND-009-AC-02 — `isOpen` false→true calls `showModal()`
- [x] FRONTEND-009-AC-03 — `isOpen` true→false calls `close()`
- [x] FRONTEND-009-AC-04 — opening moves focus to the dialog itself
- [x] FRONTEND-009-AC-05 — closing (any cause) restores focus to the pre-open element
- [x] FRONTEND-009-AC-06 — a click whose target is the dialog itself (backdrop) closes it
- [x] FRONTEND-009-AC-07 — `aria-labelledby={titleId}` gives the dialog its accessible name
- [x] FRONTEND-009-AC-08 — the native `close` event calls `onClose` exactly once
- [x] FRONTEND-009-AC-09 — grid "Add" sets `assignTarget` and opens the modal
- [x] FRONTEND-009-AC-10 — bucket "Add" sets `assignTarget` (null day/slot) and opens the modal
- [x] FRONTEND-009-AC-11 — `assignTarget` null renders `Modal` with `isOpen` false
- [x] FRONTEND-009-AC-12 — picker's fetch + single-selection pattern unchanged inside the modal
- [x] FRONTEND-009-AC-13 — picker's loading/error/empty states unchanged inside the modal
- [x] FRONTEND-009-AC-14 — picker's Assign/Cancel buttons and disabled behaviour unchanged
- [x] FRONTEND-009-AC-15 — Cancel sets `assignTarget` null, no `planApi.create` call
- [x] FRONTEND-009-AC-16 — successful assign appends the occurrence and closes the modal
- [x] FRONTEND-009-AC-17 — Escape closes with `assignTarget` null, no create call
- [x] FRONTEND-009-AC-18 — backdrop click closes with `assignTarget` null, no create call
- [x] FRONTEND-009-AC-19 — opening moves focus into the dialog, off the Add control
- [x] FRONTEND-009-AC-20 — closing (any of the four paths) returns focus to the Add control
- [x] FRONTEND-009-AC-21 — a second Add while open retargets, never a second dialog
- [x] FRONTEND-009-AC-22 — dialog's accessible name is "Assign an activity or sub-task"
- [x] FRONTEND-009-AC-23 — visually correct overlay in Light and Dark (real-browser check)
