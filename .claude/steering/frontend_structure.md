# Frontend Project Structure

This describes the real current frontend tree, not a scaffolding-era target. The frontend is a
substantial React app now (10 component subdirectories, 6 API service files, 46+ test files as of
the last `tooling_spec_005` coverage pass) — when in doubt about whether something exists, check
`frontend/src/` directly rather than trusting this doc's memory of it. Update this file whenever a
change adds/removes a top-level directory under `src/`, not on every individual component.

## Directory Layout

```
frontend/
├── src/
│   ├── components/
│   │   ├── ActivityBank/        # Activity Bank page: list, Add/Edit modal, sub-task checklist,
│   │   │                        #   category picker/guidance, suggested-activities disclosure
│   │   ├── WeeklyPlanner/       # Mon–Sun grid + weekend bucket list, Today view, Assign Activity
│   │   │                        #   modal, activity drawer, drag-and-drop payload/filters, the
│   │   │                        #   usePlanActions/useWorkDays hooks (colocated here — see below)
│   │   ├── WeeklySummary/       # Weekly Summary tab: stats, completion marks, lite grid
│   │   ├── Settings/            # Theme, category colours, grid orientation, work-day pattern
│   │   ├── Navigation/          # TabNav, AccountMenu, SettingsMenu (Popover API + CSS anchor
│   │   │                        #   positioning, no router)
│   │   ├── Modal/               # Shared <dialog>-based modal primitive, used across the app
│   │   ├── CategoryChip/        # Shared category badge
│   │   ├── CategoryGroupHeading/ # Shared "Routine/Necessary/Pleasurable" section heading
│   │   ├── FavouriteIcon/       # Shared star toggle icon
│   │   ├── RepeatableIcon/      # Shared repeatable-activity icon
│   │   └── icons/               # ChevronIcon, CompletionIcon, WorkDayIcon — small shared glyphs
│   │
│   ├── services/                # All backend API calls, one *Api.ts file per resource area:
│   │   │                        #   activityApi, authApi, exportApi, planApi, subTaskApi,
│   │   │                        #   workDayApi — plus client.ts, the shared request<T>() wrapper
│   │   │                        #   every other service file is built on.
│   │
│   ├── types/                   # Centralized TypeScript types, one file per resource area:
│   │                            #   activity.ts, auth.ts, plan.ts, subTask.ts, workDay.ts, api.ts
│   │                            #   (ApiResponse, ApiError, LoadingState, AsyncState)
│   │
│   ├── utils/                   # Small pure helpers, no React/API dependencies: categoryColors,
│   │                            #   categoryFilter, categoryGuidance, categoryLabels, contrast,
│   │                            #   getErrorMessage, gridOrientation, presetActivities, theme
│   │
│   ├── styles/                  # Shared CSS Module *variant* classes used across components
│   │                            #   (buttonVariants.module.css — primary/destructive button
│   │                            #   treatment) — not global/base styles, those stay in index.css
│   │                            #   and theme.css below.
│   │
│   ├── App.tsx                  # Real top-level orchestrator: auth gate, tab routing (no
│   │                            #   router — plain state-driven tab switch), theme provider
│   ├── App.module.css
│   ├── App.test.tsx
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Reset + base layout
│   ├── theme.css                # Theme custom properties (--text/--bg/--border/--accent/...),
│   │                            #   light+dark via prefers-color-scheme and a manual override
│   └── test-setup.ts            # Wires up @testing-library/jest-dom matchers
│
├── public/                      # favicon.svg
├── vite.config.ts               # React plugin, dev server on :4321 (strictPort),
│                                 #   /api → :8420 dev-server proxy
├── vitest.config.ts             # jsdom env, globals, test-setup.ts, merged with vite.config
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── .oxlintrc.json                # oxlint config — see note below on why not ESLint
├── package.json
├── package-lock.json
└── .gitignore
```

**Lint tool note**: this project uses **oxlint**, not ESLint — `npm create vite@latest`'s
`react-ts` template defaults to it (Rust-based, ESLint-rule-compatible, much faster). Adopted as
scaffolded rather than swapped for legacy ESLint; revisit only if a specific ESLint-only rule/plugin
is needed that oxlint doesn't cover yet.

**Styling is settled**: **CSS Modules**, one `ComponentName.module.css` colocated per component
(confirmed in `frontend_conventions.md`, originally decided in `frontend_spec_005`) — this was an
open question at scaffolding time and is not anymore.

**Not yet built**: a router or `pages/` directory — tab-based navigation driven by plain
`useState` in `App.tsx` has covered everything so far (Activity Bank, Weekly Planner, Today,
Weekly Summary, Settings), so there's been no concrete need yet. A top-level `hooks/` directory
also never materialized: the two hooks that exist (`usePlanActions`, `useWorkDays`) are colocated
under `components/WeeklyPlanner/` since only that area needs them — extract to a shared top-level
location only once a second, unrelated area needs the same logic, not before.

## File Naming Rules

| Category | Pattern | Example |
|----------|---------|---------|
| React Components | `PascalCase.tsx` | `WeeklyPlanner.tsx` |
| Component Tests | `PascalCase.test.tsx` | `WeeklyPlanner.test.tsx` |
| Component Styles | `PascalCase.module.css` | `WeeklyPlanner.module.css` |
| Services/Utils | `camelCase.ts` | `activityApi.ts` |
| Type Definitions | `camelCase.ts` | `activity.ts` |
| Hooks | `use[Name].ts` | `usePlanActions.ts` |

## Component Organization

Most components in this app are both presentational and lightly stateful at once — there's no
strict presentational/container split enforced; a component typically owns its own local UI state
(form fields, open/closed) while receiving fetched data and callbacks via props from its nearest
page-level parent (`ActivityBank.tsx`, `WeeklyPlanner.tsx`, `TodayView.tsx`, `WeeklySummary.tsx`,
`Settings.tsx`). Data fetching itself always goes through `services/*Api.ts` — never a direct
`fetch`/`axios` call inside a component, and never duplicated fetch logic once two components need
the same data (that's when a shared hook, colocated near its first real consumer, is worth
extracting — see `usePlanActions`/`useWorkDays` above).

## Services & API Layer

All backend communication goes through `src/services/*Api.ts` — never raw `axios`/`fetch` in a
component. Each file exports a typed object (`activityApi`, `planApi`, ...) following the same
`request<T>()` wrapper pattern (`client.ts`): typed, throws a shared `ApiError` (`src/types/api.ts`)
on failure. A global 401 handler in `client.ts` bounces an expired session to the login screen
(see `frontend_spec_029_session_expiry_handling.md`) rather than every call site handling it.

## Type Definitions

Centralized in `src/types/`. Nullable backend fields are `T | null`, not `T | undefined`.

## Environment Configuration

```
# frontend/.env.local (git-ignored)
VITE_API_BASE=/api/v1
```

Only needed to override the Vite dev-server proxy (e.g. driving the backend directly, bypassing
`:4321` — see `verify` skill's CORS note). Not needed for normal `npm run dev` usage, which proxies
`/api` to `:8420` automatically via `vite.config.ts`.

## Testing Setup

- Run: `npm test` (single run) or `npm run test:watch`. Coverage: `npm run test:coverage`
  (`@vitest/coverage-v8`, recorded for visibility — no gate enforced).
- Vitest + React Testing Library + jsdom, `test-setup.ts` wires up `@testing-library/jest-dom`
- Scope: component behaviour and user interactions, not implementation details; API calls mocked
  via `vi.mock('../services/xApi')`
- **jsdom doesn't render CSS** — a green Vitest suite is never sufficient sign-off for new/changed
  styling (contrast, light/dark theming, layout). Always do a real browser pass too — see the
  `verify` skill and `frontend_conventions.md`.

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
   shown as failure (see `WeeklySummary`'s completion-visual conventions for a concrete example of
   this applied — opacity/checkmark, never a red/green hue)
6. **Accessibility is not optional** — semantic HTML, `aria-label`s, `role="status"`/`role="alert"`
   where applicable (see `frontend_conventions.md`). Real `@axe-core/react` scanning is still not
   wired up, though — this is enforced by manual review today, not automated.
