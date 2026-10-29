# Future Ideas

Deferred features, gaps, and improvements noted along the way but not scheduled against a spec.
Collected here so they're discoverable in one place instead of scattered across individual spec
files or lost in conversation history.

**Pipeline**: `future_ideas.md` (raw, unconfirmed) → `.claude/SPEC_CANDIDATES.md` (confirmed worth
building, not yet spec'd) → a real spec exists, tracked in `ROADMAP.md`'s "Specced, coming soon"
table → implemented, row moves to "Delivered" → `CHANGELOG.md` (shipped). An idea moves out of this
file into `SPEC_CANDIDATES.md` once it's confirmed worth specifying — don't leave it duplicated in
both.

**Maintenance rule**: every item here carries a `Status` line. Before adding a new item or
touching this file, re-check existing items against the current codebase — code this file
references may have moved or changed shape since the note was written.
- **Delivered** — the idea shipped. Keep only a one-line description + the spec(s) that delivered
  it, for traceability; drop the original speculative detail.
- **Specced, not yet built** — a real spec already exists. Reference the spec name only — move the
  entry to `ROADMAP.md`'s "Specced, coming soon" section instead, at that point.
- **Not specced** — retain full detail: what's actually required, why, and any relevant
  constraints or prior discussion.

**Formatting convention**: shared with `.claude/SPEC_CANDIDATES.md` — see that file's own
"Formatting convention" note (same pipeline, same structure) for the review-log-date and
`Status`-code-block rules both files follow.

---

**Last full review:** `2026-10-01` (re-checked every entry against current codebase state):

- fixed a stale `PlannedActivity.slot` reference to the real `PlannedOccurrence.slot`, updated the drag-and-drop
entry's cross-reference from a since-promoted `SPEC_CANDIDATES.md` candidate to the real specs it
became
- removed the "Activity Bank UX improvements" batch entirely now that every item in it has
either shipped or moved to `ROADMAP.md`/`SPEC_CANDIDATES.md`
- fixed wording in the summary-strip
entry that implied `frontend_spec_008` hadn't shipped yet, and removed the "Sub-task category
drift" entry — now specced as `planner_spec_014_subtask_category_cascade.md`, see
`ROADMAP.md`'s "Specced, coming soon".
- removed the "already-open sub-task panel
doesn't refresh" entry too — now specced as `frontend_spec_023_subtask_panel_refresh_on_edit.md`.
- split the "Drag-and-drop in the week planner" entry in two — the
already-planned-item-move half is now specced as `frontend_spec_025_grid_drag_to_move.md` (see
`ROADMAP.md`); this file keeps only the remaining not-yet-specced half (sidebar/drawer assign-by-
drag for unplanned activities).

`2026-10-02`

- added a third drag-and-drop idea, dragging between the grid and the weekend bucket
list — carved out as explicitly out-of-scope by `frontend_spec_025_grid_drag_to_move.md`.
- added "Should a completed occurrence be movable?", raised while reviewing that
same spec. Later the same day: the grid/bucket cross-drag idea moved straight to a real spec
(`frontend_spec_026_grid_bucket_cross_drag.md`, see `ROADMAP.md`'s "Specced, coming soon") without
passing through `SPEC_CANDIDATES.md` — removed from this file.
- the "favourite activities" aside mentioned inside the sidebar/drawer entry moved straight
to its own real spec pair (`planner_spec_015_favourite_activities.md`/
`frontend_spec_027_favourite_activities.md`, see `ROADMAP.md`'s "Specced, coming soon"), decoupled
from the sidebar/drawer idea it was raised alongside — the sidebar/drawer entry itself remains here,
trimmed to remove the now-specced favourites mention.
- the sidebar/drawer entry itself ("Drag-and-drop in the week planner: assign an
unplanned activity via a sidebar/drawer") moved to a real spec
(`frontend_spec_028_activity_drawer.md`, see `ROADMAP.md`'s "Specced, coming soon") — the design pass
it was waiting on (panel placement, filter reuse) is done; removed from this file. This closes out
the three-way split of the original "drag-and-drop in the week planner" idea
(`frontend_spec_025`/`026`/`028`).

`2026-10-03`

- the "Weekly grid completion/category-balance summary strip" entry moved to a real spec,
reshaped from an inline strip into a full top-level tab per the user's own framing when confirming
it — `frontend_spec_036_weekly_summary.md`, see `ROADMAP.md`'s "Specced, coming soon" — removed from
this file.

`2026-08-27`

- V1 high-level planning session.

---

**Last updated:** `2026-10-06`

- added two new ideas, raised by the user after `planner_spec_024`/`frontend_spec_050_change_password.md`
  shipped: a password-recovery path for a locked-out user (no email field exists, no recovery today
  beyond wiping the database), and user registration (already settled as deliberately out of scope
  by `HIGH_LEVEL_DESIGN_FEEDBACK.md` §7a, logged here for discoverability rather than re-litigated) —
  see entries below.
- re-reviewed the "Pagination on `GET /api/v1/activities`" entry at the user's request, with real
  dev-data research backing it up — still not specced, now for a sharper reason (pagination
  actively conflicts with the current client-side-filtering UI, not just "no urgency yet"). The
  same research found one real, separate, actionable bug — moved straight to a real spec,
  `frontend_spec_048_today_view_picker_mutual_exclusion.md` — see that entry's own note.
- added two new ideas, items 5 and 6 of `.claude/audits/audit-2026-10-06.md`'s non-functional
  audit: enabling JUnit parallel test execution, and a missing index plus uncached list sorts both
  flagged as real but below the threshold worth fixing at this app's current scale — see entries
  below.
- added three new candidates, raised by the user while reviewing the just-shipped Suggested
  activities feature: marking days as "work days", per-occurrence notes, and Activity Bank
  sorting/organization.
- the "Mark specific days as work days" entry moved straight to a real spec pair
  (`planner_spec_021_work_day_marking.md`/`frontend_spec_042_work_day_marking.md`, see
  `ROADMAP.md`'s "Specced, coming soon") the same day it was raised, once the user confirmed the
  hybrid-pattern/visual-only/both-surfaces scoping — removed from this file.
- the "Notes on individual planned occurrences" entry's open questions were all resolved in a
  planning session the same day (200-char limit with `@Size` validation, a dedicated endpoint
  rather than extending the move endpoint, autosave-on-blur, and has-notes indicators on both the
  tile and the Weekly Summary tooltip) — moved straight to a real spec pair
  (`planner_spec_022_occurrence_notes.md`/`frontend_spec_043_occurrence_notes.md`, see
  `ROADMAP.md`'s "Specced, coming soon") — removed from this file.
- the "Sorting/organizing the Activity Bank as it grows" entry's open question was resolved
  the same day: category-grouped display (reusing `frontend_spec_040`'s Suggested Activities
  pattern) over a sort control or manual drag-to-reorder, given no `position` field exists on
  `Activity` and the bucket list's own drag gesture is known to be untestable by automated
  browser tooling — moved straight to a real frontend-only spec
  (`frontend_spec_044_activity_bank_grouping.md`, see `ROADMAP.md`'s "Specced, coming soon") —
  removed from this file.

---

**Last updated:** `2026-10-14`

- added a new idea, raised by the user: recurring activities with a repeat period and a
  due/reminder date, plus a new Reminders area and an overdue-activity banner/icon.
- the same day, in a planning session, the idea was split and most of it moved straight to real
  specs: the recurrence interval + auto-set/editable due date + the read-only Reminders page is now
  `planner_spec_026_activity_recurrence_and_due_dates.md` /
  `frontend_spec_055_reminders_page.md` (see `ROADMAP.md`'s "Specced, coming soon") — removed from
  this file. Only the remaining, still-unspecced half (the overdue banner/icon, deliberately scoped
  as a Pair 2 follow-up depending on that pair shipping first) stays below.

---

**Last updated:** `2026-10-29`

- added a new idea, surfaced while implementing/verifying `frontend_spec_049_undo_delete.md`: the
  Vitest/RTL suite can't catch a mount effect that doesn't idempotently reset its own guard/flag
  state across React `<StrictMode>`'s dev-mode double-invoke-on-mount behavior — see entry below.

---

## Overdue-activity banner/icon (Pair 2 of the recurrence/reminders idea)

```
Status: Not specced — depends on planner_spec_026/frontend_spec_055 (Pair 1) shipping first.
```

Raised `2026-10-14` alongside the recurrence/due-date/Reminders-page idea above, which has now
moved to real specs (`planner_spec_026_activity_recurrence_and_due_dates.md` /
`frontend_spec_055_reminders_page.md`). This is the remaining half: an icon/banner surfaced
elsewhere in the app (e.g. header or nav) flagging when there are "unplanned overdue" activities —
overdue per `nextDueAt`, and not currently sitting anywhere on the live plan (current week's grid or
bucket list, not yet completed) — so the user notices without having to visit the Reminders page
proactively.

Not specced yet because it depends on Pair 1's `nextDueAt`/`GET /api/v1/reminders` actually existing
first, and the precise definition of "unplanned" (no live `PlannedOccurrence` for the activity vs.
some narrower/broader check) is still an open design question to resolve when this gets picked up.

Open questions, not yet resolved: exact period options (fixed presets like weekly/monthly/every-N-
months vs. a free interval picker), whether the auto-set reminder date is user-editable afterward,
how this relates to the existing bucket-list carry-forward automation
(`frontend_spec_011_bucket_carry_forward_automation.md`) — a distinct concept or a variant of the
same mechanism — and exactly where the overdue banner/icon should surface.

## Password recovery for a locked-out user

```
Status: Delivered (2026-10-29) — the lighter-weight RUNBOOK path, not a full email-reset flow.
```

Raised `2026-10-06`. Delivered as the lighter-weight alternative this entry itself identified: a
new `hashPassword` Gradle task (`backend/build.gradle.kts`, `security/PasswordHashCli.java` — no
Spring context, no database access, just prints a BCrypt hash) plus a documented manual `UPDATE`
recipe, see `RUNBOOK.md`'s "Recovering a locked-out user" section. No email field, no email-sending
infrastructure, no new spec — matches this app's actual deployment model (self-hosted, single user,
already has direct database access). The full email-based reset flow this entry considered and
rejected stays rejected unless multi-user support ever becomes real (see the "Registration" entry
below).

## User registration (multi-user sign-up)

```
Status: Not specced — deliberately deferred by prior architecture decision, not an oversight.
```

Raised `2026-10-06`, prompted by the user noticing there's no sign-up UI anywhere in the app. This
isn't a gap to fix — it's a settled decision. `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7a explicitly
addresses this: owner-association on every entity and real Spring Security auth were built in from
V1 as *seams* for possible future multi-user support, but registration/invite flows were deliberately
left out — *"building those now would be speculative"* — until there's an actual concrete second
user. The single account today is created entirely via `.env`'s `APP_BOOTSTRAP_USERNAME`/
`APP_BOOTSTRAP_PASSWORD` on first startup, by design.

Logged here only for discoverability (so this doesn't get re-raised as a surprise gap later), not
because it's newly worth building. Revisit only if this app ever actually needs to support a second
real person — at that point, this entry and the password-recovery entry above both become much more
clearly justified together, rather than either being worth building in isolation for a single user.

## Enable JUnit Platform parallel test execution for the backend suite

```
Status: Not specced.
```

Raised `2026-10-06`, item 5 of `.claude/audits/audit-2026-10-06.md`'s non-functional audit. The
backend Spock suite (327 tests, 34 classes) currently runs single-threaded, single-JVM — `gradlew.bat
test`'s `useJUnitPlatform()` call sets no `maxParallelForks` and no JUnit Jupiter parallel-execution
properties. A real, measured 27.6s full run today is not slow enough to justify turning this on.

Turning it on isn't free when it does become worth doing: 7 of the suite's specs are real-Postgres
`@SpringBootTest` integration tests sharing one database with no per-class isolation. Each one's
cleanup strategy (most use `cleanup:` blocks today) would need checking before running them
concurrently, to avoid cross-test interference. Revisit once the suite is actually slow enough to
annoy someone in daily use, not before — this is a lever to have ready, not a problem to solve now.

## Composite index for `PlanService.migrateStaleBucketItems`'s query, and `useMemo` on reorderable list sorts

```
Status: Not specced.
```

Raised `2026-10-06`, item 6 of `.claude/audits/audit-2026-10-06.md`'s non-functional audit. Two
small, unrelated performance observations, both real but below the threshold worth fixing at this
app's current single-user V1 scale:

- `migrateStaleBucketItems` runs on every `GET /api/v1/plan` request (the hottest query path in the
  app) via `findByOwnerAndDayOfWeekIsNullAndSlotIsNullAndWeekStartBefore`, with no composite index
  covering it — its two sibling queries both have full index coverage, this one doesn't. At
  realistic bucket-list sizes (low tens of rows) this is sub-millisecond regardless of the missing
  index; it's a consistency gap against the other two queries more than a performance one today.
- `SubTaskList.tsx` and `BucketList.tsx` both re-sort their list on every render with no `useMemo`
  around the `.sort()` call. The largest real checklist observed during testing was 12 items — a
  `.sort()` over a dozen items is sub-millisecond, and adding `useMemo` here would mean a dependency
  array to keep correct for no measurable gain at today's list sizes.

Revisit either only if real usage ever grows list/dataset sizes enough for these to become
measurable — don't add the index or the memoization ahead of that actually happening.

## Vitest/RTL can't catch a mount effect that doesn't survive React StrictMode's double-invoke

```
Status: Not specced.
```

Raised `2026-10-29`, surfaced while implementing and real-browser-verifying
`frontend_spec_049_undo_delete.md`. A real bug shipped in that spec's first pass: a mount-tracking
`useEffect` only set `isMountedRef.current = false` in its cleanup, never resetting it to `true` in
its setup. `main.tsx` wraps the whole app in `<StrictMode>`, which deliberately double-invokes every
effect once on initial mount in development (mount → run effects → simulate unmount, run cleanups →
simulate remount, run effect setups again — all on the same component instance, to help catch
exactly this class of bug). That left `isMountedRef.current` permanently `false` for the rest of the
component's real lifetime, silently disabling a deferred-action's own success/failure state updates
in every real dev-mode browser session, while the underlying API call still fired and succeeded —
confirmed the hard way: an actual seeded activity got deleted for real while its "Undo" notice stuck
around forever, visually implying nothing had happened yet.

The automated suite (694 tests passing throughout) never caught this, and structurally can't:
production builds don't double-invoke effects (so this never manifests in what actually ships), and
React Testing Library's `render()` doesn't wrap in `<StrictMode>` by default. A direct test was
tried — wrapping the component under test in `<StrictMode>` inside `render()` — and it passed
identically against both the buggy and the fixed code, meaning Vitest's React environment doesn't
reproduce StrictMode's double-invoke-on-mount behavior the way a real browser's dev build does. Only
real-browser verification caught this, which is exactly why this project's Definition of Done
already requires it for UI work — this is a concrete example of why, not just the usual CSS-can't-
be-tested-in-jsdom case.

Not yet specced because the right shape of a fix is a real open question: possibilities include
finding a way to force Vitest's React build into genuinely double-invoking effects for a targeted
set of tests (unclear if this is even achievable without deeper Vitest/React config changes), a
lint rule or code-review checklist item flagging the "cleanup sets a ref/flag but setup never resets
it" pattern specifically, or simply accepting this as a known gap that real-browser verification
exists to catch and not chasing automated coverage for it at all. Revisit if this exact bug shape
(a mount-effect guard that doesn't idempotently reset) turns up again in a future spec — two
occurrences would be a much stronger signal that it's worth solving generically rather than
case-by-case.

## Finer-grained/custom time slots for planned activities

```
Status: Not specced.
```

V1's `PlannedOccurrence.slot` is a fixed `MORNING`/`AFTERNOON`/`EVENING`
enum (nullable, for bucket-style entries). Raised during V1 planning: hourly or specific-time
scheduling might be wanted later. Deliberately not built now — nothing in the current roadmap needs
it, and building generic time-scheduling ahead of a real requirement would be solving a problem
V1 doesn't have. The `slot` field is named generically (not something like `ThreePartDay`) and left
nullable specifically so this would most likely be an *additive* future change (e.g. an optional
`plannedTime` alongside the coarse `slot`), not a schema redesign, when/if it's actually needed.

## Should a completed occurrence be movable?

```
Status: Resolved (2026-10-29) — current behaviour confirmed correct, no further action.
```

Raised 2026-10-02 while reviewing `frontend_spec_025_grid_drag_to_move.md`. This entry's own
"current lean" — allow moving a completed occurrence between grid day/slot cells, don't restrict —
is confirmed still exactly what `PlanService.applyMove` does today (re-checked 2026-10-29): the
`else` branch (grid-to-grid moves) has no completion check, only the bucket-targeting branch does,
and that one's gate shipped separately as its own real fix —
`planner_spec_020_prevent_completed_occurrence_bucket_move.md` (a completed occurrence cannot be
demoted to the bucket, `409 BucketMoveNotAllowedException`) — which this entry's original framing
didn't cover (it was specifically about day/slot moves, not bucket demotion). Between the two,
nothing about this question is still open: grid-to-grid moves stay unrestricted (the real "fix the
record after the fact" use case this entry identified), and the one case that genuinely needed a
guard (silently losing a scheduled slot while marked done) already has one. No spec needed for the
unrestricted half — it's confirmed-correct existing behaviour, not a change.

## Dedicated activity-history view/endpoint

```
Status: Not specced.
```

V1 satisfies "basic activity history" (a V1 feature bullet in
`HIGH_LEVEL_DESIGN.md`) by letting `weekStart` on the existing `GET /api/v1/plan` navigate to past
weeks — no separate history page or endpoint. Confirmed during V1 planning as fine for V1; a richer
standalone history view (filtering/searching past completions independent of the week-by-week
navigation) is a plausible later addition once the week planner itself is in real use.

## From the feasibility review (`.claude/HIGH_LEVEL_DESIGN.md` §6 — potential future features)

These are explicitly *not* part of the initial build per the design doc, listed here for
discoverability rather than restated in full — see the design doc itself for the complete list:

```
Status: Not specced.
```

Deliberately deferred, should only be pulled forward if they emerge
naturally from real usage (per the design doc's own framing): mobile/PWA, notifications, calendar
integration, therapy-worksheet import, therapist-facing export, multiple activity templates,
natural-language activity entry, voice input, local/on-device AI, more sophisticated trend
analysis, activity effectiveness scoring, social/connection activity tracking.

## End-of-week reflection (light journal, no scoring)

```
Status: Not specced.
```

Raised by the user 2026-09-29, explicitly flagged as probably out of V1
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

```
Status: Not specced.
```

Raised 2026-10-02 during a deliberate performance investigation (alongside
`planner_spec_017_plan_response_n_plus_one.md`/`planner_spec_018_bulk_sub_task_fetch.md`, the two
findings from that same pass that *were* confirmed worth specifying). `GET /api/v1/activities`
returns every activity owned by the user in one unbounded list, with no `limit`/`offset`/cursor —
matches this app's stated personal/small-scale use (`.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7a),
genuinely fine today and for the foreseeable future. Logged here, not actioned, in case the activity
count ever grows enough (e.g. heavy multi-user adoption) for an unbounded response to start mattering
— revisit only if that actually happens, don't build pagination ahead of a concrete need for it.

**Re-reviewed `2026-10-06`**, prompted by the user asking to scope this into a real spec. Research
first, before writing one: real current data (queried the live dev backend) is **20 activities, 23
sub-tasks total** — the "genuinely fine" assessment still holds, four days on. `GET /api/v1/sub-tasks`
(the bulk endpoint) is the only other genuinely unbounded list endpoint — everything else is bounded
by week or by parent activity. More importantly, standard pagination would actively conflict with
today's UI: `ActivityBank.tsx`'s category grouping and "Favourites only" filter both operate
client-side over the *entire* fetched list — paginating the response would mean a category group
could span two pages, or "Favourites only" could miss a favourite sitting on an unfetched page.
**Still not specced, and now for a sharper reason than just "no urgency": pagination as commonly
understood is the wrong shape for how this app's UI actually works today.** If list length ever does
become a real pain point, a search/filter param is the more likely right fix, not paging — revisit
with that framing, not this one. (The same research pass did turn up one real, separate, actionable
finding — a redundant-fetch bug in `TodayView.tsx` — which went straight to a real spec,
`frontend_spec_048_today_view_picker_mutual_exclusion.md`, rather than staying in this file.)

## Self-hosted/local LLM inference for AI features

```
Status: Not specced — deliberately deferred, not rejected.
```

See `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7b: CPU-only inference is too slow for good UX without a
GPU, and expected call volume is low enough that a hosted free API will be cheaper/faster. Only
reconsider if a real data-sovereignty requirement (mood/mental-health data never leaving
user-controlled infrastructure) forces it later — that would be the actual justification, not cost
or latency.
