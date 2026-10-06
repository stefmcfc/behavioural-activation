# Export Your Data as Replayable SQL (Backend)

**Status**: Implemented (2026-10-06) — `controller/ExportController.java`, `service/ExportService.java`
**Priority**: P2 — safety net for a self-hosted, single-user deployment with no documented backup
strategy
**Depends on**: `planner_spec_002_activity_bank.md` (`Activity`), `planner_spec_003_sub_tasks.md`
(`SubTask`), `planner_spec_004_week_planning.md` (`PlannedOccurrence`, `CompletionRecord`),
`planner_spec_021_work_day_marking.md` (`WorkDayPattern`, `WorkDayOverride`), `planner_spec_010_bucket_reordering.md`/
`planner_spec_023_subtask_reordering.md` (`bucketPosition`/`position` columns, included as-is)
**Area**: Backend
**Roadmap version**: V1 (cross-cutting — data portability, not tied to one feature area)

## Overview

Raised by the user 2026-10-06 during a V1 ideas review, with a specific stated use case: they
intend to reset their self-hosted Postgres database at some point and don't want to lose their
activity/plan history. Rather than a generic JSON export, the user explicitly asked for the export
to be **replayable SQL** — a file of `INSERT` statements they can run themselves (`psql`/`docker
exec`) against a freshly-migrated database to restore their data.

**Scope: export only.** No in-app import/restore UI. Replaying the exported file is a manual step
the user performs themselves outside the app, against a database that has already been through the
app's own Flyway migrations and the normal bootstrap flow (so a `users` row with a matching
`username` already exists — see the `user_id` design below). Building a safe in-app *import* flow
(handling malformed/hostile SQL, conflict resolution, re-authentication of ownership) is a
materially bigger and riskier undertaking than export, explicitly deferred — this spec is
read-only, with no new way to mutate data.

**The critical design problem this spec solves**: `UserBootstrapRunner` only seeds a user when the
`users` table is empty, and `User.id` is a `@GeneratedValue` UUID with no fixed value — after a
database wipe, the recreated bootstrap user gets a **new**, different UUID. Every user-owned table
(`activities`, `sub_tasks`, `planned_occurrences`, `completion_records`, `work_day_patterns`,
`work_day_overrides`) has its own direct `user_id` foreign key column (confirmed via the Flyway
migrations — none of these inherit ownership only transitively through a parent row). A literal
`user_id = '<old-uuid>'` baked into exported `INSERT` statements would therefore reference a user
that no longer exists once replayed against a freshly-wiped database. **This spec resolves `user_id`
via a `(SELECT id FROM users WHERE username = '<username>')` subquery in every generated `INSERT`,
never a literal UUID** — the export is tied to the *username*, which survives a reset, not the
database-generated id, which doesn't.

Every other primary key (`activities.id`, `sub_tasks.id`, `planned_occurrences.id`,
`completion_records.id`, `work_day_patterns.id`, `work_day_overrides.id`) **is** exported as its
original literal UUID — these values only need to be internally self-consistent with each other
(e.g. a `sub_tasks` row's `activity_id` matching the `activities.id` value emitted earlier in the
same file), which they already are, and `INSERT` can always supply an explicit value overriding a
`gen_random_uuid()` column default.

**No `users` row is ever exported, and no password hash ever appears in the output** — the target
database's own bootstrap flow (`.env`'s `APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD`) is
exclusively responsible for creating the user row the replayed data attaches to.

## Requirement 1: Export endpoint returns a downloadable, owner-scoped SQL file

**User story**: As the authenticated user, I want to download all of my own data as one file, so I
have a way to restore it if I ever reset the database.

### PLANNER-025-AC-01 [AUTO]: The endpoint returns a downloadable file
**Statement**: When `GET /api/v1/export` is requested by an authenticated user, the
`ExportController` shall return `200` with `Content-Type: text/plain` (or `application/sql`) and a
`Content-Disposition: attachment; filename="behavioural-activation-export-<date>.sql"` header, with
the generated SQL as the response body.

**Rationale**: This is the first non-JSON-returning endpoint in the app — confirmed via grep, no
existing `ResponseEntity<byte[]>`/`Content-Disposition` precedent to follow, so this is genuinely new
surface, not an extension of an existing pattern.

**References**: `controller/ExportController.java` (new), `service/ExportService.java` (new).

**Test Case (Red)**:
```groovy
def "PLANNER-025-AC-01: the export endpoint returns a downloadable SQL file"() {
    when: "GET /api/v1/export is requested"
        def response = client.get().uri("/api/v1/export").cookie(sessionCookie).exchange()

    then: "the response is 200 with a Content-Disposition attachment header"
        response.expectStatus().isOk()
        response.expectHeader().value("Content-Disposition", { it.contains("attachment") })
}
```

**Test Case (Green)**: implement `ExportController.export(...)` as described in References.

### PLANNER-025-AC-02 [AUTO]: The export is strictly scoped to the authenticated user's own data
**Statement**: The generated SQL shall include only rows owned by the authenticated user — no row
belonging to a different user shall ever appear in the output.

**References**: every repository call in `ExportService` shall be owner-scoped (`findByOwner(User)`),
matching this codebase's established owner-scoping convention throughout.

**Test Case (Red)** (real Postgres — cross-user scoping isn't provable against a mock):
```groovy
def "PLANNER-025-AC-02: export includes only the authenticated user's own data"() {
    given: "an activity owned by a different user, and one owned by the caller"
        def otherOwner = userRepository.save(new User("other-${UUID.randomUUID()}", "hashed"))
        def foreignActivity = activityRepository.save(new Activity("Not mine", ActivityCategory.ROUTINE, null, otherOwner))
        def myActivity = activityRepository.save(new Activity("Mine", ActivityCategory.ROUTINE, null, owner))

    when: "the caller exports their data"
        def sql = exportService.generateExport(owner.username)

    then: "only the caller's own activity appears"
        sql.contains("'Mine'")
        !sql.contains("'Not mine'")

    cleanup:
        activityRepository.delete(foreignActivity)
        userRepository.delete(otherOwner)
}
```

**Test Case (Green)**: scope every fetch by the authenticated owner.

## Requirement 2: Generated SQL correctly reconstructs every user-owned table

**User story**: As the user replaying this file after a reset, I want every activity, sub-task,
planned occurrence, completion, and work-day setting restored exactly as it was, with its
relationships intact.

### PLANNER-025-AC-03 [AUTO]: Activities are exported with their original id and all columns
**Statement**: For every owned `Activity`, the export shall emit an `INSERT INTO activities (id,
user_id, name, category, description, created_at, updated_at, repeatable, archived, favourite)
VALUES (...)` statement, using the activity's original `id`, every column's current value, and a
`(SELECT id FROM users WHERE username = '<username>')` subquery for `user_id`.

**References**: `repository/ActivityRepository.java`'s existing `findByOwnerOrderByFavouriteDescNameAsc(User)`
(already includes archived activities).

**Test Case (Green)**: given a known `Activity`, assert the generated `INSERT` statement contains
its `id`, `name`, `category`, and the `user_id` subquery (not a literal UUID).

### PLANNER-025-AC-04 [AUTO]: Sub-tasks are exported with their original id and FK intact
**Statement**: For every owned `SubTask`, the export shall emit an `INSERT INTO sub_tasks (id,
activity_id, user_id, name, category, created_at, updated_at, position) VALUES (...)` statement,
using the sub-task's original `id` and `activity_id` (referencing the same `id` emitted by AC-03 for
its parent), and the same `user_id` subquery pattern as AC-03.

**References**: `repository/SubTaskRepository.java`'s `findByOwner(User)` (existing).

**Test Case (Green)**: given a `SubTask`, assert its `activity_id` value matches its parent
`Activity`'s emitted `id`.

### PLANNER-025-AC-05 [AUTO]: Planned occurrences are exported preserving the activity/sub-task XOR
**Statement**: For every owned `PlannedOccurrence`, the export shall emit an `INSERT INTO
planned_occurrences (id, user_id, activity_id, sub_task_id, category, week_start, day_of_week, slot,
created_at, updated_at, bucket_position, notes) VALUES (...)` statement, with exactly one of
`activity_id`/`sub_task_id` set to its original value and the other emitted as `NULL` — matching the
existing `chk_...` constraint from `V004__create_planned_occurrences_table.sql`.

**References**: new `findByOwner(User)` method needed on `PlannedOccurrenceRepository` (confirmed:
only week-scoped/id-scoped methods exist today, no plain owner-wide fetch).

**Test Case (Green)**: given an activity-targeted and a sub-task-targeted occurrence, assert each
emits exactly one non-null reference column.

### PLANNER-025-AC-06 [AUTO]: Completion records are exported with their FK intact
**Statement**: For every owned `CompletionRecord`, the export shall emit an `INSERT INTO
completion_records (id, user_id, planned_occurrence_id, completed_at, created_at) VALUES (...)`
statement, referencing the same `id` emitted by AC-05 for its `PlannedOccurrence`.

**References**: new `findByOwner(User)` method needed on `CompletionRecordRepository` (confirmed:
only occurrence-id-list/sub-task-id-list scoped methods exist today).

**Test Case (Green)**: given a completed occurrence, assert the emitted `planned_occurrence_id`
matches.

### PLANNER-025-AC-07 [AUTO]: Work-day patterns and overrides are exported
**Statement**: For every owned `WorkDayPattern` and `WorkDayOverride`, the export shall emit the
corresponding `INSERT` statement with the same `user_id`-subquery treatment as every other table.

**References**: `WorkDayPatternRepository.findByOwner(User)` (existing); new `findByOwner(User)`
method needed on `WorkDayOverrideRepository` (confirmed: only date-scoped methods exist today).

**Test Case (Green)**: given a work-day pattern and an override, assert both are present in the
output.

## Requirement 3: The generated file is safe and correctly ordered to replay

**User story**: As the user replaying this file, I want it to either fully succeed or fully fail —
not leave my database half-restored if something goes wrong partway through.

### PLANNER-025-AC-08 [AUTO]: Free-text fields are correctly SQL-escaped
**Statement**: Any embedded single quote in a free-text column (`activities.name`,
`activities.description`, `sub_tasks.name`, `planned_occurrences.notes`) shall be escaped by
doubling it (`'` → `''`) per standard SQL string-literal syntax, so a value like `Mum's birthday`
produces valid, correctly-reconstructing SQL rather than a syntax error or truncated statement.

**Test Case (Red)**:
```groovy
def "PLANNER-025-AC-08: an embedded single quote in a free-text field is escaped"() {
    given: "an activity with an apostrophe in its name"
        def activity = activityRepository.save(new Activity("Mum's birthday", ActivityCategory.PLEASURABLE, null, owner))

    when: "the data is exported"
        def sql = exportService.generateExport(owner.username)

    then: "the apostrophe is doubled, producing valid SQL"
        sql.contains("'Mum''s birthday'")
}
```

**Test Case (Green)**: escape every free-text value before interpolating it into the generated SQL.

### PLANNER-025-AC-09 [AUTO]: Statements are ordered to satisfy foreign-key dependencies
**Statement**: The generated file shall emit `INSERT` statements in dependency order: `activities`,
then `sub_tasks`, then `planned_occurrences`, then `completion_records` (each table's FK targets
already emitted before it); `work_day_patterns`/`work_day_overrides` may appear anywhere after the
implicit user resolution, since they depend only on the user row.

**Test Case (Green)**: given one of each entity type, assert their `INSERT` statements appear in
the file in the order above (string-index comparison).

### PLANNER-025-AC-10 [AUTO]: The script is wrapped in a transaction
**Statement**: The generated file shall begin with `BEGIN;` and end with `COMMIT;`, so that if any
individual `INSERT` fails during replay (e.g. a constraint violation), the whole replay rolls back
rather than partially applying.

**Test Case (Green)**: assert the output starts with `BEGIN;` and ends with `COMMIT;`.

### PLANNER-025-AC-11 [AUTO]: No `users` row or password hash is ever included
**Statement**: The generated file shall never contain an `INSERT INTO users` statement, and no
password hash value shall ever appear in the output.

**Rationale**: The target database's own bootstrap flow is exclusively responsible for the `users`
row this export's `user_id` subqueries resolve against — re-inserting it here would conflict with
that row and would mean emitting a password hash into a downloadable file, a real unnecessary
security exposure.

**Test Case (Green)**: assert the output never contains the literal string `INSERT INTO users`.

### PLANNER-025-AC-12 [AUTO]: A leading comment documents the replay precondition
**Statement**: The generated file shall begin with a SQL comment block stating the export
timestamp, the source username, and that replay requires a `users` row with a matching `username`
to already exist in the target database (i.e. the app's normal migration/bootstrap flow must have
already run).

**Test Case (Green)**: assert the output's first lines are `--`-prefixed comment lines containing
the username and this caveat, before the `BEGIN;` statement.

## Requirement 4: Empty state

**User story**: As a brand-new user with no data yet, I still want the export to work, not error.

### PLANNER-025-AC-13 [AUTO]: A user with no data gets a valid, near-empty file
**Statement**: If the authenticated user owns no activities, sub-tasks, occurrences, completions, or
work-day settings, `GET /api/v1/export` shall still return `200` with a valid file (the header
comment plus `BEGIN;`/`COMMIT;` and no `INSERT` statements), not an error.

**Test Case (Green)**: a freshly-created user with zero owned rows still gets `200` with valid,
parseable (if functionally empty) SQL.

## Cross-references

| Reference | What it provides |
|---|---|
| `controller/ExportController.java` (new) | `GET /api/v1/export` |
| `service/ExportService.java` (new) | SQL generation, owner-scoped fetches across all six tables |
| `repository/PlannedOccurrenceRepository.java` | Extended — new `findByOwner(User)` |
| `repository/CompletionRecordRepository.java` | Extended — new `findByOwner(User)` |
| `repository/WorkDayOverrideRepository.java` | Extended — new `findByOwner(User)` |
| `repository/ActivityRepository.java`, `SubTaskRepository.java`, `WorkDayPatternRepository.java` | Reused unmodified — `findByOwner`-shaped methods already exist |
| `frontend_spec_051_data_export.md` | Paired frontend spec — triggers this endpoint and handles the download |

## Acceptance Criteria Summary

- [x] PLANNER-025-AC-01 — endpoint returns a downloadable SQL file with the correct headers
- [x] PLANNER-025-AC-02 — export is strictly scoped to the authenticated user's own data
- [x] PLANNER-025-AC-03 — activities exported with original id, all columns, `user_id` subquery
- [x] PLANNER-025-AC-04 — sub-tasks exported with original id and intact `activity_id` FK
- [x] PLANNER-025-AC-05 — planned occurrences exported preserving the activity/sub-task XOR
- [x] PLANNER-025-AC-06 — completion records exported with intact `planned_occurrence_id` FK
- [x] PLANNER-025-AC-07 — work-day patterns and overrides exported
- [x] PLANNER-025-AC-08 — embedded single quotes in free-text fields are correctly escaped
- [x] PLANNER-025-AC-09 — statements ordered to satisfy FK dependencies
- [x] PLANNER-025-AC-10 — script wrapped in `BEGIN;`/`COMMIT;`
- [x] PLANNER-025-AC-11 — no `users` row or password hash ever included
- [x] PLANNER-025-AC-12 — leading comment documents the replay precondition
- [x] PLANNER-025-AC-13 — a user with no data gets a valid, near-empty file, not an error

## Summary

### Implementation

- New `controller/ExportController.java` — `GET /api/v1/export`, thin delegate to
  `ExportService`, builds the `Content-Disposition`/filename and returns the generated SQL as a
  `ResponseEntity<byte[]>` body.
- New `service/ExportService.java` — owner-scoped SQL generation across all six tables, in FK
  dependency order (`activities` → `sub_tasks` → `planned_occurrences` → `completion_records` →
  `work_day_patterns` → `work_day_overrides`). Every `user_id` is emitted via the
  `(SELECT id FROM users WHERE username = '...')` subquery; every other primary/foreign key is
  emitted as its real literal UUID.
- Extended `repository/PlannedOccurrenceRepository.java`, `CompletionRecordRepository.java`, and
  `WorkDayOverrideRepository.java` with a plain `findByOwner(User)` each — `ActivityRepository`,
  `SubTaskRepository`, `WorkDayPatternRepository` reused unmodified, as the spec anticipated.

### Return type / content-type decision

The spec deliberately left the exact Spring return type open. Chose
`ResponseEntity<byte[]>` with `Content-Type: application/sql` (over `text/plain`) — the
`.sql`-named downloadable file is unambiguously SQL, and `application/sql` is the more specific,
IANA-registered media type for this case; `byte[]` (rather than `String`) avoids any
character-encoding ambiguity for the `Content-Disposition` download path.

### Tests

- `controller/ExportControllerSpec.groovy` (new, `@WebMvcTest`, mocked `ExportService`) — 2 tests,
  covering PLANNER-025-AC-01 (status/headers) and the inherited 401-when-unauthenticated rule.
- `service/ExportServiceIntegrationSpec.groovy` (new, `@SpringBootTest`, real Postgres) — 12 tests,
  one per remaining AC (PLANNER-025-AC-02 through AC-13).
- Full backend suite: 338 tests before this change, 352 after (14 new, 0 regressions).

### Findings

- No real surprises — the spec's exact column lists (taken verbatim from the Flyway migrations)
  matched the entity classes exactly, so no schema drift was found during implementation.
- `PlannedOccurrenceRepository.findByOwner(User)` deliberately has no `JOIN FETCH` unlike this
  repository's other query methods (which fetch-join `activity`/`subTask` to avoid N+1 for
  response-mapping call sites) — `ExportService` only ever reads `.getId()` off those lazy
  associations, and Hibernate resolves an uninitialized proxy's id without a round trip, so the
  extra fetch-join would add query cost with no benefit here.

### Real end-to-end replay verification (beyond the spec's own test suite)

The Spock suite proves the generation logic is correct; it doesn't prove the *output file* is
genuinely replayable SQL. Verified that directly against the real dev data: fetched the actual
export via `curl` against the live `gradlew.bat bootRun` server (21 activities, 23 sub-tasks, 35
occurrences, 9 completions, 5 work-day patterns, 6 overrides), confirmed by inspection that no
`INSERT INTO users` or password-hash-shaped string appears anywhere in the output, then exercised
the user's actual stated use case end-to-end: created a throwaway Postgres database in the same
container, applied all 11 Flyway migrations fresh, inserted a **newly-bootstrapped `steve` user row
with a brand-new random UUID** (simulating a real post-wipe restart), and replayed the exported file
against it via `psql -f`. Every statement succeeded, the transaction committed, every table's row
count matched the original exactly, and — the critical check — every replayed row's `user_id`
correctly resolved to the *new* user's id via the `(SELECT id FROM users WHERE username = 'steve')`
subquery, despite that id being completely different from the original export's source user. This is
the actual "clean down the DB without losing progress" workflow proven to work, not just its
component queries. Throwaway database dropped afterward.
