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

Last updated: 2026-10-02 (the header restructure candidate moved to a real spec —
`frontend_spec_030_header_restructure.md`, see `ROADMAP.md`'s "Specced, coming soon" — removed from
this file.)
Earlier note: 2026-10-01, added two candidates from the modern-web-guidance frontend review
— `.claude/modern-web-guidance/reviews/review-2026-10-01.md` — touch-friendly bucket reordering
and a bulk sub-task fetch endpoint; see entries below.)
Earlier note: 2026-10-01, Activity Bank UX improvements batch fully resolved: category filter and
plain sub-task count specced directly to `ROADMAP.md` — `frontend_spec_017`,
`planner_spec_012`/`frontend_spec_018` — and the "2/3 done" progress variant added here as a new
candidate, blocked on a product decision about what "done" means for a sub-task; see that entry.
Earlier note: 2026-09-30, Weekday/Weekend grid tabs + "Today" view candidate now fully specced and
moved to `ROADMAP.md`'s "Specced, coming soon" — split into two specs per the design pass:
`frontend_spec_015_weekday_weekend_grid_tabs.md` (the bug fix, must land first) and
`frontend_spec_016_today_view.md` (the new top-level "Today" tab, depends on 015).
Earlier note: 2026-09-29, Weekly Planner UX batch now fully specced: occurrence detail card
(`frontend_spec_008`), "Add" picker modal (`frontend_spec_009`), bucket drag-and-drop reordering
(`planner_spec_010`/`frontend_spec_010`), and automatic carry-forward
(`planner_spec_011`/`frontend_spec_011`) — the last two split from one candidate into two
independent specs during planning, both now written and moved to `ROADMAP.md`'s "Specced, coming
soon". The weekly grid orientation toggle candidate is now also written up
(`frontend_spec_012_grid_orientation_toggle.md`) and moved to `ROADMAP.md`.)

---

## Candidates

## Touch-friendly weekend bucket list reordering

**Status**: Confirmed, not yet specced. Deferred 2026-10-01, raised by the modern-web-guidance
frontend review (`.claude/modern-web-guidance/reviews/review-2026-10-01.md`, finding "Worth
considering #5"). `BucketList.tsx`/`OccurrenceItem.tsx` (`planner_spec_010`/`frontend_spec_010`)
implement reordering via the native HTML5 Drag and Drop API (`draggable`, `onDragStart`/`onDragOver`/
`onDrop`), which has no touch support at all without a polyfill — on a phone/tablet, only the
keyboard-accessible Move up/Move down buttons currently work; the drag handle itself does nothing.

Explicitly deferred rather than dropped: current usage is desktop-only, so there's no confirmed gap
today, but worth a proper Pointer-Events-based (or a maintained sortable library's touch-aware)
reorder implementation if/when this app sees real mobile use of the bucket list. Revisit if that
usage pattern actually shows up, rather than building ahead of it.

## Bulk sub-task fetch endpoint (fix N+1 in AssignActivityPicker)

**Status**: Confirmed, not yet specced. Deferred 2026-10-01, raised by the modern-web-guidance
frontend review (`.claude/modern-web-guidance/reviews/review-2026-10-01.md`, finding "Optional #2").
`AssignActivityPicker.tsx` calls `activityApi.getAll()` then fans out one
`subTaskApi.getAll(activityId)` call per activity (parallelized via `Promise.all`, so not a
sequential waterfall, but still N+1 round trips). There is currently no bulk endpoint — only
`GET /api/v1/activities/{activityId}/sub-tasks`, one activity at a time.

A real fix needs a new backend endpoint (e.g. all sub-tasks for the authenticated user in one call,
or eager-loading sub-tasks onto the existing activities response) plus the matching `API.md` update
and frontend consumption change — a full backend+frontend spec pair, not a frontend-only tweak.
Deferred rather than actioned now: this is a scale/performance concern, not an active problem at
this app's current (personal-use) activity counts. Revisit if the activity list grows enough for the
extra round trips to matter in practice.

## Filter the Weekly Planner by completed status and by category

**Status**: Confirmed, not yet specced. Raised 2026-10-01. The Weekly Planner's grid and weekend
bucket list currently show every planned occurrence for the week with no filtering — the Activity
Bank already has this exact pattern for its own list (`frontend_spec_017_activity_bank_category_filter.md`'s
category filter, plus its existing "Show archived" status toggle), so this would extend the same
idea to the planner view rather than inventing a new filtering UI from scratch. Likely wants two
independent filters: by `ActivityCategory` (Routine/Necessary/Pleasurable) and by completed/not-yet-
completed. Needs a real design pass before writing ACs: where the filter controls live (the grid and
bucket list are two separate components/sections — one shared control above both, or one per
section?), whether filtering hides non-matching occurrences entirely or just visually de-emphasises
them (the latter might matter more here than in the Activity Bank, since an empty grid cell reads
differently from an empty list), and whether the Weekdays/Weekend tab control
(`frontend_spec_015_weekday_weekend_grid_tabs.md`) and any future filter control need to compose
cleanly together in the same header area.

## Sub-task completion progress indicator (e.g. "2/3 done")

**Status**: Confirmed worth a candidate, not yet specced — blocked on a product decision. Split off
2026-10-01 from the "Activity Bank UX improvements" batch's sub-task count idea
(`.claude/ideas/future_ideas.md`), which shipped as a plain count instead
(`planner_spec_012_subtask_count.md`/`frontend_spec_018_subtask_count_badge.md`). This was
originally Claude's own suggestion, not yet confirmed by the user at the time; the user has now
confirmed it's worth tracking as a real candidate, but explicitly deferred building it.

Blocker: there is no existing concept of a sub-task being "done". Completion today only exists as a
`CompletionRecord` wrapping a `PlannedOccurrence`, which is scoped per calendar week — a sub-task can
have many occurrences across many weeks, each independently completable. Before this can be spec'd,
someone needs to pick what "N of M done" actually means for a given activity, e.g.:
- done *this week* only (ties the count to whatever week is currently being viewed/planned)
- done *at least once, ever* (a lifetime completion flag, needs a new aggregation or a denormalized
  field)
- most recent occurrence per sub-task, whatever its completion state

Whichever is chosen needs real backend aggregation work across `CompletionRecord`/
`PlannedOccurrence` joined by `sub_task_id` — not a client-side computation over already-fetched
data. Revisit once there's a concrete answer to the "done" question above, ideally prompted by this
mattering in actual day-to-day use rather than decided speculatively now.

## Frontend button visual hierarchy (primary/secondary)

**Status**: Confirmed, not yet specced. Deferred scope from `frontend_spec_007_visual_refresh.md`'s
Requirement 3 (documented in that spec's Out-of-scope section): every button currently gets an
identical pill+shadow treatment, with no visual distinction between a primary action (e.g. "Add
activity", "Log in") and a secondary one (e.g. "Delete", "Cancel"). Fixing this means adding
`className`/variant props across every component that renders a button, not just a CSS change —
real scope, deliberately not bundled into the visual-refresh pass.

The V1–V5 roadmap in `.claude/HIGH_LEVEL_DESIGN.md` §3 already lists the major themes and user
stories (US-001 through US-018) with acceptance criteria at the epic level — those are the initial
source of truth for what to spec next, not duplicated here. Use this file for ideas that come up
*during* implementation and are confirmed worth building but don't map cleanly onto an existing
roadmap item (e.g. a UX refinement discovered while building the weekly grid, a cross-cutting
tooling need). Don't pre-populate it from the roadmap — that would just be restating
`HIGH_LEVEL_DESIGN.md`.
