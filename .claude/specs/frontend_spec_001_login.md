# Frontend Spec 001: Login — Session-Aware API Client & Login Page

**Status**: Not started
**Priority**: P0 — blocks every other V1 UI, which all require an authenticated session
**Depends on**: `planner_spec_001_auth.md` (paired backend spec — this consumes its `/api/v1/auth/*`
endpoints exactly as specified there)
**Area**: Frontend Stage 1 of 3 (V1)
**Roadmap version**: V1 (see `.claude/steering/product.md`)

## Overview

Nothing in `frontend/src/` exists yet beyond the placeholder `App.tsx` from scaffolding. This spec
builds the first real pieces: a session-aware `authApi` service (the pattern every later `*Api.ts`
file follows), a `LoginPage`, and the app-load session gate that decides whether to render
`LoginPage` or the (still-placeholder) authenticated view. No Activity Bank or Week Planner UI is
built here — just enough authenticated shell for those to land on top of in specs 2 and 3.

## Requirements

### Requirement 1 — Session-aware API client

As a developer building every later feature, I want one shared, session-aware API client pattern
established now, so that Activity Bank/Week Planner services (spec 2/3) don't each reinvent it.

- **FRONTEND-001-AC-01** [AUTO]: The `authApi` service shall use an axios instance configured with
  `withCredentials: true`, so the session cookie is sent on every request.
- **FRONTEND-001-AC-02** [AUTO]: If a request made through the shared `request<T>()` wrapper
  rejects, then the wrapper shall throw a typed `ApiError` (`src/types/api.ts`) populated from the
  response's `status` and `message`.

### Requirement 2 — Login page

As the user, I want to enter my username and password and log in, so that I can access my planner.

- **FRONTEND-001-AC-03** [AUTO]: When the `LoginPage` form is submitted with a non-blank username
  and password, the component shall call `authApi.login()`.
- **FRONTEND-001-AC-04** [AUTO]: If `authApi.login()` resolves successfully, then `LoginPage` shall
  signal the app to leave the unauthenticated state (e.g. via an `onLoginSuccess` callback from
  `App`).
- **FRONTEND-001-AC-05** [AUTO]: If `authApi.login()` rejects with a `401`, then `LoginPage` shall
  display an error message in a `role="alert"` element and remain on the login form.
- **FRONTEND-001-AC-06** [AUTO]: While a login request is in flight, `LoginPage` shall disable the
  submit button and show a loading indicator with `role="status"`.
- **FRONTEND-001-AC-07** [AUTO]: If the form is submitted with a blank username or password, then
  `LoginPage` shall show an inline validation error without calling `authApi.login()`.

### Requirement 3 — Session gate on app load

As the user, I want the app to check whether I'm already logged in before showing me anything, so
that I land on the right screen without a flash of the wrong one.

- **FRONTEND-001-AC-08** [AUTO]: When `App` mounts, it shall call `authApi.me()` to determine
  session state before rendering either `LoginPage` or the authenticated view.
- **FRONTEND-001-AC-09** [AUTO]: While the session check is in flight, `App` shall render a loading
  state — neither `LoginPage` nor the authenticated view.
- **FRONTEND-001-AC-10** [AUTO]: If `authApi.me()` resolves successfully, then `App` shall render
  the authenticated view — for this spec, a minimal placeholder showing the logged-in username and
  a logout control (Activity Bank/Week Planner replace this placeholder in specs 2/3, not here).
- **FRONTEND-001-AC-11** [AUTO]: If `authApi.me()` rejects with `401`, then `App` shall render
  `LoginPage`.

### Requirement 4 — Logout

As the user, I want to log out, so that my session ends on this device.

- **FRONTEND-001-AC-12** [AUTO]: When the logout control is activated, the app shall call
  `authApi.logout()` and, on success, return to `LoginPage`.

## Cross-references

| This spec | Contracts against |
|---|---|
| `authApi.login/logout/me` | `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` — exact shapes from `planner_spec_001_auth.md` |
| `ApiError` (`src/types/api.ts`) | New type, following `frontend_conventions.md`'s `request<T>()` wrapper pattern |
| `App.tsx` | Replaces the current placeholder with the session gate + minimal authenticated view |
| `LoginPage` (`src/components/` or `src/pages/`) | New component |

## Test case sketches (Vitest + RTL, red before implementation)

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { authApi } from '../services/authApi';

vi.mock('../services/authApi');

describe('FRONTEND-001-AC-05: failed login shows an alert, stays on the form', () => {
  it('displays the error and does not call onLoginSuccess', async () => {
    vi.mocked(authApi.login).mockRejectedValue({ status: 401, message: 'Invalid credentials' });
    const onLoginSuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onLoginSuccess} />);

    await userEvent.type(screen.getByLabelText(/username/i), 'steve');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid credentials/i);
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });
});

describe('FRONTEND-001-AC-08/AC-11: App session gate', () => {
  it('renders LoginPage when the session check returns 401', async () => {
    vi.mocked(authApi.me).mockRejectedValue({ status: 401 });
    render(<App />);
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });

  it('renders the authenticated placeholder when the session check succeeds', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ username: 'steve' });
    render(<App />);
    expect(await screen.findByText(/steve/i)).toBeInTheDocument();
  });
});

describe('FRONTEND-001-AC-07: blank fields validate without calling the API', () => {
  it('shows an inline error and does not call authApi.login', async () => {
    render(<LoginPage onLoginSuccess={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(screen.getByText(/required/i)).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });
});
```

## Acceptance Criteria Summary

- [x] FRONTEND-001-AC-01 — axios instance sends credentials
- [x] FRONTEND-001-AC-02 — request wrapper throws typed ApiError
- [x] FRONTEND-001-AC-03 — valid submit calls authApi.login()
- [x] FRONTEND-001-AC-04 — success leaves unauthenticated state
- [x] FRONTEND-001-AC-05 — 401 shows alert, stays on form
- [x] FRONTEND-001-AC-06 — in-flight state disables submit + shows loading
- [x] FRONTEND-001-AC-07 — blank fields validate client-side, no API call
- [x] FRONTEND-001-AC-08 — App calls authApi.me() on mount
- [x] FRONTEND-001-AC-09 — loading state while session check is in flight
- [x] FRONTEND-001-AC-10 — success renders authenticated placeholder
- [x] FRONTEND-001-AC-11 — 401 renders LoginPage
- [x] FRONTEND-001-AC-12 — logout calls authApi.logout() and returns to LoginPage
