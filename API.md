# API Reference

**Maintenance rule**: update this file in the same change that creates, amends, or deletes an
endpoint — don't defer it to a later documentation pass.

**Status**: empty — no backend exists yet. This file establishes where endpoint documentation lives
from the start (see `PROCESS_CHANGES.md` for why: a per-endpoint table/list belongs in its own file,
not folded into `README.md`, since it's high-churn and unrelated to a general project overview).

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

## Activities

*(none yet)*

## Planner / Weekly Grid

*(none yet)*

## Occurrences & Completion

*(none yet)*

## Mood & Reflection

*(none yet — V2)*

## AI Suggestions

*(none yet — V3+)*
