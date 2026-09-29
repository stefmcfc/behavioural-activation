# Spec Candidates

**Pipeline**: `.claude/ideas/future_ideas.md` (raw, unconfirmed ideas) → **this file** (confirmed
worth a real spec eventually, not yet written) → a real spec exists, tracked in `ROADMAP.md`'s
"Specced, coming soon" table → implemented, row moves to "Delivered" → `CHANGELOG.md` (shipped).

A running backlog of ideas confirmed worth a real EARS spec eventually, but not yet written or
scheduled. Distinct from `ROADMAP.md`, which only tracks specs that already exist (written, with
real acceptance criteria) — this file is the layer *before* that.

**Maintenance rule**: when a candidate here actually gets spec'd (via the `ears-spec` skill), move
it out of this file and into `ROADMAP.md`'s "Specced, coming soon" section as part of that same
change — don't leave it duplicated in both places. Before adding a new candidate or touching this
file, re-check existing entries against the current codebase — referenced classes/components may
have moved.

Last updated: 2026-09-29 (frontend styling pass added).

---

## Candidates

## Frontend styling pass

**Status**: Confirmed, not yet specced. Raised 2026-09-29 after noticing the app still renders with
no real styling (login/activity-bank/sub-tasks all shipped against Vite's default `index.css` only
— `.claude/steering/frontend_conventions.md`'s "Styling" section has flagged this as an undecided
placeholder, leaning CSS Modules, since project creation, but the decision was never actually made
or recorded when the first component shipped as that section says it should be).

Explicitly sequenced **after Week Planning (pair 4) ships**, not before — confirmed with the user
2026-09-29: functionality first, one deliberate styling pass afterward rather than restyling
piecemeal as each spec pair lands. When this is picked up: resolve the CSS Modules decision for
real (one `*.module.css` per component, Vite scopes it automatically), introduce shared theme
custom properties (`--text`, `--bg`, `--border`, `--accent`, etc. per `frontend_conventions.md`)
rather than hardcoded hex values so light/dark mode and contrast stay correct, and apply it
retroactively across the existing login, activity bank, and sub-task checklist UI in one pass
rather than only new components going forward.

The V1–V5 roadmap in `.claude/HIGH_LEVEL_DESIGN.md` §3 already lists the major themes and user
stories (US-001 through US-018) with acceptance criteria at the epic level — those are the initial
source of truth for what to spec next, not duplicated here. Use this file for ideas that come up
*during* implementation and are confirmed worth building but don't map cleanly onto an existing
roadmap item (e.g. a UX refinement discovered while building the weekly grid, a cross-cutting
tooling need). Don't pre-populate it from the roadmap — that would just be restating
`HIGH_LEVEL_DESIGN.md`.
