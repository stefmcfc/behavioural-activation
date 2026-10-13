---
name: verify
description: Build/launch/drive recipe for verifying changes to the Behavioural Activation Planner end-to-end — backend via curl/API, frontend via browser.
---

# Verifying this app end-to-end

**Status: real app, well past V1.** Six controllers (auth, activities, sub-tasks, planner/weekly
grid, work days, data export) and a full React frontend exist — see `API.md` for the endpoint
reference and `ROADMAP.md`'s "Delivered" table for what's actually shipped. Don't assume
scaffolding-era gaps without checking those two files first; they drift fast on this project.

## Launch

`RUNBOOK.md` is the source of truth for exact commands/ports/env vars — don't duplicate it here.
Summary:

- `docker compose up -d` starts Postgres first (required before the backend starts or its tests
  run). Docker Desktop's CLI is installed on this machine but the daemon isn't always running —
  start it manually first if `docker compose up -d` fails to connect.
- `bash scripts/start-dev.sh` launches both dev servers in the background with health-check-based
  readiness reporting (`backend` or `frontend` alone, `--debug` for a JDWP port) — see RUNBOOK.md's
  "Quick Start (scripts)" section. `bash scripts/stop-dev.sh` / `restart-dev.sh` to match. Logs land
  in `logs/backend.log` / `logs/frontend.log` (gitignored, truncated fresh each run).
- Manual equivalent: `cd backend && gradlew.bat bootRun` (**:8420**), `cd frontend && npm run dev`
  (**:4321**, `strictPort: true`). Flyway runs migrations automatically on backend startup.
- Needs `APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD` set (no default) — either in the
  environment or a git-ignored `.env` at the repo root — for there to be a user to log in as at all.
- **CORS**: `config/CorsConfig.java` exposes a `CorsConfigurationSource` bean wired into
  `SecurityConfig`'s `SecurityFilterChain` via `.cors(...)` (allow-list from
  `app.cors.allowed-origins`, credentials allowed, never a wildcard) — this is the correct pattern
  for an app with Spring Security on the classpath; a plain `WebMvcConfigurer.addCorsMappings` bean
  would be bypassed by Security's filter chain running first. Driving the backend through anything
  other than the Vite proxy (e.g. Postman, a raw `curl` from a browser page) needs its origin added
  to `app.cors.allowed-origins`, or just route through the Vite dev-server proxy (`/api` →
  `:8420`) instead.
- Real accessibility scanning (`@axe-core/react`) is still not wired up — worth doing eventually
  given the product's non-gamified/calm-UI requirement depends on contrast and semantics, but
  there's no automated signal for it today. Manual browser checks (see below) are the only coverage.

## Drive (backend, via curl)

Auth is session-cookie based (`SameSite=Lax`, CSRF disabled) — use a cookie jar across calls:

```bash
# Log in (replace with the real bootstrap credentials from .env/environment)
curl -c cookies.txt -X POST http://localhost:8420/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "you", "password": "change-me"}'

# Create an activity
curl -b cookies.txt -X POST http://localhost:8420/api/v1/activities \
  -H "Content-Type: application/json" \
  -d '{"name": "Walk", "category": "ROUTINE"}'

# Plan it into the current week (weekStart must be a Monday)
curl -b cookies.txt -X POST http://localhost:8420/api/v1/plan/occurrences \
  -H "Content-Type: application/json" \
  -d '{"activityId": "<id-from-above>", "weekStart": "2026-10-05", "dayOfWeek": "MONDAY", "slot": "MORNING"}'

# Mark complete
curl -b cookies.txt -X POST http://localhost:8420/api/v1/plan/occurrences/<occurrence-id>/completion
```

See `API.md` for the full endpoint set (sub-tasks, bucket reorder, carry-forward, notes, work days,
data export, change password) — it's kept current with every endpoint change, so check it rather
than assuming a shape here.

## Drive (frontend, via browser)

1. `bash scripts/start-dev.sh` (or the manual commands above), then open **http://localhost:4321**
   — the `claude-in-chrome` skill's tools work well for this: navigate, screenshot, and
   `read_console_messages` (no `axe` pattern filter is useful yet, since axe-core isn't wired up —
   just watch for real console errors).
2. Log in with the bootstrap credentials, then drive the actual flow under test: Activity Bank,
   Weekly Planner grid + weekend bucket, Today view, Weekly Summary, Settings.
3. Drive through the states that matter for a new/changed component: loading, error (works without
   the backend running — fetch fails naturally), empty, populated.
4. Check both light and dark `prefers-color-scheme` for any new/changed styling — jsdom doesn't
   render CSS, so Vitest passing is never sufficient sign-off (see
   `.claude/steering/frontend_conventions.md`). This has caught real bugs before (e.g.
   `frontend_spec_043`'s notes-textarea overflow, `frontend_spec_046`'s drawer text-wrapping).
5. Specifically probe the product's neutral-language requirement: does an incomplete/missed
   activity ever render in a way that reads as failure or a scorecard? That's a real product bug
   here, not just cosmetics (see `.claude/steering/product.md`). The Weekly Summary's completion
   visuals already deliberately avoid a red/green hue for this reason — don't regress it.
6. Clean up afterwards: delete `frontend/.env.local` if created for the CORS workaround above, and
   delete any test data created via the UI.

## Worth probing on any change in these areas

- Validation: missing/blank required fields, invalid category values, malformed IDs.
- 404 on a non-existent resource ID, and that it's `404` (not `403`) for an `id` that exists but
  belongs to another user — every domain entity is owner-scoped from V1 (see
  `.claude/steering/structure.md`), so this is worth a deliberate check on any new entity/endpoint,
  not an assumption.
- Response bodies never leak internals (SQL, stack traces, file paths).
- Occurrence lifecycle edge cases that have had real bugs before: demoting a completed occurrence
  to the bucket (`409`, blocked), carry-forward on a completed or already-scheduled occurrence
  (`409`), notes/position surviving a move or carry-forward unchanged.
- Drag-and-drop interactions (grid↔bucket, grid↔grid, bucket reordering, sub-task reordering) —
  these are mouse-only (no native DnD touch support) and have a history of real browser-only bugs
  (illegible squeezed grids, unreachable drop targets) that Vitest can't catch.

## Resetting between runs

```bash
docker compose down -v && docker compose up -d
```

Drops and recreates the local Postgres volume (both the dev and test databases); restart the
backend afterward so Flyway recreates the schema from scratch.
