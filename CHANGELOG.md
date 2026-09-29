# Changelog

All notable changes to this project are documented in this file, in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-09-29

- Added sub-tasks: split an activity into a flat checklist of child tasks that inherit the parent's
  category as a one-time snapshot (`planner_spec_003_sub_tasks.md`/
  `frontend_spec_003_sub_tasks.md`). New nested endpoints under
  `/api/v1/activities/{activityId}/sub-tasks` (create/list/rename/delete); deleting an activity
  cascades to delete its sub-tasks. Frontend adds an expandable checklist under each activity in the
  Activity Bank, with the same inline add/rename/delete-confirm pattern as activities themselves.

## [0.2.0] - 2026-09-28

- Added the Activity Bank: create, list, edit, and delete activities with a Routine/Necessary/
  Pleasurable category (`planner_spec_002_activity_bank.md`/`frontend_spec_002_activity_bank.md`).
  Every activity is scoped to its owner; a cross-owner or nonexistent `id` returns `404` in both
  cases identically, never `403`.
- Fixed: an invalid `category` value in a request body (e.g. `"FUN"`) returned `500` instead of
  `400` — `GlobalExceptionHandler` now maps `HttpMessageNotReadableException` to `400`.
- Extracted a shared `frontend/src/services/client.ts` (axios instance + `request<T>()` wrapper) out
  of `authApi.ts`, so `activityApi.ts` doesn't duplicate the session-cookie client setup. No
  behavior change to existing auth requests.

## [0.1.0] - 2026-09-28

- Fixed new SonarQube findings on `SecurityConfig.java`: removed an unnecessary `throws Exception`
  from the `authenticationManager`/`securityFilterChain` beans (Spring Security 7.1.1 no longer
  declares a checked exception there — `java:S112`/`java:S1130`), and suppressed `java:S4502` (CSRF
  disabled) with a comment pointing at the class javadoc, since that's a deliberate, already-
  documented V1 decision rather than an oversight.
- Fixed: the session cookie was missing `SameSite=Lax` (`PLANNER-001-AC-15`) — added
  `server.servlet.session.cookie.same-site: lax`. Since CSRF is deliberately disabled for this app,
  this was a real gap in its practical CSRF defense, not just an unchecked box; only caught once
  Docker/Postgres became available to actually inspect a live `Set-Cookie` header.
- Fixed: `gradlew.bat test` failed against a real database (`BehaviouralActivationApplicationSpec`'s
  full `@SpringBootTest` boots `UserBootstrapRunner`, which fails startup with no bootstrap
  credentials set) — the test profile now has fixed, safe-to-share test-only bootstrap credential
  defaults instead of requiring a real secret exported just to run the suite.
- `scripts/start-dev.sh backend` now fails fast (a few seconds, via `scripts/lib/docker-common.sh`)
  with a specific message if Docker isn't running or Postgres isn't up/healthy yet, instead of
  waiting out the full 90s health-check timeout.
- Added `scripts/start-dev.sh`/`stop-dev.sh`/`restart-dev.sh` to launch/stop both dev servers in the
  background with health-check-based readiness reporting, plus a `--debug` flag that opens a JDWP
  port (`:5005`) on the backend for remote debugging (`backend/build.gradle.kts` now pins
  `suspend=false` on `bootRun`'s debug options, and adds `spring-boot-devtools` for
  `bootRun --continuous`).
- Backend and frontend dev servers now run on static, non-default ports (`8420`/`4321`) instead of
  Spring Boot's/Vite's `8080`/`5173` defaults, to avoid colliding with other apps commonly using
  those ports.
- Added `README.md` and `RUNBOOK.md` (setup, ports, environment variables, troubleshooting).
- Added session-based authentication: a single bootstrap-seeded user, `POST /api/v1/auth/login`,
  `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, and a frontend login page
  (`planner_spec_001_auth.md`/`frontend_spec_001_login.md`).
- Initial project scaffolding: Spring Boot 4.1.x + Java 25 backend (Postgres/Flyway/Security/
  Validation, Spock testing) and React 19 + TypeScript + Vite frontend (Vitest/RTL), Docker Compose
  local Postgres, Claude Code steering/agents/skills.
