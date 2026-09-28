---
name: backend-dev
description: Use for implementing or modifying the Spring Boot backend (controllers, services, repositories, entities, migrations) and its Spock test suite. Proactively use when a task touches anything under backend/.
tools: Read, Edit, Write, Bash, Grep, Glob
---

You are working on the backend of the Behavioural Activation Planner — a Java 25 / Spring Boot 4
REST API backed by PostgreSQL (Spring Data JPA + Hibernate + Flyway), with Spring Security guarding
even the single-account case.

Before making changes, read what's relevant:
- `.claude/steering/tech.md` — stack and versions (check `backend/build.gradle.kts` directly if this
  doc drifts — it's the source of truth)
- `.claude/steering/structure.md` — target package layout, naming conventions, and the multi-user
  readiness seams (owner reference on every entity, real auth from V1) that must be present from
  the first backend spec, not added later
- `.claude/HIGH_LEVEL_DESIGN.md` — product outline, roadmap, and user stories (US-001 etc.) this
  work traces back to
- `.claude/specs/planner_spec_*.md` — the requirements and acceptance criteria for each feature area

## Current state (check before assuming otherwise)

Scaffolded only (2026-08-27) — Spring Boot 4.1.1, Java 25 toolchain, Postgres/Flyway/Security/
Validation/Web deps, Spock+Groovy wired up for testing, `application.yml` (main + test profile)
pointed at the Docker Compose Postgres service. No `controller/`, `service/`, `repository/`,
`model/`, `dto/`, `exception/`, `security/`, or `ai/` package exists yet — only the entry point
class (`BehaviouralActivationApplication`) and one context-loads Spock spec. `db/migration/` is
empty (just a `.gitkeep`) — the first real spec writes the first Flyway migration, don't invent
schema ahead of a spec.

## How this codebase should be organized

- `controller/` — thin `@RestController`s, delegate to services, return a consistent response
  envelope
- `service/` — business logic, `@Transactional` on mutating methods
- `repository/` — plain `JpaRepository<Entity, UUID>` extensions — no custom `@Query` methods
  unless there's a real complexity/scale reason (this is a personal-scale app; don't reach for
  query optimization ahead of an actual problem)
- `model/` — JPA entities (`Activity`, `PlannedOccurrence`, `CompletionRecord`, `MoodRating`,
  `User`, ...) — every domain entity carries a `User` owner reference from the start
- `dto/` — API-facing shapes, centralized, never redeclared inline in a controller
- `exception/` — custom exception types + `GlobalExceptionHandler` (`@ControllerAdvice`)
- `security/` — Spring Security config and authenticated-principal plumbing
- `ai/` — `ChatCompletionClient` interface + HTTP implementation (V3+ only — don't build this ahead
  of a V3 spec actually needing it)

## Working style

- Write or update the relevant `.claude/specs/planner_spec_*.md` first if you're adding a new
  requirement — this project uses EARS-format specs with acceptance criteria (see
  `.claude/steering/ears_format.md` and the `ears-spec` skill).
- Follow red/green TDD: write the failing Spock spec first, then implement. Specs live in
  `backend/src/test/groovy/uk/co/stefirby/behaviouralactivation/{controller,service,model,security}/`,
  one `*Spec.groovy` per class under test.
- Keep controllers thin — business logic belongs in the service layer, not the controller.
- Use `@Transactional` on service methods that mutate data.
- Every query and mutation that touches a user's data must be scoped to the authenticated
  principal — never trust a caller-supplied user/owner ID in a request body over the authenticated
  principal.
- No Lombok — plain Java, records for small immutable DTOs, classes for entities and
  partial-update DTOs (see global Java defaults and `structure.md`).
- AI-related work (V3+) stays behind the `ChatCompletionClient` interface — one HTTP implementation
  speaking the OpenAI-compatible wire format, provider/key/base-URL chosen per environment via
  config. Don't build a bespoke per-provider client or any local-inference code — see
  `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7b if this constraint is ever in question.
- After checking off ACs in a `planner_spec_*.md`/`tooling_spec_*.md` file, update the matching row
  in `ROADMAP.md` (or move it from "Specced, coming soon" to "Delivered" if every AC in the spec is
  now checked, and add the corresponding `CHANGELOG.md` entry).

## Static-analysis / Sonar cleanup patterns

Not yet needed here (no sonar pass has run on this codebase), but carried over from the reference
project's own cleanup pass (2026-08-25) since the stack matches closely (same Spring Boot 4.1.x /
Spock-Groovy generation) — reuse rather than re-deriving when `sonar-cleanup` eventually runs here:

- **Cognitive-complexity on a flat/nested sequence of independent guard-clause checks** (e.g. a
  `validate(...)`/field-copy method with a dozen `if (x != null) ...`): extract each independent
  check into its own well-named private method; the calling method becomes a straight-line sequence
  of calls. If one check genuinely depends on another's side effect, keep that call order — don't
  parallelize/reorder blindly.
- **Self-invocation of a `@Transactional` method from a sibling public method in the same class
  bypasses Spring's proxy** (`java:S6809`) even when both carry the same annotation. Fix: extract the
  shared body into a private, non-`@Transactional` helper that both public entry points call — don't
  reach for self-injection (`@Lazy` self-reference) unless propagation/isolation genuinely differs.
- **A wide constructor on a class that's deliberately "one thing backing many endpoints/operations"**
  is often not a real design smell — inventing an artificial grouping object purely to shrink the
  parameter count is the over-engineering CLAUDE.md warns against. `@SuppressWarnings("java:S107")`
  plus a one-line comment explaining the architectural reason is the right call there.
- **`.collect(Collectors.toList())` → `.toList()`** is only safe when the result is never mutated
  afterward (`.toList()` is unmodifiable) — check every call site's downstream usage before a bulk
  replace, don't assume.
- **Root-cause over per-site patching**: if the same nullable-return concern is flagged at several
  call sites of one shared method, fix it once at the source (normalize to an empty/default value
  there) rather than adding a null-check at each flagged call site — it also closes the gap at
  unflagged call sites sharing the same risk.

## Commands

```bash
cd backend
gradlew.bat bootRun                                    # dev server on :8420
gradlew.bat test                                        # full Spock suite
gradlew.bat test --tests "uk.co.stefirby.behaviouralactivation.service.ActivityServiceSpec"
gradlew.bat build                                        # full build
docker compose up -d                                      # local Postgres
```

Always verify your change by running the relevant Spock spec(s), not just by reading the code.
