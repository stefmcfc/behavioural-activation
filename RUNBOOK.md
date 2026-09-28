# Runbook: Behavioural Activation Planner

Operational guide for running and developing this app locally.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Java | 25 (matches Gradle toolchain in `build.gradle.kts`) | [adoptium.net](https://adoptium.net/) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| npm | bundled with Node | — |
| Docker Desktop | any recent | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Git | any | [git-scm.com](https://git-scm.com/) |

## Ports

Both dev servers are pinned to static, non-default ports rather than Spring Boot's `8080`/Vite's
`5173` defaults, since another app on the machine is likely already holding those:

| Service | Port | Notes |
|---|---|---|
| Backend (Spring Boot) | **8420** | `server.port` in `application.yml`, overridable via `SERVER_PORT` |
| Frontend (Vite) | **4321** | `server.port` in `vite.config.ts`, `strictPort: true` — Vite fails loudly instead of silently picking another port if `4321` is taken |
| PostgreSQL | 5432 | `docker-compose.yml`, unchanged default |

If either app port ever needs to change, update it in all of these places together:
`backend/src/main/resources/application.yml` (`server.port`, `app.cors.allowed-origins`),
`backend/src/test/resources/application.yml` (`app.cors.allowed-origins`), `frontend/vite.config.ts`
(`server.port`, proxy `target`), and `frontend/src/services/*Api.ts`'s `VITE_API_BASE` fallback.

---

## Quick Start (scripts)

`scripts/start-dev.sh`, `scripts/stop-dev.sh`, and `scripts/restart-dev.sh` (git bash) start/stop/
restart both dev servers in the background, without needing two terminal windows or a manual
`netstat`/`taskkill` cycle. Adapted from the reference project this process was based on.

```bash
bash scripts/start-dev.sh              # both servers
bash scripts/start-dev.sh backend      # just the backend
bash scripts/start-dev.sh frontend     # just the frontend
bash scripts/start-dev.sh --debug      # both servers, backend with its JDWP debug port open

bash scripts/stop-dev.sh               # both servers
bash scripts/restart-dev.sh            # stop then start, both (or one, with an argument)
bash scripts/restart-dev.sh backend --debug   # restart just the backend, debug port open
```

- **Postgres isn't started by these scripts** — run `docker compose up -d` first (see below).
  `start-dev.sh backend` fails fast (a few seconds, not the full 90s health-check timeout) with a
  specific message if Docker isn't running, the `postgres` container doesn't exist yet, or it exists
  but isn't healthy yet (`scripts/lib/docker-common.sh` — extend this file for further
  docker-compose-aware checks, e.g. auto-starting Postgres, if that's ever wanted).
- **Output**: each service's stdout/stderr goes to `logs/backend.log`/`logs/frontend.log`, truncated
  fresh on every `start-dev.sh` run (not appended). `logs/` is gitignored.
- **Readiness**: `start-dev.sh` polls each service's health check (backend:
  `GET http://localhost:8420/api/v1/auth/me`, up to 90s for a cold Gradle Daemon start — this app's
  API is auth-gated, so "ready" means *any* HTTP response, including the expected `401`, not
  specifically a `200`; frontend: `GET http://localhost:4321/`, up to 20s) and only reports "ready"
  once it actually responds — not just launched. On timeout it prints the last 20 lines of that
  service's log and exits non-zero.
- **Idempotent**: re-running `start-dev.sh` while a service is already up skips it with a message
  instead of double-launching.
- **pid files** (`logs/backend.pid`/`logs/frontend.pid`) are informational only — `stop-dev.sh`
  always re-resolves the live PID currently bound to the port before acting, and refuses to kill it
  if that PID's process image isn't `java.exe`/`node.exe` as expected (prints manual
  `tasklist`/`taskkill` commands instead of guessing). This means it's safe to run even if a pid file
  is stale or missing.
- `stop-dev.sh` only stops the backend's forked dev-server JVM, not the underlying Gradle Daemon —
  same as today's manual `gradlew.bat` usage, the Daemon stays warm across runs.

The manual commands below still work exactly as before and remain the source of truth for what the
scripts are actually doing under the hood.

---

## Debugging

**Backend**: `bash scripts/start-dev.sh --debug` (or add `--debug` to `restart-dev.sh`) launches the
backend via `gradlew.bat bootRun --debug-jvm`, which opens a JDWP debug port on **`:5005`** — the
script reports this once the backend is ready. `backend/build.gradle.kts` pins `suspend=false` on
`bootRun`'s debug options, so this never blocks startup waiting for a debugger to attach (Gradle's
own `--debug-jvm` default is `suspend=true`, which would otherwise leave the JVM parked at the JDWP
handshake and `start-dev.sh`'s health check timing out). One-time IntelliJ setup: **Run → Edit
Configurations → + → Remote JVM Debug**, host `localhost`, port `5005` — attach any time after the
backend reports ready, and breakpoints in controller/service code will be hit on the next matching
request. The manual equivalent (no script) is `gradlew.bat bootRun --debug-jvm` from `backend/`.

**Frontend**: there's no server-side debug flag — Vite's dev server already serves unminified,
sourcemapped code by default, which is what actually makes in-browser breakpoints work. Just make
sure the frontend dev server is running (`start-dev.sh` with or without `--debug` — it makes no
difference to the frontend), then attach: **Run → Edit Configurations → + → JavaScript Debug**, URL
`http://localhost:4321`. Breakpoints set in the original `.tsx` source (not transpiled output) are
hit as normal. Plain browser DevTools against `http://localhost:4321` works identically without any
IntelliJ configuration at all.

---

## Running the Database

```bash
docker compose up -d
```

Starts a local Postgres 17 container (`docker-compose.yml`) with the dev database
(`behaviouralactivation`) and, on first init only, a separate `behaviouralactivation_test` database
(via `docker/init-test-db.sql`) that the backend's test profile uses.

Stop it with `docker compose down` (add `-v` to also drop the data volume and start fully fresh).

---

## Running the Backend Locally

### 1. Start the Spring Boot server

```bash
cd backend
gradlew.bat bootRun
```

The server starts at **http://localhost:8420**. Flyway runs migrations automatically on startup.

> Only the Windows wrapper (`gradlew.bat`) is present in this repo. If you need to run on macOS/
> Linux, generate the Unix wrapper script with `gradle wrapper` (requires a local Gradle install).

**For active backend development**, use `gradlew.bat bootRun --continuous` instead:
`spring-boot-devtools` (a `developmentOnly` dependency, excluded from the built jar) automatically
restarts the Spring context — in-process, a few seconds, not a full JVM/Gradle-daemon relaunch —
whenever Gradle's `--continuous` file watcher detects a recompiled class. Config-only changes
(`application.yml`, `build.gradle.kts` itself) still need a manual stop/restart.

**To attach a remote debugger**, use `gradlew.bat bootRun --debug-jvm` instead (or
`scripts/start-dev.sh --debug` — see "Debugging" above) — opens a JDWP port on `:5005`,
`suspend=false` so startup is never blocked waiting for a debugger to attach.

### 2. Verify it is running

```
GET http://localhost:8420/api/v1/auth/me
```

Expected response with no active session: `401` with `{ "message": "...", "details": null }`.

---

## Running the Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server starts at **http://localhost:4321** and proxies `/api` calls to the backend at
`localhost:8420` (see `vite.config.ts`).

---

## Environment Variables

### Backend

Configured via `backend/src/main/resources/application.yml`.

| Property | Default | Description |
|----------|---------|-------------|
| `server.port` | `8420` | HTTP port. Overridable via `SERVER_PORT`. |
| `spring.datasource.url` | `jdbc:postgresql://localhost:5432/behaviouralactivation` | Overridable via `DB_URL` |
| `spring.datasource.username` / `password` | `behaviouralactivation` / `behaviouralactivation` | Overridable via `DB_USERNAME`/`DB_PASSWORD` — local-dev-only placeholders matching `docker-compose.yml` |
| `app.cors.allowed-origins` | `http://localhost:4321` | Origin(s) allowed to call `/api/**` cross-origin (never a wildcard) — see `CorsConfig` |
| `app.bootstrap.username` / `password` | *(none)* | The single seeded user's credentials, created on first startup if not already present. **No default** — must be supplied via `APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD`. Never logged. |

Override any property with a `SPRING_`-prefixed environment variable (or, for `app.*` properties,
the plain `APP_`-prefixed equivalent):

```bash
APP_BOOTSTRAP_USERNAME=you APP_BOOTSTRAP_PASSWORD=change-me gradlew.bat bootRun
```

### Frontend

Create a git-ignored `frontend/.env.local` if you need to override the API base URL (e.g. to route
through Vite's proxy instead of calling the backend directly):

```
VITE_API_BASE=/api/v1
```

Default (no `.env.local`): `VITE_API_BASE` falls back to `http://localhost:8420/api/v1`.

---

## Running Tests

### Backend (Spock)

```bash
cd backend
gradlew.bat test                                                                      # full suite
gradlew.bat test --tests "uk.co.stefirby.behaviouralactivation.service.*"             # one package
```

Needs Postgres running (`docker compose up -d`) — the test profile points at the
`behaviouralactivation_test` database.

### Frontend

```bash
cd frontend
npm test              # Vitest, single run
npm run test:watch    # watch mode
npm run lint           # oxlint
```

---

## Build for Production

```bash
# Backend
cd backend && gradlew.bat build   # jar at backend/build/libs/*.jar

# Frontend
cd frontend && npm run build      # static bundle at frontend/dist/
```

---

## Troubleshooting

**Port 8420 or 4321 already in use**

```bash
netstat -ano | findstr :8420
taskkill /PID <pid> /F
```

Same recipe for `:4321`. Since both ports are deliberately non-default, a collision usually means a
previous `bootRun`/`npm run dev` was backgrounded and not cleanly stopped, rather than an unrelated
app — check before killing anything unfamiliar. If the server was started via
`scripts/start-dev.sh`, prefer `bash scripts/stop-dev.sh` instead — same resolution strategy, plus a
safety check that refuses to kill anything that isn't actually the expected `java.exe`/`node.exe`
process.

**Vite exits immediately with "Port 4321 is already in use"**

Expected — `strictPort: true` in `vite.config.ts` makes Vite fail rather than silently starting on a
different port. Free `:4321` (see above) or, if you deliberately need a different port for this run
only, `npm run dev -- --port <n>` (a one-off override, not a config change).

**`Connection refused` / `CannotAcquireLockException` connecting to Postgres**

`docker compose up -d` hasn't been run, or the container isn't healthy yet — `docker compose ps` to
check, `docker compose logs postgres` for detail.

**Frontend can't reach the backend (CORS error in the browser console)**

Confirm the backend's `app.cors.allowed-origins` includes `http://localhost:4321` (the default) and
that you're hitting it from that exact origin — a different port or `127.0.0.1` vs. `localhost` both
count as a different origin. Alternatively, route through Vite's dev-server proxy instead of calling
the backend directly: create `frontend/.env.local` with `VITE_API_BASE=/api/v1`.

**Login returns 401 for credentials you're sure are right**

The seeded user is only created if `APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD` were set on the
backend's *first* startup against a given database. Setting them later doesn't retroactively create
or update the user — either reset the database (`docker compose down -v && docker compose up -d`) or
check what was actually seeded.

---

## CI/CD

Not set up yet — see `.claude/steering/tech.md`'s CI/CD section.
