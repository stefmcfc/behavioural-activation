# Production-Style Dockerfiles for Backend and Frontend (Tooling)

**Status**: Implemented (2026-10-13) — `backend/Dockerfile`, `frontend/Dockerfile`,
`frontend/nginx.conf`, `docker-compose.yml`
**Priority**: P3 — infra/tooling, no user-facing behaviour change
**Depends on**: none
**Area**: Tooling (repo-wide) — no backend/frontend feature code touched, `app.cors.allowed-origins`
left unchanged (see Decision 2 below)
**Roadmap version**: N/A — internal/maintenance, not a V1–V5 feature. Supports the self-hosted
Docker Compose deployment target already named in `.claude/steering/tech.md`'s Hosting section and
`.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7c.

## Overview

Today, `docker compose up` only starts Postgres (`docker-compose.yml`'s sole `postgres` service) —
the backend and frontend still run directly on the host (`gradlew.bat bootRun`, `npm run dev`).
This spec adds production-style, multi-stage Dockerfiles for both the backend and frontend, and
wires them into `docker-compose.yml` as two new services (`backend`, `frontend`) alongside the
existing `postgres` service, so the whole app can be started with one `docker compose up`.

This is the "Now — self-hosted, personal use" stage of the hosting plan in
`.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7c: "Docker Compose bundling the Spring Boot app +
Postgres, run on your own machine or a home server/NAS." Fly.io/Railway deploy, Tailscale setup,
TLS, and CI building/pushing these images are later stages and explicitly out of scope here.

**Out of scope**: Fly.io/Railway deployment, Tailscale configuration, TLS/HTTPS termination, CI
pipeline integration (no CI exists yet in this repo), multi-arch (`linux/arm64`) image builds,
production secrets management beyond a gitignored `.env` file consumed by Compose. These stay
future ideas/spec candidates, not part of this pass.

### Decision 1: backend build-stage strategy

Originally assumed only `gradlew.bat` (Windows) was checked in for the Gradle wrapper, which would
have ruled out invoking it from a Linux-based Docker build stage. Checking the actual repo during
implementation found `backend/gradlew` (the Unix launcher) already committed (PR #34) — the
`CLAUDE.md` hard rule describing a Windows-only wrapper was stale, and has been corrected in the
same change as this spec's implementation.

**Decision**: the backend `Dockerfile`'s build stage is based on an `eclipse-temurin:25-jdk-alpine`
image and invokes the project's own checked-in `backend/gradlew` directly (`./gradlew build -x
test --no-daemon`) — no official `gradle:*` Docker image needed, and the exact Gradle version
always matches `gradle-wrapper.properties` (currently `9.8.0`) by construction, since it's the same
wrapper `gradlew.bat` uses locally; no separate version-matching step is needed. Tests are not run
as part of the image build (they already run separately via `gradlew.bat test` / CI-to-come) — this
avoids needing a database reachable from inside the build context, and keeps image builds fast and
deterministic.

### Decision 2: frontend serves via nginx, reverse-proxying `/api` — no CORS config change

`application.yml`'s `app.cors.allowed-origins` is currently hardcoded to `http://localhost:4321`
and has no env-var override — a gap, since a containerised frontend could be served from a
different origin (a different port, a different host/domain once reachable via Tailscale).

Two ways to close that gap: (a) make `app.cors.allowed-origins` env-overridable, or (b) keep
frontend and backend same-origin from the browser's point of view, by having the frontend's static
file server reverse-proxy `/api/**` to the backend container, the same way Vite's dev server
already proxies `/api` to `localhost:8420` (`frontend/vite.config.ts`).

**Decision**: option (b). The frontend's production `Dockerfile` builds the static bundle
(`npm run build` → `frontend/dist/`) in a Node build stage, then serves it from an `nginx:alpine`
runtime stage with a `location /api/ { proxy_pass http://backend:8420/api/; }` block (`backend`
being the Compose service's DNS name on the Compose network), so the browser only ever talks to
one origin (the frontend container's exposed port) and `app.cors.allowed-origins` never needs to
change. This mirrors the existing dev-time proxy pattern exactly, rather than introducing a second,
inconsistent mechanism (env-configurable CORS) for the same problem. If a future deployment stage
genuinely needs cross-origin access (e.g. a separately-hosted SPA calling a separately-hosted API),
making `app.cors.allowed-origins` configurable can be revisited then — not pre-built speculatively
here.

## Requirement 1: Backend production Dockerfile

**User story**: As the person running this app, I want a Docker image that runs the Spring Boot
backend without needing Java or Gradle installed on the host.

### TOOLING-006-AC-01 [AUTO]: Backend image builds successfully
**Statement**: `backend/Dockerfile` shall define a multi-stage build: a build stage based on
`eclipse-temurin:25-jdk-alpine` running the project's own checked-in `./gradlew build -x test
--no-daemon` (per Decision 1), and a runtime stage based on `eclipse-temurin:25-jre-alpine` that
copies only the built jar (`backend/build/libs/*.jar`) from the build stage and runs it via `java
-jar`. Running `docker build -t ba-backend ./backend` shall exit `0` and produce a runnable image.
Confirmed available at implementation time: `eclipse-temurin:25-jdk-alpine` and
`eclipse-temurin:25-jre-alpine` are both published tags.

**Rationale**: A multi-stage build keeps the final runtime image small (no JDK/Gradle-wrapper-cache
left in the shipped layer) while still producing output equivalent to `gradlew.bat build` locally,
since both invoke the same wrapper-pinned Gradle version.

**References**:
- New file: `backend/Dockerfile`
- New file: `backend/.dockerignore` (excludes `build/`, `.gradle/`, `logs/`, `*.log`, local `.env`
  files — so the build context doesn't ship host build artifacts into the image)
- `backend/gradlew`, `backend/gradle/wrapper/` (the checked-in wrapper this stage invokes directly)
- `backend/build.gradle.kts` (Java 25 toolchain, Spring Boot 4.1.1)

**Test Case (Green)**: `docker build -t ba-backend ./backend` from the repo root exits `0`;
`docker run --rm ba-backend java -version` (or equivalent smoke check) confirms a Java 25 runtime
inside the image.

### TOOLING-006-AC-02 [AUTO]: Backend image runs and serves traffic using only env-var config
**Statement**: The backend image shall start the Spring Boot application using only environment
variables already supported by `application.yml` (`SERVER_PORT`, `DB_URL`, `DB_USERNAME`,
`DB_PASSWORD`, `APP_BOOTSTRAP_USERNAME`, `APP_BOOTSTRAP_PASSWORD`, `SESSION_TIMEOUT`) — no new
Spring property or code change required to run inside a container.

**Rationale**: All the config the backend needs to run in Compose already exists and is
externalised (confirmed in `RUNBOOK.md`'s Environment Variables table) — this AC is a smoke test
that containerising doesn't need to add any new one, rather than new functionality.

**References**: `backend/src/main/resources/application.yml`

**Test Case (Green)**: run the image with `DB_URL` pointed at a reachable Postgres instance and
`APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD` set; `GET /api/v1/auth/me` against the mapped
port returns `401` (the same "ready" signal `scripts/start-dev.sh` already uses), confirming the
app started successfully and is serving HTTP.

## Requirement 2: Frontend production Dockerfile

**User story**: As the person running this app, I want a Docker image that serves the built
frontend without needing Node installed on the host, and without needing to separately configure
CORS to let it talk to the backend.

### TOOLING-006-AC-03 [AUTO]: Frontend image builds successfully
**Statement**: `frontend/Dockerfile` shall define a multi-stage build: a Node build stage running
`npm ci` then `npm run build` (producing `frontend/dist/`), and an `nginx:alpine` runtime stage that
copies `dist/` into nginx's web root plus a project-provided nginx config. Running
`docker build -t ba-frontend ./frontend` shall exit `0` and produce a runnable image.

**References**:
- New file: `frontend/Dockerfile`
- New file: `frontend/.dockerignore` (excludes `node_modules/`, `dist/`, `coverage/`, local `.env*`
  files)
- New file: `frontend/nginx.conf` (or `docker/nginx.conf`, referenced from the Dockerfile)

**Test Case (Green)**: `docker build -t ba-frontend ./frontend` from the repo root exits `0`.

### TOOLING-006-AC-04 [AUTO]: Frontend container serves the SPA and proxies `/api` same-origin
**Statement**: The frontend container's nginx config shall (a) serve `frontend/dist/`'s static
files, falling back to `index.html` for client-side routed paths (matching `react-router-dom`'s
history-mode routing already in use), and (b) proxy any request under `/api/` to
`http://backend:8420/api/` (the `backend` Compose service's DNS name), unchanged path otherwise.
No CORS configuration is added anywhere — this AC is satisfied precisely because the browser only
ever sees one origin (the frontend container's own exposed port), per Decision 2.

**Rationale**: Mirrors `vite.config.ts`'s existing dev-time proxy (`'/api': { target:
'http://localhost:8420' }`) at the production layer, so frontend code's existing
`VITE_API_BASE`-relative-path behaviour needs no change between dev and containerised-prod.

**References**:
- `frontend/vite.config.ts` (the dev-time proxy this mirrors)
- `frontend/src/services/*Api.ts` (consumes `VITE_API_BASE`, already relative-path-friendly)

**Test Case (Green)**: with both containers running via Compose, `curl
http://localhost:<frontend-port>/` returns the SPA's `index.html`; `curl
http://localhost:<frontend-port>/api/v1/auth/me` returns the backend's `401` response (proving the
proxy reaches the backend container), and a client-side route like `/activities` also returns
`index.html` (not nginx's default 404) on a direct request/refresh.

## Requirement 3: `docker-compose.yml` runs the whole app

**User story**: As the person running this app, I want one `docker compose up` to start Postgres,
the backend, and the frontend together, instead of starting Postgres via Compose and the other two
manually.

### TOOLING-006-AC-05 [AUTO]: `backend` and `frontend` services added to `docker-compose.yml`
**Statement**: `docker-compose.yml` shall gain a `backend` service (built from `backend/Dockerfile`,
`depends_on: postgres` with `condition: service_healthy`, `DB_URL` pointing at the `postgres`
service's Compose DNS name rather than `localhost`, `APP_BOOTSTRAP_USERNAME`/
`APP_BOOTSTRAP_PASSWORD`/other secrets sourced from an `env_file: .env` entry rather than inlined)
and a `frontend` service (built from `frontend/Dockerfile`, `depends_on: backend`, exposing a
mapped port for host access). Running `docker compose up --build` from the repo root shall bring up
all three services, with the frontend reachable from the host browser and able to log in and use
the app end-to-end.

**Rationale**: This is the actual deliverable the Overview promises — the two new Dockerfiles alone
don't start the app together without this wiring.

**References**:
- `docker-compose.yml` (existing `postgres` service, to extend)
- New/updated: a gitignored `.env` at the repo root (consistent with `RUNBOOK.md`'s existing
  `.env`-for-`APP_BOOTSTRAP_*` pattern, extended to cover any other Compose-level secrets) — a
  checked-in `.env.example` with placeholder values documents what's expected, per
  `.claude/steering/tech.md`'s Secrets section.

**Test Case (Green)**: `docker compose up --build -d` from the repo root; `docker compose ps` shows
all three services healthy/running; opening the mapped frontend port in a browser allows logging in
with the bootstrap credentials and using the weekly planner end-to-end (manual smoke test — see
`[MANUAL]` note below). `docker compose down` cleanly stops all three.

**Verification**: `[MANUAL]` for the end-to-end login/use smoke test (no automated integration test
harness spins up full Compose today); `[AUTO]`-verifiable mechanically via `docker compose config`
validating the compose file parses and `docker compose up --build -d` exiting `0`.

### TOOLING-006-AC-06 [MANUAL]: No secret is baked into an image layer
**Statement**: Neither `backend/Dockerfile` nor `frontend/Dockerfile` shall `COPY` or `ARG`/`ENV` any
real credential (DB password, bootstrap username/password) into an image layer. All such values
shall be supplied only at container-run time via `docker-compose.yml`'s `environment`/`env_file`,
sourced from a gitignored `.env`.

**Rationale**: Matches the project's existing "never commit secrets" rule
(`.claude/steering/tech.md`) — a value baked into an image layer is recoverable from the image
itself (`docker history`/layer inspection) even if never committed to git, which is a distinct risk
from a value merely absent from source control.

**References**: `.gitignore` (root), `backend/Dockerfile`, `frontend/Dockerfile`,
`docker-compose.yml`

**Verification**: `[MANUAL]` — review both Dockerfiles for any `ARG`/`ENV` line naming a credential,
and confirm `docker history ba-backend`/`ba-frontend` shows no secret value in any layer command.

## Cross-references

| Reference | What it provides |
|---|---|
| `docker-compose.yml` | Existing `postgres` service; extended with `backend`/`frontend` |
| `backend/build.gradle.kts` | Java 25 toolchain, Spring Boot 4.1.1, jar output location |
| `backend/gradlew`, `backend/gradle/wrapper/` | Checked-in wrapper the build-stage image invokes directly |
| `backend/src/main/resources/application.yml` | Env vars the backend container is configured through |
| `frontend/vite.config.ts` | Dev-time `/api` proxy this spec's nginx config mirrors in prod |
| `frontend/package.json` | `npm run build` → `frontend/dist/` |
| `RUNBOOK.md` | Existing `.env`-for-secrets pattern (`APP_BOOTSTRAP_*`); gains a new "Running via Docker Compose" section |
| `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7c | Hosting plan stage this spec implements |
| `.claude/steering/tech.md` | Secrets rules; Hosting section |

## Acceptance Criteria Summary

- [x] TOOLING-006-AC-01 — `backend/Dockerfile` multi-stage build succeeds via the checked-in `gradlew`, JRE 25 runtime
- [x] TOOLING-006-AC-02 — backend image runs using only existing env-var config, no code/property change needed
- [x] TOOLING-006-AC-03 — `frontend/Dockerfile` multi-stage build succeeds
- [x] TOOLING-006-AC-04 — frontend container serves the SPA with history-mode fallback and proxies `/api` same-origin, no CORS change
- [x] TOOLING-006-AC-05 — `docker-compose.yml` gains `backend`/`frontend` services; `docker compose up --build` runs the whole app
- [x] TOOLING-006-AC-06 — no secret is baked into an image layer; all sourced from a gitignored `.env` at container-run time

## Summary

### What changed
- `backend/Dockerfile` (new): `eclipse-temurin:25-jdk-alpine` build stage running the project's own
  checked-in `./gradlew build -x test --no-daemon` (see Decision 1's revision below), then an
  `eclipse-temurin:25-jre-alpine` runtime stage (`curl` added for the Compose healthcheck) copying
  only the built jar. `backend/.dockerignore` (new) excludes `build/`, `.gradle/`, `logs/`, `.env*`.
- `frontend/Dockerfile` (new): `node:22-alpine` build stage (`npm ci && npm run build`), then an
  `nginx:alpine` runtime stage serving `dist/` via `frontend/nginx.conf` (new) — history-mode SPA
  fallback (`try_files ... /index.html`) plus a `/api/` reverse proxy to `http://backend:8420/api/`.
  `frontend/.dockerignore` (new) excludes `node_modules/`, `dist/`, `coverage/`, `.env*`.
- `docker-compose.yml`: added `backend` (built from `backend/Dockerfile`, `DB_URL` pointed at the
  `postgres` service's Compose DNS name, `APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD` required
  via Compose's `${VAR:?...}` syntax rather than defaulted, a healthcheck hitting
  `/api/v1/auth/me`, `depends_on: postgres` with `condition: service_healthy`) and `frontend`
  (built from `frontend/Dockerfile`, port `4321:80`, `depends_on: backend` with `condition:
  service_healthy`).
- `.env.example` (new, root): documents `APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD` for both
  the Compose flow and the existing non-Docker `.env` pattern `scripts/start-dev.sh` already reads.
- `RUNBOOK.md`: new "Running via Docker Compose" section; its gradlew note updated (see below).
- `README.md`: Project Structure updated with both new Dockerfiles + `nginx.conf`; Getting Started
  now points at the Compose flow as an alternative to the script/manual flow.
- `CHANGELOG.md`: `[Unreleased]` entry added.

### Decision 1 revision (found during implementation)
The spec's original Decision 1 assumed only `gradlew.bat` was checked in and planned around an
official `gradle:*` Docker image for that reason. Checking the real repo during implementation
found `backend/gradlew` (the Unix launcher) already committed in PR #34 — `CLAUDE.md`'s hard rule
describing a Windows-only wrapper was stale. Corrected `CLAUDE.md`, `.claude/steering/tech.md`, and
`RUNBOOK.md` in this same change, and simplified the backend Dockerfile to invoke the checked-in
`gradlew` directly instead of an official Gradle image — this also sidesteps a real gap found while
checking image tags: no `gradle:9.8.0-jdk25` tag exists on Docker Hub (only `9.8-jdk25` and
`9.8.1-jdk25`), which would have forced an inexact version match under the original plan.

### Verification
- `docker build -t ba-backend ./backend` — succeeds; confirmed Gradle 9.8.0 (exact wrapper-pinned
  version) downloads and runs inside the build stage, `BUILD SUCCESSFUL`.
- `docker build -t ba-frontend ./frontend` — succeeds; `tsc -b && vite build` completes, image
  built on top of the resulting `dist/`.
- `docker compose up --build -d` (real stack) — all three services report healthy; frontend root
  (`/`), the `/api/` proxy (`/api/v1/auth/me` → `401` through the proxy, matching the direct
  backend response), and a client-side route (`/activities` → `index.html`, not a 404) all verified
  via `curl`.
- End-to-end login verified via a fully isolated throwaway Compose project (separate project name,
  separate volume, disposable test credentials — deliberately not touching the real `.env`/dev
  database): `POST /api/v1/auth/login` through the frontend's `/api/` proxy returns `200` with a
  session cookie, and a follow-up `GET /api/v1/auth/me` using that cookie returns `200` with the
  logged-in username — confirming the whole same-origin, no-CORS flow works through nginx, not just
  that the containers start. Throwaway stack fully torn down (`down -v`) afterward.
- AC-06 (no secret baked into an image layer): confirmed by inspection — neither Dockerfile declares
  an `ARG`/`ENV` for any credential; `APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD` and the DB
  credentials are supplied only via `docker-compose.yml`'s `environment`, sourced from the real
  `.env` (gitignored) at container-run time.

### Findings
- `backend/gradlew` already existing in git (PR #34) contradicted `CLAUDE.md`'s stated hard rule —
  fixed `CLAUDE.md`/`tech.md`/`RUNBOOK.md` in this change (user confirmed, see Decision 1 revision).
- No `gradle:9.8.0-jdk25` image tag exists on Docker Hub — using the checked-in wrapper directly
  avoids the version-matching problem entirely rather than settling for an approximate tag.
- Compose's default array-merge behavior (ports lists concatenate across `-f` files rather than
  replacing) meant a naive port-remapping override file for isolated testing didn't work until
  using the `!override` YAML merge tag — noted here only because it's the kind of thing that's easy
  to re-discover the hard way; not relevant to the shipped `docker-compose.yml` itself, which uses
  no override files.
