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

Last full review: 2026-08-27 (V1 high-level planning session).

---

## Finer-grained/custom time slots for planned activities

**Status**: Not specced. V1's `PlannedActivity.slot` is a fixed `MORNING`/`AFTERNOON`/`EVENING`
enum (nullable, for bucket-style entries). Raised during V1 planning: hourly or specific-time
scheduling might be wanted later. Deliberately not built now — nothing in the current roadmap needs
it, and building generic time-scheduling ahead of a real requirement would be solving a problem
V1 doesn't have. The `slot` field is named generically (not something like `ThreePartDay`) and left
nullable specifically so this would most likely be an *additive* future change (e.g. an optional
`plannedTime` alongside the coarse `slot`), not a schema redesign, when/if it's actually needed.

## Drag-and-drop in the week planner (assignment, not reordering)

**Status**: Not specced. V1 ships click-to-assign only (pick an activity from the bank, assign it
to a day/slot) — drag-and-drop is a real interaction-complexity jump with no V1 user story
requiring it. Confirmed during V1 planning as a good later-release candidate once the click-to-assign
version exists and its rough edges (if any) are actually felt. Narrower in scope than it sounds now
that drag-and-drop has been separately confirmed (2026-09-29) for *reordering* the weekend bucket
list — see `.claude/SPEC_CANDIDATES.md`'s "Weekend bucket reordering + carry-forward" candidate.
This entry is specifically about dragging an activity/sub-task onto a grid day/slot to *assign* it
(replacing or supplementing the click-to-assign flow) — still unconfirmed, don't assume it's
decided just because bucket reordering now uses drag-and-drop.

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

## Activity Bank UX improvements (batch, 2026-09-29)

**Status**: Not specced. Raised by the user right after shipping spec pair 6
(repeatable/archived activities), while it was fresh:

- **Add-activity modal with category guidance**: move activity creation into a modal (off the
  bottom-of-page inline form) that includes a brief explanation of what each category
  (Routine/Necessary/Pleasurable) means, with examples — helps a new/returning user pick the right
  one without having to already know the BA framework's category definitions.
- **Filter by category**: a category filter on the Activity Bank list, alongside the existing "Show
  archived" toggle.
- **Sub-task count on the chip**: for an activity with sub-tasks, show a count (e.g. "3") on or
  near its `CategoryChip` so the sub-task checklist's size is visible without expanding "Show
  sub-tasks" first. *(Claude's suggestion, not yet confirmed by the user: once counting is in
  place, showing progress — e.g. "2/3" — rather than just a total would tie more directly into BA's
  core "am I making progress" framing; worth folding in if this gets spec'd.)*

## Weekly grid completion/category-balance summary strip

**Status**: Not specced — Claude's suggestion (2026-09-29), not yet confirmed by the user. A small
summary strip at the top of the week grid (e.g. "5/12 planned, Pleasurable: 0") showing completion
progress and category balance for the week at a glance. No new data needed — everything's already
in the `PlannedOccurrence` list the grid already fetches. Ties into BA's core "am I keeping balance"
purpose, and would pair naturally with `frontend_spec_008`'s decluttering once that ships, but was
deliberately left out of that spec's scope since it was never explicitly confirmed — raise it again
if/when there's appetite for another small Weekly Planner spec.

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

## Self-hosted/local LLM inference for AI features

**Status**: Not specced — deliberately deferred, not rejected. See
`.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7b: CPU-only inference is too slow for good UX without a
GPU, and expected call volume is low enough that a hosted free API will be cheaper/faster. Only
reconsider if a real data-sovereignty requirement (mood/mental-health data never leaving
user-controlled infrastructure) forces it later — that would be the actual justification, not cost
or latency.
