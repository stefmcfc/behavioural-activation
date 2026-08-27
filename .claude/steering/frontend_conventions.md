# Frontend Conventions

## File Structure & Naming

- **Components**: `PascalCase.tsx`
- **Utilities/Services**: `camelCase.ts`
- **Types**: `camelCase.ts` files exporting `PascalCase` interfaces/types
- **Tests**: `ComponentName.test.tsx` or `fileName.test.ts`, colocated with source

## TypeScript Type Conventions

- Types live under `src/types/`, one file per resource area (`activity.ts`, `planner.ts`, `api.ts`)
- Use `interface` for object shapes, `type`/`enum` for unions or fixed value sets
- All API responses are typed; no `any` without justification
- Optional fields that can be `null` from the backend are typed `T | null`, not `T | undefined`

## API Communication

- All backend calls go through `src/services/*Api.ts` — never call `axios`/`fetch` directly from a
  component
- Base URL comes from `import.meta.env.VITE_API_BASE`, falling back to
  `http://localhost:8080/api/v1` (Vite env convention — not `process.env`)
- Errors are centralized: a shared `request<T>()` wrapper catches axios errors and throws a typed
  `ApiError` (`src/types/api.ts`) with `status`, `message`, and optional `details`

Example shape to follow once the first service file is built:
```typescript
import axios from 'axios';
import type { Activity } from '../types/activity';
import { ApiError } from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api/v1';
const client = axios.create({ baseURL: API_BASE });

export const activityApi = {
  getAll: (): Promise<Activity[]> =>
    request<{ data: Activity[]; count: number }>(() => client.get('/activities')).then(r => r.data),
  // ...
};
```

## Component Patterns

### Presentational Components
- Receive data via props
- Handle only UI logic (show/hide, clicks, forms)
- No direct API calls

### Container Components
- Manage state (`useState`, `useReducer`, or Context)
- Fetch data via `useEffect`
- Coordinate between presentational components

### Hooks (Custom)
- Extract reusable logic into hooks, prefixed `use`
- One responsibility per hook
- Extract when a second component needs the same logic, not before

## State Management

- React hooks (`useState`, `useContext`) for local state
- `useEffect` for side effects (data fetching)
- Context API for global state if needed later — not Redux
- Avoid prop drilling; lift state up or use Context

## Styling

Not decided yet — likely CSS Modules (per the reference project's experience: no extra dependency,
Vite scopes `*.module.css` automatically, one module per component colocated with its `.tsx`).
Confirm/record the actual decision here once the first component spec implements it, rather than
assuming.

Whatever the approach: use shared theme custom properties (`--text`, `--bg`, `--border`, `--accent`,
etc.) rather than hardcoded hex values, so light/dark mode and contrast stay correct — see the
Testing section below for why this matters.

## Testing Strategy (Vitest + React Testing Library)

- Test user interactions, not implementation details
- Use `render()` and `screen` to query elements
- Mock the service layer with `vi.mock('../services/xApi')`, not axios directly, in component tests
- One test file per component, colocated

Example:
```typescript
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ActivityBank } from './ActivityBank';
import { activityApi } from '../services/activityApi';

vi.mock('../services/activityApi');
const mockGetAll = vi.mocked(activityApi.getAll);

describe('ActivityBank', () => {
  it('should render a list of activities', async () => {
    mockGetAll.mockResolvedValue([{ id: '1', name: 'Walk', category: 'ROUTINE' } as any]);
    render(<ActivityBank />);
    expect(await screen.findByText('Walk')).toBeInTheDocument();
  });
});
```

## Environment Variables

- Create `.env.local` in `frontend/` (git-ignored)
- Use `VITE_` prefix
- Example: `VITE_API_BASE=http://localhost:8080/api/v1`
- Access via `import.meta.env.VITE_API_BASE`

## Code Style

- Use arrow functions for callbacks
- Destructure props and imports
- Keep components under ~200 lines (split if larger)
- Use meaningful variable names; avoid abbreviations
- No comments unless the WHY is non-obvious

## Error Handling

- Display user-friendly error messages, driven by `ApiError.message`
- Never expose raw backend stack traces or `ApiError.details` internals directly to the user
- Log errors to console only in dev (`import.meta.env.DEV`)
- Error copy follows the product's neutral-language principle — never frame a failed fetch or a
  missed activity as the user's fault

## Accessibility (a11y)

- Use semantic HTML: `<button>`, `<label>`, `<form>`, etc.
- Include `aria-label` on icon-only buttons
- Ensure form inputs have associated `<label>` elements
- Loading indicators need `role="status"`; error containers need `role="alert"`
- This app is explicitly non-gamified and calm by design (see `product.md`) — that's a UX
  requirement, not just an a11y one: no urgent-red streak counters, no shame-coded failure states

## Performance

- Lazy load routes (`React.lazy` + `Suspense`) once routing exists
- Memoize components if props don't change (`React.memo`)
- Not a real concern at this app's scale (single/small-user) — don't over-optimize prematurely
