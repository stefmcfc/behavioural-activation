# Roadmap

Tracks what's shipped, what's specced but not yet built, and internal/maintenance specs that don't
carry a user-facing feature name. This is the live index of spec status — check here before asking
"what's left to build?" instead of re-reading every file under `.claude/specs/`.

**Maintenance rule**: update this file in the same change that creates, advances, or completes a
spec — not as a separate pass:
- **New spec written** (`ears-spec` skill): add a row to **Specced, coming soon**.
- **Spec's acceptance criteria progress**: update that row's `Status`.
- **Spec fully implemented** (every AC checked): move its row from **Specced, coming soon** to
  **Delivered**, and add the corresponding entry to `CHANGELOG.md`.

**Row shape**: one row per user-facing **feature**, pairing its backend and frontend specs in the
same row (a backend-only or frontend-only feature leaves the other spec column as `—`). This
project builds one backend spec + its matching frontend spec together as a pair (see `CLAUDE.md`'s
git-workflow "one spec pair in flight at a time" rule) — a single feature row with two spec columns
matches how the work is actually planned and reviewed, rather than splitting one feature across two
disconnected rows.

Last full audit: 2026-08-27 (V1 high-level planning session — spec pair 1 of 3 written).

---

## Delivered

*(none yet)*

## Specced, coming soon

Per the V1 high-level plan (2026-08-27): 3 spec pairs cover all of V1 (Auth → Activity Bank → Week
Planning). Only pair 1 is written so far; pairs 2 and 3 aren't specced yet — not blocked, just not
next in the queue until pair 1 ships (per the "one spec pair in flight at a time" rule).

| Feature | Backend Spec | Frontend Spec | Status |
|---|---|---|---|
| Authentication (seeded user, session login) | [`planner_spec_001_auth.md`](.claude/specs/planner_spec_001_auth.md) | [`frontend_spec_001_login.md`](.claude/specs/frontend_spec_001_login.md) | ⬜ Not started — 16 backend ACs, 12 frontend ACs, all unchecked |
| Activity bank (US-001/002) | not yet written | not yet written | ⬜ Not started — blocked by pair 1 (needs an authenticated principal) |
| Week planning (US-003–009) | not yet written | not yet written | ⬜ Not started — blocked by pairs 1 and 2 |

## Internal / maintenance specs

Pure-refactor or tooling specs with no user-facing feature name — don't force these into the
`Feature | Backend | Frontend` shape above.

*(none yet)*

| Spec | What it does | Status |
|---|---|---|

> **Open design question** (carried over from the process this file's structure was adapted from —
> see `PROCESS_CHANGES.md`): this section is a judgment call, not a settled convention. It's a
> reasonable place for specs that don't fit the feature-row shape, but if it grows past a handful of
> entries, it's worth splitting into its own tracking file instead. Reassess then.
