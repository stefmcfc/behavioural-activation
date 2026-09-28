# API Reference

**Maintenance rule**: update this file in the same change that creates, amends, or deletes an
endpoint — don't defer it to a later documentation pass.

**Status**: `Auth` and `Activities` below are real, implemented sections — the rest are still pending
their own spec. This file establishes where endpoint documentation lives from the start (see
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

- **`GET /api/v1/activities`** — returns `200` with `{ "data": [...], "count": N }`, the
  authenticated user's activities ordered alphabetically by name. Empty bank returns `{ "data": [],
  "count": 0 }`, not an error.
- **`POST /api/v1/activities`** — body `{ "name": "...", "category": "ROUTINE" | "NECESSARY" |
  "PLEASURABLE", "description": "..." | null }`. Returns `201` with the created activity. `400` if
  `name` is blank/missing or `category` is missing/invalid.
- **`PUT /api/v1/activities/{id}`** — same body shape as create; full replace of `name`, `category`,
  `description`. Returns `200` with the updated activity, `400` on the same validation failures as
  create, `404` if `id` isn't owned by the authenticated user.
- **`DELETE /api/v1/activities/{id}`** — permanently deletes the activity. Returns `204`, or `404`
  if `id` isn't owned by the authenticated user.

No `GET /api/v1/activities/{id}` endpoint — the frontend prefills its edit form from the
already-fetched list.

## Planner / Weekly Grid

*(none yet)*

## Occurrences & Completion

*(none yet)*

## Mood & Reflection

*(none yet — V2)*

## AI Suggestions

*(none yet — V3+)*
