# Future Ideas

Deferred features, gaps, and improvements noted along the way but not scheduled against a spec.
Collected here so they're discoverable in one place instead of scattered across individual spec
files or lost in conversation history.

**Pipeline**: `future_ideas.md` (raw, unconfirmed) → `.claude/SPEC_CANDIDATES.md` (confirmed worth
building, not yet spec'd) → a real spec exists, tracked in `ROADMAP.md`'s "Specced, coming soon"
table → implemented, row moves to "Delivered" → `CHANGELOG.md` (shipped). An idea moves out of this
file into `SPEC_CANDIDATES.md` once it's confirmed worth specifying — don't leave it duplicated in
both.

**Maintenance rule**: every item here carries a `**Status**` line. Before adding a new item or
touching this file, re-check existing items against the current codebase — code this file
references may have moved or changed shape since the note was written.
- **Delivered** — the idea shipped. Keep only a one-line description + the spec(s) that delivered
  it, for traceability; drop the original speculative detail.
- **Specced, not yet built** — a real spec already exists. Reference the spec name only — move the
  entry to `ROADMAP.md`'s "Specced, coming soon" section instead, at that point.
- **Not specced** — retain full detail: what's actually required, why, and any relevant
  constraints or prior discussion.

Last full review: 2026-10-01 (re-checked every entry against current codebase state: fixed a stale
`PlannedActivity.slot` reference to the real `PlannedOccurrence.slot`, updated the drag-and-drop
entry's cross-reference from a since-promoted `SPEC_CANDIDATES.md` candidate to the real specs it
became, removed the "Activity Bank UX improvements" batch entirely now that every item in it has
either shipped or moved to `ROADMAP.md`/`SPEC_CANDIDATES.md`, fixed wording in the summary-strip
entry that implied `frontend_spec_008` hadn't shipped yet, and removed the "Sub-task category
drift" entry — now specced as `planner_spec_014_subtask_category_cascade.md`, see
`ROADMAP.md`'s "Specced, coming soon". Later the same day: removed the "already-open sub-task panel
doesn't refresh" entry too — now specced as `frontend_spec_023_subtask_panel_refresh_on_edit.md`).
Later the same day: split the "Drag-and-drop in the week planner" entry in two — the
already-planned-item-move half is now specced as `frontend_spec_025_grid_drag_to_move.md` (see
`ROADMAP.md`); this file keeps only the remaining not-yet-specced half (sidebar/drawer assign-by-
drag for unplanned activities).
2026-10-02: added a third drag-and-drop idea, dragging between the grid and the weekend bucket
list — carved out as explicitly out-of-scope by `frontend_spec_025_grid_drag_to_move.md`.
Later the same day: added "Should a completed occurrence be movable?", raised while reviewing that
same spec. Later the same day: the grid/bucket cross-drag idea moved straight to a real spec
(`frontend_spec_026_grid_bucket_cross_drag.md`, see `ROADMAP.md`'s "Specced, coming soon") without
passing through `SPEC_CANDIDATES.md` — removed from this file.
2026-10-02: the "favourite activities" aside mentioned inside the sidebar/drawer entry moved straight
to its own real spec pair (`planner_spec_015_favourite_activities.md`/
`frontend_spec_027_favourite_activities.md`, see `ROADMAP.md`'s "Specced, coming soon"), decoupled
from the sidebar/drawer idea it was raised alongside — the sidebar/drawer entry itself remains here,
trimmed to remove the now-specced favourites mention.
Later the same day: the sidebar/drawer entry itself ("Drag-and-drop in the week planner: assign an
unplanned activity via a sidebar/drawer") moved to a real spec
(`frontend_spec_028_activity_drawer.md`, see `ROADMAP.md`'s "Specced, coming soon") — the design pass
it was waiting on (panel placement, filter reuse) is done; removed from this file. This closes out
the three-way split of the original "drag-and-drop in the week planner" idea
(`frontend_spec_025`/`026`/`028`).
Earlier review: 2026-08-27 (V1 high-level planning session).

---

## Finer-grained/custom time slots for planned activities

**Status**: Not specced. V1's `PlannedOccurrence.slot` is a fixed `MORNING`/`AFTERNOON`/`EVENING`
enum (nullable, for bucket-style entries). Raised during V1 planning: hourly or specific-time
scheduling might be wanted later. Deliberately not built now — nothing in the current roadmap needs
it, and building generic time-scheduling ahead of a real requirement would be solving a problem
V1 doesn't have. The `slot` field is named generically (not something like `ThreePartDay`) and left
nullable specifically so this would most likely be an *additive* future change (e.g. an optional
`plannedTime` alongside the coarse `slot`), not a schema redesign, when/if it's actually needed.

## Should a completed occurrence be movable?

**Status**: Not specced. Raised 2026-10-02 while reviewing `frontend_spec_025_grid_drag_to_move.md`
— noticed that dragging a completed grid occurrence to a different day/slot is currently allowed,
with no check against `occurrence.completed`. Confirmed this isn't a regression introduced by that
spec: the existing click-based "Rearrange" button (`OccurrenceItem.tsx`) has never been gated on
`completed` either — only on `isBusy` — so both the old and new ways of moving an occurrence already
allow moving a completed one. This is a pre-existing product question, not a bug in either feature.

Current lean (not acted on): allow it, don't restrict. Moving an occurrence's day/slot doesn't touch
its `CompletionRecord` (keyed to the occurrence's id, not its day/slot), so there's no data-integrity
risk, and there's a real use case — "I did this Tuesday but it was planned for Wednesday, let me fix
the record after the fact." Restricting it would mean inventing a disabled state, explaining why,
and deciding what drag feedback looks like for a disallowed drop, for a case that isn't actually
harmful. Logged here rather than acted on — revisit if this ever actually feels wrong or confusing
in real use, rather than building a restriction (or a feature toggle for one) ahead of that signal.

## Dedicated activity-history view/endpoint

**Status**: Not specced. V1 satisfies "basic activity history" (a V1 feature bullet in
`HIGH_LEVEL_DESIGN.md`) by letting `weekStart` on the existing `GET /api/v1/plan` navigate to past
weeks — no separate history page or endpoint. Confirmed during V1 planning as fine for V1; a richer
standalone history view (filtering/searching past completions independent of the week-by-week
navigation) is a plausible later addition once the week planner itself is in real use.

## From the feasibility review (`.claude/HIGH_LEVEL_DESIGN.md` §6 — potential future features)

These are explicitly *not* part of the initial build per the design doc, listed here for
discoverability rather than restated in full — see the design doc itself for the complete list:

**Status**: Not specced. Deliberately deferred, should only be pulled forward if they emerge
naturally from real usage (per the design doc's own framing): mobile/PWA, notifications, calendar
integration, therapy-worksheet import, therapist-facing export, multiple activity templates,
natural-language activity entry, voice input, local/on-device AI, more sophisticated trend
analysis, activity effectiveness scoring, social/connection activity tracking.

## Weekly grid completion/category-balance summary strip

**Status**: Not specced — Claude's suggestion (2026-09-29), not yet confirmed by the user. A small
summary strip at the top of the week grid (e.g. "5/12 planned, Pleasurable: 0") showing completion
progress and category balance for the week at a glance. No new data needed — everything's already
in the `PlannedOccurrence` list the grid already fetches. Ties into BA's core "am I keeping balance"
purpose, and would pair naturally with the decluttered grid tile shape `frontend_spec_008` already
shipped, but was deliberately left out of that spec's scope since it was never explicitly confirmed
— raise it again if/when there's appetite for another small Weekly Planner spec.

## End-of-week reflection (light journal, no scoring)

**Status**: Not specced. Raised by the user 2026-09-29, explicitly flagged as probably out of V1
scope. A brief end-of-week prompt inviting the user to note what felt satisfying, what was harder
than expected, and what they might want to make room for next week — free-text, not a rating or
score. Intent is to make the planner feel more human than a pure checklist of done/not-done items.

Distinct from `HIGH_LEVEL_DESIGN.md`'s existing **Version 2 — Tracking and personal reflection**
scope (US-010, "Record mood" — a numeric before/after mood rating per activity): this idea is a
free-text, whole-*week* qualitative reflection, not a per-activity numeric one. The two are
complementary, not duplicates — V2's mood ratings feed structured trend analysis
(`HIGH_LEVEL_DESIGN.md` §"Identify activities that consistently improve mood"), while this is a
private, unstructured note the app itself never scores or analyses. Explicitly no scoring/ranking
of the week or of individual activities — matches this product's established neutral-language,
non-judgmental stance (already an explicit AC elsewhere, `frontend_spec_011_bucket_carry_forward_automation.md`'s
`FRONTEND-011-AC-04`, and `product.md`'s general framing) — worth restating as a hard constraint
whenever this actually gets spec'd, not just a nice-to-have tone note.

**Claude's related ideas, offered alongside the user's own, none yet confirmed:**
- **Rotating gentle prompts instead of one blank textbox**: a short, varied question at reflection
  time (e.g. "What gave you a bit of energy this week?" / "What took more out of you than
  expected?") rather than a single generic "how was your week" box — lowers the "blank page" barrier
  and keeps it feeling like a light prompt, not homework.
- **An optional weekly highlight**: let the user optionally mark one completed activity as the
  week's highlight/most meaningful moment, with no ranking or comparison of the others — a much
  smaller, structured cousin of the free-text reflection, closer to a single tap than a journal
  entry. Could ship on its own before or instead of the full reflection, or alongside it.
- **Reflections should stay for the user's own eyes only**, never feed a streak, score, or
  comparison metric elsewhere in the app (e.g. never surfaced back as a "you felt good 3 weeks in a
  row" callout) — worth stating explicitly as a design constraint whenever this is scoped, so a
  well-meaning later feature doesn't quietly turn a private note into a scored data point.

## Pagination on `GET /api/v1/activities` (and similar unbounded list endpoints)

**Status**: Not specced. Raised 2026-10-02 during a deliberate performance investigation (alongside
`planner_spec_017_plan_response_n_plus_one.md`/`planner_spec_018_bulk_sub_task_fetch.md`, the two
findings from that same pass that *were* confirmed worth specifying). `GET /api/v1/activities`
returns every activity owned by the user in one unbounded list, with no `limit`/`offset`/cursor —
matches this app's stated personal/small-scale use (`.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7a),
genuinely fine today and for the foreseeable future. Logged here, not actioned, in case the activity
count ever grows enough (e.g. heavy multi-user adoption) for an unbounded response to start mattering
— revisit only if that actually happens, don't build pagination ahead of a concrete need for it.

## Self-hosted/local LLM inference for AI features

**Status**: Not specced — deliberately deferred, not rejected. See
`.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7b: CPU-only inference is too slow for good UX without a
GPU, and expected call volume is low enough that a hosted free API will be cheaper/faster. Only
reconsider if a real data-sovereignty requirement (mood/mental-health data never leaving
user-controlled infrastructure) forces it later — that would be the actual justification, not cost
or latency.
