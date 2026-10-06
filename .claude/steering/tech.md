# Tech Stack

**Status: scaffolded, no domain code yet.** `backend/build.gradle.kts` and `frontend/package.json`
exist and this doc reflects what's actually declared there as of 2026-08-27 — check those files
directly if this drifts, the same way the reference project's `tech.md` does.

## Language / Runtime

### Backend
- **Java 25** toolchain (LTS — never bump to a non-LTS version in this repo; per global Java
  defaults)
- **Spring Boot 4.1.1**

### Frontend
- **TypeScript**
- **React 19**
- **Vite**

## Framework

### Backend
- **Spring Boot**: REST API, dependency injection, persistence — `spring-boot-starter-webmvc`,
  `spring-boot-starter-data-jpa`, `spring-boot-starter-validation`, `spring-boot-starter-security`,
  `spring-boot-starter-flyway` (Boot 4.1's modular starter names — note `-webmvc`, not the older
  `-web`)
- **Spring Data JPA**: ORM layer
- **Spring Security**: real authentication from V1, even for a single account — see
  `structure.md`'s ownership/auth seams and `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7a for why
  this is in from day one rather than retrofitted. No actual security config/principal wiring exists
  yet — only the starter dependency, added at scaffolding time so it's never bolted on later.
- **No Lombok** — plain Java, explicit constructors/getters, records for small immutable DTOs (per
  global Java defaults)
- **Jackson 3.x, not 2.x** — Boot 4.1's default JSON binding pulls in `tools.jackson.core:jackson-databind`
  (Jackson 3), not the classic `com.fasterxml.jackson.databind` (2.x) artifact. `ObjectMapper` and
  friends live under the `tools.jackson.databind`/`tools.jackson.core` package root now — only
  `jackson-annotations` (used for `@JsonProperty` etc.) stays under the old `com.fasterxml.jackson.annotation`
  package for compatibility. Discovered while wiring `planner_spec_001_auth.md`'s custom
  `AuthenticationEntryPoint`, which needed `ObjectMapper` directly — check actual imports compile
  rather than assuming the Jackson 2 package names from habit.

### Frontend
- **React 19**: component-based UI
- **axios**: HTTP client, used only inside the API service layer (see
  `frontend_conventions.md`) — never called directly from a component
- No router or CSS framework decided yet — add `react-router` / a CSS approach if/when the first
  UI spec needs it (a drag-and-drop weekly grid is the first non-trivial UI surface; CSS Modules is
  the likely default given the reference project's experience, but not committed until V1's first
  frontend spec)

## Database

**PostgreSQL**, from V1, dev and prod — decided explicitly over a local-only H2/SQLite start,
specifically so the local dev environment matches the self-hosted deployment target (Docker
Compose) and there's no later migration surprise. Run locally via Docker Compose (see
`.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7c for the staged hosting plan this follows).

- **Spring Data JPA + Hibernate** as the ORM layer.
- **Flyway** for migrations, same pattern as the reference project.
- Every entity carries an owner/user reference from V1 (see `structure.md`) — this is a
  multi-user-readiness seam, not multi-tenancy itself.

## Build Tools

### Backend
- **Gradle** via the wrapper (bundled Gradle 9.7.1). Only `gradlew.bat` (Windows) is checked in,
  matching every other Java project on this machine — never plain `gradlew`/`./gradlew` (the
  Spring-Initializr-generated Unix `gradlew` was deleted at scaffolding time).

### Frontend
- **Vite**: dev server, production build, asset bundling
- **npm**: package manager

## Testing

### Backend
- **Spock 2.4-groovy-5.0** on **Groovy 5.1.1** (`spock-core`, `spock-spring`) — colocated
  `*Spec.groovy` under `src/test/groovy/...`, mirroring the main package structure 1:1, one spec
  per class under test. Red/green TDD as the default discipline. Not JUnit/Mockito — per global
  Java defaults. Not offered by Spring Initializr; added by hand to `build.gradle.kts` alongside
  the `groovy` Gradle plugin.
- **JUnit Platform** as the underlying test runner (`useJUnitPlatform()`), same as the reference
  project — Spock runs on top of it, tests just aren't written in raw JUnit/Mockito style.
- **Test-slice annotation packages moved in Boot 4.1's modular split** — e.g. `@WebMvcTest` now
  lives at `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest` (from
  `spring-boot-webmvc-test`), not the old `org.springframework.boot.test.autoconfigure.web.servlet`
  package. Verify the actual import compiles rather than assuming Boot 2/3-era package paths.

### Frontend
- **Vitest** (Vite-native) + **React Testing Library** + **@testing-library/user-event**
- **jsdom** as the test environment
- Real-browser verification still required for anything CSS/rendering-related before calling UI
  work done — jsdom doesn't render CSS (see `frontend_conventions.md`).

## AI integration (V3+ — not needed until then)

One Spring interface (e.g. `ChatCompletionClient`) with a single HTTP implementation speaking the
OpenAI-compatible chat-completions wire format — Groq, OpenRouter, and most self-hostable runtimes
(Ollama, vLLM, llama.cpp) all speak this, so provider/base-URL/key are chosen per environment via
`application-{profile}.yml`, not per-provider code. Local/self-hosted use → Groq or OpenRouter free
tier. Do not build a bespoke per-provider integration, and do not build local-inference-serving
code speculatively — see `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7b for the full rationale and
when self-hosted inference would actually become justified (data sovereignty, not cost/latency).

## Hosting (staged — see feedback doc §7c for full detail)

1. **Now**: self-hosted personal use — Docker Compose bundling the Spring Boot app + Postgres, run
   on the user's own machine/home server; Tailscale for private remote access, no public attack
   surface.
2. **If/when needed**: Fly.io or Railway — Dockerfile deploy, managed Postgres, no Kubernetes/VM
   ops.
3. **If it grows multi-user**: same platforms scale into small multi-tenant use; add TLS (both
   provide automatically), managed backups, and OAuth login (GitHub/Google) in place of the
   single-account auth.

No message broker at any stage — see `product.md`'s non-goals.

## API Documentation
Hand-maintained reference lives in `API.md` (root) — update it in the same change as any endpoint
add/change/delete. Interactive docs are not decided yet; add
`springdoc-openapi-starter-webmvc-ui` if wanted once real endpoints exist (see `API.md`'s own note
on why it stays example-light in anticipation of this, to avoid duplicating/going stale against
generated docs later).

## CI/CD
Not set up yet — add GitHub Actions (backend `gradle check`, frontend lint/test/build, a secrets
scan) once there's code to run it against. Model it on the reference project's
`.github/workflows/ci.yml`/`codeql.yml` if starting from scratch.

## Secrets

- Never commit `.env`, API keys, or credentials — root `.gitignore` covers `.env`/`.env.local`/
  `.env.*.local`; `frontend/.gitignore`'s `*.local` glob covers `frontend/.env.local` too.
- The Postgres credentials in `backend/src/main/resources/application.yml` are local-dev-only
  placeholders matching `docker-compose.yml`'s service, overridable via `DB_URL`/`DB_USERNAME`/
  `DB_PASSWORD` env vars — not a real secret to protect, but production deployment should still
  override them via env vars rather than relying on the checked-in defaults.
- The AI provider key (V3+) and any DB credentials are the two secrets this app will have — both
  server-side only, never shipped to the frontend bundle.
- If a variable needs documenting for other developers, add it to a checked-in `.env.example` with
  a placeholder value, never the real one.

## Local ports

Backend and frontend dev servers are pinned to static, non-default ports rather than Spring Boot's
`8080`/Vite's `5173` defaults, since those are common enough that another app on the machine is
likely already holding them:

- **Backend**: `8420` (`server.port` in `application.yml`, overridable via `SERVER_PORT`)
- **Frontend**: `4321` (`server.port` in `vite.config.ts`, with `strictPort: true` so Vite fails
  loudly instead of silently picking a different port if `4321` is taken, rather than masking a real
  conflict)

`app.cors.allowed-origins` (backend) and the Vite dev-server proxy target both point at these ports.
If either ever needs to change, update both together plus `frontend/src/services/*Api.ts`'s
`VITE_API_BASE` fallback — see `RUNBOOK.md` for the full list of places a port change touches.

## Common Commands

See also `scripts/start-dev.sh`/`stop-dev.sh`/`restart-dev.sh` (RUNBOOK.md's "Quick Start (scripts)"
section) for launching both dev servers in the background with health-check-based readiness
reporting, instead of the manual commands below in separate terminals.

```bash
# Backend (from backend/)
gradlew.bat bootRun            # start dev server on :8420
gradlew.bat test               # run Spock tests
gradlew.bat build              # full build

# Frontend (from frontend/)
npm install
npm run dev                    # Vite dev server on :4321, proxies /api to :8420
npm test                       # Vitest, single run
npm run test:watch             # Vitest watch mode
npm run test:coverage          # Vitest with coverage report (no threshold/gate set)
npm run lint                   # oxlint
npm run build                  # production build

# Local infra
docker compose up -d           # Postgres (+ creates a *_test DB on first init, for backend tests)
```

Docker itself isn't installed on this machine as of scaffolding (2026-08-27) — `docker compose up`
and anything that needs a live Postgres (`gradlew.bat test`, `gradlew.bat bootRun`) haven't been run
end-to-end yet. `gradlew.bat compileJava compileTestGroovy` (no DB needed) and the full frontend
`npm test`/`npm run lint`/`npm run build` chain have been verified.
