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

Last updated: 2026-10-05 (added the dev-script window-closes-before-you-can-read-it candidate,
raised by the user while reviewing the RUNBOOK's Quick Start section; see entry below.)
Earlier note: 2026-10-03 (the "Filter the Weekly Planner by completed status and by category"
candidate moved to a real spec — `frontend_spec_035_weekly_planner_filter.md`, see `ROADMAP.md`'s
"Specced, coming soon" — removed from this file.)
Earlier note: 2026-10-03, added the preset/starter activity bank candidate, raised by the user while
reviewing V1 completeness after `frontend_spec_012`/`034` — see entry below.)
Earlier note: 2026-10-02 (the bucket-reorder query-scaling candidate, surfaced while implementing
`planner_spec_017_plan_response_n_plus_one.md`, moved to a real spec —
`planner_spec_019_bucket_reorder_query_scaling.md`, see `ROADMAP.md`'s "Internal / maintenance specs"
— removed from this file.)
Earlier note: 2026-10-02, the bulk sub-task fetch candidate moved to a real spec pair —
`planner_spec_018_bulk_sub_task_fetch.md`/`frontend_spec_033_bulk_sub_task_fetch.md`, see
`ROADMAP.md`'s "Specced, coming soon" — removed from this file. A second, related finding from the
same performance investigation, the `GET /api/v1/plan` N+1, was *not* in this file — it moved
straight to a real spec, `planner_spec_017_plan_response_n_plus_one.md`, same as several other
findings this session that skipped this file entirely.)
Earlier note: 2026-10-02, the button-hierarchy candidate moved to a real spec —
`frontend_spec_031_button_hierarchy.md`, see `ROADMAP.md`'s "Specced, coming soon" — removed from
this file.)
Earlier note: 2026-10-02, the header restructure candidate moved to a real spec —
`frontend_spec_030_header_restructure.md`.
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

## Dev scripts: failure window closes before the diagnostic can be read

**Status**: Confirmed, not yet specced. Raised by the user 2026-10-05, while reviewing
`RUNBOOK.md`'s Quick Start section. When `start-dev.sh`/`restart-dev.sh` is launched in a way that
spawns a fresh Git Bash window scoped to just that one invocation (e.g. typing
`.\scripts\restart-dev.sh --debug` from PowerShell, or double-clicking the `.sh` file in Explorer —
both go through Windows' `.sh` file association), that window closes itself the instant the script
process exits, success or failure alike. If `scripts/lib/docker-common.sh`'s `docker_preflight`
fails (Docker Desktop not running, or Postgres not up/healthy), its diagnostic is printed correctly
and the script exits non-zero exactly as designed — confirmed by stubbing `docker()` to fail and
sourcing `docker_preflight` directly, which printed `Docker isn't running -- start Docker Desktop,
then try again.` and returned exit 1 — but the spawned window vanishes before the message can
actually be read, so in practice it looks like the script "does nothing."

Only reproducible as a UX gap, not a logic bug: running the same scripts from inside an
already-open, persistent Git Bash session (the common case documented in `RUNBOOK.md`) doesn't hit
this at all, since that window stays open regardless of what the script prints or returns.

Likely fix: a shared helper in `scripts/lib/dev-common.sh` (e.g. `pause_on_failure`, invoked via an
`EXIT` trap keyed off `$?`) that blocks on a keypress only when the script is about to exit
non-zero, so a disposable spawned window stays up long enough to read the diagnostic, without
adding an extra keypress to the normal success path that users typing directly into an open Git
Bash session already rely on today. Would apply to `start-dev.sh`, `restart-dev.sh`, and
`stop-dev.sh` uniformly once written, so all three get consistent behavior on failure.

## Preset/starter activity bank for new users

**Status**: Confirmed, not yet specced. Raised by the user 2026-10-03, while reviewing V1
completeness after `frontend_spec_012_grid_orientation_toggle.md`/`frontend_spec_034_grid_
orientation_live_update.md`. A brand-new user's Activity Bank starts completely empty today —
`ActivityBank.tsx`'s only empty-state messaging is "No activities yet. Add one below to get
started." (confirmed by reading the component), with no faster on-ramp than typing activities in
one at a time from a blank page. A curated set of common activities the user could add with one
click would lower that cold-start barrier.

Notably, this isn't a new idea invented from scratch — `.claude/HIGH_LEVEL_DESIGN.md`'s planning-
model section already lists an illustrative weekend example set almost verbatim (go for a walk, go
somewhere for coffee, cook something interesting, see a friend, work on a personal project, watch a
film, do one household task) that was written as prose for a human reader, never operationalized
into the app. A real preset list would likely want examples across all three categories (Routine/
Necessary/Pleasurable), not just the design doc's weekend-flavoured set, and both repeatable (e.g.
"Go for a walk") and one-off-flavoured (e.g. "Apply for jobs" is explicitly used elsewhere in this
project's own seed/test data as a one-off example) entries, to also showcase
`planner_spec_006_repeatable_activities.md`'s repeatable/one-off distinction.

Likely frontend-only: a "Suggested activities" section in the Activity Bank's empty state (or
always-available, collapsed once the bank isn't empty), each item a one-click "Add" that calls the
existing `POST /api/v1/activities` — no new backend endpoint needed, same pattern as any other
activity creation. Open questions for whenever this gets a real design pass: is the preset list
hardcoded client-side content or does it need to be editable/configurable later (no evidence it
needs to be, for a personal single-user app); does adding a preset immediately remove it from the
suggestions list (avoid duplicate adds) or allow re-adding; should suggestions be category-grouped
to mirror the Activity Bank's own category filter.

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

The V1–V5 roadmap in `.claude/HIGH_LEVEL_DESIGN.md` §3 already lists the major themes and user
stories (US-001 through US-018) with acceptance criteria at the epic level — those are the initial
source of truth for what to spec next, not duplicated here. Use this file for ideas that come up
*during* implementation and are confirmed worth building but don't map cleanly onto an existing
roadmap item (e.g. a UX refinement discovered while building the weekly grid, a cross-cutting
tooling need). Don't pre-populate it from the roadmap — that would just be restating
`HIGH_LEVEL_DESIGN.md`.
