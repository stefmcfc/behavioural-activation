# Backend Spec 001: Authentication — Seeded Single User, Session Login

**Status**: Not started
**Priority**: P0 — blocks every other V1 endpoint, which all require an authenticated principal
**Depends on**: none
**Area**: Backend Task
**Roadmap version**: V1 (see `.claude/steering/product.md`)
**Plan**: `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7a (real auth from V1) and this project's V1
high-level plan (2026-08-27 planning session) — no self-registration, one bootstrap-seeded user,
Spring Security session-based login.

## Overview

Every other V1 spec depends on an authenticated principal existing, so auth comes first. This spec
covers: seeding exactly one `User` on first startup (env-configured, no registration UI), a custom
JSON login/logout/me controller (not Spring Security's default redirect-based `formLogin`, which
doesn't fit a JSON SPA), securing every other `/api/v1/**` endpoint behind that session, and the
CORS/cookie configuration the SPA needs to carry a session cross-origin in dev. CSRF is deliberately
disabled for V1 (see Non-functional notes) — a decision already made in the high-level plan, not
re-litigated here.

## Requirements

### Requirement 1 — Bootstrap user seeding

As the app operator, I want a single user account provisioned automatically on first startup, so
that I can log in without building a registration flow nobody but me will ever use.

- **PLANNER-001-AC-01** [AUTO]: The `UserBootstrapRunner` shall create exactly one `User` row from
  the `APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD` environment variables if no `User` row
  exists at startup.
- **PLANNER-001-AC-02** [AUTO]: The `UserBootstrapRunner` shall store the password as a BCrypt hash
  via `PasswordEncoder`, never in plaintext.
- **PLANNER-001-AC-03** [AUTO]: If a `User` row already exists, then the `UserBootstrapRunner`
  shall not create another one — idempotent across restarts.
- **PLANNER-001-AC-04** [AUTO]: If `APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD` are unset and
  no `User` row exists, then the `UserBootstrapRunner` shall fail application startup with a clear
  error message, rather than starting an app nobody can ever log into.

### Requirement 2 — Login

As the user, I want to log in with my username and password, so that the app knows who I am.

- **PLANNER-001-AC-05** [AUTO]: When `POST /api/v1/auth/login` is requested with a valid
  username/password, the `AuthController` shall authenticate via `AuthenticationManager`, store the
  resulting `Authentication` in the `HttpSession` (via `HttpSessionSecurityContextRepository`), and
  return `200` with `{ "username": "..." }`.
- **PLANNER-001-AC-06** [AUTO]: If `POST /api/v1/auth/login` is requested with an incorrect
  username or password, then the `AuthController` shall return `401` with a generic message that
  does not reveal whether the username or the password was wrong.
- **PLANNER-001-AC-07** [AUTO]: If `POST /api/v1/auth/login` is requested with a missing username
  or password in the body, then the `AuthController` shall return `400` without calling
  `AuthenticationManager`.

### Requirement 3 — Logout

As the user, I want to log out, so that my session ends on this device.

- **PLANNER-001-AC-08** [AUTO]: When `POST /api/v1/auth/logout` is requested, the `AuthController`
  shall invalidate the current `HttpSession` and return `200`.
- **PLANNER-001-AC-09** [AUTO]: If `POST /api/v1/auth/logout` is requested with no active session,
  then the `AuthController` shall still return `200` — idempotent, not treated as an error.

### Requirement 4 — Current-session check

As the frontend, I want to check whether a session is currently authenticated, so that I can decide
whether to show the login page or the app on load.

- **PLANNER-001-AC-10** [AUTO]: When `GET /api/v1/auth/me` is requested with a valid session, the
  `AuthController` shall return `200` with `{ "username": "..." }`.
- **PLANNER-001-AC-11** [AUTO]: If `GET /api/v1/auth/me` is requested with no valid session, then
  the `AuthController` shall return `401`.

### Requirement 5 — Every other endpoint requires the session

As the user, I want every other API endpoint to require my session, so that my planning data isn't
reachable by anyone without it.

- **PLANNER-001-AC-12** [AUTO]: The `SecurityFilterChain` shall require an authenticated session
  for every request under `/api/v1/**` except `POST /api/v1/auth/login`.
- **PLANNER-001-AC-13** [AUTO]: If an unauthenticated request is made to a protected endpoint, then
  the `SecurityFilterChain` shall respond `401` — not a redirect, since there is no server-rendered
  login page to redirect to.

### Requirement 6 — Cross-origin session cookie support

As the frontend (a separate origin from the API in dev), I want cross-origin requests to carry the
session cookie, so that the SPA can maintain a session against the API.

- **PLANNER-001-AC-14** [AUTO]: The `CorsConfig` shall allow credentialed requests (cookies) from
  exactly the origins listed in `app.cors.allowed-origins`, never a wildcard.
- **PLANNER-001-AC-15** [MANUAL — verified with a real browser/curl response, since no Spring test
  slice asserts `Set-Cookie` attributes]: While CSRF protection is disabled (see Non-functional
  notes), the session cookie shall be issued with `SameSite=Lax`.

### Requirement 7 — Consistent error response shape

As the frontend, I want every error response (auth or otherwise) to share one JSON shape, so that
the shared `ApiError` handling in `frontend_conventions.md` works uniformly from the first spec
onward.

- **PLANNER-001-AC-16** [AUTO]: The `GlobalExceptionHandler` shall render `401`/`400`/`403`
  responses as `{ "message": "...", "details": null | {...} }`, never a raw stack trace or
  container-default error page.

## Non-functional notes

- **CSRF is disabled**, relying on `SameSite=Lax` cookies + the CORS allow-list as the practical
  defense for this single-user, not-yet-public app — see the V1 high-level plan for the full
  rationale and the explicit note to revisit this before any public/multi-user hosting.
- Every future spec's service-layer queries/mutations must resolve the owner from
  `SecurityContextHolder`, never a client-supplied `userId` — this spec is what makes that
  principal available; enforcing it elsewhere is each later spec's own responsibility.

## Cross-references

| This spec | Contracts against |
|---|---|
| `User` entity (`model/`) | New in this spec — `id`, `username` (unique), `passwordHash`, `createdAt` |
| `AuthController` (`controller/`) | New — `/api/v1/auth/{login,logout,me}` |
| `UserBootstrapRunner` (`security/` or root package) | New `CommandLineRunner` |
| `SecurityFilterChain` (`security/`) | New — protects `/api/v1/**` |
| `CorsConfig` (`config/`) | New — reads `app.cors.allowed-origins` (already a config key in `application.yml`) |
| `GlobalExceptionHandler` (`exception/`) | New — baseline error shape, extended by every later spec |
| `frontend_spec_001_login.md` | Paired frontend spec — consumes `/api/v1/auth/*` exactly as specified here |

## Test case sketches (Spock, red before implementation)

```groovy
def "PLANNER-001-AC-01: seeds exactly one user from env vars when none exists"() {
    given: "no User row exists and bootstrap env vars are set"
        userRepository.count() == 0

    when: "the application context starts"
        // ApplicationContextRunner with APP_BOOTSTRAP_USERNAME/APP_BOOTSTRAP_PASSWORD set

    then: "exactly one User row exists"
        userRepository.count() == 1

    and: "the password is stored hashed, not plaintext"
        userRepository.findAll().first().passwordHash != bootstrapPassword
}

def "PLANNER-001-AC-06: rejects login with incorrect password, generic message"() {
    given: "a seeded user"
        // ...

    when: "POST /api/v1/auth/login with the wrong password"
        def response = client.post().uri("/api/v1/auth/login")
            .body([username: "steve", password: "wrong"]).exchange()

    then: "the response is 401"
        response.expectStatus().isUnauthorized()

    and: "the message does not reveal which field was wrong"
        response.expectBody().jsonPath("$.message").value(not(containsString("username")))
}

def "PLANNER-001-AC-11: /auth/me without a session returns 401"() {
    when: "GET /api/v1/auth/me with no session"
        def response = client.get().uri("/api/v1/auth/me").exchange()

    then: "the response is 401"
        response.expectStatus().isUnauthorized()
}

def "PLANNER-001-AC-13: an unauthenticated request to a protected endpoint returns 401, not a redirect"() {
    when: "a protected endpoint is requested with no session"
        def response = client.get().uri("/api/v1/activities").exchange()

    then: "the response is 401, no Location redirect header"
        response.expectStatus().isUnauthorized()
        response.expectHeader().doesNotExist("Location")
}

def "PLANNER-001-AC-16: an error response never leaks a stack trace"() {
    when: "any handled exception path is triggered"
        def response = client.post().uri("/api/v1/auth/login").body([:]).exchange()

    then: "the body has message/details only"
        response.expectBody().jsonPath("$.message").exists()
        response.expectBody().jsonPath("$.stackTrace").doesNotExist()
}
```

## Acceptance Criteria Summary

- [ ] PLANNER-001-AC-01 — bootstrap seeds exactly one user from env vars
- [ ] PLANNER-001-AC-02 — password stored as BCrypt hash
- [ ] PLANNER-001-AC-03 — bootstrap is idempotent (no duplicate seeding)
- [ ] PLANNER-001-AC-04 — startup fails clearly if unseedable
- [ ] PLANNER-001-AC-05 — successful login authenticates, stores session, returns username
- [ ] PLANNER-001-AC-06 — failed login returns 401, generic message
- [ ] PLANNER-001-AC-07 — malformed login body returns 400
- [ ] PLANNER-001-AC-08 — logout invalidates session
- [ ] PLANNER-001-AC-09 — logout with no session is idempotent (still 200)
- [ ] PLANNER-001-AC-10 — /auth/me returns username when authenticated
- [ ] PLANNER-001-AC-11 — /auth/me returns 401 when not authenticated
- [ ] PLANNER-001-AC-12 — all of /api/v1/** except login requires a session
- [ ] PLANNER-001-AC-13 — unauthenticated access returns 401, not a redirect
- [ ] PLANNER-001-AC-14 — CORS allows credentials only from the configured allow-list
- [ ] PLANNER-001-AC-15 — session cookie is SameSite=Lax [MANUAL]
- [ ] PLANNER-001-AC-16 — error responses share one JSON shape, no stack traces
