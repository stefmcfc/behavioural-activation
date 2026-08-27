---
name: verify
description: Build/launch/drive recipe for verifying changes to the Behavioural Activation Planner end-to-end — backend via curl/API, frontend via browser. Placeholder until V1 scaffolding lands; fill in the sections below as components are actually built, the same way the reference project this was adapted from grew its own verify skill alongside its app.
---

# Verifying this app end-to-end

**Status: partially real.** Backend/frontend are scaffolded (2026-08-27) but there are no real
endpoints or components yet, so "Launch" below is accurate today; "Drive" is still a sketch to fill
in once the first spec lands. Use the reference project's `verify` skill
(`C:\Users\steve\claude\series-recommendation\.claude\skills\verify\SKILL.md`) as a model for the
level of concrete detail expected once there's a real app to drive.

## Launch (backend)

- Start Postgres first: `docker compose up -d` from the repo root (creates the dev DB and, on
  first init only, a separate `behaviouralactivation_test` DB via `docker/init-test-db.sql`).
  **Not yet verified end-to-end** — Docker isn't installed on this machine as of scaffolding.
- `cd backend && gradlew.bat bootRun` starts the Spring Boot server on **:8080**. Flyway runs
  migrations automatically on startup (currently zero migrations — `db/migration/` is empty).
- There's no endpoint to curl yet (no controller exists). `gradlew.bat compileJava
  compileTestGroovy` (no DB needed) has been verified; `bootRun`/`test` need Postgres running first.
- Only `gradlew.bat` is checked in (Windows) — this only runs as-is on Windows, matching every
  other Java project on this machine.

## Launch (frontend)

- `cd frontend && npm run dev` starts Vite on its default port, proxying `/api` to `:8080`
  (`vite.config.ts`) — verified working (`npm test`/`npm run lint`/`npm run build` all pass).
  `App.tsx` is currently just a placeholder heading, nothing to drive yet.
- **Likely gotcha once real API calls exist — CORS.** The backend has no CORS config yet
  (`spring-boot-starter-security` is on the classpath with no config, so Spring Security's default
  same-origin behavior applies). A browser hitting the backend directly (bypassing Vite's proxy)
  will be blocked cross-origin. Add backend CORS config (see the reference project's `CorsConfig`
  for the pattern, restricted to `app.cors.allowed-origins` — already a config key in
  `application.yml`, just unused so far) or route through the Vite dev-server proxy via a
  git-ignored `frontend/.env.local` with `VITE_API_BASE=/api/v1`.
- Real accessibility scanning (`@axe-core/react` gated on `import.meta.env.DEV`, per the reference
  project's pattern) is worth wiring up early, given this app's non-gamified/calm-UI product
  requirement depends on getting contrast and semantics right. Not wired up yet.

## Drive (backend, via curl) — TODO once endpoints exist

Smoke-test the CRUD + planning surface after a backend change. Sketch (fill in real paths once the
first `planner_spec_*` is implemented):

```bash
# Create an activity
curl -X POST http://localhost:8080/api/v1/activities \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Walk\", \"category\": \"ROUTINE\"}"

# Plan it into the week
curl -X POST http://localhost:8080/api/v1/plan/{day}/{slot} \
  -d "{\"activityId\": \"...\"}"

# Mark complete
curl -X PATCH http://localhost:8080/api/v1/occurrences/{id}/complete
```

## Drive (frontend, via browser) — TODO once components exist

1. Apply the CORS workaround above if driving against a real backend.
2. `cd frontend && npm run dev`, then open the dev server URL (the `claude-in-chrome` skill's
   tools work well for this — navigate, screenshot, and `read_console_messages` with a pattern like
   `axe|violat|error`).
3. Drive through the states that matter for each new component: loading, error (works without the
   backend running — fetch fails naturally), empty, populated.
4. Check the console for axe violations after each state change. Check both light and dark
   `prefers-color-scheme` once theming exists — jsdom doesn't render CSS, so Vitest passing is never
   sufficient sign-off for new component styling (see `.claude/steering/frontend_conventions.md`).
5. Specifically probe the product's neutral-language requirement: does an incomplete/missed
   activity ever render in a way that reads as failure or a scorecard? That's a real product bug
   here, not just cosmetics (see `.claude/steering/product.md`).
6. Clean up afterwards: delete `frontend/.env.local` if created, and delete any test data created
   via the UI.

## Worth probing once built

- Validation: missing/blank required fields, invalid category values, malformed IDs.
- 404 on a non-existent resource ID.
- Authorization: a request for another user's data must be rejected once auth exists — this is a
  core seam from V1 (see `.claude/steering/structure.md`), so it's worth a deliberate test early
  rather than assuming it "just works" because a single account exists today.
- Response bodies never leak internals (SQL, stack traces, file paths).

## Resetting between runs — TODO once a real DB exists

Sketch: `docker compose down -v && docker compose up -d` to drop and recreate the local Postgres
volume, then restart `bootRun` so Flyway recreates the schema from scratch.
