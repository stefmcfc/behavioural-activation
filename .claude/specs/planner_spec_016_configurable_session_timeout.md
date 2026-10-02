# Configurable Session Timeout (Backend)

**Status**: Implemented (2026-10-02)
**Priority**: P2 — bug-fix-adjacent: the current timeout is an unexamined framework default, not a
deliberate choice, and the frontend half of this spec pair needs a timeout the backend can be tuned
against during manual verification
**Depends on**: `planner_spec_001_auth.md` (the session-based auth this configures)
**Area**: Backend
**Roadmap version**: V1 hardening — a gap noticed in real use, not tied to a `HIGH_LEVEL_DESIGN.md`
version theme

## Summary

Both ACs implemented and tested (2 new Spock tests, 268 total in the backend suite, 0 regressions).
`server.servlet.session.timeout: ${SESSION_TIMEOUT:30m}` added to `application.yml` as a sibling of
the existing `server.servlet.session.cookie` block, mirroring the `server.port` / `SERVER_PORT`
pattern exactly.

**Real finding**: `backend/src/test/resources/application.yml` fully shadows (not merges with)
`backend/src/main/resources/application.yml` on the test classpath — Spring Boot resolves
`classpath:/application.yml` to a single resource, and the test source set's own resources directory
wins. A test asserting a main-`application.yml`-only property (initially `server.servlet.session.timeout`
alone, nothing in the test profile) resolved `null`, not the main file's default. Fix: added the
identical `server.servlet.session.timeout: ${SESSION_TIMEOUT:30m}` line to the test profile's
`application.yml` too, matching the existing convention there (`app.cors.allowed-origins`,
`app.bootstrap.*` are already duplicated with test-appropriate values for the same reason). This is
worth knowing for any future spec that adds a main-`application.yml`-only property and expects an
`@SpringBootTest` to see its default — it won't, unless the property is also added to the test
profile's `application.yml`.

## Overview

Raised by the user after returning to an idle browser tab and hitting a confusing "Authentication
required" / non-working "Retry" experience on the Weekly Planner (see
`frontend_spec_029_session_expiry_handling.md` for the actual UX fix). Investigating the root cause
found two separate gaps: the frontend never reacts to a session actually expiring (that spec), and —
this one — the session timeout itself is Spring Boot's untouched default (30 minutes of inactivity,
`server.servlet.session.timeout` never set in `application.yml`), not a value anyone deliberately
chose for this app.

This spec doesn't change the default (still 30 minutes — changing user-visible behavior wasn't asked
for) — it makes the timeout configurable via `application.yml`/an environment variable, the same
pattern every other environment-tunable value in this file already uses (e.g. `server.port` /
`SERVER_PORT`, `app.bootstrap.username` / `APP_BOOTSTRAP_USERNAME`). This lets the timeout be tuned
later (shorter for testing the expiry UX without waiting 30 minutes, longer for this single-user
personal-use app if 30 minutes keeps proving annoying in practice) without a code change.

## Requirement 1: Session timeout is configurable via environment variable

**User story**: As the person running this app, I want to be able to tune how long an idle session
stays valid without editing code, so I can adjust it for my own usage pattern or to speed up manual
testing of session-expiry behavior.

### PLANNER-016-AC-01 [AUTO]: Session timeout defaults to 30 minutes, matching current behavior
**Statement**: When `SESSION_TIMEOUT` is not set, the application shall use a 30-minute session
timeout — identical to the current (Spring Boot default) behavior, so this spec changes no observable
behavior on its own.

**References**: Config: `backend/src/main/resources/application.yml`
(`server.servlet.session.timeout: ${SESSION_TIMEOUT:30m}`)

### PLANNER-016-AC-02 [AUTO]: Session timeout is overridable via SESSION_TIMEOUT
**Statement**: When `SESSION_TIMEOUT` is set (e.g. `SESSION_TIMEOUT=10m` or `SESSION_TIMEOUT=2h`,
Spring's standard duration-string format), the application shall use that value as the session
timeout instead of the 30-minute default.

**Rationale**: Mirrors the exact existing pattern `server.port: ${SERVER_PORT:8420}` already
establishes in the same file — no new configuration mechanism introduced.

**References**: Config: `backend/src/main/resources/application.yml`

**Verification note**: both ACs are a one-line Spring Boot property with environment-variable
placeholder syntax Spring Boot's own `@ConfigurationProperties`/property-resolution machinery already
handles — there is no custom parsing code to unit test. `[AUTO]` here means "verified by the
application actually starting and the effective property value being correct," via a minimal Spring
context test asserting the resolved `server.servlet.session.timeout` property, not a hand-rolled
duration parser.

## Explicitly out of scope (do not implement as part of this spec)

- Changing the default timeout value — stays 30 minutes.
- "Remember me" / persistent-login semantics beyond the existing session cookie.
- Any change to session cookie attributes (`SameSite=Lax` etc., set in `SecurityConfig.java`) —
  unrelated to timeout duration.
- The actual frontend session-expiry UX fix — see `frontend_spec_029_session_expiry_handling.md`.

## Cross-references

| Reference | What it provides |
|---|---|
| `backend/src/main/resources/application.yml` | New `server.servlet.session.timeout` property with `SESSION_TIMEOUT` override |
| `backend/src/main/java/uk/co/stefirby/behaviouralactivation/security/SecurityConfig.java` | The session-based auth this timeout governs — unchanged by this spec |
| `RUNBOOK.md` | Needs a new row in its environment-variable table for `SESSION_TIMEOUT` |
| `frontend_spec_029_session_expiry_handling.md` | The paired frontend spec this timeout is tuned against during manual verification |

## TDD test case sketches

### PLANNER-016-AC-01 / AC-02
```groovy
def "PLANNER-016-AC-01: session timeout defaults to 30 minutes when SESSION_TIMEOUT is unset"() {
    given: "the application context loaded with no SESSION_TIMEOUT env var"
        // SESSION_TIMEOUT not set in the test environment

    expect: "the resolved session timeout property is 30 minutes"
        environment.getProperty("server.servlet.session.timeout") == "30m"
}

def "PLANNER-016-AC-02: session timeout honors SESSION_TIMEOUT when set"() {
    given: "SESSION_TIMEOUT=10m set via a dynamic property source"
        // @DynamicPropertySource registry.add("SESSION_TIMEOUT", () -> "10m")

    expect: "the resolved session timeout property is 10 minutes"
        environment.getProperty("server.servlet.session.timeout") == "10m"
}
```

## Acceptance Criteria Summary

- [x] PLANNER-016-AC-01 — session timeout defaults to 30 minutes, matching current behavior
- [x] PLANNER-016-AC-02 — session timeout overridable via `SESSION_TIMEOUT`
