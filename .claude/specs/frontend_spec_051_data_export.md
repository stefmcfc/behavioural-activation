# Export Your Data as Replayable SQL (Frontend)

**Status**: Implemented (2026-10-06) — `frontend/src/services/exportApi.ts`,
`frontend/src/components/Navigation/AccountMenu.tsx`
**Priority**: P2 — matches `planner_spec_025_data_export.md`'s priority
**Depends on**: `planner_spec_025_data_export.md` (paired backend spec — `GET /api/v1/export`),
`frontend_spec_030_header_restructure.md` (`AccountMenu`'s existing popover panel)
**Area**: Frontend
**Roadmap version**: V1 (cross-cutting — data portability)

## Overview

Consumes `planner_spec_025_data_export.md`'s new endpoint. Adds an "Export my data" button to the
existing `AccountMenu` popover, alongside the username display, "Log out" button, and (per
`frontend_spec_050_change_password.md`, landing alongside this spec) the Change password form.

**Download mechanism**: the existing `services/client.ts` request helper always assumes a JSON
response body — there's no `responseType: 'blob'` precedent anywhere in the codebase, since every
other endpoint returns JSON. This spec adds a dedicated call bypassing the shared JSON helper,
fetching the response as a `Blob` via the same authenticated `axios` client instance (so cookies/
credentials work identically to every other request — no separate auth mechanism needed), then
triggers the browser's save dialog via a programmatic, momentary `<a download>` click against an
object URL. A plain `<a href="...\/export" download>` (relying on the browser to handle the
cross-origin credentialed request directly) was considered and rejected — going through the
existing authenticated `axios` client is more predictable and consistent with every other request
in the app, rather than depending on cookie `SameSite` behavior working out for a bare anchor tag
across the `:4321`→`:8420` origins.

## Requirement 1: Export your data from the Account menu

**User story**: As the authenticated user, I want to download all of my data with one click, so I
have a file I can keep as a backup or replay later if I reset the database.

### FRONTEND-051-AC-01 [AUTO]: An Export button triggers an authenticated download
**Statement**: `AccountMenu`'s popover panel shall render an "Export my data" button. When
activated, it shall call `exportApi.downloadExport()`, which requests `GET /export` via the existing
authenticated `client` instance with `responseType: 'blob'`.

**References**: `components/Navigation/AccountMenu.tsx` (new button), `services/exportApi.ts` (new).

**Test Case (Red)**:
```typescript
describe('FRONTEND-051-AC-01: Export my data triggers an authenticated download request', () => {
  it('calls exportApi.downloadExport on click', async () => {
    const downloadSpy = vi.spyOn(exportApi, 'downloadExport').mockResolvedValue(
      new Blob(['-- export'], { type: 'text/plain' }),
    )
    render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /export my data/i }))

    expect(downloadSpy).toHaveBeenCalledTimes(1)
  })
})
```

**Test Case (Green)**: implement the button and `exportApi.downloadExport()` as described in
References.

### FRONTEND-051-AC-02 [AUTO]: A successful download saves the file via the browser
**Statement**: On a successful response, `AccountMenu` shall create an object URL from the returned
`Blob`, trigger a browser download via a momentary programmatic `<a download>` click, and revoke the
object URL afterward.

**References**: standard `URL.createObjectURL`/`URL.revokeObjectURL` pattern — no new dependency.

**Test Case (Green)**: exercised via a real-browser pass (jsdom doesn't meaningfully simulate a
file-save dialog) — confirm a `.sql` file is actually saved with real data, per this project's
Definition of Done for UI work.

### FRONTEND-051-AC-03 [AUTO]: The button shows a busy state while the download is in flight
**Statement**: While the export request is in flight, the "Export my data" button shall be disabled
and show a busy label (e.g. "Exporting…"), since the response may take a moment for a user with a
lot of data.

**Test Case (Red)**:
```typescript
describe('FRONTEND-051-AC-03: Export button shows a busy state while in flight', () => {
  it('disables the button until the download resolves', async () => {
    let resolveDownload: (value: Blob) => void
    vi.spyOn(exportApi, 'downloadExport').mockReturnValue(
      new Promise((resolve) => { resolveDownload = resolve }),
    )
    render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /export my data/i }))

    expect(screen.getByRole('button', { name: /exporting/i })).toBeDisabled()
    resolveDownload(new Blob(['-- export']))
  })
})
```

**Test Case (Green)**: wrap the call in an `isExporting` state flag.

### FRONTEND-051-AC-04 [AUTO]: A failed export shows an error
**Statement**: If `exportApi.downloadExport()` rejects, `AccountMenu` shall display the error via
the existing `getErrorMessage`/`role="alert"` pattern.

**Test Case (Red)**:
```typescript
describe('FRONTEND-051-AC-04: a failed export shows an error', () => {
  it('shows an alert on failure', async () => {
    vi.spyOn(exportApi, 'downloadExport').mockRejectedValue(new Error('Server error'))
    render(<AccountMenu username="steve" onLogout={vi.fn()} onPasswordChanged={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /export my data/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
```

**Test Case (Green)**: catch the rejection, render the error.

### FRONTEND-051-AC-05 [AUTO]: Type and service contract
**Statement**: `services/exportApi.ts` shall expose `downloadExport(): Promise<Blob>`, calling `GET
/export` via the shared `client` instance with `responseType: 'blob'`.

**Test Case (Green)**:
```typescript
export const exportApi = {
  downloadExport: (): Promise<Blob> =>
    client.get('/export', { responseType: 'blob' }).then((response) => response.data),
}
```

## Cross-references

| Reference | What it provides |
|---|---|
| `components/Navigation/AccountMenu.tsx` | Extended — "Export my data" button |
| `services/exportApi.ts` (new) | `downloadExport()` |
| `planner_spec_025_data_export.md` | Paired backend spec |

`AccountMenu.test.tsx`'s existing test suite will need its base props fixture updated for the
`onPasswordChanged` prop introduced by `frontend_spec_050` (landing alongside this spec) — not a new
AC here.

## Acceptance Criteria Summary

- [x] FRONTEND-051-AC-01 — Export button triggers an authenticated blob-download request
- [x] FRONTEND-051-AC-02 — a successful download saves the file via the browser (real-browser verified)
- [x] FRONTEND-051-AC-03 — button shows a busy state while in flight
- [x] FRONTEND-051-AC-04 — a failed export shows an error
- [x] FRONTEND-051-AC-05 — `exportApi.downloadExport()` calls `GET /export` with `responseType: 'blob'`

## Summary

### What shipped
- `services/exportApi.ts` (new) — `downloadExport(): Promise<Blob>`, calling `client.get('/export',
  { responseType: 'blob' })` directly, bypassing the shared `request<T>()` JSON helper (matches the
  spec's AC-05 snippet exactly).
- `components/Navigation/AccountMenu.tsx` — new "Export my data" button in the popover panel,
  alongside "Log out" and "Change password" (which now opens a `Modal` dialog per
  `frontend_spec_050`). On click: calls `exportApi.downloadExport()`, disables itself and shows
  "Exporting…" while in flight, and on success creates an object URL from the returned `Blob`,
  triggers a momentary programmatic `<a download>` click, then revokes the object URL. On failure,
  renders the error via the existing `getErrorMessage` + `role="alert"` pattern used by the Change
  password form in the same file.
- `components/Navigation/AccountMenu.module.css` — `.exportButton` styling, matching
  `.changePasswordTrigger`'s existing look (plus a disabled state).
- `services/exportApi.test.ts` (new) — 2 tests covering the request shape and rejection
  propagation.
- `components/Navigation/AccountMenu.test.tsx` — 3 new tests (AC-01, AC-03, AC-04) added to the
  existing suite, following the spec's test sketches; `URL.createObjectURL`/`revokeObjectURL` are
  stubbed per-test via `vi.stubGlobal` since jsdom doesn't implement them.

### Decisions made where the spec left something open
- **Download filename source**: the spec's own AC-05 contract has `exportApi.downloadExport()`
  return only the `Blob` (not the full axios response), so the real server-provided
  `Content-Disposition` filename isn't available at the call site without changing that contract.
  Hardcoded a generic client-side filename (`behavioural-activation-export.sql`) instead of
  threading the response headers through — matches the spec's explicit sketch and keeps the service
  contract simple; revisit only if a real filename (e.g. with an embedded date, matching what the
  backend sends) turns out to matter in practice.

### Test results (frontend, this change)
- `npm test`: 46 files / 678 tests before this change → 47 files / 683 tests after (+1 file,
  +5 tests: 2 new in `exportApi.test.ts`, 3 new in the existing `AccountMenu.test.tsx`). All green,
  zero regressions.
- `npm run lint` (oxlint): clean, no new findings.
- `npx tsc -b --noEmit`: clean, no errors.

### Real-browser verification (FRONTEND-051-AC-02)
Completed in a follow-up pass (Chrome automation, against the live `:4321`/`:8420` dev stack): logged
in, opened the Account menu, clicked "Export my data", and confirmed via the browser's own network
log that a real `GET /api/v1/export` request fired and returned `200`. Checked the OS Downloads
folder directly afterward: a real `behavioural-activation-export.sql` file was present (35,454 bytes
on this run), and its content opened correctly as the expected header comment + `BEGIN;`/real
`INSERT` statements — the genuine browser download path (`URL.createObjectURL` + programmatic `<a
download>` click), not jsdom's simulation of it. Test files removed afterward.
