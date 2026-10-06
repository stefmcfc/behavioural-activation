# Change Password (Frontend)

**Status**: Implemented (2026-10-06) — `components/Navigation/AccountMenu.tsx`,
`components/LoginPage.tsx`, `App.tsx`, `services/authApi.ts`
**Priority**: P2 — matches `planner_spec_024_change_password.md`'s priority
**Depends on**: `planner_spec_024_change_password.md` (paired backend spec — `PATCH
/api/v1/auth/password`), `frontend_spec_030_header_restructure.md` (`AccountMenu`'s existing native
`popover="auto"` panel, origin of its current username + Log out content),
`frontend_spec_029_session_expiry_handling.md` (`App.tsx`'s `SessionState`/`sessionExpired` pattern,
mirrored here), `tooling_spec_003_modern_web_guidance_fixes.md` (`LoginPage`'s blur-empty/
submit-attempt validation timing, mirrored for this new form)
**Area**: Frontend
**Roadmap version**: V1 (Authentication)

## Overview

Consumes `planner_spec_024_change_password.md`'s new endpoint. Adds a "Change password" form
directly inside the existing `AccountMenu` popover, alongside the current username display and
"Log out" button — no new `Modal`, matching how `SettingsMenu`'s controls already sit directly
inside its own popover panel rather than in a nested dialog.

**Post-success flow, reusing an existing mechanism rather than inventing one**: the backend
invalidates the session on a successful change (`planner_spec_024`'s `PLANNER-024-AC-04`), so the
user needs to log in again regardless. `App.tsx` already has exactly the right shape for this —
its `SessionState` union's `unauthenticated` variant carries an optional `expired?: boolean` used
today to show `LoginPage`'s "Your session has expired" notice after the global 401 handler fires.
This spec adds a second, equally-named optional reason, `passwordChanged?: boolean`, set
*proactively* by the change-password success handler (not waiting for a future request to 401) —
giving an accurate "Password changed" message instead of overloading the existing "session expired"
wording for a case that isn't actually an expiry.

## Requirement 1: Change your password from the Account menu

**User story**: As the authenticated user, I want to change my password without leaving the app or
editing server config, with the same clear, blur/submit-timed validation the Login form already
gives me.

### FRONTEND-050-AC-01 [AUTO]: AccountMenu gains a Change password form
**Statement**: `AccountMenu`'s popover panel shall render a "Change password" form (current
password, new password, confirm new password fields) alongside the existing username display and
"Log out" button, following the same blur-empty/submit-attempt validation timing `LoginPage`
already uses for its fields.

**References**: `components/Navigation/AccountMenu.tsx` — extend the existing panel `<div>`, no new
`Modal`. `components/LoginPage.tsx` — the exact validation-timing pattern to mirror (per
`tooling_spec_003`'s `TOOLING-003-AC-01`).

**Test Case (Red)**:
```typescript
describe('FRONTEND-050-AC-01: Change password form renders with validation timing matching LoginPage', () => {
  it('shows the three fields and no error until a field is blurred empty or submit is attempted', () => {
    render(<AccountMenu username="steve" onLogout={vi.fn()} />)

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
  })
})
```

**Test Case (Green)**: implement the form as described in References.

### FRONTEND-050-AC-02 [AUTO]: New password and confirmation must match before submitting
**Statement**: If "new password" and "confirm new password" don't match at submit time, the form
shall display a "Passwords don't match" error and not call the API.

**Rationale**: Purely a client-side UX check — the backend only ever sees one `newPassword` value
(`planner_spec_024`'s `ChangePasswordRequest` has no confirmation field), this prevents a silent typo
from locking the user out of their own account.

**Test Case (Red)**:
```typescript
describe('FRONTEND-050-AC-02: mismatched new password and confirmation blocks submit', () => {
  it('shows an error and does not call the API when the two new-password fields differ', async () => {
    const changePasswordSpy = vi.spyOn(authApi, 'changePassword')
    render(<AccountMenu username="steve" onLogout={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/current password/i), 'old-password')
    await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-1')
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-2')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByText(/passwords don't match/i)).toBeInTheDocument()
    expect(changePasswordSpy).not.toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: compare the two fields before calling `authApi.changePassword(...)`.

### FRONTEND-050-AC-03 [AUTO]: A successful change logs the user out with a confirmation message
**Statement**: When `authApi.changePassword(...)` resolves successfully, the app shall transition to
the unauthenticated state with `passwordChanged: true` (mirroring `SessionState`'s existing
`expired` shape), and `LoginPage` shall display a "Password changed. Please log in with your new
password." notice instead of (or alongside, if both happen to be true) the existing session-expired
notice.

**References**: `App.tsx`'s `SessionState` type — add `passwordChanged?: boolean` to the
`unauthenticated` variant, alongside the existing `expired?: boolean`. `AccountMenu` needs a new
`onPasswordChanged: () => void` callback prop, passed down from `App.tsx` exactly the way
`onLogout` already is, setting `{ status: 'unauthenticated', passwordChanged: true }`.
`components/LoginPage.tsx` — new optional `passwordChanged?: boolean` prop, rendered the same way
`sessionExpired` already is.

**Test Case (Red)**:
```typescript
describe('FRONTEND-050-AC-03: a successful password change logs out with a confirmation message', () => {
  it('calls onPasswordChanged after a successful change', async () => {
    vi.mocked(authApi.changePassword).mockResolvedValue(undefined)
    const onPasswordChanged = vi.fn()
    render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={onPasswordChanged} />)

    await userEvent.type(screen.getByLabelText(/current password/i), 'old-password')
    await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-123')
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-123')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    await vi.waitFor(() => expect(onPasswordChanged).toHaveBeenCalled())
  })

  it('LoginPage shows a password-changed notice when passwordChanged is true', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} passwordChanged />)
    expect(screen.getByRole('alert')).toHaveTextContent(/password changed/i)
  })
})
```

**Test Case (Green)**: implement the callback wiring and `LoginPage` notice as described in
References.

### FRONTEND-050-AC-04 [AUTO]: A failed change shows an error and keeps the user logged in
**Statement**: If `authApi.changePassword(...)` rejects (e.g. the backend's `401` for a wrong
current password, or `400` for an invalid new password), the form shall display the error via the
existing `getErrorMessage`/`role="alert"` pattern and the user shall remain on the current page,
still authenticated.

**Test Case (Red)**:
```typescript
describe('FRONTEND-050-AC-04: a failed change shows an error, user stays logged in', () => {
  it('shows an error and does not log out on failure', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new ApiError('Invalid credentials', 401))
    const onPasswordChanged = vi.fn()
    render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={onPasswordChanged} />)

    await userEvent.type(screen.getByLabelText(/current password/i), 'wrong-password')
    await userEvent.type(screen.getByLabelText(/^new password/i), 'new-password-123')
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'new-password-123')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid credentials/i)
    expect(onPasswordChanged).not.toHaveBeenCalled()
  })
})
```

**Test Case (Green)**: catch the rejection, render the error, don't call `onPasswordChanged`.

### FRONTEND-050-AC-05 [AUTO]: Type and service contract
**Statement**: `services/authApi.ts` shall expose `changePassword(currentPassword: string,
newPassword: string): Promise<void>`, calling `PATCH /auth/password` with `{ currentPassword,
newPassword }`.

**References**: `services/authApi.ts`'s existing `login`/`logout` method shapes to mirror.

**Test Case (Green)**:
```typescript
changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
  request<void>(() => client.patch('/auth/password', { currentPassword, newPassword })),
```

## Cross-references

| Reference | What it provides |
|---|---|
| `components/Navigation/AccountMenu.tsx` | Extended — Change password form, new `onPasswordChanged` prop |
| `components/LoginPage.tsx` | Extended — new `passwordChanged` prop and notice |
| `App.tsx` | Extended — `SessionState.passwordChanged`, wiring `onPasswordChanged` into `AccountMenu` |
| `services/authApi.ts` | Extended — `changePassword(...)` |
| `planner_spec_024_change_password.md` | Paired backend spec |
| `frontend_spec_029_session_expiry_handling.md` | Origin of the `SessionState`/`expired` pattern this mirrors |

`AccountMenu.test.tsx`'s existing test suite will need `onPasswordChanged` added to its base props
fixture — not a new AC, a mechanical consequence of the new required prop.

## Acceptance Criteria Summary

- [x] FRONTEND-050-AC-01 — AccountMenu gains a Change password form with LoginPage-style validation timing
- [x] FRONTEND-050-AC-02 — mismatched new password/confirmation blocks submit client-side
- [x] FRONTEND-050-AC-03 — a successful change logs out with a "Password changed" notice on LoginPage
- [x] FRONTEND-050-AC-04 — a failed change shows an error, user stays logged in
- [x] FRONTEND-050-AC-05 — `authApi.changePassword(...)` calls `PATCH /auth/password`

## Summary

### Implementation

- `services/authApi.ts` — added `changePassword(currentPassword, newPassword): Promise<void>`,
  calling `PATCH /auth/password`, mirroring `login`/`logout`'s existing shape exactly.
- `components/Navigation/AccountMenu.tsx` — added a "Change password" form (current password, new
  password, confirm new password) directly inside the existing popover panel, below the username/
  Log out controls. Required-field validation timing (blur-while-empty, clear-on-type, submit-
  attempt) mirrors `LoginPage.tsx` field-for-field: `aria-invalid`/`aria-describedby` wired to
  per-field `<p>` error elements. A client-only mismatch check (new vs. confirm) runs after the
  required-field check and before calling the API, showing "Passwords don't match." without
  touching the network. API failures (401 wrong-current-password, 400 validation) render via the
  existing `getErrorMessage`/`role="alert"` pattern and leave the user logged in. New required prop
  `onPasswordChanged: () => void`.
- `App.tsx` — `SessionState`'s `unauthenticated` variant gained a second optional reason,
  `passwordChanged?: boolean`, alongside the existing `expired?: boolean`. New `handlePasswordChanged`
  callback sets `{ status: 'unauthenticated', passwordChanged: true }` directly (no `authApi.logout()`
  call — the backend already invalidated the session as part of the successful change). Wired into
  `AccountMenu`'s new `onPasswordChanged` prop and `LoginPage`'s new `passwordChanged` prop exactly
  the way `onLogout`/`sessionExpired` already were.
- `components/LoginPage.tsx` — new optional `passwordChanged?: boolean` prop, rendered as a second
  `role="alert"` notice ("Password changed. Please log in with your new password.") alongside the
  existing session-expired notice, using the same `sessionExpiredNotice` CSS class.

### Testing

- Red/green TDD throughout: each AC's test was written first against the not-yet-existing
  prop/markup, confirmed failing, then made to pass.
- `AccountMenu.test.tsx`'s base props fixture (every existing render call) was updated to include
  the new required `onPasswordChanged` prop — a mechanical consequence of the new prop, not a new
  AC, per the spec's own cross-reference note.
- `SettingsMenu.test.tsx` also renders a bare `<AccountMenu>` to exercise the two-popover interaction
  (FRONTEND-030-AC-09) and needed the same mechanical prop addition — this wasn't called out in the
  spec but was caught by `tsc`, not by Vitest (the test used no typed import path that would have
  failed at the Vitest/Babel-transform layer).
- Test counts: 663 passing before this change, 675 passing after (12 new: 7 in
  `AccountMenu.test.tsx`, 3 in `LoginPage.test.tsx`, 1 in `authApi.test.ts`, 1 in `App.test.tsx`).
  Zero regressions across all 46 test files.
- `npm run lint` (oxlint): clean, no findings.
- `npx tsc -b --noEmit`: clean after the `SettingsMenu.test.tsx` fix above.

### Real-browser verification — completed in a follow-up pass

The implementing agent couldn't perform this (no browser tool available in that session) — completed
separately (Chrome automation, against the live `:4321`/`:8420` dev stack) using the real seeded
account. Logged in, opened the Account menu, submitted the Change password form (current/new/confirm)
— confirmed the app bounced to the login page with "Password changed. Please log in with your new
password." Confirmed the **old** password now returns "Invalid credentials", and the **new** password
logs in successfully — the full backend round-trip (session invalidation, hash update) verified
end-to-end, not just via Vitest. The password was then changed back to the original seeded value via
the same form, confirmed working, so the local dev environment's documented `.env` credentials are
unaffected.
