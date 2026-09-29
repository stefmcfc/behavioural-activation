# Behavioural Activation Planner

A personal Behavioural Activation (BA) planner: build an activity bank, plan structured weekdays
and a flexible weekend bucket list, and record completion/mood — with AI-assisted suggestions
planned for a later version. See [`.claude/HIGH_LEVEL_DESIGN.md`](.claude/HIGH_LEVEL_DESIGN.md) for
the full product outline, roadmap, and user stories.

## What it does

**Status: early V1.** Authentication (seeded single-user session login), the Activity Bank
(create/edit/delete activities, categorised Routine/Necessary/Pleasurable), and splitting an
activity into sub-tasks are built. Everything else below is the target shape from the design doc,
not yet implemented:

- ~~Build a bank of activities~~ ✅ built — name, one of Routine/Necessary/Pleasurable, optional
  description, optionally split into a flat checklist of sub-tasks that inherit the parent's
  category
- Plan structured weekdays and a flexible weekend "bucket list" against that bank
- Record completion and a mood rating against each planned occurrence
- Review mood/activity trends over time
- (V3+) Get AI-suggested activities — always optional, never a diagnosis, requires explicit approval
  before becoming an active plan

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 25 toolchain, Spring Boot 4.1.x |
| Frontend | TypeScript, React 19, Vite |
| Database | PostgreSQL (local dev via Docker Compose, matches self-hosted deployment target) |
| ORM | Spring Data JPA + Hibernate |
| Migrations | Flyway |
| Auth | Spring Security (session-cookie based), from V1 |
| Build (backend) | Gradle (Windows `gradlew.bat` wrapper only) |
| Build (frontend) | Vite, npm |
| Tests (backend) | Spock Framework (Groovy) |
| Tests (frontend) | Vitest, React Testing Library |

Full detail and rationale: [`.claude/steering/tech.md`](.claude/steering/tech.md).

## Project Structure

```
behavioural-activation/
├── .claude/
│   ├── agents/            # Claude Code subagents (backend-dev, frontend-dev, spec-writer)
│   ├── skills/             # Claude Code skills (ears-spec, verify)
│   ├── steering/           # AI assistant context files
│   └── specs/               # Feature specs and requirements
├── backend/               # Spring Boot application
│   ├── src/main/java/uk/co/stefirby/behaviouralactivation/
│   │   ├── controller/    # REST endpoints
│   │   ├── service/       # Business logic
│   │   ├── repository/    # Spring Data JPA
│   │   ├── model/         # JPA entities + enums
│   │   ├── dto/           # API request/response types
│   │   ├── security/      # Spring Security config, authenticated-principal plumbing
│   │   └── exception/     # Custom exceptions + global handler
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── db/migration/  # Flyway SQL scripts
│   └── src/test/groovy/   # Spock specifications
├── frontend/              # React + Vite application
├── scripts/               # Dev-server start/stop/restart bash scripts
├── docker-compose.yml     # Local Postgres
├── CLAUDE.md              # Claude Code steering entrypoint
├── README.md
├── API.md                 # API endpoint reference
├── ROADMAP.md             # Feature delivery status
└── RUNBOOK.md
```

## Ports

Backend and frontend dev servers run on static, non-default ports (**not** Spring Boot's `8080` or
Vite's `5173`), since those are common enough that another app on the machine is likely already
using them:

- **Backend**: `http://localhost:8420`
- **Frontend**: `http://localhost:4321`

See [`RUNBOOK.md`](./RUNBOOK.md) for full setup and [`.claude/steering/tech.md`](.claude/steering/tech.md#local-ports)
for the rationale.

## API Overview

The backend exposes a REST API at `http://localhost:8420/api/v1`. See [API.md](./API.md) for the
full endpoint list and behavior notes.

## Getting Started

See [RUNBOOK.md](./RUNBOOK.md) for detailed setup and local development instructions.

## Features Roadmap

See [ROADMAP.md](./ROADMAP.md) for delivered features and what's specced and coming soon.

## Future Ideas

Deferred features and known gaps, not yet scheduled against a spec, are tracked in
[future_ideas.md](./.claude/ideas/future_ideas.md).
