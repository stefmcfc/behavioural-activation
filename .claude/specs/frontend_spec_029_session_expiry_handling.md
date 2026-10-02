# Graceful Session Expiry Handling

**Status**: Implemented (2026-10-02) — all 8 ACs implemented and test-covered
**Priority**: P2 — real UX bug found in use: the existing "Retry" button on an expired session can
never succeed, and nothing tells the user why
**Depends on**: `frontend_spec_001_login.md` (the `App.tsx` session gate and `LoginPage` this
modifies), `planner_spec_016_configurable_session_timeout.md` (the timeout this is verified against —
not a hard dependency, since this spec doesn't change timeout duration itself, but useful for a fast
manual-test loop)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: V1 hardening — a gap noticed in real use, not tied to a `HIGH_LEVEL_DESIGN.md`
version theme

## Summary

Implemented exactly as scoped in the Overview. `client.ts` gained a module-level
`onUnauthorized` handler slot, an exported `setUnauthorizedHandler()` to register/clear it, and a
`client.interceptors.response.use()` rejection handler that calls `onUnauthorized?.()` on any `401`
response and then re-rejects unchanged — `request()`'s existing `ApiError`-wrapping logic is
untouched and still runs on the re-thrown error. `App.tsx`'s `SessionState`'s `'unauthenticated'`
variant gained an optional `expired?: boolean` field; a new mount-only `useEffect` registers a
handler via `setUnauthorizedHandler` that only transitions state via a functional `setSession`
update guarded on `current.status === 'authenticated'` (and clears the registration on unmount).
`LoginPage` gained an optional `sessionExpired?: boolean` prop rendering a plain `<p>Your session
has expired. Please log in again.</p>` above the form when `true`; `App.tsx` passes
`sessionExpired={session.expired === true}` when rendering it from the `'unauthenticated'` branch.
`handleLoginSuccess` was already a full-replacement `setSession({ status: 'authenticated',
username })` with no `expired` field, so AC-05 required no production change — only a new test
confirming it.

No deviations from the spec. The "handler only acts while authenticated" mechanism was verified by
spying on `setUnauthorizedHandler` (real, unmocked `client.ts`) in `App.test.tsx`, capturing the
callback `App` registers, and invoking it directly in each session-state scenario — this exercises
the exact same App-level logic the real interceptor would trigger, without needing a second,
redundant simulation of the axios round-trip (that round-trip — "a 401 response invokes the
registered handler, a non-401 does not, `request()` still throws `ApiError`" — is covered directly
in the new `client.test.ts`). One incidental fix needed along the way: `vi.spyOn` on an ES-module
named export persists across tests in this file without an explicit `vi.restoreAllMocks()` in
`afterEach` (each subsequent `spyOn` call layers on top of the prior one rather than starting
clean), which made one new test flaky depending on run order until that `afterEach` was added —
worth keeping in mind for any future test file that `spyOn`s a module export more than once.

Four pre-existing service test files (`authApi.test.ts`, `planApi.test.ts`, `activityApi.test.ts`,
`subTaskApi.test.ts`) mock `axios.create()`'s return value without an `interceptors` property; each
needed `interceptors: { response: { use: vi.fn() } }` added to that mock so `client.ts`'s new
module-load-time `client.interceptors.response.use(...)` call doesn't throw `undefined is not an
object` when those modules import `client.ts`. No behavior change to those test files otherwise.

Test counts: 5 new tests in `frontend/src/services/client.test.ts` (new file), 10 new tests in
`frontend/src/App.test.tsx` (AC-01/02 registration + scoping, AC-03/04 redirect + notice, AC-05
re-login clears expired, AC-07 explicit logout shows no notice, AC-08 failed login's own inline
error unaffected), 3 new tests in `frontend/src/components/LoginPage.test.tsx` (AC-04 notice
shown/hidden/omitted). AC-06 (non-401 regression guard) relies on the pre-existing, unmodified
`WeeklyPlanner.test.tsx` (`FRONTEND-004-AC-38`) and `ActivityBank.test.tsx` (`FRONTEND-006-AC-13`)
Retry-flow tests continuing to pass unchanged (confirmed), plus the dedicated
`client.test.ts` case confirming the interceptor itself is a no-op for non-`401` statuses. Full
suite: 411 tests passing (32 files), `npm run lint` (oxlint) clean, `npm run build` clean. Backend
was running locally during verification (`GET /auth/me` confirmed returning `401` as expected); no
interactive browser click-through was performed in this pass beyond confirming the dev server
serves the app — this is a logic-only change with no new CSS, and the one new UI element (the
expired-session `<p>` notice) reuses existing plain-paragraph text styling already present in
`LoginPage`.

## Overview

Raised by the user: after leaving a `/planner` tab idle long enough for the backend session to
expire, the page showed a generic "Authentication required" error with a "Retry" button that didn't
do anything — clicking it just re-sent the same request with the same already-dead session cookie, so
it 401s again, forever. Meanwhile the header still read "Logged in as steve" with a working nav,
which is actively misleading.

**Root cause**: `App.tsx` checks `authApi.me()` exactly once, in a mount-only `useEffect`. Once that
resolves, `session.status` is set to `'authenticated'` and nothing afterward ever moves it back —
there is no code anywhere that reacts to a later `401` from any other API call. Each page component
(`WeeklyPlanner`, `ActivityBank`, etc.) independently catches its own fetch errors and renders a
local, generic error message + "Retry" button — which works fine for a transient `500` (the server
really might succeed on retry) but is structurally incapable of ever succeeding for a `401` (retrying
sends the identical, still-invalid session cookie).

**The fix**: a global response interceptor on the shared `axios` client (`client.ts`) that detects any
`401` and — critically, only while the app currently believes itself authenticated — tells `App.tsx`
to drop back to the login screen with a clear "your session expired" message. This is scoped
precisely to avoid two false triggers that would otherwise break existing, correct behavior:
- `App.tsx`'s own initial `authApi.me()` check legitimately returns `401` for a browser that was
  never logged in — this must not show an "expired" message (there was no session to expire).
- `LoginPage`'s own login attempt legitimately returns `401` for wrong credentials — this must keep
  showing `LoginPage`'s own existing inline error, not trigger a global redirect.

**Why this doesn't need URL-based exclusions**: rather than special-casing `/auth/me`/`/auth/login` by
path in the interceptor (brittle — anyone adding a new public endpoint later would have to remember to
extend an exclusion list), the global handler itself only *acts* when the app's current session state
is `'authenticated'`. A `401` from the initial `me()` check happens while `session.status ===
'checking'`; a `401` from a failed login happens while `session.status === 'unauthenticated'`. Neither
matches, so the handler is a no-op in both cases — the exclusion falls out of *when* the 401 can occur
relative to app state, not which endpoint produced it.

## Requirement 1: A global interceptor observes every 401, scoped to "while authenticated"

**User story**: As a developer, I want one place that knows "the session just died," instead of every
component inventing its own retry-that-can-never-work error handling.

### FRONTEND-029-AC-01 [AUTO]: The shared API client exposes a registrable 401 handler
**Statement**: `client.ts` shall export a function (e.g. `setUnauthorizedHandler(handler: (() => void)
| null)`) that registers a callback to be invoked whenever any response from the shared `axios`
instance has status `401`. The client's existing `request()` error-wrapping (into `ApiError`) shall be
unaffected — the interceptor observes the response, it doesn't swallow or alter the error that
`request()` still throws to its caller.

**References**: Service: `frontend/src/services/client.ts` (new response interceptor via
`client.interceptors.response.use`)

### FRONTEND-029-AC-02 [AUTO]: The registered handler is only invoked while the app is currently authenticated
**Statement**: `App.tsx` shall register its handler such that a `401` occurring while `session.status`
is `'checking'` or already `'unauthenticated'` has no effect — only a `401` occurring while
`session.status === 'authenticated'` shall transition the session state.

**Rationale**: This is the mechanism described in the Overview that makes URL-based exclusions
unnecessary — the initial `me()` check's expected `401` (not logged in yet) and a failed login
attempt's expected `401` (bad credentials) both occur while `session.status` is *not*
`'authenticated'`, so neither can trigger the transition.

**References**: Component: `frontend/src/App.tsx` (handler registered via `useEffect`, checks current
`session.status` before transitioning — e.g. a functional `setSession` update that only changes state
when the previous state was `'authenticated'`)

## Requirement 2: An expired session returns the user to the login screen with a clear message

**User story**: As a user whose session has expired, I want to be told clearly that I need to log in
again, and land somewhere that can actually resolve it, instead of staring at a broken "Retry" button.

### FRONTEND-029-AC-03 [AUTO]: Detecting an expired session transitions to the login screen
**Statement**: When the registered handler fires while `session.status === 'authenticated'`,
`App.tsx` shall transition `session` to an unauthenticated state flagged as expired (e.g. `{ status:
'unauthenticated', expired: true }`), causing `LoginPage` to render in place of the authenticated
shell.

**References**: Component: `frontend/src/App.tsx` (`SessionState` type gains an `expired?: boolean`
field on the `'unauthenticated'` variant)

### FRONTEND-029-AC-04 [AUTO]: LoginPage shows a session-expired notice only when shown for that reason
**Statement**: `LoginPage` shall accept a new prop (e.g. `sessionExpired?: boolean`) and, when `true`,
render a visible notice (e.g. "Your session has expired. Please log in again.") above the login form.
When the prop is absent or `false` — the normal first-visit and explicit-logout cases — no such notice
shall render.

**References**: Component: `frontend/src/components/LoginPage.tsx`, `frontend/src/App.tsx` (passes
`sessionExpired={session.status === 'unauthenticated' && session.expired === true}`)

### FRONTEND-029-AC-05 [AUTO]: Logging back in clears the expired state and resumes normally
**Statement**: After a session-expired `LoginPage` is shown and the user successfully logs in again,
`App.tsx` shall transition to `{ status: 'authenticated', username }` exactly as a normal login does —
the `expired` flag shall not persist or reappear afterward.

**References**: Component: `frontend/src/App.tsx` (`handleLoginSuccess`, unchanged — already sets a
fresh `{ status: 'authenticated', ... }` with no `expired` field)

## Requirement 3: Existing error handling and explicit logout are unaffected

**User story**: As a user, I want a genuine server error (not a session problem) to keep showing the
existing Retry option, and logging out on purpose to behave exactly as it does today.

### FRONTEND-029-AC-06 [AUTO]: Non-401 errors are unaffected — existing local Retry UI still applies
**Statement**: A `500` (or any non-`401`) error from any page's data fetch shall continue to populate
that component's own local error state and "Retry" button exactly as before — the new global handler
shall not fire, and no redirect to the login screen shall occur.

**Rationale**: Explicit regression guard — this spec narrows the problem to `401`s specifically; a
real transient server error is still worth a local retry, which can genuinely succeed.

**References**: Components: `frontend/src/components/WeeklyPlanner/WeeklyPlanner.tsx`,
`frontend/src/components/ActivityBank/ActivityBank.tsx` (existing `loadError`/`handleRetry`, unchanged)

### FRONTEND-029-AC-07 [AUTO]: Explicit logout is unaffected and shows no expired notice
**Statement**: Clicking the existing "Log out" button shall continue to call `authApi.logout()` and
transition to `{ status: 'unauthenticated' }` (`expired` absent/`false`) exactly as today — `LoginPage`
shall render with no session-expired notice in this case.

**References**: Component: `frontend/src/App.tsx` (`handleLogout`, unchanged)

### FRONTEND-029-AC-08 [AUTO]: A failed login attempt's own error display is unaffected
**Statement**: Submitting invalid credentials on `LoginPage` shall continue to show `LoginPage`'s own
existing inline `submitError` exactly as before — the global `401` handler firing (a no-op per
`FRONTEND-029-AC-02`, since `session.status` is `'unauthenticated'` at that point) shall not interfere
with or replace that inline error.

**References**: Component: `frontend/src/components/LoginPage.tsx` (`handleSubmit`'s existing
`submitError` state, unchanged)

## Explicitly out of scope (do not implement as part of this spec)

- Changing the session timeout duration — see `planner_spec_016_configurable_session_timeout.md`
  (separate, paired spec — makes it configurable, doesn't change the 30-minute default).
- A non-disruptive banner/toast variant that keeps the current page visible underneath — the user
  confirmed a straight bounce to the login screen is preferred; no new banner/toast component is
  introduced.
- Preserving in-progress, unsaved form state (e.g. a half-filled Add Activity modal) across the forced
  logout — acceptable data loss on session expiry, consistent with how most session-expiry UX works;
  not attempted here.
- Proactively warning the user *before* the session expires (e.g. an idle-timeout countdown) — this
  spec is reactive (handle it gracefully when it happens), not preventive.

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/services/client.ts` | New `setUnauthorizedHandler`, response interceptor |
| `frontend/src/App.tsx` | `SessionState`'s new `expired` field, handler registration, redirect logic |
| `frontend/src/components/LoginPage.tsx` | New `sessionExpired` prop, notice rendering |
| `frontend/src/types/api.ts` | `ApiError` (unchanged — still thrown by `request()` to each caller) |
| `planner_spec_016_configurable_session_timeout.md` | The paired backend spec making the timeout tunable, useful for fast manual verification of this spec |
| `frontend_spec_001_login.md` | The original `App.tsx` session gate / `LoginPage` this extends |

## TDD test case sketches

### FRONTEND-029-AC-01 / AC-02
```typescript
describe('FRONTEND-029: client.ts 401 interceptor', () => {
  it('AC-01: invokes the registered handler when any response is 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    mockAxiosAdapter.onGet('/plan').reply(401, { message: 'Authentication required' })
    await expect(planApi.getWeek('2026-09-28')).rejects.toThrow()
    expect(handler).toHaveBeenCalled()
  })
})

describe('FRONTEND-029-AC-02: handler only acts while authenticated', () => {
  it('does not transition session state on the initial unauthenticated me() check', async () => {
    vi.mocked(authApi.me).mockRejectedValue({ status: 401 })
    render(<App />)
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
    expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
  })
})
```

### FRONTEND-029-AC-03 / AC-04 / AC-05
```typescript
describe('FRONTEND-029: expired-session redirect', () => {
  it('AC-03/AC-04: a 401 while authenticated shows LoginPage with the expired notice', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
    vi.mocked(planApi.getWeek).mockRejectedValue(new ApiError(401, 'Authentication required'))
    render(<App />)
    await screen.findByText('Logged in as steve')
    // navigate to /planner, triggering the 401
    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
  })

  it('AC-05: logging back in clears the expired notice', async () => {
    // ...reach the expired-login state as above...
    vi.mocked(authApi.login).mockResolvedValue({ username: 'steve' })
    await userEvent.type(screen.getByLabelText(/username/i), 'steve')
    await userEvent.type(screen.getByLabelText(/password/i), 'password')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByText('Logged in as steve')).toBeInTheDocument()
    expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
  })
})
```

### FRONTEND-029-AC-06 / AC-07 / AC-08
```typescript
describe('FRONTEND-029: existing behaviors unaffected', () => {
  it('AC-06: a 500 still shows the local Retry button, no redirect to login', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
    vi.mocked(planApi.getWeek).mockRejectedValue(new ApiError(500, 'Something went wrong'))
    render(<WeeklyPlanner />)
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /log in/i })).not.toBeInTheDocument()
  })

  it('AC-07: explicit logout shows no expired notice', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' })
    vi.mocked(authApi.logout).mockResolvedValue(undefined)
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /log out/i }))
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument()
    expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument()
  })

  it('AC-08: a failed login attempt still shows its own inline error', async () => {
    vi.mocked(authApi.me).mockRejectedValue({ status: 401 })
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, 'Invalid username or password'))
    render(<App />)
    await userEvent.type(await screen.findByLabelText(/username/i), 'steve')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument()
  })
})
```

## Acceptance Criteria Summary

- [x] FRONTEND-029-AC-01 — shared API client exposes a registrable 401 handler
- [x] FRONTEND-029-AC-02 — the handler only acts while the app is currently authenticated
- [x] FRONTEND-029-AC-03 — detecting an expired session transitions to the login screen
- [x] FRONTEND-029-AC-04 — LoginPage shows a session-expired notice only when shown for that reason
- [x] FRONTEND-029-AC-05 — logging back in clears the expired state and resumes normally
- [x] FRONTEND-029-AC-06 — non-401 errors are unaffected, existing local Retry UI still applies
- [x] FRONTEND-029-AC-07 — explicit logout is unaffected and shows no expired notice
- [x] FRONTEND-029-AC-08 — a failed login attempt's own error display is unaffected
