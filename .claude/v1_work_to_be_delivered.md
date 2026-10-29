# V1 work to be delivered

A triage of everything currently open in `ROADMAP.md`'s "Specced, coming soon" table,
`.claude/SPEC_CANDIDATES.md`, and `.claude/ideas/future_ideas.md`, answering: what should still land
before this phase is considered closed and V2 proper begins? Produced 2026-10-29 at the user's
request. This is a recommendation, not a decision — nothing here is acted on until confirmed.

## Framing: "V1" has already shipped — this is about where to draw the next line

By `.claude/steering/product.md`'s own versioning table and `HIGH_LEVEL_DESIGN.md`'s roadmap
section, literal **V1** — activity catalogue, three categories, weekly Morning/Afternoon/Evening
grid, complete/edit/move, basic history — was completed long ago. `ROADMAP.md`'s "Week planning
(US-003–009)" row is explicitly marked **"Completes V1."** Everything delivered since then (visual
refresh, repeatable activities, favourites, drag-and-drop, Weekly Summary, work-day marking,
per-occurrence notes, change password, data export, dozens of UX polish passes) has been open-ended
V1.x work that was never formally re-versioned as V2.

More pointedly: two specs already sitting in "Specced, coming soon" —
`planner_spec_026_activity_recurrence_and_due_dates.md` and
`frontend_spec_055_reminders_page.md` — are **self-labeled "Roadmap version: V2"** in their own
headers. They implement part of V2's "recurring activities" theme from `product.md`'s versioning
table. So the real question isn't "finish every open item," it's: **what's small/finishing-touch
enough to close out this long V1.x tail, versus what's substantial (or already explicitly V2-scoped)
enough that it should be the start of V2 instead.**

## Recommended for V1 close-out

Small, low-risk, already-well-scoped items — finishing touches, not new themes.

- **`frontend_spec_049_undo_delete.md`** — already specced (2026-10-06), not yet built. Ship as-is;
  no new decisions needed. *(Still outstanding — spec exists, not yet implemented.)*
- **`frontend_spec_052_slot_item_counts.md`** — already specced (2026-10-06), not yet built. Ship
  as-is; no new decisions needed. *(Still outstanding — spec exists, not yet implemented.)*
- **"Duplicate activity" quick action** (`SPEC_CANDIDATES.md`) — ✅ **Specced** 2026-10-29 as
  `frontend_spec_056_duplicate_activity.md`, resolved as a bare duplicate (no sub-tasks copied), per
  this recommendation. Not yet implemented.
- **Category-colour swatch discoverability in Settings** (`SPEC_CANDIDATES.md`) — ✅ **Specced**
  2026-10-29 as `frontend_spec_057_category_colour_swatch_discoverability.md`. Not yet implemented.
- **Password recovery for a locked-out user** (`future_ideas.md`) — ✅ **Delivered** 2026-10-29: a
  new `hashPassword` Gradle task (`backend/build.gradle.kts`, `security/PasswordHashCli.java`) plus
  a documented recovery recipe in `RUNBOOK.md`, exactly the lightweight path recommended here —
  verified end-to-end against the running stack. `CHANGELOG.md` entry added.
- **Housekeeping only, no code**: close out "Should a completed occurrence be movable?"
  (`future_ideas.md`) — ✅ **Resolved** 2026-10-29: re-checked `PlanService.applyMove` directly —
  grid-to-grid moves of a completed occurrence are still unrestricted (as this entry originally
  leaned), and the one case that did need a guard (demoting to the bucket) already has one via
  `planner_spec_020`. No code change; entry marked resolved in `future_ideas.md`.

## Recommended to defer to V2 (or later)

- **`planner_spec_026`/`frontend_spec_055` (activity recurrence + due dates + Reminders page)** —
  already explicitly labeled V2 in its own header, and covers V2's "recurring activities" theme from
  `product.md`. Good opening pair for V2 precisely because both specs are already fully written —
  recommend starting V2 with this pair rather than re-specifying something new from scratch.
- **Overdue banner/icon, Pair 2** (`future_ideas.md`) — explicitly scoped as depending on the
  recurrence/reminders pair above shipping first. Falls naturally right after it in V2.
- **End-of-week reflection journal** (`future_ideas.md`) — the user themselves flagged this as
  "probably out of V1 scope" when raising it. Pairs naturally with V2's mood/pleasure/achievement
  ratings theme (`product.md`'s V2 row) — worth scoping alongside that work rather than in isolation.
- **Icon+text treatment for Add/Edit/Delete CTAs** (`SPEC_CANDIDATES.md`) — needs a full cross-app
  UX audit (every CTA site, which get icon-only vs. icon+text) before it's even spec-able. Not a
  finishing touch; a standalone UX initiative whenever there's time to do it properly.
- **"Weekend bucket list" label shown outside weekend contexts** (`SPEC_CANDIDATES.md`) — explicitly
  flagged as the weakest-confidence candidate in its own batch. Recommend skipping unless it becomes
  a real, recurring point of confusion in actual use rather than a hypothetical one.
- **Touch-friendly weekend bucket list reordering** and **sub-task completion progress ("2/3
  done")** (both `SPEC_CANDIDATES.md`) — both already explicitly deferred in their own entries (no
  confirmed mobile usage; blocked on an unresolved "what does 'done' mean" product decision,
  respectively). Nothing has changed to pull either forward now.
- **CI + automated end-to-end testing** (`SPEC_CANDIDATES.md`) — flagged in the 2026-10-06 audit as
  the single biggest structural gap in the project, but explicitly "needs a scoping conversation
  first" (provider, what runs when, which e2e tool, retroactive-vs-new-only coverage). This is not a
  product feature for either V1 or V2 — recommend treating it as its own cross-cutting initiative,
  with the scoping conversation and initial setup landing **right at the V1/V2 boundary**, before V2
  adds health-sensitive mood/reflection data that will make regressions costlier to catch late.
- **Everything else still open in `future_ideas.md`** — JUnit parallel test execution, the composite
  index + `useMemo` perf pair, finer-grained/custom time slots, pagination on
  `GET /api/v1/activities`, self-hosted/local LLM inference, user registration. Each already carries
  its own "not yet, revisit if X actually happens" reasoning, and nothing has changed since those
  were logged to justify pulling any of them forward. Recommend leaving all of them exactly as
  deferred.

## Not actionable now

`HIGH_LEVEL_DESIGN.md` §6's long list of explicitly-deferred future features (mobile/PWA,
notifications, calendar integration, therapy-worksheet import, therapist-facing export, multiple
activity templates, natural-language activity entry, voice input, activity-effectiveness scoring,
social/connection tracking) stays untouched — these were never in scope for this triage and nothing
here changes that.

## Summary table

| Item | Recommendation |
|---|---|
| `frontend_spec_049_undo_delete.md` | Build now (V1 close-out) — still outstanding |
| `frontend_spec_052_slot_item_counts.md` | Build now (V1 close-out) — still outstanding |
| "Duplicate activity" quick action | ✅ Specced (`frontend_spec_056`) — not yet implemented |
| Category-colour swatch discoverability | ✅ Specced (`frontend_spec_057`) — not yet implemented |
| Password recovery (locked-out user) | ✅ Delivered — `hashPassword` Gradle task + RUNBOOK recipe |
| "Completed occurrence movable?" | ✅ Resolved — confirmed correct, no code needed |
| Recurrence + due dates + Reminders page (`planner_spec_026`/`frontend_spec_055`) | Defer — start V2 with this pair |
| Overdue banner/icon (Pair 2) | Defer — after the pair above |
| End-of-week reflection journal | Defer to V2, alongside mood ratings |
| Icon+text CTA treatment | Defer — needs a full UX audit first |
| "Weekend bucket list" label rename | Skip unless it becomes a real recurring complaint |
| Touch-friendly bucket reordering | Stay deferred — no confirmed need |
| Sub-task "2/3 done" progress | Stay deferred — blocked on a product decision |
| CI + automated e2e testing | Scope + start right at the V1/V2 boundary |
| Remaining `future_ideas.md` perf/scale/scope items | Stay deferred, no change |
