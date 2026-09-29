# Changelog

All notable changes to this project are documented in this file, in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.0] - 2026-09-29

- Added a full visual refresh ("Quiet Room" design system), replacing the scaffold-era purple
  accent and entirely-unstyled native HTML with a warm sage-accented palette, pill-shaped
  buttons/chips with a soft shadow, hairline-bordered flat content rows/panels (no card shadows
  outside of buttons), tighter system-sans typography with tabular numerals, and monospace
  uppercase day-of-week labels in the weekly grid. Every V1 screen (Login, Activity Bank,
  sub-tasks, Weekly Planner, Settings) now has real component styling for the first time; global
  base styles cover every button/input/radio uniformly (no primary/secondary distinction yet —
  deliberately deferred). Direction was chosen from three mocked-up options plus a hybrid, reviewed
  in a throwaway design-exploration artifact before being turned into a spec.
- Fixed a batch of discrepancies found comparing the shipped result against the approved mockup:
  `h2` section headings and fieldset `legend`s now use the small uppercase quiet-label treatment
  instead of duplicating the page `h1`; Activity Bank/sub-task/bucket-list rows were rendering real
  browser bullet points (missing `list-style: none`) instead of the intended flush hairline list;
  Settings' category-colour rows now lead with the swatch, drop the redundant "colour"/category-name
  text, right-align the reset action, and the swatch itself is a true circle (Chromium's
  `::-webkit-color-swatch` doesn't inherit the input's own `border-radius`); the Appearance theme
  picker is a one-row chip/segmented toggle instead of either the original cramped inline radios or
  an over-corrected vertical stack; the weekly grid's Morning/Afternoon/Evening label now renders
  small inside each box rather than as a shared row/column header; Activity Bank's "Show sub-tasks"
  is the first action and the add-activity form sits below the list.
- Fixed a real, reproducible test flake (`FRONTEND-005-AC-06`): `router.navigate()` calls outside
  of a React event handler weren't wrapped in `act()`, so the resulting state update sometimes
  didn't flush before the test's assertions ran.

## [0.5.0] - 2026-09-29

- Added tabbed navigation (Activities / Weekly Planner / Settings) via `react-router-dom`, replacing
  the single-page stack of components with real, bookmarkable, back/forward-aware routes.
- Added a Settings page: Light/Dark/System theme (persisted in `localStorage`, System follows the
  OS via `prefers-color-scheme`), and per-category chip colour customization with a reset-to-default
  control.
- Added a reusable `CategoryChip` component — replaces the plain "Name — Category" text in the
  Activity Bank, sub-task list, and weekly planner with a coloured chip. The chip's text colour is
  always computed automatically (WCAG contrast against black vs white) so a user-chosen background
  can't make the label unreadable; this doesn't guarantee WCAG AA (4.5:1) against every possible
  background, only the objectively better of the two text-colour choices.
- Resolved `frontend_conventions.md`'s long-deferred styling decision: CSS Modules per component
  plus a shared `theme.css` owning the `--text`/`--bg`/`--border`/`--accent`/category-colour custom
  properties, superseding the ad hoc theme block that had been living in `index.css`.

## [0.4.0] - 2026-09-29

- Added the weekly planner (V1's final spec pair): a Monday-Friday × Morning/Afternoon/Evening grid
  plus a weekend bucket list, backed by a new `PlannedOccurrence`/`CompletionRecord` pair
  (`planner_spec_004_week_planning.md`/`frontend_spec_004_week_planning.md`). Plan either a whole
  Activity or an individual SubTask into a day+slot or into the weekend bucket; move/reschedule;
  mark complete/undo; carry an unfinished bucket item forward a week; remove without deleting from
  the bank. The bucket list highlights a category with zero entries while another has at least one
  (no ratio/threshold). New endpoints under `/api/v1/plan` (view/create/move/remove) and
  `/api/v1/plan/occurrences/{id}/{completion,carry-forward}`.
- Fixed: `GET /api/v1/plan` (and move/complete/carry-forward) returned `500` with a
  `LazyInitializationException` against a real, previously-persisted occurrence —
  `open-in-view: false` closes the Hibernate session before the controller read the lazy
  `activity`/`subTask` association; `PlanService`'s transactional methods now call
  `Hibernate.initialize()` before the entity crosses the transaction boundary.

## [0.3.1] - 2026-09-29

- Fixed: `scripts/start-dev.sh`/`restart-dev.sh` never actually loaded the repo-root `.env`
  (gitignored) despite its own comment claiming they did — `APP_BOOTSTRAP_USERNAME`/
  `APP_BOOTSTRAP_PASSWORD` set there were silently ignored, so a reset Postgres volume seeded
  whatever ad hoc credentials the last manual `gradlew.bat bootRun` invocation happened to use
  instead. Added `load_dotenv` (`scripts/lib/dev-common.sh`), called before the backend starts.

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
