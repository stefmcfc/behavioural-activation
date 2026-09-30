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

Last updated: 2026-09-30 (added the Weekday/Weekend grid tabs + "Today" view candidate, raised while
refining `frontend_spec_008`'s detail card and finding the Saturday/Sunday invisible-occurrence bug.
Earlier note: 2026-09-29, Weekly Planner UX batch now fully specced: occurrence detail card
(`frontend_spec_008`), "Add" picker modal (`frontend_spec_009`), bucket drag-and-drop reordering
(`planner_spec_010`/`frontend_spec_010`), and automatic carry-forward
(`planner_spec_011`/`frontend_spec_011`) — the last two split from one candidate into two
independent specs during planning, both now written and moved to `ROADMAP.md`'s "Specced, coming
soon". The weekly grid orientation toggle candidate is now also written up
(`frontend_spec_012_grid_orientation_toggle.md`) and moved to `ROADMAP.md`.)

---

## Candidates

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

## Weekday/Weekend grid tabs + a "Today" view

**Status**: Confirmed, not yet specced. Raised 2026-09-30 while refining
`frontend_spec_008_occurrence_detail_card.md`'s Move sub-state: its day `<select>` offers all seven
days (`ALL_DAYS` in `planLabels.ts`), but `PlannerGrid` only renders Monday–Friday columns and
`BucketList` only shows occurrences with a `null` day/slot — so moving something to Saturday or
Sunday saves successfully on the backend (no validation rejects it) but then has no view that
displays it; it's simply invisible in the UI. See that spec's Requirement 1 amendment for the full
finding. Confirmed with the user 2026-09-30 as worth a real fix, not a quick patch (e.g. just
removing Saturday/Sunday from the day `<select>`) — they want to rethink the grid's shape instead.

Proposed direction (not yet a firm design — needs its own pass before writing ACs):
- Split the weekly grid into two tabs: **Weekdays** (today's Monday–Friday, 5 columns × 3 slots, as
  now) and **Weekend** (Saturday/Sunday, presumably 2 columns × 3 slots) — rather than a single
  7-column grid, which the user judged "too much" for one view.
- Open question: does the weekend bucket list (the existing flexible, unslotted list) stay visible
  on both tabs, or only on the Weekend tab? Both are plausible — bucket items are conceptually
  weekend-scoped already, but a user might want to add to the bucket while looking at their weekday
  plan too.
- Also proposed: a **"Today"** view — possibly promoted to a top-level nav tab alongside
  Activities/Weekly Planner/Settings (`TabNav`, `frontend_spec_005_navigation_and_theme.md`) rather
  than living inside the planner — showing only the current day's plan, to reduce clutter for the
  "what do I actually need to do right now" use case the full weekly grid doesn't serve well.

Touches `PlannerGrid.tsx`/`.module.css` (tab/view split), `BucketList.tsx` (visibility scope across
tabs), `WeeklyPlanner.tsx` (tab state), `OccurrenceItem.tsx`'s Move sub-state (`ALL_DAYS` usage would
need to follow whichever tab is active, if Saturday/Sunday remain selectable at all once they have a
real grid home), and possibly `TabNav`/`App.tsx` for a new "Today" top-level tab. Needs its own
design pass (exact tab/column layout, bucket-list scope decision, whether "Today" is a planner
sub-view or a real top-level route) before writing ACs.

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
