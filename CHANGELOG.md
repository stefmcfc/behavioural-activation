# Changelog

All notable changes to this project are documented in this file, in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.41.1] - 2026-10-06

### Fixed

- Completion tick marks on the Summary page's category bars and weekly placement grid were
  rendering in a fixed accent colour instead of the mark's own computed high-contrast colour,
  making them hard to see against some category colours (especially in dark mode). The marks and
  their ticks are also slightly larger now for better visibility.

## [0.41.0] - 2026-10-06

### Added

- "Export my data" button in the Account menu, downloading all of your own data (activities,
  sub-tasks, planned occurrences, completion records, work-day patterns/overrides) as one
  replayable SQL file via a new `GET /api/v1/export` endpoint — for restoring your data after a
  self-hosted database reset. See `.claude/specs/planner_spec_025_data_export.md` and
  `.claude/specs/frontend_spec_051_data_export.md`.

## [0.40.0] - 2026-10-06

### Added

- You can now change your password from the Account menu, instead of needing to edit `.env` and
  wipe the database. A successful change logs you out with a confirmation message; your current
  password must be re-entered to confirm the change, and your session is invalidated afterward.

## [0.39.2] - 2026-10-06

### Fixed

- Today view's "Browse activities" drawer and "Add" (Assign Activity modal) are now mutually
  exclusive — opening one closes the other, restoring `ActivityPickerList`'s "never mounted
  simultaneously" invariant and eliminating the redundant concurrent activity/sub-task fetch that
  resulted when both were left open at once.

## [0.39.1] - 2026-10-06

### Changed

- Deduplicated the frontend's 11 copy-pasted `getErrorMessage()` implementations into one shared
  `frontend/src/utils/getErrorMessage.ts` utility; no behavior change.
- Unified the two unrelated `ChevronIcon` components into one shared, four-direction
  (`up`/`down`/`left`/`right`) icon component; `WeekNav.tsx` now renders the shared component
  instead of its own local copy. No visual or behavior change.

### Added

- Wired up the already-installed `@vitest/coverage-v8` frontend test-coverage tooling: a
  `test:coverage` script and a `vitest.config.ts` coverage block. No threshold/gate is enforced yet
  — reporting only.

## [0.39.0] - 2026-10-06

### Added

- Sub-tasks within an activity's checklist can now be manually reordered from the Activities page,
  via keyboard-accessible Move up/Move down buttons on each row (no drag-and-drop, deliberately —
  avoids the weekend bucket list's known touch-support gap). New `PUT
  /api/v1/activities/{activityId}/sub-tasks/order` endpoint and a persisted `position` field on
  `SubTask`; newly-created sub-tasks append at the end, and deleting one renumbers the rest to stay
  contiguous.

### Changed

- Move up/Move down controls (sub-task checklist and the weekend bucket list) now use a proper SVG
  chevron icon instead of plain "↑"/"↓" text characters. Sub-task checklist Move controls also
  moved from the trailing Rename/Delete group to a leading position before the name, matching the
  bucket list's layout.

## [0.38.0] - 2026-10-06

### Changed

- Today's "Browse activities" drag drawer now gets the same category-grouped sections and
  collapsible, single-expansion sub-tasks as the Assign Activity modal, instead of a flat,
  always-expanded list.

### Fixed

- Fixed the sub-tasks toggle wrapping across multiple lines in the narrow activity drawer.

## [0.37.0] - 2026-10-05

### Changed

- The Assign Activity modal's activity list is now grouped into Routine/Necessary/Pleasurable
  sections, matching the Activity Bank, and each activity's sub-tasks are collapsed by default
  behind a "Show sub-tasks (N)" toggle instead of always showing. Today's drag-and-drop activity
  drawer is unaffected — it keeps its existing flat, always-expanded list.

## [0.36.0] - 2026-10-05

### Changed

- The Activity Bank's "My Activities" list is now grouped into Routine/Necessary/Pleasurable
  sections with coloured headings, instead of one flat list — reuses the same grouping pattern
  Suggested Activities already used. Row content, filters, and within-group order (favourites
  first, then alphabetical) are unchanged; "My Activities" always stays expanded, unlike the
  collapsible Suggested Activities disclosure.

## [0.35.0] - 2026-10-05

### Added

- Per-occurrence notes: a short freeform note (up to 200 characters) can be attached to one
  specific planned occurrence, distinct from the shared activity description — e.g. "Book A" on
  Tuesday's "Read a book" occurrence vs "Book B" on Thursday's. Edited inline in the occurrence
  detail card (autosaves on blur, with a live character counter) and preserved across moves and
  carry-forward. A small has-notes indicator shows on the occurrence tile and in the Weekly
  Summary's tooltip when a note is present.

## [0.34.0] - 2026-10-06

### Added

- Mark days as work days: a recurring weekly pattern (Settings → "Work days") plus a per-date
  override (an inline toggle on each day header in the Weekly Planner/Today grid), where the
  override always wins. Purely informational — no change to slots or what can be planned on a
  marked day.
- The Weekly Summary's read-only "lite grid" now badges marked work days too, matching the Weekly
  Planner/Today grid.

## [0.33.1] - 2026-10-06

### Fixed

- The Today tab's grid heading no longer duplicates today's day name — it now reads "Today's
  plan", with the actual day/date shown once via the grid's own day label below it.

## [0.33.0] - 2026-10-06

### Added

- A "Suggested activities" disclosure in the Activity Bank, below a new "My Activities" heading
  for the real list, offers a curated list of common activities — grouped Routine/Necessary/
  Pleasurable under headings coloured to match each category, respecting the existing category
  filter — that can be added with a single "Add to my activities" click instead of typing every
  activity in from scratch. A rotating chevron next to the heading signals it can be expanded or
  collapsed; open by default for a brand-new, empty bank and collapsed-but-still-reachable once the
  bank has activities. A suggestion drops off the list once an activity with the same name already
  exists (case-insensitive, regardless of archived status), and shows a repeatable icon when
  applicable.

## [0.32.1] - 2026-10-06

### Fixed

- `scripts/start-dev.sh`/`stop-dev.sh`/`restart-dev.sh` now pause for a keypress before exiting on
  failure, so a disposable spawned window (double-clicked, or launched from PowerShell rather than
  an already-open Git Bash session) doesn't close itself before the failure diagnostic can be read.
  A successful run is unaffected. `restart-dev.sh` also now correctly reflects a failure in either
  its stop or start step in its own exit code, instead of only the last one run.

## [0.32.0] - 2026-10-05

### Changed

- Reorganized the Weekly Summary tab's section order to "This week at a glance", "This week's
  placement", "By schedule and category" — glance first, since that's what's actually read first.
- Renamed "Where things landed" to "This week's placement" (reads correctly for a past, current, or
  future week, instead of implying the week is already over) and "By location and category" to "By
  schedule and category" ("location" read as a physical place; "schedule" is the intended meaning).
- Merged the flat completion bar and the numeric "By category" table into one combined table under
  "This week at a glance": one row per category (Routine/Necessary/Pleasurable, always shown even at
  zero), each row's marks ordered completed-first, then by day/slot, then by weekend-bucket
  position — one visualization doing the job of both, reading as a de facto bar graph.
- The "X scheduled, Y in the weekend bucket" line no longer shows for a week that's already fully
  ended, since any bucket items still incomplete by week's end have already auto-migrated forward
  and the count would be stale. The completion-count line is unaffected and still shows for every
  week.
- The compact "This week's placement" grid now has visible grid lines around its cells and renders
  its day/slot header labels in a monospace font, so it reads more clearly as a compact table; marks
  are centered and sized up slightly for legibility, the time-of-day column matches the day columns'
  width, and every cell has its own background fill distinct from the page.
- The "Weekend bucket" sub-section under "This week's placement" no longer renders when the viewed
  week's bucket is empty.

## [0.31.1] - 2026-10-05

### Fixed

- `PATCH /api/v1/plan/occurrences/{id}` now rejects (`409`) demoting an already-completed occurrence
  back to the weekend bucket — a completed activity is done for the week, so it can no longer be
  silently turned back into an unscheduled bucket item. Rescheduling a completed occurrence to a
  different day/slot is unaffected.
- The "Send to bucket" action no longer appears for a completed occurrence's detail card, and
  dragging a completed occurrence onto the weekend bucket list (panel or an existing bucket item) is
  now a no-op — the proactive UX fix pairing the backend rejection above, so the `409` is a
  defense-in-depth safety net rather than something a user can actually trigger. Grid-internal
  drag-to-move and the Rearrange dropdown for a completed occurrence are unaffected.

## [0.31.0] - 2026-10-05

### Added

- The Weekly Summary tab now shows a segmented completion bar: one small block per planned
  activity this week, completed activities grouped first, each coloured by its category and
  hoverable/focusable for its name, day/slot, and completion status.
- The Weekly Summary tab also shows a compact, read-only "lite" weekly grid and weekend bucket
  list — the same small coloured marks placed where each activity actually landed, with no
  Add/drag/remove controls.
- The Weekly Summary tab now shows a location breakdown chart: three stacked bars (weekday grid,
  weekend grid, weekend bucket) split by category, each segment directly labelled with its
  category name and count so the chart stays readable even if two categories share a similar or
  identical colour.

### Fixed

- Every completion mark across the Weekly Summary's new visualizations now has a visible border
  regardless of its category colour, so a category coloured white/black (or matching the page
  background) never renders as an invisible, contentless mark.

## [0.30.0] - 2026-10-03

### Added

- A new "Summary" tab shows how a week is going: planned/completed counts and a completion
  percentage, a breakdown by category (Routine/Necessary/Pleasurable), and a scheduled-vs-weekend-
  bucket split — all computed from the existing weekly plan data, with its own independent week
  navigation.

## [0.29.0] - 2026-10-03

### Added

- The Weekly Planner now has a collapsible "Filters" control for narrowing the view by category or
  completion status. A filtered-out activity stays visible but dimmed, rather than disappearing, so
  it's always clear what's actually planned where.

## [0.28.1] - 2026-10-03

### Fixed

- Hovering a primary (green) or destructive (red) button — Add activity, Complete, Delete, and
  similar — no longer shows barely-readable text (white-on-near-white in Light theme, near-black-
  on-near-black in Dark theme). The button's fill colour was being silently overridden on hover.

## [0.28.0] - 2026-10-03

### Added

- A new "Weekly grid layout" setting lets you switch the Weekly Planner and Today grid between
  "Days across the top" (the existing layout) and "Each day as its own section" (each day stacked
  vertically with its Morning/Afternoon/Evening slots side by side).

### Fixed

- The weekly grid layout toggle in Settings now applies immediately to whatever planner view is
  open behind it, instead of requiring a reload or navigating away and back.

## [0.27.3] - 2026-10-03

### Changed

- The Add picker and Browse activities drawer now load faster, especially with more activities —
  sub-tasks are fetched in one request instead of one per activity. The Activity Bank also loads
  faster with more activities, for the same reason. No visible behavior change.

## [0.27.2] - 2026-10-03

### Changed

- Dragging to reorder the weekend bucket list is now faster for larger buckets — an internal fix
  to how reordered items are fetched from the database, no visible behavior change.

## [0.27.1] - 2026-10-02

### Changed

- The Weekly Planner and Today view now load faster, especially with more planned activities — an
  internal fix to how the plan is fetched from the database, no visible behavior change.

## [0.27.0] - 2026-10-02

### Changed

- The category/type/favourite filters in the "Add" modal and Today's "Browse activities" drawer are
  now tucked behind a single collapsed "Filters" disclosure instead of three always-visible blocks —
  less clutter when you're not using them, especially in the narrower drawer.

## [0.26.0] - 2026-10-02

### Added

- A new "Today" tab shows just the current day's plan (grid + weekend bucket list) — a faster view
  than the full weekly grid when you just want to know what's on today. Supports Add/Complete/Undo
  and the full detail card, exactly like the Weekly Planner.
- Today's "Browse activities" panel lets you drag an unplanned activity or sub-task straight onto
  today's plan — the same idea the Weekly Planner tried and had removed, now with a visible drag
  handle so it's actually clear items can be dragged.

## [0.25.1] - 2026-10-02

### Removed

- The Weekly Planner's "Browse activities" drag-and-drop drawer has been removed. In real use it
  wasn't usable — items didn't look draggable, opening the drawer squeezed the week's columns down
  to the point of being illegible, and the weekend bucket list couldn't be reached mid-drag. The
  existing "Add" button and picker still work exactly as before; a fixed version of the drawer is
  planned for the upcoming Today view instead.

## [0.25.0] - 2026-10-02

### Changed

- Each screen's main action button (Add activity, Add sub-task, Log in, Save, Assign, Complete/
  Undo) now stands out with a solid accent fill, and Activity/Sub-task deletion (Delete, Confirm
  delete) now stands out with a solid red fill — everything else keeps the existing neutral button
  style. Disabled buttons are now visibly dimmed, which previously had no visual indication at all.

## [0.24.0] - 2026-10-02

### Changed

- The page header is now Title | Settings icon | Account icon, with navigation tabs demoted to a
  second row below it. Settings (theme, category colours) and your account info/Log out now open in
  a small popover from their icon, instead of Settings being a separate tab and account info sitting
  as static text in the header. The trigger icon highlights while its popover is open.

## [0.23.0] - 2026-10-02

### Added

- The session timeout (how long you can stay idle before being logged out) is now configurable via
  the `SESSION_TIMEOUT` environment variable — the default (30 minutes) is unchanged.

### Fixed

- If your session expires while you're using the app, you're now returned to the login screen with
  a clear, prominently-styled "Your session has expired. Please log in again." message, instead of
  being stuck on a page showing "Authentication required" with a "Retry" button that could never
  actually succeed.

## [0.22.0] - 2026-10-02

### Added

- You can now open a "Browse activities" drawer on the Weekly Planner to drag an unplanned activity
  or sub-task directly onto a grid cell or the weekend bucket to assign it there — a faster,
  drag-based alternative to the existing "Add" button and picker modal, which still work exactly as
  before. The drawer is closed by default and sits beside the grid when open.

## [0.21.0] - 2026-10-02

### Added

- You can now mark an activity as a favourite — a star toggle next to each Activity Bank row, or a
  checkbox in the Add/Edit Activity form. Favourited activities are pinned to the top of the Activity
  Bank and the Weekly Planner's "Add" picker, and both surfaces have a new "Favourites only" filter
  to narrow the list down further.

## [0.20.0] - 2026-10-02

### Added

- You can now drag an already-planned grid occurrence directly onto the weekend bucket list to
  move it there, or drag a bucket item directly onto a grid cell to assign it a day/slot — faster,
  mouse-only alternatives to the existing "Send to bucket" and "Rearrange" actions, which still work
  exactly as before.

## [0.19.0] - 2026-10-02

### Added

- You can now drag an already-planned activity tile directly onto a different day/slot cell in the
  Weekly Planner grid to move it there — a faster, mouse-only alternative to the existing
  "Rearrange" dropdown, which still works exactly as before. Limited to the currently visible grid
  (Weekdays or Weekend, whichever tab is active); moving to a different week, to/from the weekend
  bucket list, and touch/mobile drag are unchanged and still use the existing click-based actions.

## [0.18.0] - 2026-10-01

### Changed

- The Login, Add/Edit Activity, and Add/Rename Sub-task forms now flag an empty required field
  (and the Activity form's category choice) as soon as you leave it empty or try to submit, instead
  of staying silent until a submit attempt — matching native browser validation timing.
- The Add/Edit Activity modal and other `<dialog>`-based modals can now be dismissed by clicking
  outside them or via a mobile back-gesture, in browsers that support it.
- Internal: `theme.css`'s light/dark colour tokens are now defined once each via the CSS
  `light-dark()` function instead of three duplicated blocks — no visible change.

### Fixed

- Fixed the weekend bucket list's Move up/down buttons silently losing their compact, icon-tight
  sizing to an unrelated CSS property reset, so they rendered taller than intended.

## [0.17.0] - 2026-10-01

### Added

- An incomplete weekend bucket item that's fallen behind the current week now automatically moves
  forward to the current week the next time you open the planner, instead of staying stuck in the
  past with no way back into view. It's marked "Moved from last week" so it's clear what happened.

### Fixed

- Fixed a contrast issue where the Move up/down buttons' hover/focus highlight could render
  near-white text on a near-white background in Light theme.

## [0.16.0] - 2026-10-01

### Added

- The weekend bucket list can now be manually reordered: drag an item (via a grip handle) to a new
  position, or use the keyboard-accessible Move up/Move down buttons on each row. The new order is
  saved immediately and persists across reloads.

## [0.15.0] - 2026-10-01

### Fixed

- Moving a planned occurrence to Saturday or Sunday (via its existing "Rearrange" control) now has
  somewhere to actually show up: the Weekly Planner's grid is split into Weekdays/Weekend tabs, so
  weekend occurrences are no longer silently invisible after being moved there. Defaults to whichever
  tab actually contains today; today's column now highlights correctly on the Weekend tab too.

### Changed

- Weekly Planner header/spacing polish: the week label now reads "Week Commencing" with a date
  formatted to match the browser's own locale (e.g. `dd/mm/yyyy` in the UK, `mm/dd/yyyy` in the US)
  instead of a hardcoded `yyyy-mm-dd`; Previous/Next week controls are now icon-only chevrons (with
  accessible "Previous week"/"Next week" labels) and the row is centered; larger spacing between the
  nav row and the grid, between the Morning/Afternoon/Evening rows, and between the grid and the
  weekend bucket list.
- The weekend bucket list's "Add" button is now right-aligned on the same row as its "Weekend
  bucket list" heading, matching the Activity Bank's sub-task panel layout.
- Each Week grid day column header now shows the date number next to the day name (e.g. "28
  Monday"), so the calendar date is visible without cross-referencing the "Week Commencing" date.

## [0.14.1] - 2026-10-01

### Fixed

- A sub-task's category now updates to match its parent activity when the activity's category is
  changed, instead of staying stuck at whatever it was when the sub-task was created (previously
  visible as a mismatched category chip in the weekly planner's picker and occurrence items).
- An activity's sub-task panel, if already open, now reflects an edit to that activity immediately
  instead of needing to be manually collapsed and re-expanded first.

## [0.14.0] - 2026-10-01

### Added

- The Activity Bank's "Show sub-tasks" button now shows the sub-task count directly in its label
  ("Show sub-tasks (3)"), or reads "Add sub-tasks" when there are none yet.

### Changed

- Removed the "Sub-tasks — {Category}" heading from the expanded sub-task panel; "Add sub-task" is
  now right-aligned at the top of the panel, and sits on the same row as "No sub-tasks yet." when
  an activity has none.

## [0.13.0] - 2026-10-01

### Added

- The Add/Edit activity modal now shows the repeat icon live next to the "Repeatable" checkbox as
  you toggle it, matching the icon already shown in the Activity Bank list.
- Repeatable activities now show the repeat icon on their items in the weekend bucket list (weekly
  grid cells intentionally do not show it, to avoid adding back the clutter removed in an earlier
  decluttering pass).
- The "Assign an activity or sub-task" picker (opened from "Add" in the Weekly Planner) now shows
  the repeat icon next to repeatable activities (sub-tasks always inherit their parent's
  repeatable/one-off status, so the icon doesn't repeat on each sub-task row).

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
