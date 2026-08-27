# Project Structure

Lines marked **(built)** exist today (scaffolded 2026-08-27); everything else is the target layout
to grow into as specs are implemented. Update this doc as scaffolding evolves, the way the reference
project's `structure.md` tracks its actual `backend/`/`frontend/` trees.

## Layout (current + target)
```
behavioural-activation/
├── .claude/                    # (built) agents/, skills/, steering/, specs/ (empty), ideas/,
│                                #   HIGH_LEVEL_DESIGN.md, HIGH_LEVEL_DESIGN_FEEDBACK.md
├── backend/                    # (built, scaffold only) Spring Boot application
├── frontend/                   # (built, scaffold only) React + Vite application
├── docker/
│   └── init-test-db.sql        # (built) creates the `_test` DB on first Postgres container init
├── docker-compose.yml          # (built) Local Postgres, matches backend's application.yml creds
├── CLAUDE.md                   # (built) Root steering entrypoint
├── API.md                      # (built, empty template) Endpoint reference, grouped by area
├── ROADMAP.md                  # (built, empty template) Delivered / specced / internal-maintenance
├── .gitignore                  # (built)
├── README.md                   # not yet created
└── RUNBOOK.md                  # not yet created
```

## Backend structure (current + target)
```
backend/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── uk/co/stefirby/behaviouralactivation/
│   │   │       ├── controller/        # REST endpoints (@RestController) — thin, delegate only (none yet)
│   │   │       ├── service/           # Business logic (@Service), @Transactional on mutations (none yet)
│   │   │       ├── repository/        # Spring Data JPA (@Repository) — plain JpaRepository extensions (none yet)
│   │   │       ├── model/             # JPA entities (@Entity) — Activity, PlannedOccurrence,
│   │   │       │                      #   CompletionRecord, MoodRating, User, ... (none yet)
│   │   │       ├── dto/               # API-facing shapes — centralized, never redeclared inline (none yet)
│   │   │       ├── exception/         # Custom exceptions + GlobalExceptionHandler (@ControllerAdvice) (none yet)
│   │   │       ├── security/          # Spring Security config, authenticated-principal plumbing (none yet)
│   │   │       ├── ai/                # ChatCompletionClient interface + HTTP impl (V3+, not before)
│   │   │       ├── config/            # CorsConfig and other cross-cutting @Configuration classes (none yet)
│   │   │       └── BehaviouralActivationApplication.java  # (built) Entry point, no config yet
│   │   └── resources/
│   │       ├── application.yml        # (built) dev config — Postgres via Docker Compose, Flyway,
│   │       │                          #   app.cors.allowed-origins
│   │       └── db/
│   │           └── migration/         # (built, empty — just .gitkeep) Flyway migrations, V001__ onward
│   └── test/
│       ├── groovy/
│       │   └── uk/co/stefirby/behaviouralactivation/
│       │       ├── controller/        # (none yet)
│       │       ├── service/           # (none yet)
│       │       ├── model/             # (none yet)
│       │       ├── security/          # (none yet)
│       │       └── BehaviouralActivationApplicationSpec.groovy  # (built) context-loads smoke spec
│       └── resources/
│           └── application.yml        # (built) test profile — separate `_test` database
├── gradle/wrapper/                    # (built) Gradle wrapper (Windows gradlew.bat only — see below)
├── build.gradle.kts                   # (built) Boot 4.1.1, Java 25 toolchain, Spock 2.4-groovy-5.0
├── settings.gradle.kts                # (built)
└── .gitignore                         # (built, Spring Initializr default)
```

Gradle wrapper note: Spring Initializr generates both `gradlew` (Unix) and `gradlew.bat` (Windows);
`gradlew` was deleted after generation to match this project's Windows-only-wrapper convention.

Spock/Groovy note: not offered by Spring Initializr, added by hand to `build.gradle.kts` —
`org.apache.groovy:groovy:5.1.1`, `org.spockframework:spock-core`/`spock-spring:2.4-groovy-5.0`,
alongside the `groovy` Gradle plugin. The generated JUnit Jupiter smoke test was replaced with the
equivalent Spock spec (`BehaviouralActivationApplicationSpec.groovy`) rather than kept alongside it.

## Frontend structure (current + target)
See `frontend_structure.md` for the full detail — summary here:
```
frontend/
├── src/
│   ├── components/     # Weekly planner grid, activity bank, bucket list, forms, etc. (none yet)
│   ├── services/        # All backend API calls — one file per resource area (none yet)
│   ├── types/            # Centralized TypeScript types (none yet)
│   ├── App.tsx           # (built) Placeholder shell
│   └── main.tsx           # (built)
├── vite.config.ts        # (built) React plugin + /api proxy to :8080
├── vitest.config.ts       # (built)
├── package.json            # (built)
└── .gitignore               # (built, Vite default)
```

## Naming conventions

### Backend (Java)
- **Package root**: `uk.co.stefirby.behaviouralactivation.{feature}` (lowercase, reverse domain)
- **Classes**: `PascalCase` (e.g. `ActivityController`, `PlannerService`, `ActivityEntity`)
- **Files**: match class name
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Variables/Methods**: `camelCase`
- **DTOs**: suffix with `Dto` or `Request`/`Response` (e.g. `ActivityDto`, `PlanWeekRequest`)
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

## Multi-user readiness seams (build in from V1 — don't retrofit)

Per `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7a, two things are expensive to add later and cheap to
include now:

1. **Owner association on every entity from day one** — `Activity`, `PlannedOccurrence`,
   `MoodRating`, etc. all carry a `User` reference, even with exactly one user initially.
2. **Real authentication from V1** — Spring Security guarding at least a single account, so an
   authenticated principal is already threaded through services/repositories rather than assumed
   implicit.

Everything else (per-tenant schemas, admin tooling, billing, invite flows) waits until there's a
concrete second user.

## Where tests live

### Backend
Colocated: `src/test/groovy/uk/co/stefirby/behaviouralactivation/{controller,service,model,security}/ClassNameSpec.groovy`.
Run with `gradlew.bat test`.

### Frontend
Colocated with source, `ComponentName.test.tsx` / `fileName.test.ts`. Run with `npm test`.

## Database

- **PostgreSQL** (see `tech.md`), run locally via `docker-compose.yml`.
- **Migrations**: `backend/src/main/resources/db/migration/` (Flyway).
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
