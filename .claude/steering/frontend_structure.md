# Frontend Project Structure

Lines marked **(built)** exist today (scaffolded 2026-08-27 via `npm create vite@latest -- --template
react-ts`, then wired up for testing/API-proxy/theming per this project's conventions); everything
else is the target layout to grow into as specs are implemented.

## Directory Layout (current + target)

```
frontend/
├── src/
│   ├── components/                 # Reusable React components (none yet)
│   │   ├── WeeklyPlanner/           # Mon–Fri Morning/Afternoon/Evening grid (V1)
│   │   ├── ActivityBank/            # Create/edit/list activities, category picker (V1)
│   │   ├── WeekendBucketList/       # Flexible weekend list (V1)
│   │   ├── MoodRating/              # Before/after mood capture (V2)
│   │   ├── WeeklyReview/            # Review dashboard (V2)
│   │   └── ...                     # grow this list as specs land, don't pre-build
│   │
│   ├── pages/                      # Page-level components, if/when routing is added (not yet needed)
│   │
│   ├── services/                   # All backend API calls, one file per resource area (none yet)
│   │   ├── activityApi.ts
│   │   ├── plannerApi.ts
│   │   └── ...
│   │
│   ├── types/                      # Centralized TypeScript types (none yet)
│   │   ├── activity.ts
│   │   ├── planner.ts
│   │   └── api.ts                  # ApiResponse, ApiError, LoadingState, AsyncState
│   │
│   ├── hooks/                      # Custom React hooks — extract when a second component needs
│   │                                #   the same fetch/state logic, not before
│   │
│   ├── styles/                     # Global styles, if split out from src/index.css (not yet needed)
│   │
│   ├── App.tsx                     # (built) Placeholder shell — swap for the real orchestrator
│   │                                #   once the first component spec lands
│   ├── App.test.tsx                # (built) Smoke test only — validates the Vitest wiring
│   ├── main.tsx                    # (built) React entry point
│   ├── index.css                   # (built) Reset + theme custom properties (--text/--bg/--border/
│   │                                #   --accent/...), light+dark via prefers-color-scheme
│   └── test-setup.ts               # (built) Wires up @testing-library/jest-dom matchers
│
├── public/                         # (built) favicon.svg
├── vite.config.ts                  # (built) React plugin + /api → :8080 dev-server proxy
├── vitest.config.ts                # (built) jsdom env, globals, test-setup.ts, merged with vite.config
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json  # (built)
├── .oxlintrc.json                  # (built) oxlint config — see note below on why not ESLint
├── package.json                    # (built)
├── package-lock.json               # (built)
└── .gitignore                      # (built)
```

**Lint tool note**: this project uses **oxlint**, not ESLint — `npm create vite@latest`'s current
`react-ts` template defaults to it (Rust-based, ESLint-rule-compatible, much faster). Adopted as
scaffolded rather than swapped for legacy ESLint; revisit only if a specific ESLint-only rule/plugin
is needed that oxlint doesn't cover yet.

**No router, no CSS-framework, no `services`/`types`/`components` yet** — first real UI work (the
weekly planner grid) decides the styling approach (CSS Modules is the likely default per
`frontend_conventions.md`, not yet confirmed) and creates these directories for real.

## File Naming Rules

| Category | Pattern | Example |
|----------|---------|---------|
| React Components | `PascalCase.tsx` | `WeeklyPlanner.tsx` |
| Component Tests | `PascalCase.test.tsx` | `WeeklyPlanner.test.tsx` |
| Services/Utils | `camelCase.ts` | `activityApi.ts` |
| Type Definitions | `camelCase.ts` | `activity.ts` |
| Hooks | `use[Name].ts` | `useWeekPlan.ts` |

## Component Organization

### Presentational Components
Live in `src/components/`. Receive data via props, handle UI only, no direct API calls.

### Container Components
Manage state and data fetching (`useState`/`useEffect` or, once routing exists, `src/pages/`).

## Services & API Layer

All backend communication goes through `src/services/*Api.ts` — never raw `axios`/`fetch` in a
component. Each file exports a typed object (`activityApi`, `plannerApi`, ...) following the same
`request<T>()` wrapper pattern: typed, throws a shared `ApiError` (`src/types/api.ts`) on failure.

## Type Definitions

Centralized in `src/types/`. Nullable backend fields are `T | null`, not `T | undefined`.

## Environment Configuration

```
# frontend/.env.local (git-ignored)
VITE_API_BASE=http://localhost:8080/api/v1
```

## Testing Setup

- Run: `npm test` (single run) or `npm run test:watch`
- Vitest + React Testing Library + jsdom, `test-setup.ts` wires up `@testing-library/jest-dom`
- Scope: component behaviour and user interactions, not implementation details; API calls mocked
  via `vi.mock('../services/xApi')`

## Build & Deployment

- Build: `npm run build` → `frontend/dist/`
- Deploy: not decided yet — follows the backend's Docker Compose / Fly.io / Railway staging (see
  `tech.md`)

## Key Principles

1. **Type everything** — no `any` without justification
2. **Separation of concerns** — components for UI, `services/` for API, `types/` for contracts
3. **Test behaviour**, not implementation
4. **Keep it simple** — build to the current version's spec, not ahead of it (see
   `product.md`'s roadmap and non-goals)
5. **Calm, non-gamified UI** — matches the product's core philosophy: missed activities are never
   shown as failure
6. **Accessibility is not optional** — semantic HTML, `aria-label`s, `role="status"`/`role="alert"`
   where applicable (see `frontend_conventions.md`)
