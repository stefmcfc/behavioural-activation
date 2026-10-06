# Change Password (Frontend)

**Status**: Not started
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

- [ ] FRONTEND-050-AC-01 — AccountMenu gains a Change password form with LoginPage-style validation timing
- [ ] FRONTEND-050-AC-02 — mismatched new password/confirmation blocks submit client-side
- [ ] FRONTEND-050-AC-03 — a successful change logs out with a "Password changed" notice on LoginPage
- [ ] FRONTEND-050-AC-04 — a failed change shows an error, user stays logged in
- [ ] FRONTEND-050-AC-05 — `authApi.changePassword(...)` calls `PATCH /auth/password`
