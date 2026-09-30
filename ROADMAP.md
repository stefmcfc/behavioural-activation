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
| Frontend navigation, settings, and category chips | — | [`frontend_spec_005_navigation_and_theme.md`](.claude/specs/frontend_spec_005_navigation_and_theme.md) | ✅ All 28 ACs implemented and tested (2026-09-29, 149 Vitest tests, 0 regressions; `tsc -b --noEmit`/`npm run build` clean). Tab navigation (`react-router-dom`, `/activities`/`/planner`/`/settings`), light/dark/system theme (verified in a real browser: instant apply, persists across a hard reload with no visible flash, System correctly reflects the OS preference), and category chips with user-customizable colours (verified live cross-tab update and reset-to-default) in all three locations (Activity Bank, sub-tasks, weekly planner). Also resolves `frontend_conventions.md`'s long-deferred CSS Modules + theme custom-properties decision for real. Merged to `main` as PR #6. |
| Authentication (seeded user, session login) | [`planner_spec_001_auth.md`](.claude/specs/planner_spec_001_auth.md) | [`frontend_spec_001_login.md`](.claude/specs/frontend_spec_001_login.md) | ✅ All 16 backend ACs + all 12 frontend ACs verified (2026-09-28, once Docker became available — including AC-15's `SameSite=Lax` cookie, `[MANUAL]`), full login→/auth/me→logout cycle confirmed through a real browser against real Postgres. Two real gaps found and fixed during this pass: `SameSite=Lax` was actually missing (`server.servlet.session.cookie.same-site` had never been set), and the backend's `@SpringBootTest` smoke test failed against a real DB (`UserBootstrapRunner` needs bootstrap credentials; test profile now has safe defaults). Merged to `main` in `0.1.0` (2026-09-28). |
| Activity bank (US-001/002) | [`planner_spec_002_activity_bank.md`](.claude/specs/planner_spec_002_activity_bank.md) | [`frontend_spec_002_activity_bank.md`](.claude/specs/frontend_spec_002_activity_bank.md) | ✅ All 19 backend ACs + all 28 frontend ACs implemented and tested (2026-09-28). Full create→edit→delete cycle verified through a real browser against real Postgres, including the inline delete-confirm (no native `window.confirm()`) and a category change persisting correctly. One real gap found and fixed during this pass: an invalid `category` value returned `500` instead of `400` (`GlobalExceptionHandler` now handles `HttpMessageNotReadableException`). Merged to `main` as PR #2 (`d6440fe`). |
| Split an activity into smaller sub-tasks | [`planner_spec_003_sub_tasks.md`](.claude/specs/planner_spec_003_sub_tasks.md) | [`frontend_spec_003_sub_tasks.md`](.claude/specs/frontend_spec_003_sub_tasks.md) | ✅ All 21 backend ACs + all 22 frontend ACs implemented and tested (2026-09-29, 88 Spock + 66 Vitest tests, 0 regressions). Full expand→add→rename→delete cycle verified through a real browser against real Postgres, including the inline delete-confirm, the inherited read-only category badge, and the "No sub-tasks yet." empty state. Merged to `main` as PR #3, and the `.env`-loading dev-script fix as PR #4 (both 2026-09-29). |
| Week planning (US-003–009) | [`planner_spec_004_week_planning.md`](.claude/specs/planner_spec_004_week_planning.md) | [`frontend_spec_004_week_planning.md`](.claude/specs/frontend_spec_004_week_planning.md) | ✅ All 37 backend ACs + all 40 frontend ACs implemented and tested (2026-09-29, 155 Spock + 98 Vitest tests, 0 regressions; backend built in two passes — core CRUD/view, then completion/carry-forward). Full view→plan(activity or sub-task)→move→complete/undo→carry-forward→remove cycle verified through a real browser against real Postgres, including promoting a bucket item into a slot, the weekend category-balance highlight, and the inline remove-confirm. One real gap found and fixed during this pass: `GET /api/v1/plan` (and move/complete/carry-forward) 500'd with a `LazyInitializationException` on a real persisted occurrence (`open-in-view: false` closes the Hibernate session before the controller reads the lazy `activity`/`subTask` association) — fixed with `Hibernate.initialize()` calls inside `PlanService`'s transactional methods. Merged to `main` as PR #5. **This completes V1.** |
| Visual refresh — "Quiet Room" design system | — | [`frontend_spec_007_visual_refresh.md`](.claude/specs/frontend_spec_007_visual_refresh.md) | ✅ All 32 ACs implemented and tested (2026-09-29, 176 Vitest tests, 0 regressions; built in two passes — tokens/typography/global base styles/layout shell, then the per-component restyle; `tsc -b --noEmit`/`npm run build` clean). Replaces the scaffold-era purple accent/unstyled-native-HTML look with the approved Quiet Room + Clear Structure + Soft Focus hybrid (warm sage palette, hairline dividers, pill buttons/chips with soft shadow, tabular numerals, mono day labels). Full real-browser pass across Light and Dark on every screen (Login, Activity Bank, Weekly Planner, Settings) confirmed the palette, shapes, and a visible keyboard focus outline all render correctly. Merged to `main` as PR #7 (`102532e`), version `0.6.0`. |
| Mark activities as repeatable vs one-off | [`planner_spec_006_repeatable_activities.md`](.claude/specs/planner_spec_006_repeatable_activities.md) | [`frontend_spec_006_repeatable_activities.md`](.claude/specs/frontend_spec_006_repeatable_activities.md) | ✅ All 18 backend ACs + all 15 frontend ACs implemented and tested (2026-09-29, 189 Spock + 193 Vitest tests, 0 regressions; backend auto-archive verified with a real-Postgres integration spec for the flush-timing-sensitive "last sub-task" case). `Activity` gains `repeatable`/`archived`, two new archive/unarchive endpoints, an `includeArchived` filter, and an auto-archive hook in `PlanService.complete()`. Frontend adds a "Repeatable" checkbox to `ActivityForm`, a "Show archived" toggle + "(Archived)" indicator + "Unarchive" action to `ActivityBank`, a read-only "Show sub-tasks" view for archived activities (no add/rename/delete), and a regression guard on `AssignActivityPicker`. Full real-browser pass (light + dark) verified create/edit/hide/reveal/unarchive, viewing an archived activity's sub-tasks read-only, and the plan→complete→auto-archive flow; also found and fixed a real bug along the way — native checkbox/radio controls were rendering in the OS's preferred color scheme instead of the app's own selected theme. Merged to `main` as PR #8 (`bbdbe6c`), version `0.7.0`. |
| Occurrence detail card (Weekly Planner "too much noise" batch, 1 of 4) | [`planner_spec_008_occurrence_detail_card.md`](.claude/specs/planner_spec_008_occurrence_detail_card.md) | [`frontend_spec_008_occurrence_detail_card.md`](.claude/specs/frontend_spec_008_occurrence_detail_card.md) | ✅ All 9 backend ACs + all 28 frontend ACs implemented and tested (2026-09-30, real-Postgres integration spec verifying the extended `Hibernate.initialize()` lazy-load fix; 214 Vitest tests, 0 regressions; `tsc -b --noEmit`/`npm run build` clean). Adds `parentActivityName` to `PlannedOccurrenceResponse`; `OccurrenceItem`'s at-rest tile now shows only name/category/completion icon/one-click Complete-Undo, with Move/Move to bucket/Remove/Carry forward relocated into a detail card (opened by activating the name) rendered as a dimmed-overlay modal — closeable by Close, clicking outside, or Escape; today's weekday column is highlighted in the grid when viewing the real current week. A same-day post-implementation UX pass (still pre-merge, AC-23–AC-28) added the modal presentation, a higher-contrast `--border-strong` divider between sibling occurrences sharing a slot, a persistent pill/chip treatment on the name control (was hover-only), and reordered the parent-activity label to precede the sub-task name. Full real-browser pass (light + dark) confirmed all of the above. |

## Specced, coming soon

Check `.claude/SPEC_CANDIDATES.md` for further ideas confirmed worth a spec but not yet written (the
header restructure and button-hierarchy candidates).

| Feature | Backend Spec | Frontend Spec | Status |
|---|---|---|---|
| "Add" opens a picker modal (Weekly Planner UX batch, 2 of 4) | — (frontend-only) | [`frontend_spec_009_add_picker_modal.md`](.claude/specs/frontend_spec_009_add_picker_modal.md) | Not started — 23 frontend ACs specced, none implemented. |
| Weekend bucket drag-and-drop reordering (Weekly Planner UX batch, 3a of 4) | [`planner_spec_010_bucket_reordering.md`](.claude/specs/planner_spec_010_bucket_reordering.md) | [`frontend_spec_010_bucket_reordering.md`](.claude/specs/frontend_spec_010_bucket_reordering.md) | Not started — 16 backend ACs + 16 frontend ACs specced, none implemented. New `bucketPosition` field + migration; drag-and-drop with a keyboard-accessible up/down fallback. |
| Automatic carry-forward for incomplete bucket items (Weekly Planner UX batch, 3b of 4) | [`planner_spec_011_bucket_carry_forward_automation.md`](.claude/specs/planner_spec_011_bucket_carry_forward_automation.md) | [`frontend_spec_011_bucket_carry_forward_automation.md`](.claude/specs/frontend_spec_011_bucket_carry_forward_automation.md) | Not started — 16 backend ACs + 5 frontend ACs specced, none implemented. Introduces this backend's first injectable `Clock` bean and a silent migrate-on-fetch side effect on `GET /api/v1/plan`. |
| Weekly grid orientation toggle (Settings) | — (frontend-only) | [`frontend_spec_012_grid_orientation_toggle.md`](.claude/specs/frontend_spec_012_grid_orientation_toggle.md) | Not started — 13 frontend ACs specced, none implemented. Pure client-side `localStorage` preference (mirrors the theme-preference mechanism); adds a day-rows layout alongside the existing day-columns default, and directly amends `frontend_spec_008_occurrence_detail_card.md`'s `FRONTEND-008-AC-18`–`AC-20` today-highlight wording to hold for both orientations. |

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
