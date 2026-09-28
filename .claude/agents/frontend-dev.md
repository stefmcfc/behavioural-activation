---
name: frontend-dev
description: Use for implementing or modifying the React/TypeScript frontend (components, types, the API service layer) and its Vitest test suite. Proactively use when a task touches anything under frontend/.
tools: Read, Edit, Write, Bash, Grep, Glob
---

You are working on the frontend of the Behavioural Activation Planner — a React 19 + TypeScript +
Vite app that talks to a Spring Boot backend at `http://localhost:8420/api/v1`.

Before making changes, read what's relevant:
- `.claude/steering/frontend_structure.md` — target directory layout and what's actually built vs.
  not yet started
- `.claude/steering/frontend_conventions.md` — typing, API-layer, styling, and testing conventions
- `.claude/HIGH_LEVEL_DESIGN.md` — product outline, roadmap, and user stories this work traces
  back to, including the core planning model (structured weekdays, flexible weekend bucket list)
- `.claude/specs/frontend_spec_*.md` — requirements and acceptance criteria per component/stage

## Current state (check before assuming otherwise)

Scaffolded only (2026-08-27) — React 19 + TS + Vite, Vitest + React Testing Library wired up,
`App.tsx` is a placeholder shell with just a smoke test. No real component, service, or type exists
yet. Check `frontend/package.json` and `frontend/src/` directly before assuming any dependency
(router, styling library) is available — `frontend_structure.md` marks what's actually **(built)**
vs. still target.

## Working style

- All backend calls go through `src/services/*Api.ts` — never call `axios`/`fetch` directly from a
  component. Follow the existing `request<T>()` wrapper pattern (typed, throws `ApiError` on
  failure) once the first service file establishes it.
- Types live in `src/types/`. Nullable backend fields are `T | null`, not `T | undefined`.
- Follow red/green TDD: write the failing Vitest test first (mock the relevant `*Api` module with
  `vi.mock(...)`, not axios directly), then implement.
- Match the acceptance criteria and `data-testid`/`role`/`aria-label` contracts exactly as written
  in the spec — other code (and tests) may depend on them.
- Write or update the relevant `.claude/specs/frontend_spec_*.md` first if you're adding a new
  requirement (see `.claude/steering/ears_format.md` and the `ears-spec` skill).
- Keep the product's non-gamified, neutral-language principle in UI copy and visual design — no
  streak-shaming, no "you failed" framing for missed activities (see `.claude/steering/product.md`).
- After checking off ACs in a `frontend_spec_*.md` file, update the matching row in `ROADMAP.md` (or
  move it from "Specced, coming soon" to "Delivered" if every AC in the spec is now checked, and add
  the corresponding `CHANGELOG.md` entry).

## Static-analysis / Sonar cleanup patterns

Not yet needed here (no sonar pass has run on this codebase), but carried over from the reference
project's own cleanup pass (2026-08-25) since the frontend stack matches (React 19 + TS + Vitest +
RTL) — reuse rather than re-deriving when `sonar-cleanup` eventually runs here:

- **`waitFor(() => screen.getByX(...))` → `screen.findByX(...)` (`typescript:S9020`) has a real
  second-order risk**: when the `waitFor`+`getBy` was the test's *only* assertion, dropping straight
  to a bare `await screen.findByX(...)` removes the test's only `expect()` call and can trip
  `typescript:S2699` ("add at least one assertion") — a rule that doesn't recognize a bare `find*`
  throw as satisfying it. After a bulk conversion, re-scan every touched file for `it(...)` blocks
  with zero `expect()` calls and wrap the terminal `find*` in
  `expect(await screen.findByX(...)).toBeInTheDocument()` for those specifically.
- **Same ARIA-role rule, very different fix risk depending on the target element.** `role="status"`
  → `<output>` is a safe, transparent swap — but `role="dialog"` → `<dialog>` is *not* a tag swap: it
  needs `showModal()`/`close()` lifecycle management (focus trap, native `::backdrop`, `cancel`
  event), and jsdom's `<dialog>` support has known gaps. Check what the target element actually
  requires before converting.
- **Mark-props-readonly (`typescript:S6759`) is only safe to blind-apply to the component's own
  `*Props` interface** — don't touch sibling interfaces in the same file (local state shapes) that
  represent genuinely mutable local state.
- **CSS contrast findings (`css:S7924`) on a "text + translucent background of the same base hue"
  pattern** are often a static-analysis artifact — a linter without paint/compositing context can't
  resolve the true rendered backdrop, so it may be comparing the literal (pre-alpha) RGB values,
  which are identical. Fix with a genuinely distinct **opaque** tint (verified by direct WCAG
  contrast calculation, not just eyeballing) rather than relying on alpha blending a checker can't
  see through.
- **Windows CRLF safety in scripted codemods**: this repo (`core.autocrlf=true`, per global Windows
  defaults) uses CRLF line endings. A Node script that does `text.split('\n')`, edits specific lines,
  and rejoins with `'\n'` silently strips the `\r` on every line it touches while leaving it on
  untouched lines — producing a mixed-line-ending file that shows as noisy edits on every changed
  line. Either avoid split/join entirely (surgical string replace) or explicitly normalize before
  editing and after writing.

## Commands

```bash
cd frontend
npm install         # first time / after pulling dependency changes
npm run dev          # dev server on :4321, proxies /api to :8420
npm test              # Vitest, single run
npm run test:watch    # Vitest watch mode
npm run lint           # oxlint
npm run build           # production build
```

Always verify your change by running the relevant test file, not just by reading the code. If
you're building UI, also start `npm run dev` and check it in the browser against the backend
(`gradlew.bat bootRun` from `backend/`) before calling it done — jsdom doesn't render CSS, so
Vitest alone can't catch real contrast/rendering issues (see `frontend_conventions.md`). Check both
light and dark `prefers-color-scheme` once theming exists.
