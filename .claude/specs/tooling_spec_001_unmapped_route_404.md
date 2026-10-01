# Tooling Spec 001: Unmapped Routes Return 404, Not 500

**Status**: Implemented — `handleNoResourceFoundException` added to `GlobalExceptionHandler`,
regression-guard test added for `handleUnexpectedException`; full backend Spock suite green.
**Priority**: Low (cosmetic/correctness — no functional endpoint is affected)
**Depends on**: None
**Area**: Backend (tooling/maintenance — no user-facing feature)
**Roadmap version**: N/A — internal/maintenance, not a V1–V5 feature

## Overview

`GlobalExceptionHandler` (`backend/src/main/java/uk/co/stefirby/behaviouralactivation/exception/GlobalExceptionHandler.java`)
renders every handled error as one consistent `ApiError` JSON shape, with a catch-all
`@ExceptionHandler(Exception.class)` at the bottom returning `500` and the message "An unexpected
error occurred" for anything not specifically handled above it.

Spring's own `NoResourceFoundException` — thrown for any request path with no matching controller
mapping or static resource, e.g. `GET http://localhost:8420/` or `GET /favicon.ico` — has no
specific handler in this class, so it falls through to that catch-all. The result: visiting an
unmapped path returns `500 "An unexpected error occurred"`, which reads as a server bug, when the
correct, unremarkable response is `404 Not Found`. This was observed directly in `logs/backend.log`
while diagnosing a "servers are up but the browser shows an unexpected error" report — the backend
was healthy throughout; the user was simply hitting the API's root (`:8420/`) instead of the
frontend (`:4321/`), and the 500-shaped response made a routine 404 look like a real failure.

This spec adds a dedicated handler for `NoResourceFoundException` returning `404` with the existing
`ApiError` shape, so an unmapped path is distinguishable from an actual server error — no other
endpoint's behavior changes.

## Requirement 1: Unmapped routes return 404

**User story**: As anyone probing an unmapped path on the API (a browser hitting the bare origin,
a stray `/favicon.ico` request, a typo'd endpoint), I want a plain "not found" response, not a
message that reads as a server-side bug, so I can tell the two apart at a glance.

### TOOLING-001-AC-01 [AUTO]: NoResourceFoundException renders as 404
**Statement**: When a request matches no controller mapping or static resource (Spring throws
`NoResourceFoundException`), the `GlobalExceptionHandler` shall return `404 Not Found` with an
`ApiError` body of `{ "message": "Not found", "details": null }`.

**Rationale**: Distinguishes "you asked for something that doesn't exist" from "the server broke" —
see Overview for the real-world trigger (hitting `:8420/` directly).

**References**:
- Type: `ApiError` (backend `exception/ApiError.java`) — reused as-is, no new shape
- Exception: `org.springframework.web.servlet.resource.NoResourceFoundException`
- Related: `TOOLING-001-AC-02` (the generic catch-all must still apply to everything else)

**Test Case (Red)**:
```groovy
def "TOOLING-001-AC-01: renders a NoResourceFoundException as 404, not the 500 catch-all"() {
    given: "a NoResourceFoundException, as Spring throws for an unmapped path like '/' or '/favicon.ico'"
        def ex = new NoResourceFoundException(HttpMethod.GET, "/")

    when: "the exception is handled"
        def response = handler.handleNoResourceFoundException(ex)

    then: "the status is 404, not 500"
        response.statusCode == HttpStatus.NOT_FOUND

    and: "the body uses the standard ApiError shape"
        response.body.message() == "Not found"
        response.body.details() == null
}
```

**Test Case (Green)**: add `handleNoResourceFoundException` to `GlobalExceptionHandler`, handling
`NoResourceFoundException` above the generic `Exception` catch-all, returning
`ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiError.of("Not found"))`.

### TOOLING-001-AC-02 [AUTO]: Genuine unexpected errors still return 500
**Statement**: While an exception is anything other than one of `GlobalExceptionHandler`'s
specifically-handled types (including `NoResourceFoundException` per `TOOLING-001-AC-01`), the
`GlobalExceptionHandler` shall still return `500 Internal Server Error` with
`{ "message": "An unexpected error occurred", "details": null }`.

**Rationale**: This spec narrows the catch-all by exactly one exception type — it must not weaken
500-handling for actual unexpected failures (a regression here would mask real bugs as if they were
routine "not found" responses).

**References**:
- Related: `TOOLING-001-AC-01`

**Test Case (Red)**:
```groovy
def "TOOLING-001-AC-02: an unrelated exception still renders as the 500 catch-all"() {
    when: "a generic, unhandled exception type is handled"
        def response = handler.handleUnexpectedException(new RuntimeException("boom"))

    then: "the status is still 500"
        response.statusCode == HttpStatus.INTERNAL_SERVER_ERROR

    and: "the body is still the generic message"
        response.body.message() == "An unexpected error occurred"
}
```

**Test Case (Green)**: no production change needed beyond AC-01 — this is a regression guard on the
existing `handleUnexpectedException`, confirming it still fires for anything not caught by a more
specific handler.

## Cross-references

| Depends on / contracts against | Where |
|---|---|
| `ApiError` shape | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/exception/ApiError.java` |
| Existing catch-all being narrowed | `backend/src/main/java/uk/co/stefirby/behaviouralactivation/exception/GlobalExceptionHandler.java` (`handleUnexpectedException`) |
| Existing handler test conventions | `backend/src/test/groovy/uk/co/stefirby/behaviouralactivation/exception/GlobalExceptionHandlerSpec.groovy` |

## Acceptance Criteria Summary

- [x] TOOLING-001-AC-01 [AUTO]: Unmapped routes (`NoResourceFoundException`) return `404` with
      `{ "message": "Not found", "details": null }`
- [x] TOOLING-001-AC-02 [AUTO]: Any other unhandled exception still returns `500` with
      `{ "message": "An unexpected error occurred", "details": null }` (regression guard)
