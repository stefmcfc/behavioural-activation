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

## Specced, coming soon

Check `.claude/SPEC_CANDIDATES.md` for further ideas confirmed worth a spec but not yet written (the
header restructure and button-hierarchy candidates).

| Feature | Backend Spec | Frontend Spec | Status |
|---|---|---|---|
| Weekly grid orientation toggle (Settings) | — (frontend-only) | [`frontend_spec_012_grid_orientation_toggle.md`](.claude/specs/frontend_spec_012_grid_orientation_toggle.md) | Not started. Day-rows layout alongside the existing day-columns default. |
| Today view (top-level nav tab) | — (frontend-only) | [`frontend_spec_016_today_view.md`](.claude/specs/frontend_spec_016_today_view.md) | Not started. New "Today" tab always showing the real current day. Depends on `frontend_spec_015`. |

## Internal / maintenance specs

Pure-refactor or tooling specs with no user-facing feature name — don't force these into the
`Feature | Backend | Frontend` shape above.

| Spec | What it does | Status |
|---|---|---|
| [`tooling_spec_001_unmapped_route_404.md`](.claude/specs/tooling_spec_001_unmapped_route_404.md) | Unmapped routes return 404 instead of the generic 500 catch-all. | ✅ Implemented. |
| [`tooling_spec_003_modern_web_guidance_fixes.md`](.claude/specs/tooling_spec_003_modern_web_guidance_fixes.md) | Native required-field validation timing (Login/Activity/Sub-task forms), `Modal` dialog `closedby="any"` light-dismiss, `index.html` color-scheme meta tag — from the `modern-web-guidance` review. | ✅ Implemented. |

> **Open design question** (carried over from the process this file's structure was adapted from —
> see `PROCESS_CHANGES.md`): this section is a judgment call, not a settled convention. It's a
> reasonable place for specs that don't fit the feature-row shape, but if it grows past a handful of
> entries, it's worth splitting into its own tracking file instead. Reassess then.
