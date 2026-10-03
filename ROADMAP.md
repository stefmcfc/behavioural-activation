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

**Status column stays to one line** — a terse "what shipped" summary, not a development diary. Test
counts, real findings, verification notes, and design-decision narrative belong in the spec file's
own `Status` header (see `.claude/steering/ears_format.md`), which the row's link already points to
— don't duplicate that detail here. This file's job is a glanceable index, not an archive.

Last full audit: 2026-10-01 (trimmed every row to one line; full narrative detail lives in each
spec's own `Status` header instead of being duplicated here — see `tooling_spec_002` for the
spec-tidying effort this came out of).

---

## Delivered

| Feature | Backend Spec | Frontend Spec | Status |
|---|---|---|---|
| Frontend navigation, settings, and category chips | — | [`frontend_spec_005_navigation_and_theme.md`](.claude/specs/frontend_spec_005_navigation_and_theme.md) | ✅ Implemented (2026-09-29). Tab navigation, light/dark/system theme, customizable category chips. |
| Authentication (seeded user, session login) | [`planner_spec_001_auth.md`](.claude/specs/planner_spec_001_auth.md) | [`frontend_spec_001_login.md`](.claude/specs/frontend_spec_001_login.md) | ✅ Implemented (2026-09-28), v0.1.0. |
| Activity bank (US-001/002) | [`planner_spec_002_activity_bank.md`](.claude/specs/planner_spec_002_activity_bank.md) | [`frontend_spec_002_activity_bank.md`](.claude/specs/frontend_spec_002_activity_bank.md) | ✅ Implemented (2026-09-28). Create/edit/delete activities with a category. |
| Split an activity into smaller sub-tasks | [`planner_spec_003_sub_tasks.md`](.claude/specs/planner_spec_003_sub_tasks.md) | [`frontend_spec_003_sub_tasks.md`](.claude/specs/frontend_spec_003_sub_tasks.md) | ✅ Implemented (2026-09-29). |
| Week planning (US-003–009) | [`planner_spec_004_week_planning.md`](.claude/specs/planner_spec_004_week_planning.md) | [`frontend_spec_004_week_planning.md`](.claude/specs/frontend_spec_004_week_planning.md) | ✅ Implemented (2026-09-29). Weekly grid + weekend bucket, plan/complete/undo/carry-forward. **Completes V1.** |
| Visual refresh — "Quiet Room" design system | — | [`frontend_spec_007_visual_refresh.md`](.claude/specs/frontend_spec_007_visual_refresh.md) | ✅ Implemented (2026-09-29), v0.6.0. |
| Mark activities as repeatable vs one-off | [`planner_spec_006_repeatable_activities.md`](.claude/specs/planner_spec_006_repeatable_activities.md) | [`frontend_spec_006_repeatable_activities.md`](.claude/specs/frontend_spec_006_repeatable_activities.md) | ✅ Implemented (2026-09-29), v0.7.0. Repeatable vs one-off, auto-archive on completion. |
| Occurrence detail card (Weekly Planner "too much noise" batch, 1 of 4) | [`planner_spec_008_occurrence_detail_card.md`](.claude/specs/planner_spec_008_occurrence_detail_card.md) | [`frontend_spec_008_occurrence_detail_card.md`](.claude/specs/frontend_spec_008_occurrence_detail_card.md) | ✅ Implemented (2026-09-30). Decluttered grid tiles; actions moved into a detail card. |
| "Add" opens a picker modal (Weekly Planner UX batch, 2 of 4) | — (frontend-only) | [`frontend_spec_009_add_picker_modal.md`](.claude/specs/frontend_spec_009_add_picker_modal.md) | ✅ Implemented (2026-09-30). First `Modal` primitive; `AssignActivityPicker` relocated into it. |
| Add/Edit activity modal with category guidance + Add/Rename sub-task modal (Activity Bank UX batch) | — (frontend-only) | [`frontend_spec_013_add_activity_modal.md`](.claude/specs/frontend_spec_013_add_activity_modal.md) + [`frontend_spec_014_add_subtask_modal.md`](.claude/specs/frontend_spec_014_add_subtask_modal.md) | ✅ Implemented (2026-09-30). Activity/sub-task forms relocated into modals. |
| Activity Bank category filter | — (frontend-only) | [`frontend_spec_017_activity_bank_category_filter.md`](.claude/specs/frontend_spec_017_activity_bank_category_filter.md) | ✅ Implemented (2026-10-01). |
| Repeatable-activity icon (Activity Bank rows) | — (frontend-only) | [`frontend_spec_019_repeatable_activity_icon.md`](.claude/specs/frontend_spec_019_repeatable_activity_icon.md) | ✅ Implemented (2026-10-01). |
| Repeatable icon in the Add/Edit activity modal | — (frontend-only) | [`frontend_spec_020_repeatable_icon_in_activity_form.md`](.claude/specs/frontend_spec_020_repeatable_icon_in_activity_form.md) | ✅ Implemented (2026-10-01). |
| Repeatable icon in the weekend bucket list | [`planner_spec_013_repeatable_on_occurrence.md`](.claude/specs/planner_spec_013_repeatable_on_occurrence.md) | [`frontend_spec_021_repeatable_icon_in_bucket_list.md`](.claude/specs/frontend_spec_021_repeatable_icon_in_bucket_list.md) | ✅ Implemented (2026-10-01). Bucket items only, not grid cells. |
| Repeatable icon in the Assign Activity Picker | — (frontend-only) | [`frontend_spec_022_repeatable_icon_in_assign_picker.md`](.claude/specs/frontend_spec_022_repeatable_icon_in_assign_picker.md) | ✅ Implemented (2026-10-01). Activity rows only, not sub-task rows. |
| Sub-task count on the "Show sub-tasks" CTA | [`planner_spec_012_subtask_count.md`](.claude/specs/planner_spec_012_subtask_count.md) | [`frontend_spec_018_subtask_count_badge.md`](.claude/specs/frontend_spec_018_subtask_count_badge.md) | ✅ Implemented (2026-10-01). Count shown in the toggle label itself, not a separate badge. |
| Cascade an activity's category change to its sub-tasks (bug fix) | [`planner_spec_014_subtask_category_cascade.md`](.claude/specs/planner_spec_014_subtask_category_cascade.md) | — (backend-only) | ✅ Implemented (2026-10-01), v0.14.1. |
| Refresh an open sub-task panel after editing its activity (bug fix) | — (frontend-only) | [`frontend_spec_023_subtask_panel_refresh_on_edit.md`](.claude/specs/frontend_spec_023_subtask_panel_refresh_on_edit.md) | ✅ Implemented (2026-10-01), v0.14.1. |
| Weekday/Weekend grid tabs (bug fix) | — (frontend-only) | [`frontend_spec_015_weekday_weekend_grid_tabs.md`](.claude/specs/frontend_spec_015_weekday_weekend_grid_tabs.md) | ✅ Implemented (2026-10-01), v0.15.0. Fixes weekend occurrences being invisible in the grid; `PlannerGrid` generalized to a `days` prop. |
| Weekly Planner header/spacing polish (bug fix) | — (frontend-only) | [`frontend_spec_024_weekly_planner_header_polish.md`](.claude/specs/frontend_spec_024_weekly_planner_header_polish.md) | ✅ Implemented (2026-10-01), v0.15.0. Locale-aware "Week Commencing" date, chevron nav buttons, grid/bucket-list spacing, day-of-month numbers on column headers. |
| Weekend bucket drag-and-drop reordering (Weekly Planner UX batch, 3a of 4) | [`planner_spec_010_bucket_reordering.md`](.claude/specs/planner_spec_010_bucket_reordering.md) | [`frontend_spec_010_bucket_reordering.md`](.claude/specs/frontend_spec_010_bucket_reordering.md) | ✅ Implemented (2026-10-01), v0.16.0. New `bucketPosition` field; drag-and-drop + keyboard-accessible Move up/down. |
| Automatic carry-forward for incomplete bucket items (Weekly Planner UX batch, 3b of 4) | [`planner_spec_011_bucket_carry_forward_automation.md`](.claude/specs/planner_spec_011_bucket_carry_forward_automation.md) | [`frontend_spec_011_bucket_carry_forward_automation.md`](.claude/specs/frontend_spec_011_bucket_carry_forward_automation.md) | ✅ Implemented (2026-10-01). First injectable `Clock` bean; stale bucket items auto-migrate to the current week with a "Moved from last week" label. |
| Drag a grid occurrence to a different slot (Weekly Planner) | — (frontend-only) | [`frontend_spec_025_grid_drag_to_move.md`](.claude/specs/frontend_spec_025_grid_drag_to_move.md) | ✅ Implemented (2026-10-02). Mouse-only drag-to-move within the currently visible grid, supplementing Rearrange; verified end-to-end in a real browser. |
| Drag-and-drop between the grid and the weekend bucket list | — (frontend-only) | [`frontend_spec_026_grid_bucket_cross_drag.md`](.claude/specs/frontend_spec_026_grid_bucket_cross_drag.md) | ✅ Implemented (2026-10-02). Drag a grid occurrence onto the bucket to demote it, or a bucket item onto a grid cell to promote it; shared drag state lifted to `WeeklyPlanner.tsx`; verified end-to-end in a real browser. |
| Favourite activities | [`planner_spec_015_favourite_activities.md`](.claude/specs/planner_spec_015_favourite_activities.md) | [`frontend_spec_027_favourite_activities.md`](.claude/specs/frontend_spec_027_favourite_activities.md) | ✅ Implemented (2026-10-02). Manual star toggle mirroring the existing `archived` pattern; favourites pinned to the top plus a "Favourites only" filter (styled like "Show archived") in both the Activity Bank and AssignActivityPicker. |
| Graceful session expiry handling | [`planner_spec_016_configurable_session_timeout.md`](.claude/specs/planner_spec_016_configurable_session_timeout.md) | [`frontend_spec_029_session_expiry_handling.md`](.claude/specs/frontend_spec_029_session_expiry_handling.md) | ✅ Implemented (2026-10-02). A global 401 handler bounces an expired session to the login screen with a clear message, instead of a broken "Retry" loop; session timeout now configurable via `SESSION_TIMEOUT` (default unchanged, 30m). Found in real use; verified end-to-end in a real browser. |
| Activity drawer — drag an unplanned activity onto the grid/bucket | — (frontend-only) | [`frontend_spec_028_activity_drawer.md`](.claude/specs/frontend_spec_028_activity_drawer.md) | ⚠️ Partially reverted (2026-10-02). Removed from the Weekly Planner after real-use feedback found it unusable (no drag affordance, grid squeezed illegible, bucket list unreachable mid-drag — native DnD can't auto-scroll). Reusable plumbing (`ActivityPickerList` drag mode, `DragPayload`) kept intact for `frontend_spec_016`'s Today view, which now specs its reintroduction. See that spec's "Post-ship correction" section. |
| Today view (top-level nav tab + reintroduced activity drawer) | — (frontend-only) | [`frontend_spec_016_today_view.md`](.claude/specs/frontend_spec_016_today_view.md) | ✅ Implemented (2026-10-02). New "Today" tab/route showing a single-day grid + bucket list for the real current day, sharing a new `usePlanActions` hook with `WeeklyPlanner`. Reintroduces `frontend_spec_028`'s activity drawer with a real drag affordance this time; the drawer now stretches to match the bucket list's bottom edge, and bucket-list clearance is guaranteed with real margin to spare (both confirmed in a real browser). |
| Header restructure — Settings/Account icons, tabs demoted to a second row | — (frontend-only) | [`frontend_spec_030_header_restructure.md`](.claude/specs/frontend_spec_030_header_restructure.md) | ✅ Implemented (2026-10-02). Native Popover API + CSS anchor positioning for both menus, no custom JS; trigger icon highlights while its own popover is open; verified end-to-end in a real browser. |
| Frontend button visual hierarchy (primary/destructive) | — (frontend-only) | [`frontend_spec_031_button_hierarchy.md`](.claude/specs/frontend_spec_031_button_hierarchy.md) | ✅ Implemented (2026-10-02). New `primary`/`destructive` CSS Module variant classes applied to each screen's headline action and the Activity/Sub-task delete flows; everything else keeps today's uniform treatment; contrast verified ≥4.5:1 in both themes in a real browser. |
| Collapsible filters in the activity picker | — (frontend-only) | [`frontend_spec_032_collapsible_filters.md`](.claude/specs/frontend_spec_032_collapsible_filters.md) | ✅ Implemented (2026-10-02). One `<details>`/`<summary>` disclosure wrapping all three filters (category/type/favourite), closed by default, in `ActivityPickerList` — fixes both the Weekly Planner's Add modal and Today's Browse activities drawer at once; verified in a real browser. |
| Weekly grid orientation toggle (Settings) | — (frontend-only) | [`frontend_spec_012_grid_orientation_toggle.md`](.claude/specs/frontend_spec_012_grid_orientation_toggle.md) | ✅ Implemented (2026-10-03). New `utils/gridOrientation.ts` + Settings fieldset for an alternate "each day as its own section" `PlannerGrid` layout, read via `useState(() => getGridOrientation())` with no `main.tsx` change; today-highlight shared across both orientations; verified in a real browser in both Light and Dark. |
| Live-update the grid-orientation preference across the Settings popover boundary (bug fix, found verifying `frontend_spec_012`) | — (frontend-only) | [`frontend_spec_034_grid_orientation_live_update.md`](.claude/specs/frontend_spec_034_grid_orientation_live_update.md) | ✅ Implemented (2026-10-03). `utils/gridOrientation.ts` now dispatches a `CustomEvent` on change (mirroring `categoryColors.ts`); `PlannerGrid` subscribes on mount and unsubscribes on unmount, so the Settings popover's layout toggle applies live, no reload/remount needed. |
| Filter the Weekly Planner by category and completion status | — (frontend-only) | [`frontend_spec_035_weekly_planner_filter.md`](.claude/specs/frontend_spec_035_weekly_planner_filter.md) | ✅ Implemented (2026-10-03), AC-10 (real-browser check) pending. One shared `<details>`/`<summary>` "Filters" disclosure (category + status) dims, rather than hides, non-matching occurrences in both the grid and bucket list via a new `dimmedOccurrenceIds` prop threaded to `OccurrenceItem`. |
| Weekly Summary tab | — (frontend-only) | [`frontend_spec_036_weekly_summary.md`](.claude/specs/frontend_spec_036_weekly_summary.md) | ✅ Implemented (2026-10-03), v0.30.0. New "Summary" tab/route with its own independent week navigation (via a new shared `WeekNav` component extracted from `WeeklyPlanner`); planned/completed totals + completion rate, per-category breakdown, and scheduled-vs-bucket split computed client-side from `planApi.getWeek`; verified in a real browser in both themes. |

## Specced, coming soon

Check `.claude/SPEC_CANDIDATES.md` for further ideas confirmed worth a spec but not yet written.

| Feature | Backend Spec | Frontend Spec | Status |
|---|---|---|---|
| Weekly Summary visual refinements (segmented completion bar, lite grid/bucket view, location × category breakdown chart) | — (frontend-only) | [`frontend_spec_037_weekly_summary_visualizations.md`](.claude/specs/frontend_spec_037_weekly_summary_visualizations.md) | Not started. Colourblind-conscious: status (completed/not) is an opacity modulation of each occurrence's own category colour, never a new red/green hue; category identity in the breakdown chart never relies on hue alone since category colours are user-customizable and not guaranteed distinct. |

## Internal / maintenance specs

Pure-refactor or tooling specs with no user-facing feature name — don't force these into the
`Feature | Backend | Frontend` shape above.

| Spec | What it does | Status |
|---|---|---|
| [`tooling_spec_001_unmapped_route_404.md`](.claude/specs/tooling_spec_001_unmapped_route_404.md) | Unmapped routes return 404 instead of the generic 500 catch-all. | ✅ Implemented. |
| [`tooling_spec_003_modern_web_guidance_fixes.md`](.claude/specs/tooling_spec_003_modern_web_guidance_fixes.md) | Native required-field validation timing (Login/Activity/Sub-task forms), `Modal` dialog `closedby="any"` light-dismiss, `index.html` color-scheme meta tag — from the `modern-web-guidance` review. | ✅ Implemented. |
| [`planner_spec_017_plan_response_n_plus_one.md`](.claude/specs/planner_spec_017_plan_response_n_plus_one.md) | `JOIN FETCH` on `GET /api/v1/plan`'s and the bucket-reorder endpoint's occurrence queries, eliminating up to 2 lazy-load SELECTs per occurrence (no API contract change). | ✅ Implemented (2026-10-02). Measured via Hibernate statistics: `GET /api/v1/plan` now issues a flat query count regardless of occurrence count (previously scaled linearly). Bucket-reorder endpoint improved but not yet fully constant — completed by `planner_spec_019`. |
| [`planner_spec_018_bulk_sub_task_fetch.md`](.claude/specs/planner_spec_018_bulk_sub_task_fetch.md) + [`frontend_spec_033_bulk_sub_task_fetch.md`](.claude/specs/frontend_spec_033_bulk_sub_task_fetch.md) | New `GET /api/v1/sub-tasks` bulk endpoint, fixing two separate N+1s: `ActivityPickerList.tsx`'s per-activity sub-task fetch, and `ActivityService.listForOwner`'s per-activity sub-task-count query. | ✅ Implemented (2026-10-03). `ActivityPickerList.tsx` now issues a constant 2 requests regardless of activity count (was `1 + N`); `GET /api/v1/activities` issues a constant query count regardless of activity count, confirmed via Hibernate statistics. |
| [`planner_spec_019_bucket_reorder_query_scaling.md`](.claude/specs/planner_spec_019_bucket_reorder_query_scaling.md) | Finishes `planner_spec_017`'s bucket-reorder fix: a new bulk `findByIdInAndOwner` query replaces `PlanService.reorderBucket`'s remaining per-submitted-id lookup loop, with both existing 409 checks and the exact submitted-order guarantee preserved. | ✅ Implemented (2026-10-02). Measured via Hibernate statistics: raw prepared-statement count is `3 + N` (3 constant reads, N necessary position-assignment UPDATEs) — the constant read count no longer scales with submitted-item count. |

> **Open design question** (carried over from the process this file's structure was adapted from —
> see `PROCESS_CHANGES.md`): this section is a judgment call, not a settled convention. It's a
> reasonable place for specs that don't fit the feature-row shape, but if it grows past a handful of
> entries, it's worth splitting into its own tracking file instead. Reassess then.
