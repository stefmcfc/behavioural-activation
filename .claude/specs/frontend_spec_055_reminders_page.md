# Reminders Page and Activity Recurrence Fields (Frontend)

**Status**: Not started

**Priority**: P2 — a real enhancement, nothing else is blocked on it

**Depends on**: `planner_spec_026_activity_recurrence_and_due_dates.md` (`GET /api/v1/reminders`,
the extended `ActivityRequest`/`ActivityResponse` shapes this spec's types/form mirror),
`frontend_spec_005_navigation_and_theme.md` (`TabNav.tsx`'s `TABS` array, `App.tsx`'s route table
pattern this spec's new tab/route follows), `frontend_spec_036_weekly_summary.md` (precedent for
adding a new top-level, independently-fetching tab the exact same mechanical way), `frontend_spec_
006_repeatable_activities.md`/`frontend_spec_020_repeatable_icon_in_activity_form.md` (`ActivityForm.
tsx`'s existing shape this spec extends with new fields, alongside the existing `repeatable` toggle
it must not disturb)

**Area**: Frontend — Stage 1 of 1

**Roadmap version**: V2 (see `planner_spec_026`'s header note on why this is a narrower, visibility-
only slice of Epic 5/US-012, not that story's full scope)

## Overview

Gives the user a place to see which recurring activities are coming up or overdue, and lets them
configure an activity's recurrence interval and due date from the existing Activity form. This is
the frontend half of **Pair 1** of the "Recurring activities with a repeat period and a reminder
date" idea (`.claude/ideas/future_ideas.md`, 2026-10-14) — paired with
`planner_spec_026_activity_recurrence_and_due_dates.md`. **Pair 2** (an overdue banner/icon
elsewhere in the app) is a deliberate, out-of-scope follow-up that depends on this pair shipping
first.

Two pieces, both read entirely from `planner_spec_026`'s new/extended backend contracts with no
further backend change:

1. A new **read-only** "Reminders" tab/page (`Reminders.tsx`) — a fifth top-level tab alongside
   Activities/Weekly Planner/Today/Summary, fetching `GET /api/v1/reminders` and splitting the
   result into two client-side-filtered sections, "Coming up" and "Overdue," using the `overdue`
   flag the backend already computed. No date math happens in this component — the API response is
   already sorted ascending by `nextDueAt` and already carries the correct boolean.
2. New fields on the existing **Activity create/edit form** (`ActivityForm.tsx`) — a recurrence
   count + unit, and a due-date override — wired to the extended `ActivityInput`/`activityApi`.
   This is the only place recurrence/due date are ever *edited*; the Reminders page itself stays
   list-only for this pair, per the paired backend spec's explicit scope boundary.

**Resolved ambiguity, not explicit in the originating idea**: `nextDueAt` is a full `Instant` on the
backend, but a reminder is a day-level concept for a user ("due around early November"), not a
time-of-day one. This spec treats it as a plain `<input type="date">` in the form — submitted as
midnight local time converted to an ISO instant — and displays it as a locale date string (no
time-of-day) on the Reminders page. This is a presentation decision, not a data-model one; the
backend's `Instant` column is untouched.

**Out of scope** (mirrors the paired backend spec): no editing from the Reminders page itself (no
inline "snooze"/"mark due now" controls — the user still edits via the existing Activity form); no
overdue banner/icon elsewhere in the app (Pair 2); no auto-inserting a reminder back onto the
weekly plan; no push/real-time notification.

## Requirements

### Requirement 1 — A new "Reminders" tab and route

As a user, I want a dedicated place to check which recurring activities are coming up or overdue,
reachable the same way I reach Activities, Weekly Planner, Today, and Summary.

- **FRONTEND-055-AC-01** [AUTO]: `TabNav.tsx`'s `TABS` array shall gain a fifth entry, `{ to:
  '/reminders', label: 'Reminders' }`, rendered after "Summary" in the existing tab order.
- **FRONTEND-055-AC-02** [AUTO]: `App.tsx`'s route table shall gain `<Route path="/reminders"
  element={<Reminders />} />`, mounting a new `Reminders` component
  (`frontend/src/components/Reminders/Reminders.tsx`).

### Requirement 2 — Fetch the reminders list, with loading/error/empty states

As a user, I want the Reminders page to load my data reliably and tell me clearly if something goes
wrong, like every other page in this app.

- **FRONTEND-055-AC-03** [AUTO]: On mount, `Reminders` shall fetch via `remindersApi.getAll()`
  exactly once.
- **FRONTEND-055-AC-04** [AUTO]: While the fetch is in flight, `Reminders` shall display a loading
  indicator (`<output>Loading…</output>`, matching `WeeklySummary`/`ActivityBank`'s existing
  pattern) and render neither section from Requirement 3.
- **FRONTEND-055-AC-05** [AUTO]: If `remindersApi.getAll()` rejects, then `Reminders` shall display
  an error message (`role="alert"`) with a Retry control that re-attempts the fetch, matching
  `WeeklySummary`/`ActivityBank`'s existing `loadError`-plus-Retry-button pattern.
- **FRONTEND-055-AC-06** [AUTO]: When the fetch resolves with an empty list, `Reminders` shall
  display a plain, neutral empty-state message (e.g. "No activities are due or overdue right now.")
  instead of either section from Requirement 3.

### Requirement 3 — Group reminders into "Coming up" and "Overdue"

As a user, I want to immediately see, without doing any mental math, which of my recurring
activities need attention now versus later.

- **FRONTEND-055-AC-07** [AUTO]: Where the fetched list contains at least one reminder with
  `overdue: false`, `Reminders` shall render a "Coming up" section listing those reminders in the
  order the API returned them (already ascending by `nextDueAt`) — no client-side re-sorting.
- **FRONTEND-055-AC-08** [AUTO]: Where the fetched list contains at least one reminder with
  `overdue: true`, `Reminders` shall render an "Overdue" section listing those reminders in the
  order the API returned them.
- **FRONTEND-055-AC-09** [AUTO]: Where no reminder in the fetched list has `overdue: true`,
  `Reminders` shall not render the "Overdue" section at all; where none has `overdue: false`, it
  shall not render the "Coming up" section at all — an empty section is omitted, not shown with a
  "none" placeholder.
- **FRONTEND-055-AC-10** [AUTO]: Each rendered reminder row shall display the activity's `name`, its
  `category` via the existing `CategoryChip` component, and its `nextDueAt` formatted as a readable
  date (no time-of-day).

### Requirement 4 — Calm, neutral presentation for overdue items

As a user, I don't want to feel scolded by an overdue reminder — this app is explicitly non-
gamified and calm by design.

- **FRONTEND-055-AC-11** [AUTO]: The "Overdue" section's heading and rows shall not reuse this app's
  `role="alert"`/error/destructive CSS treatment — overdue reminders render with their own
  dedicated, visually-distinct-but-neutral styling, structurally separate from any error-state
  class in the codebase.
- **FRONTEND-055-AC-12** [MANUAL — verified by a real-browser visual check in both Light and Dark
  themes, since jsdom cannot render CSS (`frontend_conventions.md`'s Testing Strategy note); no
  automated contrast/hue assertion is planned, since "reads as calm, not alarming" is a subjective
  design judgment, not a measurable property]: The "Overdue" section's actual rendered styling reads
  as calm/muted (e.g. a neutral badge or muted text treatment), never an urgent red/alarm hue —
  consistent with `.claude/steering/frontend_conventions.md`'s "no urgent-red streak counters, no
  shame-coded failure states" rule.

### Requirement 5 — Configure recurrence and due date from the Activity form

As a user, I want to set how often an activity recurs, and to correct its due date myself, from the
same place I already manage that activity's other details.

- **FRONTEND-055-AC-13** [AUTO]: `ActivityForm` shall render a recurrence count (`<input
  type="number">`), a recurrence unit (`<select>`: Weeks/Months), and a due-date (`<input
  type="date">`) field, in both create and edit mode, alongside the existing `repeatable`/
  `favourite` fields.
- **FRONTEND-055-AC-14** [AUTO]: In edit mode, `ActivityForm` shall pre-fill the recurrence count/
  unit/due-date fields from the `activity` prop's current `recurrenceIntervalCount`/
  `recurrenceIntervalUnit`/`nextDueAt` values.
- **FRONTEND-055-AC-15** [AUTO]: When the form is submitted with both a count and a unit set,
  `ActivityForm` shall include `recurrenceIntervalCount`, `recurrenceIntervalUnit`, and `nextDueAt`
  (converted from the date input, or `null` if left blank) in the `ActivityInput` passed to
  `activityApi.create`/`update`.
- **FRONTEND-055-AC-16** [AUTO]: When the form is submitted with the count/unit fields cleared on a
  previously-recurring activity, `ActivityForm` shall send `null` for both
  `recurrenceIntervalCount`/`recurrenceIntervalUnit` in the `ActivityInput`, while still sending
  whatever the due-date field currently displays (clearing recurrence does not implicitly clear the
  due date, matching the backend's own independence rule).
- **FRONTEND-055-AC-17** [AUTO]: If the count field has a value but the unit field is unset (or vice
  versa) when the form is submitted, then `ActivityForm` shall display an inline validation message
  and shall not call `activityApi.create`/`update` — the same cross-field rule the backend enforces,
  caught client-side first.
- **FRONTEND-055-AC-18** [AUTO]: After a successful save, `ActivityForm`'s recurrence count/unit/
  due-date fields shall reflect exactly the values returned by `activityApi.create`/`update`,
  matching how every other field on this form already round-trips.

## Component/type changes

`frontend/src/types/activity.ts` — extended:

```typescript
export type RecurrenceIntervalUnit = 'WEEKS' | 'MONTHS'

export interface Activity {
  id: string
  name: string
  category: ActivityCategory
  description: string | null
  repeatable: boolean
  archived: boolean
  favourite: boolean
  createdAt: string
  subTaskCount: number
  recurrenceIntervalCount: number | null
  recurrenceIntervalUnit: RecurrenceIntervalUnit | null
  nextDueAt: string | null
}

export interface ActivityInput {
  name: string
  category: ActivityCategory | null
  description: string | null
  repeatable: boolean
  recurrenceIntervalCount: number | null
  recurrenceIntervalUnit: RecurrenceIntervalUnit | null
  nextDueAt: string | null
}
```

`frontend/src/types/reminder.ts` (new):

```typescript
import type { ActivityCategory } from './activity'

export interface Reminder {
  id: string
  name: string
  category: ActivityCategory
  nextDueAt: string
  overdue: boolean
}
```

`frontend/src/services/remindersApi.ts` (new), following `activityApi.ts`'s exact shape:

```typescript
import type { Reminder } from '../types/reminder'
import { client, request } from './client'

export const remindersApi = {
  getAll: (): Promise<Reminder[]> =>
    request<{ data: Reminder[]; count: number }>(() => client.get('/reminders')).then((r) => r.data),
}
```

`frontend/src/utils/dueDate.ts` (new) — a small shared helper, since both `Reminders.tsx` and
`ActivityForm.tsx` need to convert between the backend's ISO `Instant` string and an `<input
type="date">`'s plain `YYYY-MM-DD` value:

```typescript
/** Formats an ISO instant as a locale date string, no time-of-day (e.g. "11/1/2026"). */
export function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

/** Converts a stored ISO instant to the YYYY-MM-DD value an <input type="date"> expects. */
export function toDueDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

/** Converts an <input type="date">'s YYYY-MM-DD value to an ISO instant (local midnight), or null. */
export function fromDueDateInputValue(value: string): string | null {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null
}
```

`frontend/src/components/Reminders/Reminders.tsx` (new) — follows `WeeklySummary.tsx`'s precedent
exactly (own local state, plain `useEffect` fetch-on-mount, standard loading/error/empty/data
states):

```tsx
import { useEffect, useState } from 'react'
import { remindersApi } from '../../services/remindersApi'
import type { Reminder } from '../../types/reminder'
import { CategoryChip } from '../CategoryChip/CategoryChip'
import { formatDueDate } from '../../utils/dueDate'
import { getErrorMessage } from '../../utils/getErrorMessage'
import styles from './Reminders.module.css'

function ReminderRow({ reminder }: { readonly reminder: Reminder }) {
  return (
    <li className={styles.row}>
      <span>{reminder.name}</span> <CategoryChip category={reminder.category} />
      <span className={styles.dueDate}>{formatDueDate(reminder.nextDueAt)}</span>
    </li>
  )
}

export function Reminders() {
  const [reminders, setReminders] = useState<Reminder[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    remindersApi
      .getAll()
      .then((data) => {
        if (!cancelled) {
          setReminders(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(getErrorMessage(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [retryCount])

  const handleRetry = () => setRetryCount((count) => count + 1)

  // FRONTEND-055-AC-07/AC-08/AC-09 -- no re-sort, the API already returns ascending nextDueAt order.
  const upcoming = reminders?.filter((r) => !r.overdue) ?? []
  const overdue = reminders?.filter((r) => r.overdue) ?? []

  return (
    <section>
      <h2>Reminders</h2>

      {loadError && (
        <p role="alert">
          {loadError}{' '}
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </p>
      )}

      {reminders === null && !loadError && <output>Loading…</output>}

      {reminders !== null && reminders.length === 0 && (
        <p>No activities are due or overdue right now.</p>
      )}

      {upcoming.length > 0 && (
        <>
          <h3>Coming up</h3>
          <ul className={styles.list}>
            {upcoming.map((reminder) => (
              <ReminderRow key={reminder.id} reminder={reminder} />
            ))}
          </ul>
        </>
      )}

      {overdue.length > 0 && (
        <>
          <h3>Overdue</h3>
          {/* FRONTEND-055-AC-11/AC-12 -- styles.overdueList applies a dedicated, calm/neutral
              treatment (e.g. a muted badge), never this app's role="alert"/error/destructive
              classes -- final markup/CSS left to implementation, same as WeeklySummary's stats
              table (frontend_spec_036 precedent). */}
          <ul className={`${styles.list} ${styles.overdueList}`}>
            {overdue.map((reminder) => (
              <ReminderRow key={reminder.id} reminder={reminder} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
```

`frontend/src/components/Navigation/TabNav.tsx` — `TABS` gains one entry:

```typescript
const TABS = [
  { to: '/activities', label: 'Activities' },
  { to: '/planner', label: 'Weekly Planner' },
  { to: '/today', label: 'Today' },
  { to: '/summary', label: 'Summary' },
  { to: '/reminders', label: 'Reminders' },
] as const
```

`frontend/src/App.tsx` — `Routes` gains one entry:

```tsx
<Route path="/reminders" element={<Reminders />} />
```

`frontend/src/components/ActivityBank/ActivityForm.tsx` — gains three fields (sketch; final
markup/validation-message copy left to implementation, same as every other field on this form):

```tsx
const [recurrenceCount, setRecurrenceCount] = useState<string>(
  activity?.recurrenceIntervalCount != null ? String(activity.recurrenceIntervalCount) : '',
)
const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceIntervalUnit | ''>(
  activity?.recurrenceIntervalUnit ?? '',
)
const [nextDueAtInput, setNextDueAtInput] = useState(toDueDateInputValue(activity?.nextDueAt ?? null))
const [recurrenceError, setRecurrenceError] = useState<string | null>(null)

// FRONTEND-055-AC-17 -- client-side mirror of the backend's own cross-field rule
// (InvalidActivityRequestException), checked before submit.
const hasCount = recurrenceCount.trim() !== ''
const hasUnit = recurrenceUnit !== ''
if (hasCount !== hasUnit) {
  setRecurrenceError('Enter both a number and a unit to set a repeat interval, or leave both blank.')
  return
}

const input: ActivityInput = {
  // ...existing fields...
  recurrenceIntervalCount: hasCount ? Number(recurrenceCount) : null,
  recurrenceIntervalUnit: hasUnit ? (recurrenceUnit as RecurrenceIntervalUnit) : null,
  nextDueAt: fromDueDateInputValue(nextDueAtInput),
}
```

## Cross-references

| This spec | Contracts against |
|---|---|
| `GET /api/v1/reminders` (`planner_spec_026`) | New — consumed by `remindersApi.getAll()`, response already sorted/flagged, no client-side date math |
| `ActivityRequest`/`ActivityResponse` (`planner_spec_026`) | Extended — three new fields mirrored exactly in `ActivityInput`/`Activity` |
| `TabNav.tsx`/`App.tsx` (`frontend_spec_005_navigation_and_theme.md`) | Extended — new "Reminders" tab/route, same mechanical pattern as `frontend_spec_036`'s "Summary" tab |
| `CategoryChip` (`frontend_spec_005_navigation_and_theme.md`) | Reused unmodified for category display in reminder rows |
| `ActivityForm.tsx` (`frontend_spec_006_repeatable_activities.md`/`frontend_spec_020`) | Extended — three new fields alongside the existing `repeatable`/`favourite` toggles, which are unmodified |
| `getErrorMessage` (`tooling_spec_005_frontend_cleanup_and_coverage.md`) | Reused unmodified |
| `.claude/ideas/future_ideas.md` | "Recurring activities with a repeat period and a reminder date" entry — Pair 1 of 2, specced here; left as-is in that file (not edited as part of this change) |
| `.claude/steering/frontend_conventions.md` | "No urgent-red streak counters, no shame-coded failure states" rule — directly governs Requirement 4 |

## Test case sketches (Vitest + RTL, red before implementation)

```tsx
// TabNav.test.tsx / App.test.tsx additions

describe('FRONTEND-055-AC-01/AC-02: Reminders tab and route', () => {
  it('navigates to /reminders and renders the Reminders page', async () => {
    render(<App />, { route: '/reminders' }) // or this project's existing router-test helper
    expect(await screen.findByRole('heading', { name: /reminders/i })).toBeInTheDocument()
  })
})
```

```tsx
// Reminders.test.tsx (new)

describe('FRONTEND-055-AC-03/AC-04: fetches on mount, shows a loading state first', () => {
  it('shows a loading indicator before the fetch resolves', () => {
    vi.mocked(remindersApi.getAll).mockReturnValue(new Promise(() => {}))
    render(<Reminders />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    expect(remindersApi.getAll).toHaveBeenCalledTimes(1)
  })
})

describe('FRONTEND-055-AC-05: shows an error with Retry on failure', () => {
  it('re-fetches when Retry is clicked', async () => {
    vi.mocked(remindersApi.getAll).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
    render(<Reminders />)
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    await screen.findByText(/no activities are due/i)
  })
})

describe('FRONTEND-055-AC-06: empty list shows a plain message', () => {
  it('renders the empty state and neither section', async () => {
    vi.mocked(remindersApi.getAll).mockResolvedValue([])
    render(<Reminders />)
    expect(await screen.findByText(/no activities are due/i)).toBeInTheDocument()
    expect(screen.queryByText('Coming up')).not.toBeInTheDocument()
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-055-AC-07/AC-08/AC-09: groups by the overdue flag, omitting empty sections', () => {
  it('renders only the sections that have at least one reminder', async () => {
    vi.mocked(remindersApi.getAll).mockResolvedValue([
      { id: '1', name: 'Water the plants', category: 'ROUTINE', nextDueAt: '2026-11-01T00:00:00Z', overdue: false },
    ])
    render(<Reminders />)
    expect(await screen.findByText('Coming up')).toBeInTheDocument()
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-055-AC-10: each row shows name, category, and a formatted due date', () => {
  it('renders the reminder details', async () => {
    vi.mocked(remindersApi.getAll).mockResolvedValue([
      { id: '1', name: 'Service the boiler', category: 'NECESSARY', nextDueAt: '2026-11-01T00:00:00Z', overdue: true },
    ])
    render(<Reminders />)
    expect(await screen.findByText('Service the boiler')).toBeInTheDocument()
    expect(screen.getByTestId('category-chip-NECESSARY')).toBeInTheDocument()
  })
})

describe('FRONTEND-055-AC-11: the overdue section never reuses error/alert styling', () => {
  it('does not render the overdue list inside a role="alert" container', async () => {
    vi.mocked(remindersApi.getAll).mockResolvedValue([
      { id: '1', name: 'Overdue task', category: 'ROUTINE', nextDueAt: '2026-01-01T00:00:00Z', overdue: true },
    ])
    render(<Reminders />)
    const overdueHeading = await screen.findByText('Overdue')
    expect(overdueHeading.closest('[role="alert"]')).toBeNull()
  })
})
```

```tsx
// ActivityForm.test.tsx additions

describe('FRONTEND-055-AC-13/AC-14: renders and pre-fills recurrence/due-date fields', () => {
  it('pre-fills from the activity prop in edit mode', () => {
    const activity = makeActivity({
      recurrenceIntervalCount: 3,
      recurrenceIntervalUnit: 'MONTHS',
      nextDueAt: '2026-11-01T00:00:00Z',
    })
    render(<ActivityForm mode="edit" activity={activity} onSuccess={vi.fn()} />)
    expect(screen.getByLabelText(/repeat every/i)).toHaveValue(3)
    expect(screen.getByLabelText(/unit/i)).toHaveValue('MONTHS')
    expect(screen.getByLabelText(/due date/i)).toHaveValue('2026-11-01')
  })
})

describe('FRONTEND-055-AC-15/AC-16: submits recurrence fields as plain overwrites', () => {
  it('sends null for both count and unit when cleared, keeping the due date', async () => {
    const activity = makeActivity({
      recurrenceIntervalCount: 3,
      recurrenceIntervalUnit: 'MONTHS',
      nextDueAt: '2026-11-01T00:00:00Z',
    })
    vi.mocked(activityApi.update).mockResolvedValue(activity)
    render(<ActivityForm mode="edit" activity={activity} onSuccess={vi.fn()} />)

    await userEvent.clear(screen.getByLabelText(/repeat every/i))
    await userEvent.selectOptions(screen.getByLabelText(/unit/i), '')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(activityApi.update).toHaveBeenCalledWith(
      activity.id,
      expect.objectContaining({
        recurrenceIntervalCount: null,
        recurrenceIntervalUnit: null,
        nextDueAt: '2026-11-01T00:00:00.000Z',
      }),
    )
  })
})

describe('FRONTEND-055-AC-17: count without a unit blocks submission', () => {
  it('shows a validation message and does not call activityApi', async () => {
    render(<ActivityForm mode="create" onSuccess={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(/repeat every/i), '3')
    await userEvent.click(screen.getByRole('button', { name: /save activity/i }))

    expect(await screen.findByText(/enter both a number and a unit/i)).toBeInTheDocument()
    expect(activityApi.create).not.toHaveBeenCalled()
  })
})
```

## Acceptance Criteria Summary

- [ ] FRONTEND-055-AC-01 — `TabNav.tsx` gains a "Reminders" tab entry
- [ ] FRONTEND-055-AC-02 — `App.tsx` gains the `/reminders` route
- [ ] FRONTEND-055-AC-03 — fetches `remindersApi.getAll()` exactly once on mount
- [ ] FRONTEND-055-AC-04 — loading state renders before data/sections
- [ ] FRONTEND-055-AC-05 — fetch failure shows an error with Retry
- [ ] FRONTEND-055-AC-06 — empty list shows a plain neutral message
- [ ] FRONTEND-055-AC-07 — "Coming up" section lists non-overdue reminders, API order preserved
- [ ] FRONTEND-055-AC-08 — "Overdue" section lists overdue reminders, API order preserved
- [ ] FRONTEND-055-AC-09 — an empty section is omitted entirely, not shown with a placeholder
- [ ] FRONTEND-055-AC-10 — each row shows name, category chip, and a formatted due date
- [ ] FRONTEND-055-AC-11 — the overdue section never reuses error/alert styling
- [ ] FRONTEND-055-AC-12 — real-browser check: overdue styling reads as calm/muted, not alarming
- [ ] FRONTEND-055-AC-13 — `ActivityForm` renders recurrence count/unit/due-date fields
- [ ] FRONTEND-055-AC-14 — edit mode pre-fills those fields from the activity prop
- [ ] FRONTEND-055-AC-15 — submitting with both fields set includes them in `ActivityInput`
- [ ] FRONTEND-055-AC-16 — clearing recurrence sends `null`/`null`, due date untouched
- [ ] FRONTEND-055-AC-17 — count without unit (or vice versa) blocks submission with a message
- [ ] FRONTEND-055-AC-18 — after save, fields reflect exactly what the API returned
