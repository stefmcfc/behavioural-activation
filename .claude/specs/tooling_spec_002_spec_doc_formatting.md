# Trim Spec Status Headers, Add a Summary Section, Tidy Formatting (Tooling)

**Status**: In progress — AC-01 and AC-03 done (2026-10-01); AC-02's retroactive per-spec tidy-up
not yet started
**Priority**: P3 — documentation quality, no behavior change
**Depends on**: `.claude/steering/ears_format.md` (the convention this spec amends),
`tooling_spec_001_unmapped_route_404.md` (precedent for a tooling spec with no single feature)
**Area**: Tooling/documentation — no backend or frontend code touched
**Roadmap version**: N/A — maintenance, not tied to a V1–V5 theme

## Overview

Raised by the user 2026-10-01 while reviewing `ROADMAP.md`'s row bloat (see that file's own "Last
full audit" note — rows were trimmed to one line in the same session this spec was written).
`ROADMAP.md`'s rows had grown enormous because every spec's full implementation narrative — test
counts, real findings, same-day amendment rounds, bugs found and fixed, real-browser verification
notes — was being duplicated in two places: the spec file's own `Status` header, and the ROADMAP
row. `ROADMAP.md` is now fixed to a one-line-per-row index. This spec fixes the other half: the
spec files themselves, where the same narrative had been crammed into a single `Status` *line* that
in practice grew into dense, unformatted multi-paragraph walls of text (see
`frontend_spec_009_add_picker_modal.md`'s `Status` header for the clearest example — three amendment
rounds, a found-and-fixed bug, and cross-references to other specs, all run together with no
sub-structure).

Two changes:

1. **Amend `.claude/steering/ears_format.md`**: split what currently lives in one `Status` line into
   two things — `Status` stays genuinely one line (`Not started` / `In progress` / `Implemented
   (date)`), and a new `## Summary` section (present once a spec reaches `Implemented`) carries
   everything else — test counts, real findings, amendment rounds, verification notes — formatted
   with subheadings/bullet lists, not dense paragraphs. This is the convention going forward for
   every spec, not just a one-time cleanup.
2. **Retroactively tidy every currently-`Implemented` spec file** to match: trim its `Status` line,
   move the narrative into a new `## Summary` section, reformat it into scannable bullets/subheadings
   instead of copying the wall of text verbatim. `Overview` sections are left untouched — they're the
   original pre-implementation intent and stay that way as a historical record; only the
   post-implementation narrative that had been bolted onto `Status` moves out.

No code changes — this is a documentation-only pass across `.claude/specs/*.md` and
`.claude/steering/ears_format.md`.

## Requirement 1: Define the Status/Summary split in steering

**User story**: As someone (or something) writing or updating a spec, I want a clear convention for
where implementation narrative goes, so `Status` stays scannable and detail has one obvious home
instead of two places it might end up duplicated.

### TOOLING-002-AC-01 [MANUAL]: ears_format.md defines Status as one line and introduces Summary
**Statement**: `.claude/steering/ears_format.md`'s "Structure of a spec" section shall define
`Status` as a single line (`Not started` / `In progress` / `Implemented (date)`, optionally with a
pointer to implementing files) and shall introduce a `## Summary` section — present once a spec
reaches `Implemented`, positioned directly after the header block and before `Overview` — as the
designated home for implementation narrative (test counts, real findings, amendment rounds,
verification notes), with explicit guidance to use subheadings/bullet lists rather than dense
paragraphs.

**Rationale**: Without an explicit rule, narrative detail drifts back into `Status` the same way it
did before — a one-off cleanup doesn't stick without the steering doc itself changing.

**References**:
- `.claude/steering/ears_format.md`'s existing "Structure of a spec" section (numbered list,
  currently item 1 covers the header including `Status`).
- Verified (not an automated test): read the amended section and confirm it states both halves of
  the rule explicitly — the one-line `Status` constraint, and `Summary`'s placement/formatting
  guidance — rather than just adding `Summary` without constraining `Status`, which would let the
  same bloat recur there instead.

**Verification**: `[MANUAL]` — human review of the amended `ears_format.md` section for clarity and
completeness. No automated test applies to a documentation-convention change.

## Requirement 2: Retroactively tidy every Implemented spec

**User story**: As someone opening a spec file to understand what actually shipped, I want a short
`Status` line and a well-formatted `Summary` section, not a multi-paragraph wall of text I have to
parse to find the one fact I need (e.g. "is this done, and were there any real surprises").

### TOOLING-002-AC-02 [MANUAL]: Every Implemented spec has a one-line Status and a formatted Summary
**Statement**: For every spec file in `.claude/specs/` currently at `Implemented` status (per
`ROADMAP.md`'s Delivered table, both backend and frontend specs for paired features), the file shall
have its `Status` line trimmed to one line and its post-implementation narrative moved into a new
`## Summary` section, reformatted into subheadings/bullet lists rather than left as continuous prose.

**Rationale**: The actual fix — without this, the steering amendment (AC-01) only changes behavior
for specs written from now on, leaving every existing spec exactly as bloated as before.

**References**:
- Full list of files in scope: every spec linked from `ROADMAP.md`'s Delivered table at the time
  this spec is implemented (`frontend_spec_001`–`frontend_spec_023`,
  `planner_spec_001`–`planner_spec_014`, as applicable — check the actual current Delivered table
  rather than trusting this list, since more specs may deliver before this is implemented).
- `frontend_spec_009_add_picker_modal.md` — the specific example raised by the user; use it as the
  worked example/template for the reformatting pattern, since it has the densest `Status` header in
  the project (three amendment rounds + a found-and-fixed bug, all run together).
- Each file's `Overview` section is explicitly **out of scope** — it's the pre-implementation intent
  and stays as originally written.

**Verification**: `[MANUAL]` — human review of each tidied file (or a sample, given the volume) for
readability and that no factual content was lost in the reformatting, only its structure changed.

### TOOLING-002-AC-03 [AUTO]: ROADMAP.md rows stay one line (regression guard)
**Statement**: `ROADMAP.md`'s Delivered and Specced-coming-soon table rows shall each remain a single
line of summary text, not re-accumulate the detailed narrative this spec moves into each spec's own
`Summary` section.

**Rationale**: `ROADMAP.md` was already trimmed in the same session that prompted this spec
(2026-10-01) — this AC exists so future spec-completion edits to `ROADMAP.md` don't quietly regress
back into duplicating `Summary` content there, now that `Summary` is the designated home for it.

**References**: `ROADMAP.md`'s own "Status column stays to one line" note (added in the same trim).

**Verification**: `[AUTO]`-adjacent but not code-testable — enforced by convention (the `ROADMAP.md`
note itself) rather than a Spock/Vitest test, since there's no code artifact to assert against. Treat
as a documentation lint: if a future ROADMAP row grows past roughly one line, that's the signal this
AC has regressed.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| Convention this spec amends | `.claude/steering/ears_format.md` ("Structure of a spec") |
| Worked example / densest current offender | `.claude/specs/frontend_spec_009_add_picker_modal.md` |
| The ROADMAP trim this spec follows up on | `ROADMAP.md` ("Status column stays to one line" note) |
| Precedent for a no-feature tooling spec | `tooling_spec_001_unmapped_route_404.md` |

## Acceptance Criteria Summary

- [x] TOOLING-002-AC-01 [MANUAL]: `ears_format.md` defines `Status` as one line and introduces `Summary`
- [ ] TOOLING-002-AC-02 [MANUAL]: Every `Implemented` spec has a one-line `Status` and a formatted `Summary`
- [x] TOOLING-002-AC-03 [AUTO]: `ROADMAP.md` rows stay one line (regression guard, enforced by convention)
