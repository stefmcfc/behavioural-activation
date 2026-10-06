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

**Formatting convention** (applies here and in `.claude/ideas/future_ideas.md`, which shares this
file's pipeline and structure):
- **Review-log dates** (the "Last updated" log below, and `future_ideas.md`'s "Last full review"
  log): every date is inline-code-formatted, e.g. `` `2026-10-05` `` — including the most recent
  entry's own label line (`**Last updated:** \`2026-10-05\``). Each date stands on its own line,
  followed by a blank line, then its content as a new paragraph (or a bullet list, if the date has
  more than one distinct point to record) — never run the date into the same sentence as its
  content.
- **Each candidate's `Status`**: a fenced code block directly under its `## heading`, exactly
  ` ```\nStatus: <text>\n``` `, not inline bold text — this makes the status pop visually ahead of
  the rationale/detail prose that follows it.

---

**Last updated: `2026-10-06`**

- the preset/starter activity bank candidate moved to a real spec —
  `frontend_spec_040_preset_starter_activities.md`, see `ROADMAP.md`'s "Specced, coming soon" —
  removed from this file.
- added the icon+text CTA treatment candidate, raised by the user in a post-merge discussion
  prompted by `planner_spec_023`/`frontend_spec_047`'s Move-button icon polish — see entry below.
- added the CI + automated end-to-end testing candidate, item 4 of
  `.claude/audits/audit-2026-10-06.md`'s non-functional audit — see entry below.
- added three new candidates from a V1 ideas review of the live app (browser walkthrough): a
  "Duplicate activity" quick action, reconsidering the "Weekend bucket list" label shown even in
  non-weekend contexts, and discoverability of the Settings category-colour swatches — see entries
  below. The same review's four other findings went straight to real specs:
  `frontend_spec_049_undo_delete.md`, `planner_spec_024`/`frontend_spec_050_change_password.md`,
  `planner_spec_025`/`frontend_spec_051_data_export.md`, `frontend_spec_052_slot_item_counts.md`.

`2026-10-05`

- added the dev-script window-closes-before-you-can-read-it candidate, raised by the user while
  reviewing the RUNBOOK's Quick Start section
- that candidate moved to a real spec — `tooling_spec_004_dev_script_pause_on_failure.md`, see
  `ROADMAP.md`'s "Internal / maintenance specs" — removed from this file

`2026-10-03`

the "Filter the Weekly Planner by completed status and by category"
candidate moved to a real spec — `frontend_spec_035_weekly_planner_filter.md`, see `ROADMAP.md`'s
"Specced, coming soon" — removed from this file.

added the preset/starter activity bank candidate, raised by the user while
reviewing V1 completeness after `frontend_spec_012`/`034` — see entry below.

`2026-10-02`

the bucket-reorder query-scaling candidate, surfaced while implementing
`planner_spec_017_plan_response_n_plus_one.md`, moved to a real spec —
`planner_spec_019_bucket_reorder_query_scaling.md`, see `ROADMAP.md`'s "Internal / maintenance specs"
— removed from this file.

the bulk sub-task fetch candidate moved to a real spec pair —
`planner_spec_018_bulk_sub_task_fetch.md`/`frontend_spec_033_bulk_sub_task_fetch.md`, see
`ROADMAP.md`'s "Specced, coming soon" — removed from this file. A second, related finding from the
same performance investigation, the `GET /api/v1/plan` N+1, was *not* in this file — it moved
straight to a real spec, `planner_spec_017_plan_response_n_plus_one.md`, same as several other
findings this session that skipped this file entirely.

the button-hierarchy candidate moved to a real spec —
`frontend_spec_031_button_hierarchy.md`, see `ROADMAP.md`'s "Specced, coming soon" — removed from
this file.

the header restructure candidate moved to a real spec —
`frontend_spec_030_header_restructure.md`.

`2026-10-01`

added two candidates from the modern-web-guidance frontend review
— `.claude/modern-web-guidance/reviews/review-2026-10-01.md` — touch-friendly bucket reordering
and a bulk sub-task fetch endpoint; see entries below.

Activity Bank UX improvements batch fully resolved: category filter and
plain sub-task count specced directly to `ROADMAP.md` — `frontend_spec_017`,
`planner_spec_012`/`frontend_spec_018` — and the "2/3 done" progress variant added here as a new
candidate, blocked on a product decision about what "done" means for a sub-task; see that entry.

`2026-09-30`

Weekday/Weekend grid tabs + "Today" view candidate now fully specced and
moved to `ROADMAP.md`'s "Specced, coming soon" — split into two specs per the design pass:
`frontend_spec_015_weekday_weekend_grid_tabs.md` (the bug fix, must land first) and
`frontend_spec_016_today_view.md` (the new top-level "Today" tab, depends on 015)

`2026-09-29`

Weekly Planner UX batch now fully specced:
- occurrence detail card (`frontend_spec_008`)
- "Add" picker modal (`frontend_spec_009`)
- bucket drag-and-drop reordering (`planner_spec_010`/`frontend_spec_010`) and automatic carry-forward
(`planner_spec_011`/`frontend_spec_011`) — the last two split from one candidate into two
independent specs during planning, both now written and moved to `ROADMAP.md`'s "Specced, coming
soon"
- the weekly grid orientation toggle candidate is now also written up
(`frontend_spec_012_grid_orientation_toggle.md`) and moved to `ROADMAP.md`.

---

## Candidates

## "Duplicate activity" quick action

```
Status: Confirmed worth a candidate, not yet specced.
```

Raised `2026-10-06` during a V1 ideas review of the live app. Building a variant of an existing
activity (e.g. a longer version of "Go for a walk") means retyping it from scratch today — `Edit`/
`Delete` exist per row, but no `Duplicate`. A lightweight `Duplicate` action next to the existing
row controls (pre-filling the Add-activity form from the source activity's name/category/
description/repeatable/favourite, not copying its sub-tasks or plan history) would lower that
friction.

Not yet specced: whether duplicating should also copy the source activity's sub-tasks (straight
copy vs. a deliberately bare duplicate the user re-builds) is an open product question worth
settling before writing ACs, not a technical blocker.

## "Weekend bucket list" label shown outside weekend contexts

```
Status: Confirmed worth a candidate, not yet specced — softest/most subjective of this batch.
```

Raised `2026-10-06` during the same review. The Today view shows a section headed "Weekend bucket
list" even when "today" is a weekday — accurate to the underlying concept (the bucket is flexible/
unscheduled, not actually day-restricted), but the label could read oddly out of context to a user
who isn't thinking of it as "the weekend bucket" on, say, a Tuesday. A possible fix: a more neutral
label (e.g. "Flexible activities") in non-weekend-grid contexts, while keeping "Weekend bucket list"
where it's actually shown alongside the Saturday/Sunday grid.

Explicitly the weakest-confidence item of this batch — flagged for discussion, not a firm
recommendation. "Weekend bucket list" is an established, consistent proper noun throughout this
app's specs and UI; renaming it in only some contexts could itself be confusing in a different way.
Worth a product decision before writing any AC, not just an implementation choice.

## Category-colour swatch discoverability in Settings

```
Status: Confirmed worth a candidate, not yet specced.
```

Raised `2026-10-06` during the same review. Settings' "Category colours" section shows a plain
circular swatch next to each category's "Reset to default" button — nothing visually hints that the
circle itself is clickable and opens a colour picker. A small affordance (a visible "Change colour"
label, a hover/focus state, or similar) would make this discoverable without a user needing to
guess-click it.

Minor, low-risk, but not yet scoped: exact treatment (label text, whether to add a focus ring/hover
style, or both) isn't decided.

## CI + automated end-to-end testing

```
Status: Confirmed worth a candidate, not yet specced — needs a scoping conversation first.
```

Raised `2026-10-06`, item 4 of `.claude/audits/audit-2026-10-06.md`'s non-functional audit. Two
related, currently-absent pieces of infrastructure:

- **No CI at all.** Nothing runs `gradlew.bat test`/`npm test`/`npm run lint` automatically on a
  push or PR — everything in this project's test suite only runs when someone remembers to run it
  locally.
- **No automated black-box/end-to-end testing.** The only thing exercising the app through a real
  browser is a one-time manual pass per feature, done at implementation time, never repeated, never
  run in CI. It's already caught real bugs the Spock/Vitest suites missed (a horizontal-scrollbar
  overflow, a Hibernate flush-ordering bug) — good evidence it's worth making repeatable, not
  evidence it's fine to leave manual-only.

These are related (an e2e suite is the kind of thing CI exists to run) but are two separate pieces
of work and don't have to land together. Not yet spec-able because the scope needs real decisions
first, not just effort:

- Which CI provider/config (this project already uses GitHub, so GitHub Actions is the likely
  default, but worth confirming rather than assuming).
- What runs on every push vs. only on PR vs. nightly — the full backend suite alone takes ~28s
  today, cheap enough to run on every push, but that calculus changes once/if an e2e suite is added.
- Which e2e tool (`frontend_spec_010`'s `FRONTEND-010-AC-08` already named Playwright as the likely
  candidate when this gap was first hit).
- Whether e2e tests get written retroactively for already-shipped features or only for new ones
  going forward (retroactive coverage is a much bigger lift).

Revisit once there's an answer to those questions — this is the biggest structural gap this audit
found, but also the one most likely to be mis-scoped if spec'd before those are settled.

## Icon+text treatment for Add/Edit/Delete CTAs

```
Status: Confirmed worth a candidate, not yet specced.
```

Raised `2026-10-06` by the user, prompted by `planner_spec_023_subtask_reordering.md`/
`frontend_spec_047_subtask_reordering.md`'s Move up/down chevron-icon polish. The user asked for an
opinion on icon-only CTAs — add (`+`), edit (pencil), delete (bin) — across the app: how universally
recognized they are, and the accessibility impact. The `modern-web-guidance:accessibility` guide was
consulted; discussion summary (not yet a design decision):

- All three icons are widely but not universally recognized — learned software conventions, not
  inherently intuitive symbols. Trash/delete is the most universal of the three; pencil/edit is the
  most prone to confusion (e.g. with "annotate a note").
- The real accessibility risk isn't recognizability, it's losing the free self-documentation visible
  text gives you for free. Icon-only buttons need a disambiguated per-instance `aria-label` (e.g.
  `Delete {activity name}`, not a shared `Delete`) wherever more than one instance appears in a list
  — this app already does exactly this for the Move up/down buttons (`Move {name} up`), so the
  discipline has a direct precedent to extend rather than invent from scratch.
- Icons-as-UI-components need 3:1 contrast (same bar as borders/focus rings), and icon-only buttons
  are more prone to shrinking under the ~24×24px touch-target minimum than a padded text button.
- A sketched-but-unconfirmed direction from the conversation: icon+text for primary/destructive
  actions (Add, Delete — Delete especially, given it's irreversible even with the existing two-step
  confirm), icon-only with disciplined per-row `aria-label`s for secondary/low-stakes actions
  (Edit/Rename, Move). This is a visual-density tradeoff the user still needs to weigh, not a
  decision.

Every CTA across the app (Activity Bank, sub-task rows, Weekly Planner) currently uses full visible
text labels ("Edit", "Delete", "Rename", "Add activity", "Add sub-task") — this candidate is about
whether/where to move toward icon or icon+text treatments, not a known regression or bug. No
component scope is decided yet; a real spec would need a UX pass across every CTA site to decide
which get icon-only vs. icon+text treatment first.

## Touch-friendly weekend bucket list reordering

```
Status: Confirmed, not yet specced.
```

Deferred 2026-10-01, raised by the modern-web-guidance
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

```
Status: Confirmed worth a candidate, not yet specced — blocked on a product decision.
```

Split off
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
