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

Last updated: 2026-10-01 (Activity Bank UX improvements batch fully resolved: category filter and
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

## Header restructure: Settings + Account/Profile icons, tabs demoted to a second row

**Status**: Confirmed, not yet specced. Raised 2026-09-29 while reviewing the visual refresh —
"Logged in as steve" as static text plus a separate "Log out" button in the page body was flagged
as not really adding anything. Proposed replacement: a top nav row of **Title | Settings icon |
Account/profile icon**, with the Activities/Weekly planner tabs demoted to a second row beneath it.
Settings and Account/Profile are two separate icons/menus, not combined — confirmed with the user
2026-09-29: they're different categories (Settings = how the app looks/behaves; Account/Profile =
who I am), and starting separated avoids re-splitting a combined menu later once Account/Profile
grows past just a username.

Account/Profile menu content, V1: just the username (replacing "Logged in as X") and the Log out
action (replacing the standalone button). Explicitly designed with room to grow: notifications/email
preferences, change password, etc. are plausible later additions to this same menu, not this
candidate's scope — don't build those ahead of a concrete need, per this project's usual
not-ahead-of-need rule.

Touches `TabNav` (`frontend_spec_005_navigation_and_theme.md`), `App.tsx`'s header markup, and
likely wants two new small icon-triggered menu/dropdown components (Settings, Account) — the
existing `/settings` route's content (theme, category colours) would move into the Settings icon's
menu rather than being its own tab. Needs its own real design pass (icon choice, menu/dropdown
interaction pattern, keyboard/focus handling) before writing ACs, not just a markup reshuffle.

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
