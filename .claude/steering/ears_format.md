# EARS Requirements Format

This project uses EARS (Easy Approach to Requirements Syntax) to write clear, testable
requirements. All specs use EARS format with explicit references, verification markers, and
traceability to tests. This applies from the very first spec — there's no legacy ID scheme to
carry forward here (unlike the reference project this convention was adapted from).

## EARS Patterns

Every requirement statement follows one of the five canonical EARS patterns. Use the simplest one
that captures the requirement — complex ACs may combine clauses (When … , if … , then …).

| Pattern | Template | Example |
|---|---|---|
| Ubiquitous | The `<system>` shall `<response>` | The `ActivityEntity` shall default `category` to null until explicitly set |
| Event-driven | When `<trigger>`, the `<system>` shall `<response>` | When `POST /api/v1/activities` is requested, the `ActivityController` shall create and return the new activity |
| State-driven | While `<state>`, the `<system>` shall `<response>` | While a fetch is in flight, the `WeeklyPlanner` component shall display a loading spinner |
| Unwanted behaviour | If `<condition>`, then the `<system>` shall `<response>` | If `activityApi.getAll()` rejects, then the `ActivityBank` component shall display an error message with a Retry button |
| Optional feature | Where `<feature is present>`, the `<system>` shall `<response>` | Where a mood rating is recorded, the `WeeklyReview` component shall display the average mood change for that activity |

**Name the system concretely** — the component, endpoint, service class, or entity. Never a bare
"the system".

## Reference IDs

Every acceptance criterion gets a unique, human-readable ID in the form:

```
<AREA>-<SPEC-NUMBER>-AC-<NN>
```

- `AREA` is `PLANNER` for backend specs, `FRONTEND` for frontend specs, or `TOOLING` for repo-wide
  tooling/CI/build-config specs that aren't backend or frontend feature work — matching the spec
  file's own prefix (`planner_spec_005_*.md` → `PLANNER-005`, `frontend_spec_003_*.md` →
  `FRONTEND-003`, `tooling_spec_001_*.md` → `TOOLING-001`).
- `NN` is a two-digit sequence number within that spec, assigned in the order requirements appear.

Example: `PLANNER-005-AC-01`, `FRONTEND-003-AC-07`.

This mirrors the spec filename directly rather than inventing a separate stage system — this
project doesn't work in predefined stages (the version roadmap in `product.md` is a rough sequence
of themes, not a stage gate a spec must map onto), so an ID scheme built around stages wouldn't
fit. A spec's own filename is already the short, meaningful "what's being changed" label (mirroring
branch naming — `feature/<slug>`), so the ID just needs to be traceable back to it.

### Conversion rules

1. **Reference IDs are immutable.** Once assigned, never renumber, merge, or delete an ID — other
   specs, tests, and cross-reference tables may point to it.
2. **Splitting**: if one requirement contains several distinct obligations, use sub-letters under
   the same ID (`PLANNER-005-AC-01a`, `PLANNER-005-AC-01b`) rather than new numbers.
3. **No weakening**: every obligation in a requirement's prose must survive into its AC
   statement(s). If a requirement is ambiguous, resolve toward the stricter reading and note the
   decision in the spec.

## Verification markers

Every AC carries a marker immediately after its reference ID, stating how it's actually verified:

- `[AUTO]` — verified by an automated test (Spock spec, Vitest test) or the build pipeline itself
  (compilation, CI).
- `[MANUAL]` — verified by human review. A `[MANUAL]` AC must state *how* it's checked (e.g.
  "visual check in browser against the design note above") and, where one exists, note the route to
  automating it later.

`[AUTO]` should be the overwhelming majority — both backend (Spock) and frontend (Vitest + RTL)
support testing almost everything. Treat any new `[MANUAL]` as something to justify, not a default.
AI-feature ACs (V3+) are the likely exception where `[MANUAL]` review of suggestion quality may be
unavoidable alongside automated contract tests.

## Structure of a spec

Each `.claude/specs/*.md` file has:

1. **Header**: title, `Status` (Not started / In progress / Implemented, with a pointer to
   implementing files once true), `Priority`, `Depends on`, backend/frontend area, and which
   roadmap version it belongs to (V1–V5, see `product.md`).
2. **Overview**: one paragraph — what this delivers and why.
3. **Requirements**: grouped "Requirement N" sections, each with a one-line user story and its
   EARS-format acceptance criteria (ID + `[AUTO]`/`[MANUAL]` marker + statement).
4. **Cross-references**: a table linking to the specific endpoints, types, or specs this one
   depends on or contracts against.
5. **TDD test case sketches** (red, before implementation) in the target framework — Spock
   `given/when/then` for backend, Vitest + RTL for frontend — one per AC, named after its reference
   ID.
6. **Acceptance Criteria Summary**: a flat checklist mirroring every AC above, unchecked (`- [ ]`)
   until implemented.

### Template

```markdown
### PLANNER-005-AC-01 [AUTO]: Create an Activity
**Statement**: When `POST /api/v1/activities` is requested with a valid body, the
`ActivityController` shall create and return the new activity with `201 Created`.

**Rationale**: Users need to add activities to their bank before they can plan with them
(`.claude/HIGH_LEVEL_DESIGN.md` US-001).

**References**:
- Type: `ActivityDto` (backend `dto/`), `Activity` (frontend `src/types/activity.ts`)
- Related: `PLANNER-005-AC-02` (validation failure case)

**Test Case (Red)**:
\```groovy
def "PLANNER-005-AC-01: creates and returns a new activity"() {
    given: "a valid activity request body"
        // ...

    when: "POST /api/v1/activities is requested"
        // ...

    then: "the response is 201 with the created activity"
        // ...
}
\```

**Test Case (Green)**: implement the controller/service until the spec above passes.
```

## Mapping to Spock

- **While/Where** (state, preconditions) → `given:` block
- **When** (trigger) → `when:` block
- **shall** (response) → `then:` assertions
- **If/then** (unwanted behaviour) → `when:` + `then:` with `thrown(...)` or error-status assertions

A ubiquitous requirement typically becomes a `then:`/`expect:`-only spec.

### Block labels

Every `given:`/`when:`/`then:`/`expect:`/`and:` block in a Spock spec carries a string label
describing that step in plain language — bare, unlabelled blocks aren't used. Where a block maps
directly onto an EARS clause, the label echoes that clause's own wording, so the spec reads as the
requirement's sentence split across blocks:

- `given "<state>":` — mirrors a While/Where clause, or states setup when the AC has no explicit
  precondition.
- `when "<trigger>":` — mirrors the When clause.
- `then "<response>":` — mirrors the shall clause.
- `and "<...>":` — a further assertion or action within the same phase; label it independently
  rather than leaving it bare.
- `expect "<response>":` — collapses when+then into one block for a direct, side-effect-free
  assertion; still labelled.

```groovy
def "PLANNER-005-AC-01: creates and returns a new activity"() {
    given: "a valid create-activity request"
        def request = new ActivityRequest(name: "Walk", category: Category.ROUTINE)

    when: "POST /api/v1/activities is requested"
        def response = client.post().uri("/api/v1/activities").body(request).exchange()

    then: "the response is 201 Created"
        response.expectStatus().isCreated()

    and: "the created activity is returned in the body"
        response.expectBody().jsonPath("$.data.name").isEqualTo("Walk")
}
```

This applies to every Spock spec in `backend/src/test/groovy/`.

## Naming convention for frontend test files

Group tests in one file, using `describe` blocks named after the requirement ID:

```typescript
describe('FRONTEND-003-AC-01: fetch on mount', () => { /* tests */ })
describe('FRONTEND-003-AC-02: loading state', () => { /* tests */ })
```

## Why EARS + TDD together

1. **Traceability**: every test corresponds to a requirement ID.
2. **Clarity**: no ambiguity about what "done" means.
3. **Testability**: EARS statements are inherently testable.
4. **Reviews**: reviewers can verify against requirement IDs.

## When writing a new spec

Always include:
1. Requirement statements in EARS format, each with a `<AREA>-<NNN>-AC-<NN>` ID and
   `[AUTO]`/`[MANUAL]` marker
2. References to backend/frontend types, endpoints, and related specs
3. An Acceptance Criteria Summary checklist
4. Test case sketches showing red/green structure, named after the requirement ID

The `.claude/skills/ears-spec` skill packages this workflow — use it when drafting a new spec so
the structure stays consistent.
