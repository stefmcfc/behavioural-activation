# Process Changes: README Split (2026-08-27)

This documents a documentation restructure applied to this project, for porting to another
project. Move this file into the target project's root, then ask Claude to apply the same
changes there (adjusting file/path names to match that project's structure and steering-doc
conventions).

## Motivation

`README.md` had grown two large, high-churn sections that didn't belong in a general-purpose
project overview:

- **API Overview** — a dense per-endpoint table that grows every time an endpoint changes.
- **Features Roadmap** — a 60-row table tracking every spec's build status, functionally a
  changelog of planned/in-progress work rather than project overview.

Both were split into their own root-level files. A related overlap was found and resolved at the
same time: this project already had two spec-tracking files (`SPEC_CANDIDATES.md` for
not-yet-written ideas, `OUTSTANDING_SPECS.md` for written-but-not-yet-built specs) — once the
roadmap file took over `OUTSTANDING_SPECS.md`'s job, that file's role became redundant, so it was
retired.

## Changes made

### 1. New file: `API.md`

- Moved the API Overview section out of `README.md` verbatim, **converted from a table to a
  list** (grouped by area — CRUD, search/export, lookup, recommendations, refresh, sorting — each
  endpoint as a `- **`METHOD /path`** — description` bullet).
- Kept the same level of detail as before (path/method/params/behavior notes) rather than adding
  full example request/response bodies — reasoning: this project plans to add springdoc-openapi
  later, and full examples now would either duplicate or immediately go stale against the
  generated docs once that lands. Full examples would be worth adding later as a small
  hand-picked "quickstart" `curl` section for the most-used endpoints, not a mechanical 1:1
  example-per-endpoint expansion.
- Also absorbed two adjacent paragraphs that were really API behavior, not general project info:
  the `sortBy`/`sortDirection` sorting-semantics note, and the CORS configuration paragraph.
- Added a maintenance-rule line at the top of the file stating it must be updated in the same
  change that creates/amends/deletes an endpoint.
- `README.md`'s API Overview section became a two-line pointer to this file.

### 2. New file: `ROADMAP.md`

- Moved the Features Roadmap table out of `README.md`.
- **Restructured from `Spec | Feature | Status` (one row per spec) to
  `Feature | Backend Spec | Frontend Spec | Status`** (one row per feature, pairing its backend
  and frontend specs in the same row). A backend-only or frontend-only feature just leaves the
  other spec column as `—`. Rationale: this project builds one backend spec + its matching
  frontend spec together as a pair (see the git-workflow "one spec pair in flight at a time"
  rule), so a single feature row with two spec columns matches how the work is actually planned
  and reviewed, instead of splitting one feature across two disconnected table rows.
- Kept the existing ✅ Done / ⬜ Not started status values plus free-text "superseded, see X"
  notes rather than forcing those into a strict enum — the free text carries real
  traceability value across many specs that were later superseded/folded into a replacement.
- Split into three sections: **Delivered**, **Specced, coming soon** (absorbs
  `OUTSTANDING_SPECS.md`'s old job — specs that are written but not yet built), and **Internal /
  maintenance specs** (a small separate table for pure-refactor specs with no user-facing feature
  name — these don't fit the `Feature | Backend | Frontend` shape and were previously tracked only
  in `OUTSTANDING_SPECS.md`).
- **Did a full audit pass** before writing the file: counted checked vs. total acceptance
  criteria across every file in the specs directory and cross-referenced against the existing
  roadmap table. This is worth doing as a one-off whenever a project does this same split — it
  surfaces drift between "what the roadmap table says" and "what the specs actually show," which
  had accumulated silently. Found and corrected two classes of drift in this project:
  - Three rows were marked "Not started" despite their linked spec having every acceptance
    criterion checked (stale status — the spec shipped but the roadmap row was never updated).
  - Nine completed specs (all from one feature area, added in a single work session) were missing
    from the roadmap table entirely — implemented and shipped, but never added to the table in
    the first place.
- `README.md`'s Features Roadmap section became a two-line pointer to this file.

### 3. Retired `OUTSTANDING_SPECS.md`, kept `SPEC_CANDIDATES.md`

The two pre-existing spec-tracking files had this relationship:
- `SPEC_CANDIDATES.md` — ideas confirmed worth a real spec, not yet written.
- `OUTSTANDING_SPECS.md` — specs already written, not yet fully built.

Once `ROADMAP.md` took over `OUTSTANDING_SPECS.md`'s exact job (specs written, not yet built —
now the "Specced, coming soon" section), `OUTSTANDING_SPECS.md` had nothing left to do, so it was
deleted. `SPEC_CANDIDATES.md` needed no content changes — only its own header/pipeline
description updated to point at `ROADMAP.md` instead of the now-deleted file.

**The idea pipeline is now**: raw idea file → `SPEC_CANDIDATES.md` (confirmed, not yet spec'd) →
a real spec exists, tracked in `ROADMAP.md`'s "Specced, coming soon" table → implemented, row
moves to "Delivered" → `CHANGELOG.md` (shipped version entry).

### 4. Updated every cross-reference to the moved/retired content

This was the largest share of the actual edit work — grep the whole repo for the old file/section
names and fix each hit, not just the two new files. In this project, that meant:

- The steering entrypoint doc (`CLAUDE.md` here): the intro line's file pointers, the "Current
  status" section's stale "Features Roadmap is currently done" claim, the deep-dive references
  list, the idea-pipeline description, the "Keep OUTSTANDING_SPECS.md current" maintenance rule,
  a historical git-workflow note that named the old roadmap-table location, the Definition of
  Done checklist (added explicit `API.md`/`ROADMAP.md` triggers, split out from the general
  `README.md` trigger), and the pre-merge release-hygiene checklist.
- A runbook/setup doc: one line pointing at "the API Overview table in README.md" → repointed at
  the new API file.
- A project-structure steering doc: the file tree diagram needed the two new root files added.
- The idea-backlog file itself, and any other speculative-idea file that referenced the retired
  file by name.
- Any agent/skill definitions that instructed updating the retired file as part of their workflow
  (e.g. "after implementing, update its entry in OUTSTANDING_SPECS.md") — repointed at the new
  file's equivalent section.
- The root README's own file-tree diagram (the two new files needed adding there too).

**When porting this change to another project**: after creating the equivalent of `API.md` and
`ROADMAP.md`, grep that project's entire repo (not just the README) for the name of whatever file
is being split and the name of whatever tracking file is being retired — both are very likely
referenced from steering/agent/skill docs beyond the README itself, exactly as they were here.
Don't assume the README is the only place these names appear.

## Open design question carried into this change

The "Internal / maintenance specs" section of `ROADMAP.md` (pure refactor specs with no
user-facing feature) is a judgment call, not a settled convention — it's a reasonable place to put
specs that don't fit the `Feature | Backend | Frontend` row shape, but if a project accumulates a
lot of these, it might be worth its own tracking file instead of a subsection. Reassess if that
list grows past a handful of entries.
