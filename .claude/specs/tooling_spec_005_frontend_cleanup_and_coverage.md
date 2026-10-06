# Deduplicate getErrorMessage, Resolve ChevronIcon Collision, Add Frontend Coverage Script (Tooling)

**Status**: Implemented (2026-10-06) — `frontend/src/utils/getErrorMessage.ts`,
`frontend/src/components/icons/ChevronIcon.tsx`, `frontend/vitest.config.ts`/`package.json`
**Priority**: P3 — quality/tooling cleanup, no user-facing behavior change
**Depends on**: `frontend_spec_047_subtask_reordering.md` (the `ChevronIcon` `direction` prop and
the `WeekNav.tsx` naming collision it sharpened, both addressed here), `tooling_spec_003_modern_web_guidance_fixes.md`
(precedent for bundling several small, unrelated frontend fixes into one tooling spec)
**Area**: Frontend only — no backend/API changes, no `API.md` update
**Roadmap version**: N/A — internal/maintenance, not a V1–V5 feature

## Overview

Raised by `.claude/audits/audit-2026-10-06.md`'s refactoring and test-coverage findings (items 1–3
of that audit's recommendations). Three small, independent, no-behavior-change items bundled into
one spec per this project's existing precedent (`tooling_spec_003`) for low-risk frontend cleanups
that don't warrant three separate spec files:

1. **`getErrorMessage()` is duplicated verbatim across 11 files.** Same 13-line implementation,
   copy-pasted every time a component needs to turn a caught error into display text. Extract to one
   shared utility.
2. **Two different components are both named `ChevronIcon`.** `components/icons/ChevronIcon.tsx`
   (shared, grew a `direction: 'up' | 'down'` prop in `frontend_spec_047`) and `WeekNav.tsx`'s own
   locally-defined `ChevronIcon` (`direction: 'left' | 'right'`) are unrelated components that
   happen to share a name. Unify into one shared component supporting all four directions, and have
   `WeekNav.tsx` use it instead of its own copy — this resolves the naming collision *and* removes a
   second near-identical implementation in one move.
3. **Frontend coverage tooling is installed but unused.** `@vitest/coverage-v8` is already a
   devDependency; there's no `test:coverage` script and no `coverage` block in `vitest.config.ts`, so
   it does nothing. Wire it up.

**Out of scope**: setting a coverage threshold/gate (no baseline number exists yet — see Requirement
3's note), CI integration (no CI exists yet, tracked separately as a spec candidate), the
`SubTaskList`/`BucketList` Move up/down duplication and `ActivityBank.tsx`'s `useState` sprawl
(flagged in the same audit as lower-priority, not part of this pass).

## Requirement 1: One shared `getErrorMessage` utility

**User story**: As a developer, I want error-message formatting defined once, so a change to how
errors are displayed doesn't require editing 11 files, and so new components don't get an 12th copy.

### TOOLING-005-AC-01 [AUTO]: Shared `getErrorMessage` utility exists
**Statement**: The frontend shall provide one `getErrorMessage(error: unknown): string` utility at
`frontend/src/utils/getErrorMessage.ts`, returning `error.message` when `error` is an `ApiError`,
the `message` field when `error` is any other object carrying a string `message` property, and the
fixed fallback string `"Something went wrong. Please try again."` otherwise — identical behavior to
every one of the 11 local copies it replaces (confirmed byte-identical across a spot-check of 3
during audit research; verify all 11 match before extracting, not just the sample).

**Rationale**: A pure extraction — same logic, one location. Every call site's existing tests
already exercise this behavior indirectly (e.g. a load-error or delete-error test rendering the
fallback text); a small dedicated test file gives the utility itself direct coverage too.

**References**:
- New file: `frontend/src/utils/getErrorMessage.ts`
- Type: `frontend/src/types/api.ts`'s `ApiError`

**Test Case (Red)**:
```typescript
import { describe, it, expect } from 'vitest'
import { getErrorMessage } from './getErrorMessage'
import { ApiError } from '../types/api'

describe('TOOLING-005-AC-01: getErrorMessage', () => {
  it('returns the ApiError message', () => {
    expect(getErrorMessage(new ApiError('Not found', 404))).toBe('Not found')
  })

  it('returns a plain object error\'s string message field', () => {
    expect(getErrorMessage({ message: 'Network error' })).toBe('Network error')
  })

  it('falls back to a generic message for anything else', () => {
    expect(getErrorMessage('a plain string')).toBe('Something went wrong. Please try again.')
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.')
  })
})
```

**Test Case (Green)**: implement `getErrorMessage.ts` with the three branches above.

### TOOLING-005-AC-02 [MANUAL]: No duplicate local declarations remain
**Statement**: None of the following shall declare their own local `getErrorMessage` function —
each shall import the shared utility from `TOOLING-005-AC-01` instead: `ActivityBank.tsx`,
`ActivityForm.tsx`, `SubTaskForm.tsx`, `SubTaskList.tsx`, `SuggestedActivities.tsx`, `LoginPage.tsx`,
`Settings.tsx`, `ActivityPickerList.tsx`, `AssignActivityPicker.tsx`, `usePlanActions.ts`,
`useWorkDays.ts`.

**Rationale**: The actual fix — AC-01 alone only adds a 12th copy if the existing 11 aren't also
updated to use it.

**References**: `grep -rn "^function getErrorMessage" frontend/src` shall return zero matches once
this is done (the only remaining definition is the one `export`ed from AC-01's new file, which uses
an `export const`/`export function` form grep can distinguish from a local declaration).

**Verification**: `[MANUAL]` — code review confirming each of the 11 files imports rather than
redeclares, plus the grep check above as a mechanical confirmation. No new behavior to assert beyond
AC-01's own test and each file's pre-existing tests (which must keep passing unchanged, since this
is a no-behavior-change import swap).

## Requirement 2: One shared, four-direction ChevronIcon

**User story**: As a developer, I don't want two unrelated components named the same thing — it's
confusing to grep for, and inconsistent now that both ended up needing a `direction` prop for
different axes.

### TOOLING-005-AC-03 [AUTO]: Shared ChevronIcon supports all four directions
**Statement**: `components/icons/ChevronIcon.tsx` shall accept `direction: 'up' | 'down' | 'left' |
'right'` (defaulting to `'down'`, unchanged for every existing caller that passes no `direction`),
rendering the correct polyline orientation for each of the four values.

**Rationale**: Extends the `up`/`down` pair `frontend_spec_047` already added with `left`/`right`,
reusing `WeekNav.tsx`'s existing left/right polyline point values (`10,2 4,8 10,14` /
`6,2 12,8 6,14`) rather than inventing new ones.

**References**: `components/icons/ChevronIcon.tsx`, `components/icons/ChevronIcon.module.css`
(unchanged — same `.icon` class for all four directions).

**Test Case (Red)**:
```typescript
describe('TOOLING-005-AC-03: ChevronIcon direction variants', () => {
  it.each([
    ['up', '4,10 8,6 12,10'],
    ['down', '4,6 8,10 12,6'],
    ['left', '10,2 4,8 10,14'],
    ['right', '6,2 12,8 6,14'],
  ] as const)('renders the %s polyline', (direction, points) => {
    const { container } = render(<ChevronIcon direction={direction} />)
    expect(container.querySelector('polyline')).toHaveAttribute('points', points)
  })
})
```

**Test Case (Green)**: implement the four-way `points` lookup in `ChevronIcon.tsx`.

### TOOLING-005-AC-04 [AUTO]: WeekNav uses the shared ChevronIcon, no local duplicate
**Statement**: `WeekNav.tsx` shall import and render the shared `ChevronIcon` (`direction="left"`
for its Previous-week button, `direction="right"` for Next) instead of declaring its own local
`ChevronIcon` component. No second `ChevronIcon` definition shall exist anywhere in the frontend.

**Rationale**: Removes the naming collision and the duplicate implementation in the same change.

**References**: `components/WeeklyPlanner/WeekNav.tsx`, `components/WeeklyPlanner/WeekNav.module.css`
(its own `.chevronIcon` class may become unused once rendering delegates to the shared component's
`.icon` class — remove it if so, don't leave dead CSS).

**Test Case (Green)**: `WeekNav.test.tsx`'s existing tests (Previous/Next button behavior,
accessible names) must keep passing unchanged — this is a rendering-implementation swap, not a
behavior change. Confirmed via `grep -rn "function ChevronIcon" frontend/src` returning exactly one
match (the shared one) after this change.

## Requirement 3: Frontend code-coverage tooling is actually wired up

**User story**: As a developer, I want to run one command and see which lines/branches the frontend
suite actually exercises, instead of relying on manual AC-to-test spot-checks to judge coverage.

### TOOLING-005-AC-05 [AUTO]: `npm run test:coverage` produces a real coverage report
**Statement**: `frontend/package.json` shall declare a `test:coverage` script running Vitest with
coverage enabled, using the already-installed `@vitest/coverage-v8` provider. `vitest.config.ts`
shall declare a `test.coverage` block (`provider: 'v8'`, text + a machine-readable reporter such as
`lcov` or `json-summary`, excluding test files, `main.tsx`, and type-only `.d.ts`/`types/` files from
the report). Running `npm run test:coverage` shall complete successfully and produce a coverage
summary, with no change to any existing test's pass/fail outcome.

**Rationale**: The dependency is already installed and doing nothing — this is purely wiring it up,
not introducing a new tool. No coverage threshold/gate is set as part of this AC (see Overview's
"Out of scope" — no baseline exists yet to set a sensible number against).

**References**:
- `frontend/package.json`'s `scripts` block
- `frontend/vitest.config.ts`
- `@vitest/coverage-v8` (already a devDependency)

**Test Case (Green)**: run `npm run test:coverage` from `frontend/`; verify it exits `0`, prints a
per-file coverage table, and writes a report to the configured output directory (e.g.
`coverage/`) — add `coverage/` to `.gitignore` if not already covered by an existing `*.log`/build
output ignore pattern. No Vitest `*.test.ts(x)` file changes needed for this AC.

## Cross-references

| Reference | What it provides |
|---|---|
| `frontend/src/utils/getErrorMessage.ts` (new) | AC-01 target |
| 11 files listed in AC-02 | AC-02 targets |
| `frontend/src/components/icons/ChevronIcon.tsx` | AC-03 target |
| `frontend/src/components/WeeklyPlanner/WeekNav.tsx` | AC-04 target |
| `frontend/package.json`, `frontend/vitest.config.ts` | AC-05 targets |
| `.claude/audits/audit-2026-10-06.md` | Source audit this spec actions (items 1–3) |
| `.claude/SPEC_CANDIDATES.md` | Where audit item 4 (CI + e2e) lives instead |
| `.claude/ideas/future_ideas.md` | Where audit items 5–6 (JUnit parallelism, index/memo) live instead |

## Acceptance Criteria Summary

- [x] TOOLING-005-AC-01 — shared `getErrorMessage` utility exists, identical behavior to the 11 copies
- [x] TOOLING-005-AC-02 — no duplicate local declarations remain, all 11 import the shared utility
- [x] TOOLING-005-AC-03 — shared `ChevronIcon` supports `up`/`down`/`left`/`right`
- [x] TOOLING-005-AC-04 — `WeekNav.tsx` uses the shared `ChevronIcon`, no second definition remains
- [x] TOOLING-005-AC-05 — `npm run test:coverage` is wired up and produces a real report

## Summary

### What changed
- Added `frontend/src/utils/getErrorMessage.ts` (+ `getErrorMessage.test.ts`, 3 cases) and removed
  the 11 duplicated local copies, replacing each with an import. In each case the now-unused local
  `ApiError` import was also removed (it had no other use in any of the 11 files).
- Extended `frontend/src/components/icons/ChevronIcon.tsx` with `left`/`right` directions (exact
  point values taken from `WeekNav.tsx`'s prior local copy), added the AC-03 `it.each` test file
  (`ChevronIcon.test.tsx`, new — none existed before), and updated `WeekNav.tsx` to import the
  shared component instead of declaring its own. Removed the now-unused `.chevronIcon` class from
  `WeekNav.module.css` (confirmed via grep it had no other reference).
- Added `test:coverage` script (`vitest run --coverage`) to `frontend/package.json` and a
  `test.coverage` block to `frontend/vitest.config.ts` (`provider: 'v8'`, `reporter: ['text',
  'lcov', 'json-summary']`, excluding test files, `main.tsx`, and `types/`/`.d.ts`). Added
  `coverage` to `frontend/.gitignore` (previously not covered by any existing pattern).

### Test counts
- Before: 45 test files / 652 tests passing (verified by stashing tracked changes and re-running;
  the 2 new untracked test files still present at that point contributed the only failures, both
  in the `ChevronIcon` `left`/`right` cases, as expected pre-AC-03).
- After: 46 test files / 660 tests passing (+1 file, `getErrorMessage.test.ts`'s 3 cases live inside
  an existing new file count and `ChevronIcon.test.tsx`'s 5 cases — net +8 tests, +1 file since
  `ChevronIcon.test.tsx` didn't exist before).
- `npm run lint` (oxlint) and `npx tsc -b --noEmit`: both clean, zero findings.

### Coverage
- `npm run test:coverage` exits 0 and writes `frontend/coverage/` (`lcov.info`,
  `coverage-summary.json`, `lcov-report/`).
- Overall: **93.67% statements, 88.72% branches, 91.48% functions, 94.56% lines** (660/660 tests
  passing under coverage instrumentation too). No threshold is enforced — this number is recorded
  for visibility only, per the Overview's "out of scope."

### Findings
- All 11 `getErrorMessage` local copies were confirmed byte-identical (same 13-line body) before
  extraction — no behavior differences found.
- Fixing the coverage config surfaced one real gotcha: using `reporters` (plural) instead of
  Vitest's actual `reporter` (singular) `CoverageOptions` key doesn't just fail cleanly — it breaks
  `mergeConfig`'s type inference entirely, producing a second, unrelated-looking `tsc` error
  (`UserConfig & Promise<UserConfig>... not assignable to type 'never'`) at `vitest.config.ts`'s
  `mergeConfig(...)` call site. Fixed by using the correct `reporter` key.
- No other surprises; `WeekNav.test.tsx` passed unchanged after the `ChevronIcon` swap, as
  expected for a pure rendering-implementation change.
