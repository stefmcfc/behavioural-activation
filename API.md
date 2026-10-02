# API Reference

**Maintenance rule**: update this file in the same change that creates, amends, or deletes an
endpoint — don't defer it to a later documentation pass.

**Status**: `Auth`, `Activities` (including its Sub-tasks section), and `Planner / Weekly Grid`
below are real, implemented sections — `Mood & Reflection` and `AI Suggestions` are still pending
their own spec/pass. This file establishes where endpoint documentation lives from the start (see
`PROCESS_CHANGES.md` for why: a per-endpoint table/list belongs in its own file, not folded into
`README.md`, since it's high-churn and unrelated to a general project overview).

## Format

Group endpoints by area (e.g. Activities, Planner/Weekly Grid, Occurrences & Completion, Mood &
Reflection, AI Suggestions once V3 lands). Within each area, one bullet per endpoint:

```
- **`METHOD /api/v1/path`** — what it does, notable params/behavior.
```

List-of-bullets, not a table — a table grows unreadable fast as columns (path, method, params,
behavior notes) compete for width; a bullet per endpoint scales better and is easier to scan when
grouped by area.

Keep to path/method/params/behavior-note level of detail, not full example request/response
bodies — this project may add `springdoc-openapi` later (see `.claude/steering/tech.md`), and full
examples written by hand now would either duplicate or quickly go stale against generated docs once
that lands. A small hand-picked "quickstart" `curl` section for the most-used endpoints is a
reasonable later addition; a mechanical one-example-per-endpoint expansion is not.

Cross-cutting API behavior that isn't a specific endpoint (sorting semantics, CORS configuration,
auth requirements) belongs in this file too, not scattered into `README.md`.

## Auth

Every `/api/v1/**` endpoint requires an authenticated session, except `POST /api/v1/auth/login` and
`POST /api/v1/auth/logout` (see `.claude/specs/planner_spec_001_auth.md`). There is no
self-registration — exactly one user is bootstrap-seeded on first startup from
`APP_BOOTSTRAP_USERNAME`/`APP_BOOTSTRAP_PASSWORD`. Auth is session-cookie based (not token-based);
CSRF is disabled, so cross-origin cookie support relies on `app.cors.allowed-origins` (never a
wildcard) plus a `SameSite=Lax` session cookie.

- **`POST /api/v1/auth/login`** — body `{ "username": "...", "password": "..." }`. On success,
  authenticates and stores the session, returns `200` with `{ "username": "..." }`. Returns `401`
  with a generic message on bad credentials, `400` if either field is missing/blank.
- **`POST /api/v1/auth/logout`** — invalidates the current session if one exists. Always returns
  `200`, even with no active session (idempotent).
- **`GET /api/v1/auth/me`** — returns `200` with `{ "username": "..." }` if the session is
  authenticated, `401` otherwise.

Error responses (auth or otherwise) share one shape: `{ "message": "...", "details": null | {...} }`.

## Activities

All endpoints below require an authenticated session (see Auth above) and are scoped to the
authenticated user — an `id` that doesn't exist or belongs to a different user returns `404` in
both cases identically, never `403`.

An activity is either **repeatable** (`repeatable: true`, the default — reusable indefinitely) or a
**one-off** (`repeatable: false`). A one-off activity **auto-archives** (`archived` becomes `true`)
the moment it's genuinely "done": its own occurrence completing, if it has no sub-tasks, or every
one of its sub-tasks gaining at least one completed occurrence, if it does — see
`.claude/specs/planner_spec_006_repeatable_activities.md`. Archiving is otherwise never a direct
user action; it's a side effect of `POST /api/v1/plan/occurrences/{id}/completion` (see Planner /
Weekly Grid below), and the two archive endpoints below exist only for idempotent-success/manual-
unarchive symmetry. Repeatable activities never auto-archive.

- **`GET /api/v1/activities?includeArchived=`** — returns `200` with `{ "data": [...], "count": N
  }`, the authenticated user's activities ordered with every favourited activity first, then
  alphabetically by name within each group (favourited and non-favourited). `includeArchived`
  defaults to `false` (excludes archived activities); `includeArchived=true` includes both archived
  and non-archived, still favourites-first then alphabetical (an archived-and-favourited activity
  still sorts into the favourite group). Empty bank returns `{ "data": [], "count": 0 }`, not an
  error.
- **`POST /api/v1/activities`** — body `{ "name": "...", "category": "ROUTINE" | "NECESSARY" |
  "PLEASURABLE", "description": "..." | null, "repeatable": true | false | null }`. `repeatable`
  defaults to `true` when omitted/`null`. Returns `201` with the created activity (`archived` always
  `false` on create — the request body has no `archived` field, so a client-supplied one has no
  effect). `400` if `name` is blank/missing or `category` is missing/invalid.
- **`PUT /api/v1/activities/{id}`** — same body shape as create; full replace of `name`, `category`,
  `description`, `repeatable` (defaults to `true` when omitted/`null`, same as create).
  `archived` is never settable here — only via the archive/unarchive endpoints below. Returns `200`
  with the updated activity, `400` on the same validation failures as create, `404` if `id` isn't
  owned by the authenticated user.
- **`DELETE /api/v1/activities/{id}`** — permanently deletes the activity. Returns `204`, or `404`
  if `id` isn't owned by the authenticated user.
- **`POST /api/v1/activities/{id}/archive`** — sets `archived: true`. Idempotent — archiving an
  already-archived activity is still a `200` success, not an error. Returns `200` with the updated
  activity, `404` if `id` isn't owned by the authenticated user.
- **`DELETE /api/v1/activities/{id}/archive`** — unarchives (`archived: false`). Returns `204`, or
  `404` if `id` isn't owned by the authenticated user.
- **`POST /api/v1/activities/{id}/favourite`** — sets `favourite: true`. Idempotent — marking an
  already-favourited activity is still a `200` success, not an error. Returns `200` with the updated
  activity, `404` if `id` isn't owned by the authenticated user. `favourite` is never settable via
  create/update — only via this endpoint and the one below.
- **`DELETE /api/v1/activities/{id}/favourite`** — unmarks favourite (`favourite: false`).
  Idempotent — unmarking an already-not-favourited activity is still a `204` success, not an error.
  Returns `204`, or `404` if `id` isn't owned by the authenticated user. Fully orthogonal to
  `archived` — neither flag's endpoints ever change the other.

No `GET /api/v1/activities/{id}` endpoint — the frontend prefills its edit form from the
already-fetched list.

### Sub-tasks

Lets an activity be broken down into a checklist of smaller sub-tasks (one level deep only — no
recursive sub-sub-tasks). All endpoints below are nested under the parent activity, require an
authenticated session, and are scoped to the authenticated user: an `activityId` or sub-task `id`
that doesn't exist or belongs to a different user returns `404` in every case identically, never
`403`. A sub-task's `category` is copied from its parent activity once, at creation time, and is
never client-supplied or editable afterward — it does not track later changes to the parent
activity's own category.

- **`GET /api/v1/activities/{activityId}/sub-tasks`** — returns `200` with `{ "data": [...], "count":
  N }`, the parent activity's sub-tasks ordered by `createdAt` ascending. An activity with no
  sub-tasks yet returns `{ "data": [], "count": 0 }`, not an error. `404` if `activityId` isn't owned
  by the authenticated user.
- **`POST /api/v1/activities/{activityId}/sub-tasks`** — body `{ "name": "..." }` (no `category`
  field — it is always copied from the parent activity's current category). Returns `201` with the
  created sub-task. `400` if `name` is blank/missing, `404` if `activityId` isn't owned by the
  authenticated user.
- **`PATCH /api/v1/activities/{activityId}/sub-tasks/{id}`** — body `{ "name": "..." }`; renames the
  sub-task (category can never be changed via this endpoint). Returns `200` with the updated
  sub-task, `400` if `name` is blank/missing, `404` if `activityId` or `id` isn't owned by the
  authenticated user.
- **`DELETE /api/v1/activities/{activityId}/sub-tasks/{id}`** — permanently deletes the sub-task.
  Returns `204`, or `404` if `activityId` or `id` isn't owned by the authenticated user.

No `GET /api/v1/activities/{activityId}/sub-tasks/{id}` single-item endpoint — the frontend renders
and edits sub-tasks from the already-fetched list. Deleting an activity cascade-deletes its
sub-tasks automatically (database-level `ON DELETE CASCADE`), not via any explicit endpoint call.

## Planner / Weekly Grid

Backs the Monday–Friday Morning/Afternoon/Evening grid plus a flexible weekend bucket list — one
unified `PlannedOccurrence` per planned activity/sub-task. A `PlannedOccurrence` with `dayOfWeek`
and `slot` both set is scheduled; both null means it's still in the weekend bucket — there is no
backend restriction tying bucket items to Saturday/Sunday specifically. All endpoints below require
an authenticated session and are scoped to the authenticated user: an `id` that doesn't exist or
belongs to a different user returns `404` in every case identically, never `403`.

**Status**: fully implemented (both passes) — see `.claude/specs/planner_spec_004_week_planning.md`.

- **`GET /api/v1/plan?weekStart=`** — `weekStart` must be a Monday (`YYYY-MM-DD`); returns `400` if
  missing or not a Monday. Returns `200` with `{ "data": [...], "count": N }`, the authenticated
  user's `PlannedOccurrence`s for that week (both scheduled and weekend-bucket), ordered by
  `createdAt` ascending. An empty week (including a past week with nothing planned) returns
  `{ "data": [], "count": 0 }`, not an error — this doubles as the only "activity history" mechanism
  for V1 (navigate `weekStart` to a past Monday).
- **`POST /api/v1/plan/occurrences`** — body `{ "activityId": "..." | null, "subTaskId": "..." |
  null, "weekStart": "YYYY-MM-DD", "dayOfWeek": "MONDAY".."SUNDAY" | null, "slot": "MORNING" |
  "AFTERNOON" | "EVENING" | null }`. Exactly one of `activityId`/`subTaskId` must be set;
  `dayOfWeek`/`slot` must both be set (scheduled) or both be null (weekend bucket) — either
  violation, or a missing/non-Monday `weekStart`, returns `400` without creating anything. Returns
  `201` with the created occurrence; its `category` is copied from the referenced activity/sub-task
  at creation time (never client-supplied, never a live reference). `404` if the referenced
  `activityId`/`subTaskId` isn't owned by the authenticated user.
- **`PATCH /api/v1/plan/occurrences/{id}`** — body `{ "dayOfWeek": "..." | null, "slot": "..." |
  null }`. Both set reschedules/promotes the occurrence to that day/slot (a weekend-bucket item can
  be promoted into *any* day, not just Saturday/Sunday); both null demotes it back to the weekend
  bucket, leaving `weekStart` unchanged. Exactly one set returns `400` without applying any change.
  Returns `200` with the updated occurrence, `404` if `id` isn't owned by the authenticated user.
- **`DELETE /api/v1/plan/occurrences/{id}`** — permanently removes the planned occurrence from the
  week without touching the underlying `Activity`/`SubTask` in the user's bank. Returns `204`, or
  `404` if `id` isn't owned by the authenticated user.
- **`POST /api/v1/plan/occurrences/{id}/completion`** — marks the occurrence complete, creating a
  `CompletionRecord` with `completedAt` set to the current time, or updating the existing record's
  `completedAt` if one already exists (idempotent — re-completing is not an error). Returns `200`
  (not `201`) with the occurrence reflecting `completed: true`. `404` if `id` isn't owned by the
  authenticated user. Side effect: if the completed occurrence's target `Activity` (directly, or via
  its parent, for a sub-task) is a one-off (`repeatable: false`) and is now "done" (see Activities
  above), it is auto-archived in the same request — not reflected in this response body, only in a
  later `GET /api/v1/activities`.
- **`DELETE /api/v1/plan/occurrences/{id}/completion`** — undoes completion, deleting the
  occurrence's `CompletionRecord`. Returns `204`, or `404` if `id` isn't owned by the authenticated
  user or has no current `CompletionRecord` (undoing a non-complete occurrence is not idempotent —
  it's a `404`, not a no-op `204`).
- **`POST /api/v1/plan/occurrences/{id}/carry-forward`** — advances a weekend-bucket occurrence's
  `weekStart` by 7 days, keeping the same occurrence `id` (not a new row). Only valid for an
  occurrence that is currently a bucket item (`dayOfWeek`/`slot` both null) and not complete —
  either violation returns `409` without changing `weekStart`. Returns `200` with the updated
  occurrence, `404` if `id` isn't owned by the authenticated user.

`name` in every response is resolved live from the linked `Activity`/`SubTask` at response time
(not stored on `PlannedOccurrence`) — renaming the underlying activity/sub-task later changes the
displayed name of every occurrence referencing it. Every response also includes
`parentActivityName`: `null` when the occurrence targets an `Activity` directly, or that activity's
name (also resolved live, same as `name`) when it targets a `SubTask` — lets a sub-task's tile show
which activity it belongs to. Every response also includes `completed` (boolean) and `completedAt`
(`null` unless complete), reflecting the occurrence's `CompletionRecord` if any. Deleting an
`Activity` or `SubTask` cascade-deletes its `PlannedOccurrence`s automatically (database-level
`ON DELETE CASCADE`), and deleting a `PlannedOccurrence` (directly, or transitively via its parent
`Activity`/`SubTask`) cascade-deletes its `CompletionRecord` the same way — not via any explicit
endpoint call.

## Occurrences & Completion

*(folded into the "Planner / Weekly Grid" section above — completion, undo, and carry-forward are
all `PlannedOccurrence`/`CompletionRecord` operations under `/api/v1/plan/occurrences/...`, not a
separate resource)*

## Mood & Reflection

*(none yet — V2)*

## AI Suggestions

*(none yet — V3+)*
