---
name: ears-spec
description: Draft a new EARS-format feature spec for the Behavioural Activation Planner (backend or frontend) and save it to .claude/specs/. Use when the user asks to spec out a new feature, write requirements for something, or plan work before implementing it.
---

# Writing an EARS-format spec

This project's specs (`.claude/specs/`) all follow EARS (Easy Approach to Requirements Syntax).
Full reference: `.claude/steering/ears_format.md` — read it before drafting if you haven't already
in this session.

## Steps

1. **Confirm scope with the user** if it's not already clear: is this a backend spec
   (Java/Spring/Spock) or frontend spec (React/TS/Vitest)? What does it depend on? Which roadmap
   version does it belong to (V1–V5, see `.claude/steering/product.md`)? Check `.claude/specs/` for
   the next available number in the right sequence (`planner_spec_00N_*` or `frontend_spec_00N_*`).

2. **Ground it in reality, not assumption.** Before writing requirements:
   - Backend: read `.claude/steering/structure.md` and `.claude/steering/tech.md`, and grep the
     actual `backend/src/main/java/...` for related existing classes (once any exist).
   - Frontend: read `.claude/steering/frontend_structure.md` and
     `.claude/steering/frontend_conventions.md`, and check what actually exists under
     `frontend/src/` — most of the target layout in that steering doc isn't built yet early on.
   - Check dependency specs' actual `Status` line and cross-check against the real source.
   - Read `.claude/HIGH_LEVEL_DESIGN.md` for the relevant user story/ies and
     `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` for any architecture decision already made that
     constrains this spec (e.g. AI features go through one provider-agnostic interface, every
     entity carries an owner reference, no message broker).

3. **Write requirements as numbered EARS statements**, grouped into named "Requirement N" sections,
   each with a one-line user story and acceptance criteria using the canonical EARS patterns
   (Ubiquitous, Event-driven, State-driven, Unwanted behaviour, Optional feature). Assign each AC an
   ID in the form `<AREA>-<SPEC-NUMBER>-AC-<NN>` (`PLANNER-005-AC-01`, `FRONTEND-003-AC-02`, ...)
   plus a `[AUTO]`/`[MANUAL]` verification marker — see `.claude/steering/ears_format.md` for the
   full scheme.

4. **Include a cross-reference table** linking to the specific endpoints, types, or specs this one
   depends on or contracts against.

5. **Include TDD test case sketches** (red, before implementation) in the target framework — Spock
   `given/when/then` for backend, Vitest + React Testing Library for frontend — one per major
   acceptance criterion, named after its requirement ID.

6. **End with a flat "Acceptance Criteria Summary" checklist** mirroring every criterion above,
   unchecked (`- [ ]`).

7. **Save** to `.claude/specs/{name}.md` and tell the user what to hand off next — usually the
   `backend-dev` or `frontend-dev` agent to implement it via red/green TDD.

8. **Add a row to `ROADMAP.md`'s "Specced, coming soon" table** for the new spec (every AC starts
   unchecked, so it's outstanding by definition) — feature name, backend spec, frontend spec (or
   `—` if this is one-sided), and status. Note explicitly whether it's blocked by another spec
   already in that table. A pure-refactor/tooling spec with no user-facing feature name goes in the
   "Internal / maintenance specs" section instead.

## What NOT to do

- Don't mark anything as done/implemented in the new spec — it hasn't been built yet, that's the
  point of writing it first.
- Don't invent API contracts that don't match what's actually in
  `backend/src/main/java/uk/co/stefirby/behaviouralactivation/dto/` — check the real DTOs (once
  they exist).
- Don't skip the test case sketches — `backend-dev`/`frontend-dev` rely on them as the starting
  point for TDD.
- Don't relitigate an architecture decision already made in `HIGH_LEVEL_DESIGN_FEEDBACK.md` (e.g.
  adding a message broker, bypassing the `ChatCompletionClient` abstraction for AI calls, skipping
  the owner/user reference on a new entity) without flagging it to the user first.
