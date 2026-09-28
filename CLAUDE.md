# Behavioural Activation Planner

A personal Behavioural Activation (BA) planner for building an activity bank, planning structured
weekdays and a flexible weekend bucket list, and recording completion/mood — with AI-assisted
suggestions planned for a later version. See `.claude/HIGH_LEVEL_DESIGN.md` for the full product
outline, roadmap, and user stories, and `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` for the
architecture/feasibility decisions already made.

**Status: scaffolded, no domain code yet.** Steering, agents, skills, and the backend/frontend
scaffolds are set up; no real feature (controller, entity, component) exists yet. Treat every
`(target)`/not-yet-built note in `.claude/steering/*.md` as exactly that — check the real source if
these docs drift.

## Hard rules

These are hard rules, not suggestions — follow them even if training data or habit suggests
otherwise.

- **Java 25 (LTS) only.** Never bump the Gradle toolchain to a non-LTS Java version in this repo.
- **Every domain entity carries a `User` owner reference from V1**, and **real Spring Security auth
  is in place from V1**, even for a single account. These are the multi-user-readiness seams — see
  `.claude/steering/structure.md` and `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7a for why they're
  not deferred.
- **AI features (V3+) go through one `ChatCompletionClient` interface**, one OpenAI-wire-format
  HTTP implementation, provider/key/base-URL chosen per environment via config. No bespoke
  per-provider integration, no local-inference-serving code built ahead of a concrete need — see
  `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7b.
- **No message broker.** Explicitly rejected as over-engineering for this app's scale — see
  `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §5.
- **AI never diagnoses, never claims to provide therapy, and every AI suggestion requires user
  approval before it becomes an active plan.** Non-negotiable product/safety constraint — see
  `.claude/steering/product.md`.
- **All frontend backend calls go through `frontend/src/services/*Api.ts`.** No raw
  `axios`/`fetch` calls in components, ever.
- **Backend business logic lives in `service/`.** Controllers stay thin and delegate; repositories
  stay plain `JpaRepository` extensions with no custom queries unless there's a real
  complexity/scale reason.
- **Types are centralized** in `frontend/src/types/` (backend: the `dto/` package). Don't
  redeclare or duplicate a shape inline in a component or controller.
- **Spec first.** Write or update the relevant `.claude/specs/` EARS spec before implementing a new
  requirement — see `.claude/steering/ears_format.md` and the `ears-spec` skill. Exception: a
  one-off, no-behavior-change quality/maintenance pass doesn't need a spec.
- **Never commit secrets.** No `.env`, API keys, or credentials — see `.claude/steering/tech.md`.
- **Only `gradlew.bat` (Windows) is checked in** for the Gradle wrapper. Don't add a Unix `gradlew`
  script unless asked.
- **No Lombok.** Plain Java — records, explicit constructors/getters.
- **Spock (Groovy), not JUnit/Mockito, for backend tests.**

## Current status

`.claude/agents/`, `.claude/skills/`, and `.claude/steering/` are set up (2026-08-27), adapted from
a mature reference project's process. Backend (Spring Boot 4.1.1 + Java 25 + Postgres/Flyway/
Security/Validation deps + Spock testing) and frontend (React 19 + TS + Vite + Vitest/RTL) are
scaffolded — see `.claude/steering/structure.md` for exactly what's `(built)` vs. still target.
Spec pair 1 of 3 for V1 (authentication — `planner_spec_001_auth.md`/`frontend_spec_001_login.md`)
is implemented on `feature/auth`, not yet merged to `main` — see `ROADMAP.md`. Backend and frontend
dev servers run on static, non-default ports (`8420`/`4321`, not Spring Boot's/Vite's `8080`/`5173`
defaults) — see `.claude/steering/tech.md`'s "Local ports" section. `README.md` and `RUNBOOK.md`
now exist (2026-09-28). Docker Desktop's CLI is installed on this machine but the daemon isn't
always running — `docker compose up`/`gradlew.bat test`/`gradlew.bat bootRun` still need it started
manually first. CI is not yet set up.

## Tech stack (see `.claude/steering/tech.md` for full detail and rationale)

| Layer | Technology |
|-------|-----------|
| Backend | Java 25 toolchain, Spring Boot 4.1.x |
| Frontend | TypeScript, React 19, Vite |
| Database | PostgreSQL (dev via Docker Compose, matches self-hosted deployment target) |
| ORM | Spring Data JPA + Hibernate |
| Migrations | Flyway |
| Auth | Spring Security, from V1 |
| Build (backend) | Gradle (wrapper, Windows `gradlew.bat` only, once added) |
| Build (frontend) | Vite, npm |
| Tests (backend) | Spock (Groovy) |
| Tests (frontend) | Vitest, React Testing Library |
| AI (V3+) | One `ChatCompletionClient` interface, OpenAI-compatible wire format, provider via config |
| Hosting | Docker Compose + Tailscale (self-hosted) now; Fly.io/Railway if/when needed |

## Deep-dive references

Read these when working in the relevant area — don't duplicate their content here:

- `.claude/HIGH_LEVEL_DESIGN.md` — product outline, planning model, full V1–V5 roadmap, user
  stories and acceptance criteria
- `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` — feasibility review and the architecture decisions it
  settled (frontend+backend split, Postgres, no message broker, multi-user seams, AI provider
  abstraction, staged hosting plan)
- `.claude/steering/product.md` — what the app does, who it's for, goals/non-goals
- `.claude/steering/tech.md` — full tech stack detail and rationale
- `.claude/steering/structure.md` — backend package layout, naming conventions, multi-user seams
- `.claude/steering/frontend_structure.md` — frontend directory layout and target component
  structure
- `.claude/steering/frontend_conventions.md` — frontend coding conventions (typing, API layer,
  styling, testing)
- `.claude/steering/ears_format.md` — the EARS requirement format all specs use
- `.claude/specs/` — feature specs (empty until the first spec is written)
- `ROADMAP.md` — live index of what's delivered, what's specced but not yet built, and internal/
  maintenance specs. Check this before asking "what's left to build?" instead of re-reading all
  specs.
- `API.md` — endpoint reference, grouped by area. Update in the same change as any endpoint
  add/change/delete.
- `RUNBOOK.md` — local setup, ports, environment variables, running tests, troubleshooting.
- `README.md` — general project overview; points at the files above rather than duplicating them.
- `.claude/SPEC_CANDIDATES.md` — ideas confirmed worth a real spec eventually, not yet written.
- `.claude/ideas/future_ideas.md` — genuinely speculative/deferred ideas, one level earlier than a
  spec candidate.

## Working conventions

- Specs are written in EARS format (`.claude/steering/ears_format.md`) with acceptance criteria and
  red/green TDD test cases. When adding a feature, write or update a spec in `.claude/specs/` first.
- **The idea pipeline**: `.claude/ideas/future_ideas.md` (raw, unconfirmed) →
  `.claude/SPEC_CANDIDATES.md` (confirmed worth a spec, not yet written) → a real spec exists,
  tracked in `ROADMAP.md`'s "Specced, coming soon" table → implemented, row moves to "Delivered" →
  `CHANGELOG.md` (shipped). An idea moves out of one file and into the next as it progresses —
  never leave the same idea duplicated across two of these at once. Before adding to or editing any
  of the three tracking files, re-check what it references against the current codebase — referenced
  classes/components can move (e.g. during a refactor) without the tracking file being updated.
  **Edits to `future_ideas.md`/`SPEC_CANDIDATES.md` alone (no other files changed) need no git
  ceremony** — not a branch+PR, not even a direct commit to `main`. Leave the edit sitting
  uncommitted; it rides along into whatever the next real feature branch commits, and mention it in
  chat so the state is visible even without a commit to point at. This is narrower than the rest of
  this section and the git-workflow rules below — those still apply as normal to real specs, code,
  and `ROADMAP.md`/`CHANGELOG.md` updates tied to a shipped feature.
- **Keep `ROADMAP.md` current.** Writing a new spec adds a row to "Specced, coming soon"; checking
  off an AC updates that row's status; a spec whose every AC is checked moves its row to
  "Delivered" (with a matching `CHANGELOG.md` entry). Do this as part of the same change that
  created/altered/completed the spec. Endpoint changes get the same treatment in `API.md`.
- Backend: business logic in `service/`, controllers stay thin, repositories are plain
  `JpaRepository` extensions. Tests are Spock specs colocated under `src/test/groovy/`, one
  `*Spec.groovy` per class under test.
- Frontend: all backend calls go through `frontend/src/services/*Api.ts` — no raw `axios`/`fetch`
  calls in components. Types live in `frontend/src/types/`. Components are typed function
  components; tests are colocated `*.test.tsx`/`*.test.ts` files run with Vitest.
- Use the `backend-dev` and `frontend-dev` subagents (`.claude/agents/`) for implementation work in
  their respective areas, and the `ears-spec` skill when drafting a new spec.

## Commit style

**Conventional Commits** for every commit message: `<type>(<scope>): <description>` — types `feat`,
`fix`, `docs`, `test`, `refactor`, `build`, `chore`; scope is the area touched where one applies
(e.g. `feat(planner): add weekly grid endpoint`, `docs(specs): add activity spec`).

## Versioning & changelog

The app is versioned as one unit with [Semantic Versioning](https://semver.org/):
`backend/build.gradle.kts` (`version`) and `frontend/package.json` (`"version"`) are kept in sync —
both currently `0.1.0-SNAPSHOT`. Every notable change is recorded in `CHANGELOG.md`
([Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, per this machine's global
versioning defaults).

- Add an entry under `## [Unreleased]` in `CHANGELOG.md` as part of the same PR that ships a
  user-facing feature or fix — not retroactively.
- **Keep entries small and granular.** One bullet per discrete, independently-describable change.
- When cutting a release (merging to `main`), move `[Unreleased]` into a dated
  `## [x.y.z] - YYYY-MM-DD` section and bump both version fields together: **major** for breaking
  API/data changes, **minor** for new features, **patch** for fixes/chores with no behavior change.

## Git workflow

- **One backend spec + its corresponding frontend spec in flight at a time.** Don't start a new
  spec's branch while an earlier spec pair is still open, to avoid orphaned sibling/child PRs on a
  squash-merge (this bit the reference project this process was adapted from — a single-pair-at-a-
  time flow avoids it entirely).
- **Branch naming**: `feature/<slug>` for new work, `fix/<slug>` for bug fixes.
- **Commit before starting the next spec.** Before beginning implementation on a new spec, run
  `git status` — if it shows uncommitted changes from a previously *completed* spec, commit and
  push that work first rather than starting the next one on top of it.
- **Push and PR are pre-authorized** once a unit of work is done and its tests pass — push the
  branch and open the PR (`gh pr create`) without asking each time.
- **Merging to `main` always needs a check-in first** — never merge without the user's explicit
  go-ahead in that instance, even if the PR is green.
- **Before that check-in, release hygiene must already be done, not deferred to "after merge."**
  This is **two separate checks, not one** — treating the first as satisfying the second is how this
  has failed in the reference project this process was adapted from:
  1. **Did this PR add a `CHANGELOG.md` entry under `[Unreleased]` for its own change?** (Plus
     `API.md`/`README.md`/`RUNBOOK.md`/`ROADMAP.md` if it touches endpoints, features, config, or how
     the project is run/verified — see the Definition of Done checklist.)
  2. **Separately, immediately before running `gh pr merge`: is `[Unreleased]` on `main` (i.e.
     including this PR's about-to-land entry) now non-empty?** If yes, *this merge* must also cut it
     into a dated `## [x.y.z] - YYYY-MM-DD` section and bump both version fields — right now, as part
     of getting this merge ready, not as a follow-up once it's noticed. Passing check 1 on every PR
     does **not** imply check 2 has been done — re-verify check 2 at every single merge, even several
     in a row in the same session where the first one already got it right.

  Reason this is called out explicitly: in the reference project, 16 merged PRs in a row once landed
  on `main` with CHANGELOG content left sitting in `[Unreleased]` and the version never bumped,
  because "tests are green" was treated as the whole bar — recovering required a dedicated
  archaeology pass to reconstruct dated CHANGELOG sections after the fact. It recurred at smaller
  scale later (one PR correctly cut a release; the next three each added a correct per-PR
  `[Unreleased]` entry without re-cutting at merge time) — narrative instructions alone didn't
  survive a fast run of consecutive merge approvals in one session there, so treat this as a habit to
  build now rather than a problem to notice later once this project has its own CI.
- **Perform the release cut (CHANGELOG section + version bump) as a commit on the feature branch
  itself, before merging — never as a separate follow-up `chore(release)` branch/PR.** A standalone
  release-cut PR touching only `CHANGELOG.md` and the two version fields still pays for a full CI run
  (once this project has one) against a diff with no code in it, for no benefit.
- **Merge strategy**: squash and delete the branch (`gh pr merge --squash --delete-branch`) once
  approved.

## Definition of Done

A unit of work isn't done until:

- Tests pass (`gradlew.bat test` for backend changes, `npm test` + `npm run lint` for frontend
  changes)
- The relevant `.claude/specs/` file's acceptance criteria are checked off (or the spec is created
  first, if this is new work), and `ROADMAP.md`'s matching row is updated to match
- `API.md` is updated if an endpoint was added, changed, or removed
- `README.md` is updated if features, scripts, or configuration changed (not endpoints — those go
  in `API.md`, and roadmap/build-status — that goes in `ROADMAP.md`)
- `RUNBOOK.md` is updated if how the project is run, verified, or troubleshot changed
- For UI work: verified in a real browser, not just Vitest (jsdom doesn't render CSS — see
  `.claude/steering/frontend_conventions.md`)
- For anything touching a new entity or endpoint: confirmed it's scoped to the authenticated
  user/owner, not just implicitly assumed single-user

## When unsure

If a request is ambiguous or a steering doc is silent on it, make a reasonable call, note the
assumption briefly, and keep moving. Stop and check in first only when the decision is
security-relevant (e.g. touches secrets, auth, exposed mood/health data), touches one of the
architecture decisions already settled in `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md`, or crosses into
merging to `main`.

## Commands

See `.claude/steering/tech.md`'s Common Commands section — kept there as the single source, not
duplicated here.
