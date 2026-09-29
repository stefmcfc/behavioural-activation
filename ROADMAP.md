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

Last full audit: 2026-09-29 (sub-tasks specced as pair 3 of 4, inserted before Week Planning; spec
pair 1 was fully verified against a real Docker/Postgres environment for the first time on
2026-09-28 — see status note below).

---

## Delivered

| Feature | Backend Spec | Frontend Spec | Status |
|---|---|---|---|
| Authentication (seeded user, session login) | [`planner_spec_001_auth.md`](.claude/specs/planner_spec_001_auth.md) | [`frontend_spec_001_login.md`](.claude/specs/frontend_spec_001_login.md) | ✅ All 16 backend ACs + all 12 frontend ACs verified (2026-09-28, once Docker became available — including AC-15's `SameSite=Lax` cookie, `[MANUAL]`), full login→/auth/me→logout cycle confirmed through a real browser against real Postgres. Two real gaps found and fixed during this pass: `SameSite=Lax` was actually missing (`server.servlet.session.cookie.same-site` had never been set), and the backend's `@SpringBootTest` smoke test failed against a real DB (`UserBootstrapRunner` needs bootstrap credentials; test profile now has safe defaults). Merged to `main` in `0.1.0` (2026-09-28). |
| Activity bank (US-001/002) | [`planner_spec_002_activity_bank.md`](.claude/specs/planner_spec_002_activity_bank.md) | [`frontend_spec_002_activity_bank.md`](.claude/specs/frontend_spec_002_activity_bank.md) | ✅ All 19 backend ACs + all 28 frontend ACs implemented and tested (2026-09-28). Full create→edit→delete cycle verified through a real browser against real Postgres, including the inline delete-confirm (no native `window.confirm()`) and a category change persisting correctly. One real gap found and fixed during this pass: an invalid `category` value returned `500` instead of `400` (`GlobalExceptionHandler` now handles `HttpMessageNotReadableException`). Merged to `main` as PR #2 (`d6440fe`). |

## Specced, coming soon

Per the V1 high-level plan (2026-08-27), since revised: 4 spec pairs now cover V1 (Auth → Activity
Bank → Sub-tasks → Week Planning) — sub-tasks was inserted as pair 3 on 2026-09-29 (raised in
`future_ideas.md` after Activity Bank shipped), shifting Week Planning to pair 4. Pairs 1 and 2 are
delivered, both merged to `main`. Pair 3 (sub-tasks) is specced and next up, per the "one spec pair
in flight at a time" rule; pair 4 (Week Planning) isn't specced yet.

| Feature | Backend Spec | Frontend Spec | Status |
|---|---|---|---|
| Split an activity into smaller sub-tasks | [`planner_spec_003_sub_tasks.md`](.claude/specs/planner_spec_003_sub_tasks.md) | [`frontend_spec_003_sub_tasks.md`](.claude/specs/frontend_spec_003_sub_tasks.md) | ⬜ Not started |
| Week planning (US-003–009) | not yet written | not yet written | ⬜ Not started — blocked by pairs 1–3 |

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
