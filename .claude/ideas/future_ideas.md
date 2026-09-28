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

## Drag-and-drop in the week planner

**Status**: Not specced. V1 ships click-to-assign only (pick an activity from the bank, assign it
to a day/slot) — drag-and-drop is a real interaction-complexity jump with no V1 user story
requiring it. Confirmed during V1 planning as a good later-release candidate once the click-to-assign
version exists and its rough edges (if any) are actually felt.

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

## Split an activity into smaller sub-tasks

**Status**: Not specced. Raised 2026-09-28, after the Activity Bank (pair 2) shipped. Idea: let a
user break one activity down into a checklist of smaller tasks — e.g. "Organise a birthday party"
decomposed into main tasks (Create a guest list, Send invitations, Plan the menu, Decorate the
venue, Arrange entertainment), each of which could itself have smaller steps (e.g. "Create a guest
list" → decide on numbers, list friends/family, finalise the list). Distinct from two related ideas
already noted elsewhere — don't conflate:
- The V3 AI-suggestion scenario in `HIGH_LEVEL_DESIGN.md` ("I keep postponing cleaning the
  bathroom" → the app suggests breaking it into a smaller task) is an ephemeral, in-the-moment
  *suggestion*, not a persisted structural feature — no data is created or tracked from it.
- "Multiple activity templates" (feasibility review, below) means reusable presets for creating
  *similar* activities, not decomposing *one* activity into a hierarchy.

Real open questions if this is ever pursued, not yet answered: whether sub-tasks are a
self-referential relationship on `Activity` itself or a new child entity; whether a sub-task needs
its own category or inherits the parent's; and — the one with the most forward-reaching
consequence — whether Week Planning (pair 3, not yet specced) plans/completes the parent activity
or the individual sub-tasks, since that shapes `PlannedOccurrence`'s reference target. If this idea
progresses to a spec candidate, it should be resolved before or alongside pair 3, not after, since
pair 3's schema would otherwise need to be redesigned rather than extended.

## Self-hosted/local LLM inference for AI features

**Status**: Not specced — deliberately deferred, not rejected. See
`.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7b: CPU-only inference is too slow for good UX without a
GPU, and expected call volume is low enough that a hosted free API will be cheaper/faster. Only
reconsider if a real data-sovereignty requirement (mood/mental-health data never leaving
user-controlled infrastructure) forces it later — that would be the actual justification, not cost
or latency.
