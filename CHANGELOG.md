# Changelog

All notable changes to this project are documented in this file, in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The Add/Edit activity modal now shows the repeat icon live next to the "Repeatable" checkbox as
  you toggle it, matching the icon already shown in the Activity Bank list.
- Repeatable activities now show the repeat icon on their items in the weekend bucket list (weekly
  grid cells intentionally do not show it, to avoid adding back the clutter removed in an earlier
  decluttering pass).

## [0.12.0] - 2026-10-01

### Added

- Activity Bank rows now show a small repeat icon next to the category chip for activities marked
  "Repeatable", so you can tell at a glance which activities recur week after week versus which are
  one-off — one-off activities show no icon.

## [0.11.0] - 2026-10-01

### Added

- Activity Bank gained a "Filter by category" control (All/Routine/Necessary/Pleasurable,
  defaulting to All) alongside "Show archived", narrowing the list to activities in just one
  category at a time.

## [0.10.3] - 2026-10-01

### Fixed

- Unmapped backend routes (e.g. hitting the bare API origin or a stray `/favicon.ico`) now return
  `404 "Not found"` instead of the generic `500 "An unexpected error occurred"` catch-all.

## [0.10.2] - 2026-09-30

- The Weekly Planner's occurrence detail card is now built on the same native `<dialog>`-based
  `Modal` used elsewhere in the app (previously a hand-built overlay), giving it real keyboard
  focus-trapping. No visual or workflow change.

## [0.10.1] - 2026-09-30

- Reordered the Add/Edit activity modal so Category (with its guidance) appears before Name, and
  replaced the plain radio-button category picker with coloured pills using each category's live
  Settings colour — matching `CategoryChip` elsewhere in the app, and updating live if the colour is
  changed while the modal is open.
- Gave the Name, Description, and Sub-task name fields the same quiet-label typography (small, bold,
  uppercase, letter-spaced) as the category picker's legend, stacked above their inputs instead of
  inline beside them.
- Right-aligned the Save/Cancel buttons in the Add/Edit Activity and Add/Rename Sub-task modals.
- Added a short explanatory note next to the Repeatable checkbox distinguishing repeatable activities
  (recur indefinitely) from one-off activities (auto-archived once every planned occurrence is
  completed).
- Fixed a regression where the Add/Edit Activity and Add/Rename Sub-task modals' Save/Cancel buttons
  could be clipped outside the dialog's visible bounds once their content grew taller than the
  dialog's max height — both forms now use an independently-scrollable content area with a pinned
  footer, matching the Weekly Planner picker's existing layout.
- Fixed a bug where clicking a category pill in the Add/Edit Activity modal showed a focus outline
  clipped on its left edge — the scrollable content area now reserves enough padding to fully contain
  the outline.
- Grouped the Activity Bank's "Show archived" and "Add activity" controls into a single bordered
  toolbar row, right-aligned "Add activity", and replaced the plain "Show archived" checkbox with a
  pill matching the rest of the app's segmented-control styling.

## [0.10.0] - 2026-09-30

- Added an "Add activity" button to the Activity Bank, and moved activity creation *and* editing
  into a modal (previously an always-visible form at the bottom of the page for create, an inline
  swap-in-place for edit). The modal includes a new `CategoryGuidance` block — a short purpose
  statement and one example for each of Routine/Necessary/Pleasurable, plus a note that the same
  activity can belong to a different category depending on why it's being done — always visible
  next to the category picker, to help a new or returning user who doesn't already know the
  Behavioural Activation framework's category definitions.
- Added an "Add sub-task" button to each activity's sub-task checklist, and moved sub-task creation
  *and* renaming into the same kind of modal (previously an always-visible form at the top of the
  checklist for create, an inline swap-in-place for rename). No category guidance needed here — a
  sub-task's category is inherited from its parent activity and was never user-selected.
- Fixed a `Modal` regression: a closed dialog was rendering as a visible empty box wherever it sat
  in the page, because an earlier change (`display: flex` on `.dialog`, for the Weekly Planner
  picker's scrollable body) outranked the browser's own `dialog:not([open]) { display: none }` rule.

## [0.9.0] - 2026-09-30

- Added a modal/dialog primitive (`Modal.tsx`, wrapping the native `<dialog>` element — zero new
  dependencies) and relocated the Weekly Planner's "Assign an activity or sub-task" picker into it.
  Activating "Add" on a grid cell or the weekend bucket list now opens the picker right there,
  instead of jumping attention to a picker rendered at the very bottom of the page. Picker content
  and behaviour (fetch, single-selection, Assign/Cancel) are unchanged; closing via Cancel, Escape,
  or a backdrop click all behave the same, and focus now moves into the dialog on open and returns
  to the originating "Add" control on close.
- Added a category chip and a category filter (All/Routine/Necessary/Pleasurable) to the "Assign an
  activity or sub-task" picker, and replaced its unstyled nested bullet list with a divider-
  separated, indented row-group layout — the previous default browser bullets didn't combine well
  with the new chips. Filtering keeps a non-matching activity visible if one of its sub-tasks still
  matches (a sub-task's category is fixed at creation time and doesn't follow later edits to its
  parent activity's category), so a matching sub-task is never hidden along with its parent.
- Added a second filter (All/Repeatable/One-off) to the same picker, combining with the category
  filter (both must match). Unlike the category filter, this one has no sub-task exception — it's
  an activity-only attribute, so a sub-task's visibility always follows its parent activity's.
- Bounded the modal's height and gave the picker's Assign/Cancel controls their own pinned,
  right-aligned footer, so they stay visible and reachable regardless of how long the (now
  filterable) activity list gets — previously the whole dialog, controls included, scrolled as one
  block against the browser's default `<dialog>` sizing.

## [0.8.0] - 2026-09-30

- Decluttered the Weekly Planner grid and weekend bucket list: each occurrence's tile now shows
  only its name, category, a completion icon, and a one-click Complete/Undo control. Move, Move to
  bucket, Remove, and Carry forward have moved into a detail card, opened by activating the
  occurrence's name — relocated, not removed. A planned sub-task's tile now also shows which
  activity it belongs to (`parentActivityName`, resolved server-side), and the weekly grid
  highlights today's weekday column when viewing the current week.
- Refined the occurrence detail card after a first real-browser pass: it now renders as a dimmed
  overlay modal (was inline, which cramped narrow grid columns), closeable by its Close control,
  clicking outside the card, or Escape. Also: a visibly stronger divider (`--border-strong`) between
  two occurrences sharing a grid slot, a persistent pill/chip style on the clickable name control
  (previously only visible on hover), and the parent-activity label now precedes the sub-task's own
  name.
- Refined the occurrence detail card again after a second look: the name control's pill is now
  squared-off rather than fully rounded, the card gained a header showing what was clicked (the
  occurrence's name, category, and its day/slot — or "Weekend bucket list" for an unscheduled item),
  and the Move sub-state's day/slot fields are legible and consistently spaced instead of cramped
  onto one wrapped line with mismatched font sizes.
- Refined the occurrence detail card a third time: every CTA row is now consistently right-aligned,
  with Close moved into its own footer below a divider instead of sitting left-aligned against
  right-aligned rows above it. "Move" and "Move to bucket" have been consolidated into one
  "Rearrange" area: the rest-state control is renamed "Rearrange", and its panel now offers either
  picking a new day/slot ("Confirm rearrange") or a one-click "Send to bucket" (the renamed "Move to
  bucket") as an alternative, rather than two separate top-level buttons.
- Extended the Weekly Planner's right-alignment convention outside the detail card: each occurrence
  tile's Complete/Undo control is now right-aligned (grid and bucket list alike), and each grid
  cell's "Add" control now shares its slot-label row (e.g. "Morning") instead of sitting on its own
  line below it, right-aligned against the label.

## [0.7.0] - 2026-09-29

- Added repeatable vs. one-off activities: `Activity` gains `repeatable`/`archived` fields, new
  archive/unarchive endpoints, and an `includeArchived` filter on `GET /api/v1/activities`.
  Completing a one-off activity's last outstanding occurrence — or the last of its incomplete
  sub-tasks — now auto-archives it out of the everyday Activity Bank and weekly-planner picker;
  unarchiving is manual. Activity Bank gained a "Repeatable" checkbox on the create/edit form, a
  "Show archived" toggle with an "(Archived)" indicator and "Unarchive" action, and
  `AssignActivityPicker` now excludes archived activities. An archived activity's sub-tasks remain
  viewable (read-only — no add/rename/delete) via the same "Show sub-tasks" toggle, without having
  to unarchive it first. Verified end-to-end in a real browser (light and dark) against real
  Postgres: creating/editing the repeatable flag, hiding/revealing archived activities, viewing an
  archived activity's sub-tasks read-only, unarchiving, and the full plan → complete → auto-archive
  flow.
- Fixed native checkbox/radio form controls rendering in the browser's OS-preferred color scheme
  instead of the app's own selected light/dark theme (most visible as a solid black square for an
  unchecked checkbox on an otherwise light page) — the global `color-scheme: light dark` on `:root`
  was overriding theme.css's per-`[data-theme]` blocks due to a same-specificity, wrong-order
  cascade conflict. `color-scheme` now lives in theme.css alongside the other per-theme tokens, and
  checkboxes get the same `accent-color: var(--accent)` treatment radios already had.

## [0.6.0] - 2026-09-29

- Added a full visual refresh ("Quiet Room" design system), replacing the scaffold-era purple
  accent and entirely-unstyled native HTML with a warm sage-accented palette, pill-shaped
  buttons/chips with a soft shadow, hairline-bordered flat content rows/panels (no card shadows
  outside of buttons), tighter system-sans typography with tabular numerals, and monospace
  uppercase day-of-week labels in the weekly grid. Every V1 screen (Login, Activity Bank,
  sub-tasks, Weekly Planner, Settings) now has real component styling for the first time; global
  base styles cover every button/input/radio uniformly (no primary/secondary distinction yet —
  deliberately deferred). Direction was chosen from three mocked-up options plus a hybrid, reviewed
  in a throwaway design-exploration artifact before being turned into a spec.
- Fixed a batch of discrepancies found comparing the shipped result against the approved mockup:
  `h2` section headings and fieldset `legend`s now use the small uppercase quiet-label treatment
  instead of duplicating the page `h1`; Activity Bank/sub-task/bucket-list rows were rendering real
  browser bullet points (missing `list-style: none`) instead of the intended flush hairline list;
  Settings' category-colour rows now lead with the swatch, drop the redundant "colour"/category-name
  text, right-align the reset action, and the swatch itself is a true circle (Chromium's
  `::-webkit-color-swatch` doesn't inherit the input's own `border-radius`); the Appearance theme
  picker is a one-row chip/segmented toggle instead of either the original cramped inline radios or
  an over-corrected vertical stack; the weekly grid's Morning/Afternoon/Evening label now renders
  small inside each box rather than as a shared row/column header; Activity Bank's "Show sub-tasks"
  is the first action and the add-activity form sits below the list.
- Fixed a real, reproducible test flake (`FRONTEND-005-AC-06`): `router.navigate()` calls outside
  of a React event handler weren't wrapped in `act()`, so the resulting state update sometimes
  didn't flush before the test's assertions ran.

## [0.5.0] - 2026-09-29

- Added tabbed navigation (Activities / Weekly Planner / Settings) via `react-router-dom`, replacing
  the single-page stack of components with real, bookmarkable, back/forward-aware routes.
- Added a Settings page: Light/Dark/System theme (persisted in `localStorage`, System follows the
  OS via `prefers-color-scheme`), and per-category chip colour customization with a reset-to-default
  control.
- Added a reusable `CategoryChip` component — replaces the plain "Name — Category" text in the
  Activity Bank, sub-task list, and weekly planner with a coloured chip. The chip's text colour is
  always computed automatically (WCAG contrast against black vs white) so a user-chosen background
  can't make the label unreadable; this doesn't guarantee WCAG AA (4.5:1) against every possible
  background, only the objectively better of the two text-colour choices.
- Resolved `frontend_conventions.md`'s long-deferred styling decision: CSS Modules per component
  plus a shared `theme.css` owning the `--text`/`--bg`/`--border`/`--accent`/category-colour custom
  properties, superseding the ad hoc theme block that had been living in `index.css`.

## [0.4.0] - 2026-09-29

- Added the weekly planner (V1's final spec pair): a Monday-Friday × Morning/Afternoon/Evening grid
  plus a weekend bucket list, backed by a new `PlannedOccurrence`/`CompletionRecord` pair
  (`planner_spec_004_week_planning.md`/`frontend_spec_004_week_planning.md`). Plan either a whole
  Activity or an individual SubTask into a day+slot or into the weekend bucket; move/reschedule;
  mark complete/undo; carry an unfinished bucket item forward a week; remove without deleting from
  the bank. The bucket list highlights a category with zero entries while another has at least one
  (no ratio/threshold). New endpoints under `/api/v1/plan` (view/create/move/remove) and
  `/api/v1/plan/occurrences/{id}/{completion,carry-forward}`.
- Fixed: `GET /api/v1/plan` (and move/complete/carry-forward) returned `500` with a
  `LazyInitializationException` against a real, previously-persisted occurrence —
  `open-in-view: false` closes the Hibernate session before the controller read the lazy
  `activity`/`subTask` association; `PlanService`'s transactional methods now call
  `Hibernate.initialize()` before the entity crosses the transaction boundary.

## [0.3.1] - 2026-09-29

- Fixed: `scripts/start-dev.sh`/`restart-dev.sh` never actually loaded the repo-root `.env`
  (gitignored) despite its own comment claiming they did — `APP_BOOTSTRAP_USERNAME`/
  `APP_BOOTSTRAP_PASSWORD` set there were silently ignored, so a reset Postgres volume seeded
  whatever ad hoc credentials the last manual `gradlew.bat bootRun` invocation happened to use
  instead. Added `load_dotenv` (`scripts/lib/dev-common.sh`), called before the backend starts.

## [0.3.0] - 2026-09-29

- Added sub-tasks: split an activity into a flat checklist of child tasks that inherit the parent's
  category as a one-time snapshot (`planner_spec_003_sub_tasks.md`/
  `frontend_spec_003_sub_tasks.md`). New nested endpoints under
  `/api/v1/activities/{activityId}/sub-tasks` (create/list/rename/delete); deleting an activity
  cascades to delete its sub-tasks. Frontend adds an expandable checklist under each activity in the
  Activity Bank, with the same inline add/rename/delete-confirm pattern as activities themselves.

## [0.2.0] - 2026-09-28

- Added the Activity Bank: create, list, edit, and delete activities with a Routine/Necessary/
  Pleasurable category (`planner_spec_002_activity_bank.md`/`frontend_spec_002_activity_bank.md`).
  Every activity is scoped to its owner; a cross-owner or nonexistent `id` returns `404` in both
  cases identically, never `403`.
- Fixed: an invalid `category` value in a request body (e.g. `"FUN"`) returned `500` instead of
  `400` — `GlobalExceptionHandler` now maps `HttpMessageNotReadableException` to `400`.
- Extracted a shared `frontend/src/services/client.ts` (axios instance + `request<T>()` wrapper) out
  of `authApi.ts`, so `activityApi.ts` doesn't duplicate the session-cookie client setup. No
  behavior change to existing auth requests.

## [0.1.0] - 2026-09-28

- Fixed new SonarQube findings on `SecurityConfig.java`: removed an unnecessary `throws Exception`
  from the `authenticationManager`/`securityFilterChain` beans (Spring Security 7.1.1 no longer
  declares a checked exception there — `java:S112`/`java:S1130`), and suppressed `java:S4502` (CSRF
  disabled) with a comment pointing at the class javadoc, since that's a deliberate, already-
  documented V1 decision rather than an oversight.
- Fixed: the session cookie was missing `SameSite=Lax` (`PLANNER-001-AC-15`) — added
  `server.servlet.session.cookie.same-site: lax`. Since CSRF is deliberately disabled for this app,
  this was a real gap in its practical CSRF defense, not just an unchecked box; only caught once
  Docker/Postgres became available to actually inspect a live `Set-Cookie` header.
- Fixed: `gradlew.bat test` failed against a real database (`BehaviouralActivationApplicationSpec`'s
  full `@SpringBootTest` boots `UserBootstrapRunner`, which fails startup with no bootstrap
  credentials set) — the test profile now has fixed, safe-to-share test-only bootstrap credential
  defaults instead of requiring a real secret exported just to run the suite.
- `scripts/start-dev.sh backend` now fails fast (a few seconds, via `scripts/lib/docker-common.sh`)
  with a specific message if Docker isn't running or Postgres isn't up/healthy yet, instead of
  waiting out the full 90s health-check timeout.
- Added `scripts/start-dev.sh`/`stop-dev.sh`/`restart-dev.sh` to launch/stop both dev servers in the
  background with health-check-based readiness reporting, plus a `--debug` flag that opens a JDWP
  port (`:5005`) on the backend for remote debugging (`backend/build.gradle.kts` now pins
  `suspend=false` on `bootRun`'s debug options, and adds `spring-boot-devtools` for
  `bootRun --continuous`).
- Backend and frontend dev servers now run on static, non-default ports (`8420`/`4321`) instead of
  Spring Boot's/Vite's `8080`/`5173` defaults, to avoid colliding with other apps commonly using
  those ports.
- Added `README.md` and `RUNBOOK.md` (setup, ports, environment variables, troubleshooting).
- Added session-based authentication: a single bootstrap-seeded user, `POST /api/v1/auth/login`,
  `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, and a frontend login page
  (`planner_spec_001_auth.md`/`frontend_spec_001_login.md`).
- Initial project scaffolding: Spring Boot 4.1.x + Java 25 backend (Postgres/Flyway/Security/
  Validation, Spock testing) and React 19 + TypeScript + Vite frontend (Vitest/RTL), Docker Compose
  local Postgres, Claude Code steering/agents/skills.
