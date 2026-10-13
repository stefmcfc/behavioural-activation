# Project Structure

This project moved well past its 2026-08-27 scaffolding point — six backend controllers, a dozen
entities/DTOs, 11 Flyway migrations, and a full React frontend exist today (check `ROADMAP.md`'s
"Delivered" table for the authoritative feature list; `API.md` for the endpoint list). Rather than
tagging every individual file `(built)` vs. target — which drifts out of date within days on an
active project like this — this doc describes the real package/directory layout and naming
conventions, and calls out by name the handful of areas that are still genuinely unbuilt (V2/V3+
features, or infra nobody has needed yet). When in doubt about whether something exists, check the
real source (`backend/src/main/java/...`, `frontend/src/...`) rather than trusting this doc's
memory of it — update this file whenever a change adds/removes a top-level package or directory.

## Layout
```
behavioural-activation/
├── .claude/                    # agents/, skills/, steering/, specs/, ideas/,
│                                #   HIGH_LEVEL_DESIGN.md, HIGH_LEVEL_DESIGN_FEEDBACK.md
├── backend/                    # Spring Boot application
├── frontend/                   # React + Vite application
├── scripts/                    # start-dev.sh/stop-dev.sh/restart-dev.sh +
│                                #   lib/dev-common.sh (port/process helpers), lib/docker-common.sh
│                                #   (docker preflight checks) — see RUNBOOK.md's "Quick Start
│                                #   (scripts)" section
├── docker/
│   └── init-test-db.sql        # creates the `_test` DB on first Postgres container init
├── docker-compose.yml          # Local Postgres, matches backend's application.yml creds
├── CLAUDE.md                   # Root steering entrypoint
├── API.md                      # Endpoint reference, grouped by area
├── ROADMAP.md                  # Delivered / specced / internal-maintenance
├── CHANGELOG.md
├── .gitignore
├── README.md
└── RUNBOOK.md
```

## Backend structure
```
backend/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── uk/co/stefirby/behaviouralactivation/
│   │   │       ├── controller/   # REST endpoints (@RestController), thin, delegate only.
│   │   │       │                 #   ActivityController, AuthController, ExportController,
│   │   │       │                 #   PlanController, SubTaskController (also owns the bulk
│   │   │       │                 #   GET /api/v1/sub-tasks endpoint), WorkDayController.
│   │   │       ├── service/      # Business logic (@Service), @Transactional on mutations.
│   │   │       │                 #   ActivityService, PlanService, SubTaskService, WorkDayService,
│   │   │       │                 #   ExportService, plus small projection carriers
│   │   │       │                 #   (ActivityWithSubTaskCount).
│   │   │       ├── repository/   # Spring Data JPA (@Repository), plain JpaRepository
│   │   │       │                 #   extensions — one per entity, plus small projection
│   │   │       │                 #   interfaces (SubTaskCountProjection).
│   │   │       ├── model/        # JPA entities (@Entity) + enums: User, Activity, SubTask,
│   │   │       │                 #   PlannedOccurrence, CompletionRecord, WorkDayPattern,
│   │   │       │                 #   WorkDayOverride, ActivityCategory, PlanSlot.
│   │   │       ├── dto/          # API-facing shapes — centralized, never redeclared inline.
│   │   │       │                 #   One Request/Response (+ListResponse wrapper where a
│   │   │       │                 #   collection endpoint needs one) per resource area.
│   │   │       ├── exception/    # GlobalExceptionHandler (@ControllerAdvice), ApiError, and one
│   │   │       │                 #   custom exception type per distinct 409/400 business rule
│   │   │       │                 #   (BucketMoveNotAllowedException,
│   │   │       │                 #   CarryForwardNotAllowedException, etc.).
│   │   │       ├── security/     # SecurityConfig, UserDetailsServiceImpl,
│   │   │       │                 #   JsonAuthenticationEntryPoint, UserBootstrapRunner (creates
│   │   │       │                 #   the single seeded user on first startup).
│   │   │       ├── config/       # CorsConfig, ClockConfig (injectable Clock bean — see
│   │   │       │                 #   `tech.md`'s Clock-injection convention), other cross-cutting
│   │   │       │                 #   @Configuration classes.
│   │   │       ├── ai/           # ChatCompletionClient interface + HTTP impl — NOT YET BUILT,
│   │   │       │                 #   V3+ only, don't add anything here before a concrete need.
│   │   │       └── BehaviouralActivationApplication.java  # Entry point.
│   │   └── resources/
│   │       ├── application.yml        # dev config — Postgres via Docker Compose, Flyway,
│   │       │                          #   app.cors.allowed-origins, bootstrap user, session timeout
│   │       └── db/
│   │           └── migration/         # Flyway migrations, V001__create_users_table.sql onward
│   │                                  #   (11 migrations as of this writing — check the directory
│   │                                  #   for the current count/latest version number)
│   └── test/
│       ├── groovy/
│       │   └── uk/co/stefirby/behaviouralactivation/
│       │       ├── controller/   # One *Spec.groovy per controller, plus a handful of dedicated
│       │       │                 #   *QueryCountSpec.groovy/*IntegrationSpec.groovy specs where a
│       │       │                 #   test targets N+1 query scaling or a cross-layer behavior
│       │       │                 #   rather than one class in isolation.
│       │       ├── service/      # One *Spec.groovy per service, plus the same
│       │       │                 #   IntegrationSpec/QueryCountSpec pattern as controller/.
│       │       ├── repository/   # One *Spec.groovy per repository with custom query behavior.
│       │       ├── model/        # One *Spec.groovy per entity with non-trivial behavior.
│       │       ├── security/     # SecurityConfigSpec, UserBootstrapRunnerSpec.
│       │       ├── config/       # CorsConfigSpec, SessionTimeoutDefaultSpec/OverrideSpec.
│       │       ├── exception/    # GlobalExceptionHandlerSpec.
│       │       └── BehaviouralActivationApplicationSpec.groovy  # context-loads smoke spec.
│       └── resources/
│           └── application.yml        # test profile — separate `_test` database
├── gradle/wrapper/                    # Gradle wrapper (Windows gradlew.bat only — see below)
├── build.gradle.kts                   # Boot 4.1.x, Java 25 toolchain, Spock 2.4-groovy-5.0
├── settings.gradle.kts
└── .gitignore
```

**Not yet built, by design**: `ai/` (V3+, see `CLAUDE.md`'s hard rules), any `MoodRating`-type
entity/endpoint (V2). Don't pre-build either ahead of a concrete spec.

Gradle wrapper note: Spring Initializr generates both `gradlew` (Unix) and `gradlew.bat` (Windows);
`gradlew` was deleted after generation to match this project's Windows-only-wrapper convention.

Spock/Groovy note: not offered by Spring Initializr, added by hand to `build.gradle.kts` —
`org.apache.groovy:groovy:5.1.1`, `org.spockframework:spock-core`/`spock-spring:2.4-groovy-5.0`,
alongside the `groovy` Gradle plugin. The generated JUnit Jupiter smoke test was replaced with the
equivalent Spock spec (`BehaviouralActivationApplicationSpec.groovy`) rather than kept alongside it.

## Frontend structure
See `frontend_structure.md` for the full detail — summary here:
```
frontend/
├── src/
│   ├── components/   # One subdirectory per feature area (ActivityBank, WeeklyPlanner,
│   │                 #   WeeklySummary, Settings, Navigation, Modal, icons, plus small shared
│   │                 #   primitives like CategoryChip/FavouriteIcon/RepeatableIcon). Each
│   │                 #   component is a colocated .tsx + .module.css + .test.tsx triplet.
│   ├── services/     # All backend API calls — one *Api.ts file per resource area
│   │                 #   (activityApi, authApi, exportApi, planApi, subTaskApi, workDayApi),
│   │                 #   plus a shared client.ts request<T>() wrapper.
│   ├── types/        # Centralized TypeScript types, one file per resource area.
│   ├── utils/        # Small pure helpers shared across components (categoryColors,
│   │                 #   categoryFilter, contrast, getErrorMessage, gridOrientation, theme, ...).
│   ├── App.tsx       # Real top-level orchestrator — tab routing, auth gate, theme provider.
│   └── main.tsx      # React entry point.
├── vite.config.ts    # React plugin, dev server on :4321, /api proxy to :8420
├── vitest.config.ts
├── package.json
└── .gitignore
```

**Not yet built**: a top-level `pages/` directory or router — not needed yet, tab-based navigation
in `App.tsx` covers everything so far. A top-level `hooks/` directory never materialized either;
the two hooks that exist so far (`usePlanActions`, `useWorkDays`) are colocated under
`components/WeeklyPlanner/` since only that area needed them — extract to a shared top-level
location only once a second, unrelated area needs the same hook.

## Naming conventions

### Backend (Java)
- **Package root**: `uk.co.stefirby.behaviouralactivation.{feature}` (lowercase, reverse domain)
- **Classes**: `PascalCase` (e.g. `ActivityController`, `PlanService`, `PlannedOccurrence`)
- **Files**: match class name
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Variables/Methods**: `camelCase`
- **DTOs**: suffix with `Request`/`Response` (e.g. `ActivityRequest`, `PlannedOccurrenceResponse`),
  `*ListResponse` for a collection wrapper
- **Specs**: `*Spec.groovy`
- **Records vs classes**: records for small, single-shot, never-mutated-after-construction
  DTOs/value types; classes for JPA entities (Hibernate needs non-`final`, mutable), wide
  partial-update DTOs, and objects built incrementally across conditional branches — per global
  Java defaults.

### Frontend (TypeScript/React)
- **Files**: `PascalCase.tsx` for components, `camelCase.ts` for utilities/services
- **Components**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Types**: `PascalCase`, files under `src/types/` named `camelCase.ts`
- **Test files**: `ComponentName.test.tsx` or `fileName.test.ts`, colocated with source
- **CSS**: one `ComponentName.module.css` colocated per component (CSS Modules, confirmed — see
  `frontend_conventions.md`)

## Multi-user readiness seams (built in from V1 — not a target anymore)

Per `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7a, both of these are real and in place today, not
aspirational:

1. **Owner association on every entity** — `Activity`, `PlannedOccurrence`, `SubTask`,
   `WorkDayPattern`, `WorkDayOverride`, etc. all carry a `User` reference. Every repository query
   and service method scopes by the authenticated owner; a cross-owner `id` returns `404`, never
   `403` (see `API.md` — stated per-area, consistently).
2. **Real authentication** — Spring Security guards every `/api/v1/**` endpoint except
   `login`/`logout`, session-cookie based, with a single bootstrap-seeded user
   (`UserBootstrapRunner`). An authenticated principal is threaded through controllers/services via
   Spring Security, not assumed implicit.

Everything else (per-tenant schemas, admin tooling, billing, invite flows, self-registration) still
waits until there's a concrete second user — there is still exactly one account.

## Groovy spec conventions

- **Import types rather than using inline fully-qualified references.** Write `import
  org.hamcrest.Matchers` + `Matchers.containsString(x)`, not `org.hamcrest.Matchers.containsString(x)`
  inline — same for any other type (e.g. `ActivityCategory.ROUTINE`, not the fully-qualified form).
  An inline fully-qualified reference bypasses the import, which IntelliJ's Groovy inspector then
  flags as an unused-import warning even though the class is genuinely used elsewhere in the file
  (verified as a real, repo-wide cleanup need in the reference project this convention was adapted
  from). Keep specs import-clean from the start rather than accumulating this and needing a later
  sweep.

## Where tests live

### Backend
Colocated: `src/test/groovy/uk/co/stefirby/behaviouralactivation/{controller,service,repository,model,security,config,exception}/ClassNameSpec.groovy`.
Run with `gradlew.bat test`.

### Frontend
Colocated with source, `ComponentName.test.tsx` / `fileName.test.ts`. Run with `npm test`.

## Database

- **PostgreSQL** (see `tech.md`), run locally via `docker-compose.yml`.
- **Migrations**: `backend/src/main/resources/db/migration/` (Flyway) — 11 migrations as of this
  writing; check the directory for the current count rather than trusting this number.
- **JPA Entities**: `backend/src/main/java/uk/co/stefirby/behaviouralactivation/model/`.

## Build artifacts

- **Backend JAR**: `backend/build/libs/*.jar`
- **Frontend build**: `frontend/dist/`

Both are git-ignored (`backend/.gitignore`, `frontend/.gitignore`).

## Key directories

| Directory | Purpose |
|-----------|---------|
| `.claude/steering/` | AI assistant steering files (this file, `product.md`, `tech.md`, etc.) |
| `.claude/specs/` | Feature specifications and requirements (EARS format) |
| `.claude/agents/` | Claude Code subagents |
| `.claude/skills/` | Claude Code skills |
| `backend/src/main/java/` | Source code |
| `backend/src/test/groovy/` | Spock test specifications |
| `frontend/src/` | React components, services, types |
