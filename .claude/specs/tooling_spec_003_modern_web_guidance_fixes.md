# Native Required-Field Validation Timing, Dialog Light-Dismiss, Color-Scheme Meta Tag (Tooling)

**Status**: Not started
**Priority**: P3 — UX/platform polish, no new user-facing capability
**Depends on**: `planner_spec_001_auth.md` (`LoginPage`), `planner_spec_002_activity_bank.md`
(`ActivityForm`, `CategoryPicker`), `planner_spec_003_sub_tasks.md` (`SubTaskForm`),
`frontend_spec_008_occurrence_detail_card.md`/`frontend_spec_009_add_picker_modal.md` (`Modal`,
the shared `<dialog>`-based component both specs build on)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: N/A — internal/maintenance, not a V1–V5 feature

## Overview

Raised by the user 2026-10-01 from a `modern-web-guidance` plugin review of the frontend
(`.claude/modern-web-guidance/reviews/review-2026-10-01.md`). The review found the codebase already
follows most current web-platform best practice (native `<dialog>`, `color-scheme`/`accent-color`
theming, `:has()`, `prefers-reduced-motion`); this spec actions the three lowest-risk findings the
user asked to fix together:

1. **Required-field error timing.** `LoginPage.tsx`, `ActivityForm.tsx`, and `SubTaskForm.tsx` all
   use the same pattern today: `<form onSubmit={...} noValidate>` plus a `validationError` string
   state computed only inside the submit handler (`LoginPage.tsx:36-39`, `ActivityForm.tsx:45-52`,
   `SubTaskForm.tsx:40-43`). An empty required field gives no feedback at all until the user presses
   submit. This spec moves the error to appear as soon as the user has actually interacted with and
   left the field empty (blur), or attempted submit — matching the timing native
   `:user-invalid`/`:user-valid` CSS already gives for free, which is also added as a visual
   enhancement (`:user-invalid` has been Baseline widely-available since 2023-11, no fallback
   needed). `aria-invalid` is synced in JS to match, since `:user-invalid` is visual-only and doesn't
   touch ARIA itself. `ActivityForm`'s category field (`CategoryPicker.tsx`) is a `fieldset` of
   native radio inputs, not a single text input — a radio group has no "blurred empty" state (you
   can't clear a radio selection back to nothing by interacting with it), so its only invalid timing
   is a submit attempt with nothing chosen; this is intentionally different from the text-field
   timing and called out as its own AC below. Submit buttons already stay enabled regardless of
   validity in all three forms today (not `disabled={!isValid}`) — that's correct per the guide and
   is not changed by this spec.
2. **Dialog light-dismiss.** `Modal.tsx`'s `<dialog>` doesn't set `closedby`. Adding
   `closedby="any"` is a no-cost progressive enhancement: native light-dismiss (click/tap the
   backdrop) and platform back-gesture dismiss on mobile, in browsers that already support it
   (Chrome/Edge/Firefox since early-mid 2025; Safari not yet). `Modal.tsx` already implements the
   exact JS fallback the guide specifies for non-supporting browsers (its `onClick` handler checking
   `event.target === event.currentTarget`, then `dialog.close()`), so no new fallback code is needed
   — this AC only adds the attribute and confirms the existing fallback and the native behavior don't
   double-fire `onClose` in supporting browsers.
3. **`color-scheme` meta tag.** `frontend/index.html`'s `<head>` has no
   `<meta name="color-scheme" content="light dark">`. The CSS `color-scheme` property is already set
   correctly in `theme.css`, but the guide calls the meta tag out as an additional step that lets the
   browser pick the correct native-UI theme (initial canvas/scrollbar color) before CSS has even
   parsed, reducing any residual flash.

**Explicitly out of scope** (reviewed and decided separately, not part of this spec):
- `Settings.tsx`'s three-state (System/Light/Dark) theme toggle — reviewed against the guide's
  two-state recommendation and intentionally kept as-is; the existing "Currently: Dark/Light" hint
  text already addresses the guide's feedback concern.
- Touch-friendly bucket-list drag-and-drop reordering and the `AssignActivityPicker` N+1 sub-task
  fetch — both deferred to `.claude/SPEC_CANDIDATES.md` as their own future work; the former has no
  confirmed real need yet (desktop-only usage today), the latter needs a new backend endpoint and a
  full spec pair of its own.
- The `theme.css` `light-dark()` refactor (collapsing the three duplicated light/dark variable
  blocks into one) — a genuine no-behavior-change refactor (same computed colors), done directly
  under this project's "one-off, no-behavior-change quality/maintenance pass doesn't need a spec"
  exception, not as a requirement here.

## Requirement 1: Required-field errors follow native interaction timing, not submit-only

**User story**: As a user filling in the Login, Add/Edit Activity, or Add/Rename Sub-task forms, I
want an empty required field to only look wrong once I've actually left it empty or tried to submit
— not the instant the form renders — so I'm not scolded for fields I haven't reached yet, while a
submit attempt still immediately flags every empty required field.

### TOOLING-003-AC-01 [AUTO]: LoginPage username/password error timing
**Statement**: While neither the username nor password field has been blurred empty nor has a
submit been attempted, `LoginPage` shall display no required-field error. When the user blurs an
empty required field, or attempts submit while it is empty, `LoginPage` shall display that field's
required-field error text and set `aria-invalid="true"` on it; both fields shall carry the
`required` attribute. When the user then enters a non-empty value into a field showing that error,
`LoginPage` shall immediately clear the error text and `aria-invalid` for that field.

**Rationale**: Matches the `:user-invalid`/`:user-valid` native timing model (guide:
`required-field-feedback`) without waiting on jsdom's lack of real CSS pseudo-class support —
implemented as JS-driven state so it's directly testable, with `required` + `:user-invalid` CSS
layered on top as a native visual enhancement (verified manually in-browser, see AC-01's test note).

**References**:
- Component: `frontend/src/components/LoginPage.tsx`
- Guide: `modern-web-guidance` → `required-field-feedback`

### TOOLING-003-AC-02 [AUTO]: ActivityForm name field error timing
**Statement**: While the name field has not been blurred empty nor has a submit been attempted,
`ActivityForm` shall display no "Name is required" error. When the user blurs an empty name field,
or attempts submit while it is empty, `ActivityForm` shall display the error text, set
`aria-invalid="true"` on the name input, and the input shall carry the `required` attribute. When
the user then enters a non-empty name, `ActivityForm` shall immediately clear the error and
`aria-invalid`.

**References**:
- Component: `frontend/src/components/ActivityBank/ActivityForm.tsx`

### TOOLING-003-AC-03 [AUTO]: ActivityForm category group error timing (submit-only)
**Statement**: While no category has been chosen, `ActivityForm` shall display no "Please select a
category" error until a submit has been attempted. When submit is attempted with no category
chosen, `ActivityForm` shall display that error and `CategoryPicker`'s fieldset shall expose an
invalid state (e.g. `aria-invalid="true"` on the fieldset, or an error association via
`aria-describedby`) for assistive technology. When the user then selects a category, `ActivityForm`
shall immediately clear the error and the fieldset's invalid state.

**Rationale**: A required radio group has no "blurred empty" pathway (there's no way to leave a
radio selection emptied by interacting with it, unlike a text input) — its only native invalid
timing is a submit attempt, intentionally different from AC-01/02/04.

**References**:
- Components: `frontend/src/components/ActivityBank/ActivityForm.tsx`,
  `frontend/src/components/ActivityBank/CategoryPicker.tsx`

### TOOLING-003-AC-04 [AUTO]: SubTaskForm name field error timing
**Statement**: While the name field has not been blurred empty nor has a submit been attempted,
`SubTaskForm` shall display no "Name is required" error. When the user blurs an empty name field, or
attempts submit while it is empty, `SubTaskForm` shall display the error text, set
`aria-invalid="true"` on the name input, and the input shall carry the `required` attribute. When
the user then enters a non-empty name, `SubTaskForm` shall immediately clear the error and
`aria-invalid`.

**References**:
- Component: `frontend/src/components/ActivityBank/SubTaskForm.tsx`

### TOOLING-003-AC-05 [AUTO]: Submit stays enabled regardless of validity (no regression)
**Statement**: Regardless of any required field's current validity, `LoginPage`, `ActivityForm`, and
`SubTaskForm` shall keep their submit button enabled (not `disabled`) whenever a submission is not
already in flight, so a submit attempt is always available to trigger native focus-first-invalid-field
behavior and the error timing in AC-01 through AC-04.

**Rationale**: Explicit regression guard — this spec changes *when* errors appear, not whether the
button can be clicked; disabling it would block the submit-attempt pathway the other ACs rely on.

**References**: Guide: `required-field-feedback` ("Submit Buttons" section — keep enabled, don't
disable-until-valid).

## Requirement 2: Modal dialog supports native light-dismiss

**User story**: As a user with a modal open (e.g. the Add/Edit Activity form, the occurrence detail
card), I want to dismiss it by tapping outside it or using my device's back gesture, the same way
native modals behave, so I don't have to hunt for a Cancel button every time.

### TOOLING-003-AC-06 [AUTO]: Modal declares closedby="any"
**Statement**: `Modal`'s `<dialog>` element shall carry `closedby="any"`. When the dialog is closed
— by its existing backdrop-click fallback handler, by the native `close`/`cancel` event, or by the
`closedby` attribute's own light-dismiss/platform-control handling in supporting browsers —
`Modal`'s `onClose` callback shall fire exactly once per close, with no double-invocation.

**Rationale**: `Modal.tsx` already implements the guide's recommended JS fallback for browsers
without `closedby` support (its `onClick` backdrop-detection handler); this AC only adds the
attribute as a progressive enhancement and guards against the fallback and native behavior both
firing `onClose` for the same close action in browsers that support `closedby`.

**References**:
- Component: `frontend/src/components/Modal/Modal.tsx`
- Guide: `modern-web-guidance` → `light-dismiss-a-dialog`, `platform-controls-dismiss-dialog`

**Manual verification note**: jsdom's `<dialog>` implementation doesn't model `closedby`'s native
light-dismiss/back-gesture behavior, so the "no double-fire" assertion in the automated test below
covers the existing fallback path only (the part jsdom can execute). Actual light-dismiss-by-tapping-
the-backdrop in a `closedby`-supporting browser is a one-time manual check per this project's
Definition of Done (UI work needs a real-browser pass; jsdom doesn't render/behave like a real
engine here) — not re-litigated as its own `[MANUAL]` AC since it's covered by that existing rule.

## Requirement 3: Document declares supported color schemes

**User story**: As a user loading the app, I want the browser to pick the correct native-UI theme
(scrollbars, form controls, initial canvas) as early as possible, so there's minimal chance of a
mismatched-theme flash before CSS applies.

### TOOLING-003-AC-07 [MANUAL]: index.html declares light/dark color-scheme support
**Statement**: `frontend/index.html`'s `<head>` shall contain
`<meta name="color-scheme" content="light dark">`.

**Rationale**: `[MANUAL]` rather than `[AUTO]`: this project has no existing test harness that parses
static HTML files (no test currently reads `index.html`), and the tag's presence is a trivial,
directly-diffable one-liner in code review — standing up file-reading test infrastructure for a
single static meta tag isn't worth it. Verified by code review of the diff.

**References**: Guide: `modern-web-guidance` → `dark-mode` (step 1, "Declare supported schemes in
HTML").

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/components/LoginPage.tsx` | AC-01 target |
| `frontend/src/components/ActivityBank/ActivityForm.tsx` | AC-02, AC-03 target |
| `frontend/src/components/ActivityBank/CategoryPicker.tsx` | AC-03 target (fieldset/radio group) |
| `frontend/src/components/ActivityBank/SubTaskForm.tsx` | AC-04 target |
| `frontend/src/components/Modal/Modal.tsx` | AC-06 target |
| `frontend/index.html` | AC-07 target |
| `.claude/modern-web-guidance/reviews/review-2026-10-01.md` | Source review this spec actions |
| `.claude/SPEC_CANDIDATES.md` | Where the two deferred findings (touch DnD, bulk sub-task fetch) live instead |

## TDD test case sketches

### TOOLING-003-AC-01
```typescript
describe('TOOLING-003-AC-01: LoginPage required-field error timing', () => {
  it('shows no error on initial render', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />)
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
  })

  it('shows the error and sets aria-invalid after blurring an empty username field', async () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />)
    const username = screen.getByLabelText('Username')
    fireEvent.focus(username)
    fireEvent.blur(username)
    expect(screen.getByText(/username.*required/i)).toBeInTheDocument()
    expect(username).toHaveAttribute('aria-invalid', 'true')
  })

  it('clears the error once a value is entered', async () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />)
    const username = screen.getByLabelText('Username')
    fireEvent.blur(username)
    await userEvent.type(username, 'steve')
    expect(screen.queryByText(/username.*required/i)).not.toBeInTheDocument()
    expect(username).not.toHaveAttribute('aria-invalid')
  })

  it('shows all empty required field errors on a bare submit attempt', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByText(/username.*required/i)).toBeInTheDocument()
    expect(screen.getByText(/password.*required/i)).toBeInTheDocument()
  })
})
```

### TOOLING-003-AC-02 / AC-04
```typescript
describe('TOOLING-003-AC-02: ActivityForm name field error timing', () => {
  it('shows no error until the name field is blurred empty or submit is attempted', () => {
    render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
    expect(screen.queryByText('Name is required.')).not.toBeInTheDocument()
  })

  it('shows the error after blurring an empty name field', () => {
    render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
    const name = screen.getByLabelText('Name')
    fireEvent.blur(name)
    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    expect(name).toHaveAttribute('aria-invalid', 'true')
  })
})

// TOOLING-003-AC-04 mirrors the same three cases against SubTaskForm's name field.
```

### TOOLING-003-AC-03
```typescript
describe('TOOLING-003-AC-03: ActivityForm category group error timing', () => {
  it('shows no category error before a submit attempt, even with no category chosen', async () => {
    render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Name'), 'Walk')
    expect(screen.queryByText(/select a category/i)).not.toBeInTheDocument()
  })

  it('shows the category error only once submit is attempted with none chosen', async () => {
    render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Name'), 'Walk')
    fireEvent.click(screen.getByRole('button', { name: /save activity/i }))
    expect(screen.getByText(/select a category/i)).toBeInTheDocument()
  })

  it('clears the category error once a category is selected', async () => {
    render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save activity/i }))
    await userEvent.click(screen.getByLabelText('Routine'))
    expect(screen.queryByText(/select a category/i)).not.toBeInTheDocument()
  })
})
```

### TOOLING-003-AC-05
```typescript
describe('TOOLING-003-AC-05: submit stays enabled regardless of validity', () => {
  it('ActivityForm submit button is never disabled by invalid required fields', () => {
    render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /save activity/i }))
    expect(screen.getByRole('button', { name: /save activity/i })).toBeEnabled()
  })
})
// Mirrored for LoginPage's "Log in" button and SubTaskForm's "Save sub-task" button.
```

### TOOLING-003-AC-06
```typescript
describe('TOOLING-003-AC-06: Modal closedby + no double-fire', () => {
  it('renders the dialog with closedby="any"', () => {
    render(<Modal isOpen onClose={vi.fn()} ariaLabel="Test">content</Modal>)
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('closedby', 'any')
  })

  it('fires onClose exactly once when the backdrop-click fallback closes it', () => {
    const onClose = vi.fn()
    render(<Modal isOpen onClose={onClose} ariaLabel="Test">content</Modal>)
    const dialog = screen.getByRole('dialog', { hidden: true })
    fireEvent.click(dialog) // click lands on the dialog element itself (backdrop), not a child
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

### TOOLING-003-AC-07
Verified by code review of the diff to `frontend/index.html` (see Rationale above for why this is
`[MANUAL]`, not an automated test) — confirm the `<head>` contains
`<meta name="color-scheme" content="light dark">`.

## Acceptance Criteria Summary

- [ ] TOOLING-003-AC-01 — LoginPage username/password error timing (blur-empty or submit, not on render)
- [ ] TOOLING-003-AC-02 — ActivityForm name field error timing
- [ ] TOOLING-003-AC-03 — ActivityForm category group error timing (submit-only)
- [ ] TOOLING-003-AC-04 — SubTaskForm name field error timing
- [ ] TOOLING-003-AC-05 — submit stays enabled regardless of validity (no regression)
- [ ] TOOLING-003-AC-06 — Modal declares closedby="any", no onClose double-fire
- [ ] TOOLING-003-AC-07 — index.html declares `<meta name="color-scheme" content="light dark">`
