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

Last full audit: 2026-09-29 (Week Planning, pair 4 of 4, implemented and verified end-to-end — all
4 V1 spec pairs now delivered; sub-tasks' stale "pending merge" note below corrected, it merged
earlier the same day).

---

## Delivered

| Feature | Backend Spec | Frontend Spec | Status |
|---|---|---|---|
| Authentication (seeded user, session login) | [`planner_spec_001_auth.md`](.claude/specs/planner_spec_001_auth.md) | [`frontend_spec_001_login.md`](.claude/specs/frontend_spec_001_login.md) | ✅ All 16 backend ACs + all 12 frontend ACs verified (2026-09-28, once Docker became available — including AC-15's `SameSite=Lax` cookie, `[MANUAL]`), full login→/auth/me→logout cycle confirmed through a real browser against real Postgres. Two real gaps found and fixed during this pass: `SameSite=Lax` was actually missing (`server.servlet.session.cookie.same-site` had never been set), and the backend's `@SpringBootTest` smoke test failed against a real DB (`UserBootstrapRunner` needs bootstrap credentials; test profile now has safe defaults). Merged to `main` in `0.1.0` (2026-09-28). |
| Activity bank (US-001/002) | [`planner_spec_002_activity_bank.md`](.claude/specs/planner_spec_002_activity_bank.md) | [`frontend_spec_002_activity_bank.md`](.claude/specs/frontend_spec_002_activity_bank.md) | ✅ All 19 backend ACs + all 28 frontend ACs implemented and tested (2026-09-28). Full create→edit→delete cycle verified through a real browser against real Postgres, including the inline delete-confirm (no native `window.confirm()`) and a category change persisting correctly. One real gap found and fixed during this pass: an invalid `category` value returned `500` instead of `400` (`GlobalExceptionHandler` now handles `HttpMessageNotReadableException`). Merged to `main` as PR #2 (`d6440fe`). |
| Split an activity into smaller sub-tasks | [`planner_spec_003_sub_tasks.md`](.claude/specs/planner_spec_003_sub_tasks.md) | [`frontend_spec_003_sub_tasks.md`](.claude/specs/frontend_spec_003_sub_tasks.md) | ✅ All 21 backend ACs + all 22 frontend ACs implemented and tested (2026-09-29, 88 Spock + 66 Vitest tests, 0 regressions). Full expand→add→rename→delete cycle verified through a real browser against real Postgres, including the inline delete-confirm, the inherited read-only category badge, and the "No sub-tasks yet." empty state. Merged to `main` as PR #3, and the `.env`-loading dev-script fix as PR #4 (both 2026-09-29). |
| Week planning (US-003–009) | [`planner_spec_004_week_planning.md`](.claude/specs/planner_spec_004_week_planning.md) | [`frontend_spec_004_week_planning.md`](.claude/specs/frontend_spec_004_week_planning.md) | ✅ All 37 backend ACs + all 40 frontend ACs implemented and tested (2026-09-29, 155 Spock + 98 Vitest tests, 0 regressions; backend built in two passes — core CRUD/view, then completion/carry-forward). Full view→plan(activity or sub-task)→move→complete/undo→carry-forward→remove cycle verified through a real browser against real Postgres, including promoting a bucket item into a slot, the weekend category-balance highlight, and the inline remove-confirm. One real gap found and fixed during this pass: `GET /api/v1/plan` (and move/complete/carry-forward) 500'd with a `LazyInitializationException` on a real persisted occurrence (`open-in-view: false` closes the Hibernate session before the controller reads the lazy `activity`/`subTask` association) — fixed with `Hibernate.initialize()` calls inside `PlanService`'s transactional methods. On `feature/week-planning`, pending merge — not yet on `main`. **This completes V1.** |

## Specced, coming soon

| Feature | Backend Spec | Frontend Spec | Status |
|---|---|---|---|
| Frontend navigation, settings, and category chips | — | [`frontend_spec_005_navigation_and_theme.md`](.claude/specs/frontend_spec_005_navigation_and_theme.md) | Not started — 28 ACs. Frontend-only (tab navigation via `react-router-dom`, light/dark/system theme, per-category chip colour customization with auto-computed text contrast); no backend spec pair — everything is `localStorage` + client-side rendering, nothing added to the `User` entity. |
| Mark activities as repeatable vs one-off | [`planner_spec_006_repeatable_activities.md`](.claude/specs/planner_spec_006_repeatable_activities.md) | [`frontend_spec_006_repeatable_activities.md`](.claude/specs/frontend_spec_006_repeatable_activities.md) | Not started — 18 backend ACs + 14 frontend ACs specced (2026-09-29). Backend adds `repeatable`/`archived` to `Activity`, two new archive/unarchive endpoints, an `includeArchived` filter on `GET /api/v1/activities`, and an auto-archive hook in `PlanService.complete()`. Frontend adds a "Repeatable" checkbox to `ActivityForm`, a "Show archived" toggle + "Unarchive" action to `ActivityBank`, and a regression guard on `AssignActivityPicker`. |

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
