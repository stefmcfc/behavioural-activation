# Bulk Sub-task Fetch Endpoint (Frontend)

**Status**: Implemented (2026-10-03)
**Priority**: P2 — performance/scale, paired with `planner_spec_018_bulk_sub_task_fetch.md`
(**must be implemented first** — this spec consumes its new `GET /api/v1/sub-tasks` endpoint).
**Depends on**: `planner_spec_018_bulk_sub_task_fetch.md` (the new endpoint this spec consumes),
`frontend_spec_028_activity_drawer.md` (origin of `ActivityPickerList.tsx`, the one component
modified here, shared unmodified by `AssignActivityPicker`/`ActivityDrawer`)
**Area**: Frontend only — no new UI, this is purely a fetch-strategy change
**Roadmap version**: V1 polish / internal — a performance fix, not a new capability

## Summary

All 5 ACs implemented and verified. `subTaskApi.ts` gained `getAllForOwner(): Promise<SubTask[]>`,
calling `GET /sub-tasks` and unwrapping the `{ data, count }` envelope via the same `request()`
wrapper every other method in the file uses. `ActivityPickerList.tsx`'s mount effect now issues
`Promise.all([activityApi.getAll(), subTaskApi.getAllForOwner()])` instead of fetching activities
first and then fanning out one `subTaskApi.getAll(activityId)` call per activity — the two calls have
no data dependency, so they run in parallel. The flat `SubTask[]` response is grouped into
`Record<string, SubTask[]>` client-side: every fetched activity seeds an empty array first (so a
zero-sub-task activity maps to `[]`, not an absent key, matching pre-existing behavior exactly), then
each sub-task is pushed onto its `activityId`'s bucket.

Total requests on mount dropped from `1 + N` to a constant `2`, confirmed via mock call-count
assertions in `ActivityPickerList.test.tsx` (`activityApi.getAll` called once, `subTaskApi.getAllForOwner`
called once, `subTaskApi.getAll` — the old per-activity method — never called).

**Test fallout beyond the spec's named three files**: `AssignActivityPicker.test.tsx` and
`ActivityDrawer.test.tsx` (the two consumers explicitly named in AC-05) had every
`vi.mocked(subTaskApi.getAll)` mock setup switched to `vi.mocked(subTaskApi.getAllForOwner)`, with no
assertion changes, as specified. Two additional files not named in the spec —
`WeeklyPlanner.test.tsx` and `TodayView.test.tsx` — also needed the same mock-setup fix: both render
`ActivityPickerList` indirectly (via the assign picker / browse drawer) and several of their tests
mocked only `activityApi.getAll` with an empty array, relying on the old implementation's behavior of
never calling `subTaskApi.getAll` when there were zero activities to fan out over. Since the new
implementation calls `subTaskApi.getAllForOwner()` unconditionally (not gated on activity count), an
auto-mocked, unconfigured `getAllForOwner()` resolved to `undefined`, and the component's grouping
loop threw `TypeError: allSubTasks is not iterable` — caught by the component's own existing
error-handling path and surfaced as an alert, which broke the small number of tests that asserted on
the picker's actual contents (not just its structural presence). Fixed by defaulting
`subTaskApi.getAllForOwner` to `mockResolvedValue([])` in each file's top-level `beforeEach`, plus
updating the few explicit per-test overrides. No test assertions changed in either file — same
treatment as AC-05, just a wider blast radius than the spec anticipated.

Full suite: 480 tests, 0 failures. `npm run lint` (oxlint): clean, 0 issues.

## Overview

`ActivityPickerList.tsx`'s mount effect calls `activityApi.getAll()`, then fans out one
`subTaskApi.getAll(activityId)` call per activity via `Promise.all` — parallelized (not a sequential
waterfall), but still N+1 HTTP round trips every time the Weekly Planner's "Add" modal or Today's
"Browse activities" drawer opens. `planner_spec_018` adds a new `GET /api/v1/sub-tasks` endpoint
returning every sub-task for the authenticated user in one call; this spec switches
`ActivityPickerList.tsx` to use it.

**The fix**: replace the per-activity fan-out with one `subTaskApi.getAllForOwner()` call, run in
parallel with the existing `activityApi.getAll()` call (not sequentially after it — there's no data
dependency between the two anymore, since the new endpoint isn't scoped by activity id), then group
the flat sub-task list by `activityId` client-side to reconstruct the same
`Record<string, SubTask[]>` shape the component already uses internally. Total requests drops from
`1 + N` to a constant `2`, regardless of activity count.

**No other component needs this fix.** Confirmed by checking every `subTaskApi` call site in the
frontend: `SubTaskForm.tsx` only creates/updates a single sub-task (irrelevant here), and
`SubTaskList.tsx` — the Activity Bank's own per-row "Show sub-tasks" expansion — already fetches
lazily, one activity's sub-tasks on demand when that row is expanded, using the `subTaskCount` the
list endpoint already returns inline for the collapsed-state label. `ActivityPickerList.tsx` is the
only N+1 offender in this codebase.

**No change to the component's rendered output or props.** `mode="select"`/`mode="drag"` rendering,
filters, and row markup are all unaffected — this is purely how `subTasksByActivity` gets populated.

**Explicitly out of scope**: any change to `SubTaskList.tsx`'s existing lazy-per-row fetch (it's
already correct, not part of this fix). Any new caching layer across components (e.g. sharing the
fetched activity/sub-task lists between `ActivityBank.tsx` and `ActivityPickerList.tsx`) — a larger,
separate architectural question (would need something like React Query), not scoped here; this spec
only removes *this component's own* N+1, it doesn't address redundant fetching *across* components.

## Requirement 1: `ActivityPickerList` fetches all sub-tasks in one call, not one per activity

**User story**: As a user, I want the Add picker and Browse activities drawer to open quickly
regardless of how many activities I've built up, not slower the more I use the app.

### FRONTEND-033-AC-01 [AUTO]: `subTaskApi` gains a bulk fetch method
**Statement**: `frontend/src/services/subTaskApi.ts` shall gain a new `getAllForOwner(): Promise<SubTask[]>`
method calling `GET /sub-tasks` (the new endpoint from `planner_spec_018`), following the same
`request()`-wrapper/response-unwrapping pattern every other method in this file already uses.

**References**: `frontend/src/services/subTaskApi.ts`

### FRONTEND-033-AC-02 [AUTO]: `ActivityPickerList` calls the bulk endpoint instead of fanning out per activity
**Statement**: `ActivityPickerList.tsx`'s mount effect shall call `activityApi.getAll()` and
`subTaskApi.getAllForOwner()` in parallel (not one after the other — there is no data dependency
between them), then group the returned flat `SubTask[]` list by `activityId` to populate
`subTasksByActivity`, replacing the current per-activity `Promise.all` fan-out entirely.

**References**: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx` (lines 83–112 as of
this writing)

### FRONTEND-033-AC-03 [AUTO]: Exactly two requests are issued, regardless of activity count
**Statement**: Mounting `ActivityPickerList` with N activities shall issue exactly two API calls
(`activityApi.getAll()` and `subTaskApi.getAllForOwner()`) — not `1 + N`, confirmed via mock
call-count assertions, not assumed from the code shape alone.

**References**: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`

## Requirement 2: Rendered output is unaffected — same data, same grouping, differently fetched

**User story**: As a user, I want the Add picker / Browse activities drawer to look and behave
exactly as before — this is invisible, just faster.

### FRONTEND-033-AC-04 [AUTO]: `subTasksByActivity`'s grouping is identical to today's per-activity-fetch result
**Statement**: For the same underlying data, `subTasksByActivity` (keyed by `activityId`, each value
an array of that activity's sub-tasks) shall be identical whether built from N per-activity responses
(today) or from grouping one flat bulk response (after this spec) — including an activity with zero
sub-tasks mapping to an empty array, not an absent key, matching today's behavior.

**References**: `frontend/src/components/WeeklyPlanner/ActivityPickerList.tsx`

### FRONTEND-033-AC-05 [AUTO]: Every existing `ActivityPickerList`/`AssignActivityPicker`/`ActivityDrawer` test still passes, with mocks updated for the new fetch shape
**Statement**: Every existing test exercising activity/sub-task rendering, filtering, or selection
across `ActivityPickerList.test.tsx`, `AssignActivityPicker.test.tsx`, and `ActivityDrawer.test.tsx`
shall pass — with `vi.mocked(subTaskApi.getAll)` mock setups updated to
`vi.mocked(subTaskApi.getAllForOwner)` (returning the flat list shape instead of a per-activity-id
response) wherever a test currently stubs the old per-activity call. No test's *assertions* should
need to change, only its mock setup.

**Rationale**: Explicit regression guard, and an honest acknowledgment that this fetch-shape change
touches every existing test's mock setup, not just `ActivityPickerList.test.tsx`'s own tests — the two
consumer components' test files mock the same services.

**References**: `frontend/src/components/WeeklyPlanner/ActivityPickerList.test.tsx`,
`frontend/src/components/WeeklyPlanner/AssignActivityPicker.test.tsx`,
`frontend/src/components/WeeklyPlanner/ActivityDrawer.test.tsx`

## Explicitly out of scope (do not implement as part of this spec)

- `SubTaskList.tsx`'s existing lazy per-row fetch — already correct, not touched.
- Any cross-component caching (sharing fetched data between `ActivityBank.tsx` and
  `ActivityPickerList.tsx`) — a separate, larger architectural question, not this spec's job.
- Any UI/visual change — this is a fetch-strategy change only.

## Cross-references

| This spec depends on / contracts against | What it provides |
|---|---|
| `planner_spec_018_bulk_sub_task_fetch.md` | `GET /api/v1/sub-tasks`, the endpoint this spec consumes — **must ship first** |
| `frontend_spec_028_activity_drawer.md` | `ActivityPickerList.tsx`, the one component this spec modifies |
| `types/subTask.ts` | `SubTask`'s existing `activityId` field — already present, used here to group the flat response, no type change needed |

## TDD test case sketches

### FRONTEND-033-AC-01
```typescript
describe('FRONTEND-033-AC-01: subTaskApi.getAllForOwner', () => {
  it('calls GET /sub-tasks and unwraps the data array', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { data: [subTaskA, subTaskB], count: 2 } })

    const result = await subTaskApi.getAllForOwner()

    expect(client.get).toHaveBeenCalledWith('/sub-tasks')
    expect(result).toEqual([subTaskA, subTaskB])
  })
})
```

### FRONTEND-033-AC-02 / AC-03 / AC-04
```typescript
describe('FRONTEND-033-AC-02/AC-03/AC-04: bulk fetch replaces the per-activity fan-out', () => {
  it('AC-03: issues exactly two API calls regardless of activity count', async () => {
    const activities = [activityA, activityB, activityC] // 3 activities
    vi.mocked(activityApi.getAll).mockResolvedValue(activities)
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([])

    render(<ActivityPickerList mode="select" selected={null} onSelectActivity={vi.fn()} onSelectSubTask={vi.fn()} />)
    await screen.findByText(activityA.name)

    expect(activityApi.getAll).toHaveBeenCalledTimes(1)
    expect(subTaskApi.getAllForOwner).toHaveBeenCalledTimes(1)
    expect(subTaskApi.getAll).not.toHaveBeenCalled() // the old per-activity method, confirms no fan-out
  })

  it('AC-04: groups the flat sub-task list by activityId, including an empty array for an activity with none', async () => {
    vi.mocked(activityApi.getAll).mockResolvedValue([activityA, activityB])
    vi.mocked(subTaskApi.getAllForOwner).mockResolvedValue([
      { ...subTaskA, activityId: activityA.id },
    ]) // activityB has zero sub-tasks

    render(<ActivityPickerList mode="select" selected={null} onSelectActivity={vi.fn()} onSelectSubTask={vi.fn()} />)

    expect(await screen.findByText(subTaskA.name)).toBeInTheDocument()
    // activityB renders with no sub-task rows beneath it, not an error/missing-key crash
    expect(screen.getByText(activityB.name)).toBeInTheDocument()
  })
})
```

### FRONTEND-033-AC-05
No new sketch — this AC is satisfied by updating existing tests' mock setups (`vi.mocked(subTaskApi.getAll)`
→ `vi.mocked(subTaskApi.getAllForOwner)` with the new flat-list response shape) across
`ActivityPickerList.test.tsx`/`AssignActivityPicker.test.tsx`/`ActivityDrawer.test.tsx`, not writing
new test cases.

## Acceptance Criteria Summary

- [x] FRONTEND-033-AC-01 — `subTaskApi` gains a bulk `getAllForOwner()` method
- [x] FRONTEND-033-AC-02 — `ActivityPickerList` calls the bulk endpoint instead of fanning out per activity
- [x] FRONTEND-033-AC-03 — exactly two requests issued, regardless of activity count
- [x] FRONTEND-033-AC-04 — `subTasksByActivity`'s grouping is identical to today's result
- [x] FRONTEND-033-AC-05 — every existing test passes, with mocks updated for the new fetch shape
      (plus `WeeklyPlanner.test.tsx`/`TodayView.test.tsx`, not named in the original AC text — see
      Summary)
