# Frontend Modern-Web-Guidance Audit (Tooling)

**Status**: Not started

**Priority**: P3 — quality/discoverability pass, no new user-facing capability and no code change
of its own.

**Depends on**: `.claude/modern-web-guidance/reviews/review-2026-10-01.md` (the precedent this
spec reruns, scoped much more narrowly — layout/forms/theming/dialogs/drag-and-drop only, against
the much smaller component tree that existed then), `tooling_spec_003_modern_web_guidance_fixes.md`
(the precedent for how that review's findings actually got actioned — fixed directly, since they
were confirmed trivial and behaviour-safe; this spec's findings are routed through the idea
pipeline instead, per this spec's own scope decision below)

**Area**: Frontend — tooling/audit only. No backend involvement, no `API.md` update.

**Roadmap version**: N/A — internal/maintenance, not a V1–V5 feature (matches
`tooling_spec_003`'s precedent).

## Overview

Re-runs a `modern-web-guidance` plugin audit (`GoogleChrome/modern-web-guidance`, already enabled
in this user's Claude Code settings) across the **entire current frontend component tree**, not
just what's changed. The only prior audit, `review-2026-10-01.md`, was scoped to five topics
(layout, forms/inputs, theming, dialogs/modals, drag-and-drop) against a much smaller codebase. A
great deal has shipped since without ever being checked against current web-platform best
practices: the Weekly Summary tab and its visualisations, work-day marking, per-occurrence notes,
change password, data export, the preset/starter activity bank, Activity Bank category grouping,
sub-task reordering, and — immediately before this spec was written — the undo-delete window
(`frontend_spec_049_undo_delete.md`). The plugin's own bundled guide library has also likely grown
since 2026-10-01 (it now includes, for example, a `performance` category covering Core Web
Vitals/INP, and several `ui-components` guides — toasts, progress, spinners — that may not have
existed or been searched last time), so even already-reviewed areas may be worth a second pass
against guides that didn't exist when they were first checked.

**Starting finding, already known — carry forward, don't rediscover**: while implementing
`frontend_spec_049`, the `ui-components/persistent-toast-notifications.md` guide was checked
directly (see "Prerequisite" below for why) against the new "Undo" notice. That guide's MANDATORY
recommendation for a transient, auto-dismissing notification is `popover="manual"` (Top Layer
promotion, immune to surrounding overflow/scroll/z-index, built-in multi-toast stacking via
`sibling-index()`); the shipped implementation instead uses a plain `<p role="status">` in normal
document flow, matching this app's existing inline-alert convention elsewhere (`deleteError`,
`loadError`) and deliberately keeping the notice spatially anchored to the row it replaced. The
user reviewed this specific tradeoff and chose to leave it as-is. This audit's review document
should record it as an already-reviewed, accepted deviation — not re-raise it as a fresh finding.

**Prerequisite — confirm the skill is actually invokable before starting**: the plugin is enabled
in `~/.claude/settings.json` (`"modern-web-guidance@googlechrome": true`), but invoking
`modern-web-guidance:modern-web-guidance` via the `Skill` tool returned `Unknown skill` in the
session that hit the toast-notification finding above — it had to fall back to reading the
plugin's bundled guide files directly from
`~/.claude/plugins/marketplaces/googlechrome/skills/modern-web-guidance/guides/` instead. That
fallback is a workaround for one or two targeted lookups, not a substitute for the skill's intended
live search tool (`npx modern-web-guidance@latest search "<query>"`) across the dozens of queries a
full audit needs — don't silently default to it for this spec. If the skill still isn't invokable
when this spec is picked up, troubleshoot first (e.g. restart Claude Code so the newly-enabled
plugin is actually loaded into the session) rather than working around it again.

**Scope — findings-only, full tree**: this spec produces a dated review document and routes every
actionable finding through the existing idea pipeline (`.claude/ideas/future_ideas.md` →
`.claude/SPEC_CANDIDATES.md` → a real spec, per `CLAUDE.md`'s "idea pipeline" convention) — it does
**not** fix anything itself. This is a deliberate scope decision (confirmed with the user), unlike
`tooling_spec_003`, which fixed its review's findings directly because they were confirmed trivial
and behaviour-safe; this review covers a much larger, more varied surface where that won't uniformly
hold, so triage-before-building is the safer default. The audit itself covers the **full** current
component tree (`frontend/src/components/**` — currently `ActivityBank`, `CategoryChip`,
`CategoryGroupHeading`, `FavouriteIcon`, `Modal`, `Navigation`, `RepeatableIcon`, `Settings`,
`WeeklyPlanner`, `WeeklySummary`, `icons`, plus `App.tsx`, `theme.css`, `index.css`, `main.tsx`,
`vite.config.ts`, `index.html`), not just whatever's changed since 2026-10-01 — confirmed with the
user over the narrower incremental-only alternative, since several already-reviewed areas may now
have new relevant guides too (see Overview).

**Out of scope**: any source-code change (even a trivial one) — every finding, regardless of how
small or safe it looks, goes through the idea pipeline for a separate, later spec to actually act
on. `.claude/SPEC_CANDIDATES.md`'s existing "CI + automated end-to-end testing" candidate — a
distinct, non-blocking initiative (automated regression testing/CI infrastructure) with no
dependency in either direction on this one (a one-off manual best-practices audit).

## Requirement 1: The skill's invocability is confirmed before the audit starts

As the person running this audit, I want to know the plugin's search tool actually works before
relying on it for dozens of lookups, so the audit doesn't silently degrade into manual file-reading
for a scope that's too large for that to be practical.

### TOOLING-007-AC-01 [MANUAL — verified by a direct `Skill` tool invocation (or the plugin's `npx
modern-web-guidance@latest search "test"` CLI) succeeding before any topic lookup begins]: The
audit shall not proceed past this prerequisite check until the skill (or its CLI) responds
successfully — if it still reports `Unknown skill` or fails, the session/plugin install shall be
troubleshot first (e.g. a Claude Code restart), not worked around via manual guide-file reading for
the full audit.

## Requirement 2: The audit covers the entire current frontend tree, not just recent changes

As the person running this audit, I want every current component checked, including ones already
reviewed once, so guides added to the plugin since 2026-10-01 (e.g. performance/CWV, newer
`ui-components` guides) get applied retroactively too.

### TOOLING-007-AC-02 [MANUAL — verified by reading the resulting review document's "What was
done" section]: The review document shall record having read through every directory currently
under `frontend/src/components/`, plus `App.tsx`, `theme.css`, `index.css`, `main.tsx`,
`vite.config.ts`, and `index.html` — not a subset carried over unchanged from
`review-2026-10-01.md`'s own narrower scope.

### TOOLING-007-AC-03 [MANUAL — same verification method as AC-02]: The review document shall
record which topic queries were searched against the plugin's guide library, covering at minimum
every category with a locally-bundled guide directory as of this audit
(`accessibility`, `css`, `forms`, `html`, `js`, `performance`, `privacy`, `pwa`, `security`,
`ui-atoms`, `ui-behaviors`, `ui-components`, `visual-design`, `wasm`, `webmcp` — the exact set may
have grown by the time this spec is picked up; search whatever categories actually exist then, not
this fixed list).

## Requirement 3: Each guide is checked against the real implementation, not just feature presence

As the person running this audit, I want to know not just "is this feature used" but "is it used
correctly, including its required fallback," so a finding isn't a false negative just because the
underlying API happens to appear somewhere in the codebase.

### TOOLING-007-AC-04 [MANUAL — verified by reading each finding entry in the review document]: For
every guide retrieved during the audit, the review document shall record whether the actual
implementation satisfies that guide's MANDATORY requirements and fallback strategy specifically —
not merely whether the underlying web platform feature is used anywhere in the codebase (mirrors
`review-2026-10-01.md`'s own stated cross-checking method).

### TOOLING-007-AC-05 [MANUAL — same verification method as AC-04]: The known starting finding (the
undo-delete notice's `role="status"` vs. `popover="manual"` tradeoff, see Overview) shall appear in
the review document as an already-reviewed, accepted deviation — not re-raised as if newly
discovered, and not silently omitted either.

## Requirement 4: Findings are routed through the idea pipeline, never fixed inline

As the project maintainer, I want this audit's output to be a triaged backlog I can prioritise, not
a surprise diff touching dozens of files I didn't ask to change yet.

### TOOLING-007-AC-06 [MANUAL — verified by checking this spec's own git diff once "implemented"]:
This spec's implementation shall produce zero changes under `frontend/src/` — the audit is a
read-only pass over the existing codebase.

### TOOLING-007-AC-07 [MANUAL — verified by cross-checking each review-document finding against
`future_ideas.md`/`SPEC_CANDIDATES.md`]: Every finding in the review document marked as actionable
(i.e. not already-following-best-practice, and not an already-reviewed accepted deviation per
AC-05) shall have a corresponding entry added to either `.claude/ideas/future_ideas.md` (raised,
not yet confirmed worth building) or `.claude/SPEC_CANDIDATES.md` (confirmed worth a spec
eventually), per the existing idea-pipeline convention — none left undocumented outside the review
file itself.

## Requirement 5: The review is dated and discoverable like its predecessor

As a future reader, I want this audit to be findable the same way the last one is, so the project's
audit history stays in one place.

### TOOLING-007-AC-08 [MANUAL — verified by checking the file exists at the stated path with the
stated structure]: A new file `.claude/modern-web-guidance/reviews/review-<YYYY-MM-DD>.md` (dated
the day the audit is actually run, not this spec's own write date) shall exist, structured like
`review-2026-10-01.md` — a "What this is" section, a "What was done" section, and a "Findings"
section split into "Already following current best practice" and "Worth considering".

## Cross-references

| Reference | What it provides |
|---|---|
| `.claude/modern-web-guidance/reviews/review-2026-10-01.md` | The precedent this spec reruns at larger scope — same structure, same cross-checking method, much narrower topic/tree coverage |
| `tooling_spec_003_modern_web_guidance_fixes.md` | Precedent for *acting* on a prior review's findings (fixed inline there, because they were confirmed trivial/safe) — contrast with this spec's own findings-only scope decision |
| `.claude/ideas/future_ideas.md` / `.claude/SPEC_CANDIDATES.md` | Destination for every actionable finding (AC-07) |
| `.claude/SPEC_CANDIDATES.md`'s "CI + automated end-to-end testing" candidate | A distinct, non-blocking initiative — no dependency either direction |
| `frontend_spec_049_undo_delete.md` | Source of the known starting finding (AC-05) — the `role="status"` vs. `popover="manual"` tradeoff |
| `~/.claude/plugins/marketplaces/googlechrome/skills/modern-web-guidance/guides/` | The plugin's locally-bundled guide library (fallback reference only — AC-01 governs when this is and isn't an acceptable substitute for the live skill) |

## Acceptance Criteria Summary

- [ ] TOOLING-007-AC-01 — the skill's (or its CLI's) invocability is confirmed before the audit starts
- [ ] TOOLING-007-AC-02 — the review records reading through the full current component tree, not a stale subset
- [ ] TOOLING-007-AC-03 — the review records which topic queries were searched, covering every current guide category
- [ ] TOOLING-007-AC-04 — each finding records whether MANDATORY requirements + fallback are satisfied, not just feature presence
- [ ] TOOLING-007-AC-05 — the known undo-delete toast/`role="status"` tradeoff appears as an already-reviewed, accepted deviation
- [ ] TOOLING-007-AC-06 — this spec's implementation makes zero changes under `frontend/src/`
- [ ] TOOLING-007-AC-07 — every actionable finding gets a corresponding `future_ideas.md`/`SPEC_CANDIDATES.md` entry
- [ ] TOOLING-007-AC-08 — a dated, correctly-structured review document exists at the expected path
