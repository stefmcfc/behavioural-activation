# Change Password (Backend)

**Status**: Implemented (2026-10-06) — `controller/AuthController.java` (`changePassword(...)`),
`model/User.java` (`changePassword(...)` mutator), `dto/ChangePasswordRequest.java`
**Priority**: P2 — real usability/security gap: today the only way to change the seeded user's
password is editing `.env` and wiping the Postgres volume, losing all data
**Depends on**: `planner_spec_001_auth.md` (`User`, `UserRepository`, `PasswordEncoder` bean,
`AuthController`'s existing login/logout pattern — this spec extends that controller directly, not
a new one)
**Area**: Backend
**Roadmap version**: V1 (Authentication)

## Overview

Raised by the user 2026-10-06 during a V1 ideas review, prompted by noticing the Account menu has
no way to change your password. Per `RUNBOOK.md`, the only existing path is reseeding via
`APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD`, which only takes effect on a database with an
empty `users` table — meaning a real password rotation today requires `docker compose down -v`,
destroying every activity, plan, and completion record. This adds a proper in-session self-service
endpoint.

**Design, grounded in the existing code** (not inventing new mechanisms):
- Verifying the *current* password reuses `AuthenticationManager.authenticate(...)` — exactly what
  `AuthController.login()` already does — rather than a bespoke `passwordEncoder.matches(...)` call.
  A wrong current password therefore throws the same `BadCredentialsException`
  (`AuthenticationException`) login already throws, which `GlobalExceptionHandler` already maps to
  `401` with the existing generic `"Invalid credentials"` message — reused for free, no new
  exception type needed for that case.
- Hashing the new password reuses the existing `PasswordEncoder` (`BCryptPasswordEncoder`) bean —
  the same one `UserBootstrapRunner` already uses.
- `User` currently has no mutator for `passwordHash` (only a constructor-time value, no setters at
  all) — this spec adds one, following the same "named method + no bare setter" convention already
  established by every other entity's mutators (`SubTask.rename()`, `Activity.recategorize()`, etc).
- **Session handling, a real decision this spec makes explicitly**: a successful password change
  invalidates the current HTTP session, the same way `AuthController.logout()` already does
  (`session.invalidate()` + `SecurityContextHolder.clearContext()`) — the user must log back in with
  the new password afterward. This is standard security practice (a stolen/leaked session cookie
  stops working the moment the password it was issued under changes) and avoids leaving an
  implicit, undocumented answer to "does the current session survive a password change?" — nothing
  in the existing codebase decides this for free, so it's made explicit here.

## Requirement 1: Change your own password

**User story**: As the authenticated user, I want to change my password from within the app, so I
don't have to edit `.env` and wipe my data just to rotate my credentials.

### PLANNER-024-AC-01 [AUTO]: A valid request changes the password
**Statement**: When `PATCH /api/v1/auth/password` is requested by an authenticated user with a
correct `currentPassword` and a valid `newPassword`, the `AuthController` shall update that user's
stored password hash (via `PasswordEncoder.encode(newPassword)`) and return `204 No Content`.

**References**: `controller/AuthController.java` (new method, same class as `login`/`logout`/`me` —
not a new controller), `model/User.java` (new `changePassword(String newPasswordHash)` mutator,
mirroring `rename()`'s shape), `dto/ChangePasswordRequest.java` (new record).

**Test Case (Red)**:
```groovy
def "PLANNER-024-AC-01: a valid password change updates the stored hash"() {
    given: "an authenticated user and a valid change-password request"
        def request = new ChangePasswordRequest(bootstrapPassword, "a-new-strong-password")

    when: "PATCH /api/v1/auth/password is requested"
        def response = client.patch().uri("/api/v1/auth/password")
            .cookie(sessionCookie).body(request).exchange()

    then: "the response is 204"
        response.expectStatus().isNoContent()

    and: "the new password now authenticates, and the old one no longer does"
        def loginWithNew = client.post().uri("/api/v1/auth/login")
            .body(new LoginRequest(owner.username, "a-new-strong-password")).exchange()
        loginWithNew.expectStatus().isOk()
        def loginWithOld = client.post().uri("/api/v1/auth/login")
            .body(new LoginRequest(owner.username, bootstrapPassword)).exchange()
        loginWithOld.expectStatus().isUnauthorized()
}
```

**Test Case (Green)**: implement `AuthController.changePassword(...)` as described in References.

### PLANNER-024-AC-02 [AUTO]: A wrong current password is rejected, reusing the existing 401 shape
**Statement**: If `PATCH /api/v1/auth/password` is requested with an incorrect `currentPassword`,
then the request shall fail the same way an incorrect login does — `AuthenticationManager.authenticate(...)`
throws `BadCredentialsException`, which `GlobalExceptionHandler`'s existing `AuthenticationException`
handler maps to `401` with the existing `"Invalid credentials"` message — without updating the
password.

**Rationale**: No new exception type or handler needed; reuses the exact mechanism `login` already
relies on, and the generic message avoids revealing whether the account/username itself is valid,
consistent with `PLANNER-001-AC-06`'s existing "don't reveal which field was wrong" rule.

**References**: `AuthController.changePassword(...)` shall call
`authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(authentication.getName(),
request.currentPassword()))` before touching the password hash — exactly `login()`'s existing call
shape, just with the already-authenticated principal's own username rather than one from the request
body.

**Test Case (Red)**:
```groovy
def "PLANNER-024-AC-02: an incorrect current password returns 401, password unchanged"() {
    given: "a request with the wrong current password"
        def request = new ChangePasswordRequest("wrong-password", "a-new-strong-password")

    when: "PATCH /api/v1/auth/password is requested"
        def response = client.patch().uri("/api/v1/auth/password")
            .cookie(sessionCookie).body(request).exchange()

    then: "the response is 401"
        response.expectStatus().isUnauthorized()

    and: "the original password still authenticates"
        def login = client.post().uri("/api/v1/auth/login")
            .body(new LoginRequest(owner.username, bootstrapPassword)).exchange()
        login.expectStatus().isOk()
}
```

**Test Case (Green)**: implement the current-password check as described in References.

### PLANNER-024-AC-03 [AUTO]: A blank or too-short new password is rejected
**Statement**: If `PATCH /api/v1/auth/password` is requested with a blank `currentPassword`/
`newPassword`, or a `newPassword` shorter than 8 characters, then the request shall return `400`
without updating the password.

**Rationale**: `8` is a deliberate, simple minimum-length judgment call — this app has no prior
stated password policy to match, and a minimum length is the one validation rule worth having
without inventing a complexity-scoring scheme this single-user app doesn't need.

**References**: `dto/ChangePasswordRequest.java`:
```java
public record ChangePasswordRequest(
    @NotBlank(message = "currentPassword is required") String currentPassword,
    @NotBlank(message = "newPassword is required")
    @Size(min = 8, message = "newPassword must be at least 8 characters") String newPassword
) {}
```

**Test Case (Red)**:
```groovy
def "PLANNER-024-AC-03: a too-short new password returns 400, password unchanged"() {
    given: "a request with a 3-character new password"
        def request = new ChangePasswordRequest(bootstrapPassword, "abc")

    when: "PATCH /api/v1/auth/password is requested"
        def response = client.patch().uri("/api/v1/auth/password")
            .cookie(sessionCookie).body(request).exchange()

    then: "the response is 400"
        response.expectStatus().isBadRequest()
}
```

**Test Case (Green)**: bean validation alone satisfies this once the DTO is wired up.

### PLANNER-024-AC-04 [AUTO]: A successful change invalidates the current session
**Statement**: After a successful password change, the `AuthController` shall invalidate the current
HTTP session (`session.invalidate()`) and clear the security context — identical to the existing
`logout()` behavior — so the session cookie used to make the request no longer authenticates
afterward.

**Rationale**: Explicit, deliberate security decision (see Overview) — a changed password should not
leave a pre-existing session silently still valid.

**References**: `AuthController.logout()`'s existing body is the exact pattern to reuse.

**Test Case (Red)**:
```groovy
def "PLANNER-024-AC-04: a successful password change invalidates the current session"() {
    given: "a valid change-password request"
        def request = new ChangePasswordRequest(bootstrapPassword, "a-new-strong-password")

    when: "PATCH /api/v1/auth/password succeeds"
        client.patch().uri("/api/v1/auth/password").cookie(sessionCookie).body(request).exchange()

    and: "the same session cookie is used for a subsequent authenticated request"
        def response = client.get().uri("/api/v1/auth/me").cookie(sessionCookie).exchange()

    then: "the old session no longer authenticates"
        response.expectStatus().isUnauthorized()
}
```

**Test Case (Green)**: call the same session-invalidation logic `logout()` already uses, after the
password hash is updated.

### PLANNER-024-AC-05 [AUTO]: Unauthenticated requests are rejected (inherited)
**Statement**: The existing `SecurityFilterChain` rule (`.requestMatchers("/api/v1/**").authenticated()`,
unchanged from `planner_spec_001_auth.md`) shall already require an authenticated session for
`PATCH /api/v1/auth/password`; this spec adds a regression test confirming the existing rule extends
automatically to the new endpoint, without modifying `SecurityConfig`.

**Test Case (Red)**:
```groovy
def "PLANNER-024-AC-05: an unauthenticated request to change password returns 401 (inherited rule)"() {
    when: "PATCH /api/v1/auth/password is requested with no session"
        def response = client.patch().uri("/api/v1/auth/password")
            .body(new ChangePasswordRequest("x", "a-new-strong-password")).exchange()

    then: "the response is 401, from the existing SecurityFilterChain rule, unmodified"
        response.expectStatus().isUnauthorized()
}
```

**Test Case (Green)**: no new code — already covered by the existing filter chain.

## Cross-references

| Reference | What it provides |
|---|---|
| `model/User.java` | New `changePassword(String newPasswordHash)` mutator |
| `dto/ChangePasswordRequest.java` (new) | Request body for `PATCH /api/v1/auth/password` |
| `controller/AuthController.java` | New `changePassword(...)` method, same class as `login`/`logout`/`me` |
| `exception/GlobalExceptionHandler.java` | Unchanged — reuses the existing `AuthenticationException` → `401` handler |
| `security/UserBootstrapRunner.java` | Precedent for `passwordEncoder.encode(...)` call shape |
| `frontend_spec_050_change_password.md` | Paired frontend spec — consumes this endpoint exactly as specified here |

## Acceptance Criteria Summary

- [x] PLANNER-024-AC-01 — a valid request updates the password hash, returns 204
- [x] PLANNER-024-AC-02 — a wrong current password returns 401 (reused auth-failure handler), password unchanged
- [x] PLANNER-024-AC-03 — blank/too-short new password returns 400, password unchanged
- [x] PLANNER-024-AC-04 — a successful change invalidates the current session
- [x] PLANNER-024-AC-05 — unauthenticated requests return 401 (inherited rule, regression test)

## Summary

### Implementation

- `controller/AuthController.java` — new `changePassword(...)` method on the existing controller
  (no new `AuthService`). Verifies the current password via
  `authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(authentication.getName(),
  request.currentPassword()))`, looks up the `User` by the authenticated principal's own username
  (never from the request body), calls `user.changePassword(passwordEncoder.encode(newPassword))`,
  saves, then invalidates the session via a `logout()`/`changePassword()`-shared private
  `invalidateSession(...)` helper, and returns `204 No Content`.
- `model/User.java` — new `changePassword(String newPasswordHash)` mutator, same "set field
  directly" shape as `SubTask.rename()`, minus an `updatedAt` touch (`User` has no such column).
- `dto/ChangePasswordRequest.java` — new record exactly as specced (`@NotBlank` on both fields,
  `@Size(min = 8)` on `newPassword`).
- `GlobalExceptionHandler`, `SecurityConfig` — unchanged, as specced; the existing
  `AuthenticationException` → 401 handler and `/api/v1/**` auth rule both already cover this
  endpoint.

### Tests

- `controller/AuthControllerSpec.groovy` (existing `@WebMvcTest`, mocked
  `AuthenticationManager`/`UserRepository`/`PasswordEncoder`) — 5 new test methods covering
  AC-01 through AC-05 (AC-03's blank/too-short cases run as a 3-way `where:` table), proving the
  controller's wiring and validation/auth-rule behavior.
- `controller/AuthControllerChangePasswordIntegrationSpec.groovy` (new, `@SpringBootTest` +
  `@AutoConfigureMockMvc`, real Postgres via docker-compose) — 3 tests proving the genuine
  round-trip behavior a mocked `AuthenticationManager`/`PasswordEncoder` can't: AC-01 (new password
  authenticates, old one no longer does), AC-02 (wrong current password rejected, original password
  still works), AC-04 (the session used to change the password no longer authenticates
  `GET /auth/me` afterward). Mirrors `SubTaskServiceReorderIntegrationSpec`'s throwaway-`User`
  `setup()`/`cleanup()` pattern.
- `model/UserSpec.groovy` — 1 new test for the `changePassword(...)` mutator in isolation.
- Full suite: 324 tests before this change → 338 after (14 new, 0 regressions).

### Findings

- No `AuthService` existed and none was added — per the spec's own design note, current-password
  verification and password persistence stay directly in `AuthController`, matching `login()`'s
  existing style.
- The spec's Red test sketches used a hypothetical `client`/`sessionCookie`/`owner`/
  `bootstrapPassword` fixture that doesn't exist in this codebase; adapted to the two real testing
  patterns already established here instead (`@WebMvcTest` with `@SpringBean` mocks for wiring/
  validation, `@SpringBootTest` + real Postgres for the genuine auth round-trip) rather than
  inventing a new fixture style.
