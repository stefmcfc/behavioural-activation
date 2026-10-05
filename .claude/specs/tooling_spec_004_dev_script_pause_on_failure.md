# Tooling Spec 004: Dev Scripts Pause on Failure So a Disposable Window Can Be Read

**Status**: Implemented (2026-10-06)
**Priority**: Low — UX/DX gap in local tooling, no effect on the app itself
**Depends on**: None (purely `scripts/` — no backend/frontend code touched)
**Area**: Tooling (repo-wide dev scripts — not backend or frontend feature work)
**Roadmap version**: N/A — internal/maintenance, not a V1–V5 feature

## Summary

Implemented as designed, with one real bug found and fixed during verification (see below):
`pause_on_failure` added to `scripts/lib/dev-common.sh`; `trap pause_on_failure EXIT` wired into
all three scripts; `restart-dev.sh` passes `DEV_SCRIPT_NESTED=1` to its two nested calls and
captures both exit codes independently (`exit $status`) instead of falling through to
`start-dev.sh`'s alone.

**First PR revision shipped a real bug, caught by the user's own real-terminal test**: the initial
implementation used `export DEV_SCRIPT_NESTED=1` in `restart-dev.sh` before its two nested calls.
`export` sets a variable for the rest of *that shell's own life*, not just the two commands it
precedes — so `DEV_SCRIPT_NESTED` was still set in `restart-dev.sh`'s own environment when its own
`exit $status` triggered its own top-level trap at the bottom of the script, and
`pause_on_failure` saw it set and incorrectly suppressed `restart-dev.sh`'s own pause too, not
just the nested children's. Net effect: `restart-dev.sh` run standalone (exactly the user's
real-world trigger — PowerShell, Docker Desktop stopped) never paused at all, the opposite of the
intent.

Found by direct reproduction of the real invocation path (a sandboxed shell tool has no attached
console at all, confirmed by `winpty` itself refusing to run without one — but a PowerShell tool
in the same session does have a real console, and `.sh` files are registered to
`"C:\Program Files\Git\git-bash.exe" --no-cd "%L" %*`, confirmed via `cmd /c ftype`): a throwaway
diagnostic script sourcing `dev-common.sh` and registering the real trap, launched the same way
PowerShell launches `.\scripts\restart-dev.sh`, logged `[ -t 0 ] => TRUE` to a file (so the
evidence survived even if the window closed) and — critically — `Get-Process` showed the spawned
window still alive several seconds later for the leaf scripts but *not* for `restart-dev.sh`
itself, isolating the bug to the export's scope. Fix: `DEV_SCRIPT_NESTED=1 "$DIR/stop-dev.sh"
"$@"` (the `VAR=value cmd` form, scoped to that one command's environment only, never touching
`restart-dev.sh`'s own) in place of a preceding `export`.

**All 6 ACs verified against the real invocation path** (`.\scripts\<name>.sh [args]` typed in
PowerShell, exactly as a user would, using `badarg` as the deterministic failure trigger per each
AC's own verification method — `Get-Process`/`Stop-Process` to confirm the spawned window
genuinely blocks for several seconds, not just briefly, then to clean up the test windows
afterward): `start-dev.sh badarg`, `stop-dev.sh badarg`, and (after the fix above)
`restart-dev.sh badarg` each spawned a real window that stayed alive and `Responding: True` for
7+ seconds, confirming `AC-01`/`AC-02`/`AC-03`. A real successful `stop-dev.sh` run (both servers
genuinely running, genuinely stopped) returned in ~3s with no pause, confirming `AC-04`
(`start-dev.sh` restarted both servers afterward to leave the dev environment as found). `AC-05`
re-confirmed the same way plus the original non-interactive-stdin check. `AC-06` confirmed by
reading the final implementation alongside the `restart-dev.sh badarg` run showing exit `1`
correctly propagated. `bash -n` syntax-checked all four modified files.

## Overview

Promoted from `.claude/SPEC_CANDIDATES.md`'s "Dev scripts: failure window closes before the
diagnostic can be read" entry (raised 2026-10-05). `scripts/start-dev.sh`, `stop-dev.sh`, and
`restart-dev.sh` already print clear, specific diagnostics on failure (confirmed directly —
stubbing `docker()` to fail and sourcing `docker_preflight` printed `Docker isn't running -- start
Docker Desktop, then try again.` and returned exit 1, exactly as designed). The gap is purely about
*where* that output goes: when one of these scripts is launched in a way that spawns a fresh Git
Bash window scoped to just that one invocation — typing `.\scripts\restart-dev.sh --debug` from
PowerShell, or double-clicking the `.sh` file in Explorer, both via Windows' `.sh` file association
— that window closes itself the instant the script process exits, success or failure alike. The
diagnostic is printed and then gone before it can be read. Running the same scripts from inside an
already-open, persistent Git Bash session (the common case `RUNBOOK.md` documents) never hits this,
since that window stays open regardless of what the script prints or returns.

**Fix**: a shared `pause_on_failure` helper in `scripts/lib/dev-common.sh`, registered via `trap
pause_on_failure EXIT` in all three scripts, that blocks on a single keypress only when the script
is about to exit non-zero — so a disposable spawned window stays up long enough to read the
diagnostic, without adding any friction to the normal success path.

**Two design problems solved along the way, not just the headline one**:
1. **Double-pausing through `restart-dev.sh`**: it invokes `stop-dev.sh` and `start-dev.sh` as real
   subprocesses (not sourced), sharing the same terminal/stdin. If all three scripts installed the
   trap naively, a failure during `restart-dev.sh` could pause three times in a row (once from
   whichever nested script actually failed, once from `restart-dev.sh`'s own trap, and potentially
   from the other nested script too) — more friction than before, not less. Fixed with a
   `DEV_SCRIPT_NESTED` environment flag: `restart-dev.sh` exports it before invoking the other two,
   and `pause_on_failure` skips pausing whenever it's set — only the outermost invocation ever
   pauses.
2. **`restart-dev.sh` doesn't actually propagate failure correctly today**: it runs `stop-dev.sh`
   then `start-dev.sh` with no exit-code handling between them (no `&&`, no capture), so its own
   final exit status is just whatever the *last* command (`start-dev.sh`) returned — a `stop-dev.sh`
   failure followed by a successful `start-dev.sh` currently makes `restart-dev.sh` exit `0`,
   silently swallowing the stop failure. This matters directly for the trap: if `restart-dev.sh`'s
   own exit code doesn't reflect a nested failure, its trap won't fire for that failure either, and
   — since the nested child's own trap is suppressed by `DEV_SCRIPT_NESTED` — nothing pauses at all.
   Fixed by having `restart-dev.sh` capture both sub-scripts' exit codes independently and exit with
   a combined non-zero status if either failed.

**Out of scope**: detecting *whether* a given invocation is actually a disposable spawned window
versus an already-open session (confirmed in the candidate write-up and again here: there's no
reliable signal for this from inside bash) — the fix pauses unconditionally on failure instead,
accepting one keypress of friction on an already-open session's failure path as the tradeoff for
never losing the diagnostic in a disposable one. Also out of scope: any change to what each script
prints, Docker/Postgres handling itself, or the success path's behavior/output.

## Requirement 1 — A failing script pauses before a disposable window can close

**User story**: As a user who launched one of these scripts in a way that spawns a disposable
window (not an already-open terminal), I want the window to stay open long enough to read a failure
diagnostic, instead of vanishing the instant the script exits.

### TOOLING-004-AC-01 [MANUAL]: `start-dev.sh` pauses on a non-zero exit when run directly
**Statement**: When `start-dev.sh` is invoked directly (not nested under `restart-dev.sh`) and exits
non-zero, it shall print a prompt and block on a single keypress before the process actually exits.

**Rationale**: Direct implementation of the headline fix for the script most likely to be launched
standalone and most likely to hit the Docker-down case that originally surfaced this gap.

**References**: `scripts/start-dev.sh`, `scripts/lib/dev-common.sh` (new `pause_on_failure`)

**Verification** (`[MANUAL]` — no bash test harness exists in this project; manual, but exact and
reproducible):
```bash
bash scripts/start-dev.sh badarg
# Expect: "Usage: start-dev.sh [backend|frontend] [--debug]" to stderr, then a
# "Press any key to close this window..." prompt that blocks until a key is pressed, then exit 1.
```
Also re-confirm against the original real-world trigger: with Docker Desktop stopped,
`bash scripts/start-dev.sh backend` prints `Docker isn't running -- start Docker Desktop, then try
again.` and then the same pause, instead of returning straight to the prompt.

### TOOLING-004-AC-02 [MANUAL]: `stop-dev.sh` pauses on a non-zero exit when run directly
**Statement**: When `stop-dev.sh` is invoked directly and exits non-zero, it shall pause identically
to `TOOLING-004-AC-01`.

**Rationale**: Explicit per-script coverage — the same trap must be wired into every entry point,
not just `start-dev.sh`.

**References**: `scripts/stop-dev.sh`

**Verification** (`[MANUAL]`):
```bash
bash scripts/stop-dev.sh badarg
# Expect: usage message, then the pause prompt, then exit 1.
```

### TOOLING-004-AC-03 [MANUAL]: `restart-dev.sh` pauses exactly once on a nested failure, not doubled
**Statement**: When `restart-dev.sh` is invoked directly and either its `stop-dev.sh` step or its
`start-dev.sh` step fails, exactly one pause prompt shall appear (from `restart-dev.sh`'s own trap)
— the nested script's own trap shall not also pause.

**Rationale**: Closes the double-pause problem described in the Overview — `restart-dev.sh` shares
a terminal with the real subprocesses it invokes, so without suppression a single failure could
trigger two or three sequential prompts.

**References**: `scripts/restart-dev.sh` (`DEV_SCRIPT_NESTED=1` scoped to each nested call's own
environment via the `VAR=value cmd` form — not `export`ed into `restart-dev.sh`'s own shell, which
would otherwise still be set when its own trap fires at the bottom; see Summary for the real bug
this distinction fixed), `scripts/lib/dev-common.sh` (`pause_on_failure`'s `DEV_SCRIPT_NESTED`
check)

**Verification** (`[MANUAL]`):
```bash
bash scripts/restart-dev.sh badarg
# Expect: usage message (from the nested stop-dev.sh, which fails first), then exactly ONE
# "Press any key to close this window..." prompt -- not two.
```

## Requirement 2 — The success path and non-interactive invocations are unaffected

**User story**: As a user running these scripts normally (success, or from automation), I don't
want any new keypress or hang added to a path that already works fine today.

### TOOLING-004-AC-04 [MANUAL]: A successful (exit 0) run does not pause
**Statement**: When any of the three scripts exits `0`, it shall return control to the caller
immediately — no prompt, no pause.

**Rationale**: Regression guard — the fix must add friction only to the failure path, matching the
candidate's explicit framing ("without adding an extra keypress to the normal success path").

**References**: `scripts/lib/dev-common.sh` (`pause_on_failure`)

**Verification** (`[MANUAL]`, side-effect-free regardless of local Postgres/port state):
```bash
bash scripts/stop-dev.sh
# Expect: "backend not running"/"frontend not running" messages, exit 0, prompt returns
# immediately -- no pause, confirmed by the command completing without waiting on input.
```

### TOOLING-004-AC-05 [MANUAL]: No pause (and no hang) when stdin isn't an interactive terminal
**Statement**: While stdin is not a terminal (e.g. redirected from `/dev/null`, piped, or closed —
as a future CI/automation invocation would do), `pause_on_failure` shall skip the keypress wait
entirely and let the script exit immediately, even on a non-zero exit.

**Rationale**: Safety net the candidate write-up didn't originally call out, but which the fix
itself introduces a real risk of without this guard: a `read` with no guard blocks forever against
a non-interactive stdin, turning a one-off local UX annoyance into a hang for any future automated
caller (this project has no CI yet, but `tech.md` notes it's planned). Checked via `[ -t 0 ]`.

**References**: `scripts/lib/dev-common.sh` (`pause_on_failure`)

**Verification** (`[MANUAL]`):
```bash
bash scripts/stop-dev.sh badarg < /dev/null
# Expect: usage message, exit 1, command returns immediately -- no hang waiting on a keypress
# that a non-interactive stdin could never supply.
```

## Requirement 3 — `restart-dev.sh` correctly reflects a nested failure in its own exit code

**User story**: As the `pause_on_failure` trap relies on the script's own exit code to decide
whether to pause, I want `restart-dev.sh`'s exit code to actually reflect a failure in either of
its two steps, not just whichever one happened to run last.

### TOOLING-004-AC-06 [MANUAL]: `restart-dev.sh`'s exit code reflects either nested step's failure
**Statement**: `restart-dev.sh` shall capture `stop-dev.sh`'s and `start-dev.sh`'s exit codes
independently and exit non-zero if either failed, even if the other succeeded — not simply exit
with whichever code the last-run command happened to produce.

**Rationale**: A pre-existing gap, not previously consequential (nothing read `restart-dev.sh`'s
own exit code before this spec), but load-bearing now: without this, a `stop-dev.sh`-only failure
followed by a successful `start-dev.sh` would make `restart-dev.sh` exit `0`, and — since the
nested child's own trap is suppressed by `DEV_SCRIPT_NESTED` (`TOOLING-004-AC-03`) — the diagnostic
would be lost with no pause anywhere to catch it.

**References**: `scripts/restart-dev.sh`

**Verification** (`[MANUAL]` — by code inspection, not runtime reproduction: a `stop-dev.sh`-fails-
but-`start-dev.sh`-succeeds scenario isn't reproducible without mutating real local Docker/port
state, so this is checked by reading the implementation directly rather than attempting a flaky
live repro): confirm `restart-dev.sh` captures each nested call's exit status independently (e.g.
`... || status=1` after each), and ends with an explicit `exit $status` reflecting the combination
of both — not a bare fall-through to the last command's own exit code.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| Existing `docker_preflight` diagnostic this spec's fix makes actually readable | `scripts/lib/docker-common.sh` |
| `parse_args`/`usage()` — the safe, deterministic failure trigger used by every verification above | `scripts/lib/dev-common.sh`, each script's own `usage()` |
| `RUNBOOK.md`'s "Quick Start (scripts)" section | Documents the scripts this spec modifies — update if the pause behavior needs explaining there |
| `.claude/SPEC_CANDIDATES.md` | Origin candidate — remove once this spec is written, per that file's own maintenance rule |

## Acceptance Criteria Summary

- [x] TOOLING-004-AC-01 — `start-dev.sh` pauses on a non-zero exit when run directly
- [x] TOOLING-004-AC-02 — `stop-dev.sh` pauses on a non-zero exit when run directly
- [x] TOOLING-004-AC-03 — `restart-dev.sh` pauses exactly once on a nested failure, not doubled
- [x] TOOLING-004-AC-04 — a successful (exit 0) run never pauses
- [x] TOOLING-004-AC-05 — no pause/hang when stdin isn't an interactive terminal
- [x] TOOLING-004-AC-06 — `restart-dev.sh`'s exit code reflects either nested step's failure
