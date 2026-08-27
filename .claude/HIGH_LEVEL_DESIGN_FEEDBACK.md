# High-Level Design Feedback — Behavioural Activation Planner

Reviewed against `.claude/HIGH_LEVEL_DESIGN.md` and the reference site
[psychkit.org/behavioral-activation-tool](https://psychkit.org/behavioral-activation-tool/) ("Activity Lift").

## 1. Reference site — what it actually offers

Activity Lift is much thinner than your design: pick activities from a fixed list or add your own,
drag them onto a Mon/Tue–Sun grid, and view the finished plan. No accounts, no persistence beyond the
session, no mood tracking, no completion tracking, no AI. It's useful as a UX starting point for the
"pick an activity → drop it on the week" interaction, and as a confirmation that a minimal V1 is a
genuinely small build — but essentially none of your Version 2–5 scope exists there. Your design is
already a significant superset, not an extension.

## 2. Overall feasibility

Yes — this is feasible, and the roadmap is sensibly staged. Nothing in V1–V3 requires research or
novel technique; it's CRUD, a calendar-style UI, and an LLM API call with prompt construction. The
main risks are scope and premature complexity, not technical feasibility. Comments per version:

- **V1 (core planner):** Straightforward. Activity bank + weekly grid + complete/edit/move. A solo
  build measured in days-to-low-weeks, not a big undertaking.
- **V2 (tracking/reflection):** Still straightforward. The one genuinely tricky part is **recurring
  activities with per-occurrence edits** (US-012) — this is the classic calendar-app problem (a
  recurrence rule that generates occurrences, plus the ability to override or detach a single
  occurrence without changing the rule). It's a well-understood pattern (same shape as Google
  Calendar's model), just don't underestimate it — it's the most "designy" part of V1/V2.
- **V3 (AI suggestions):** Feasible as a backend service that assembles the user's activity bank +
  recent history into a prompt and calls an LLM API. No training, no fine-tuning — this is prompt
  engineering plus structured output, with the user approving results before they become active
  (already in your acceptance criteria, which is the right constraint).
- **V4 (personalised patterns):** Feasible, but reframe it internally: this is **descriptive
  analytics over the user's own data** (group-by-activity average mood delta, postponement counts,
  time-of-day preferences), not machine learning. Plain SQL aggregation + a bit of Java gets you the
  example insight in the doc ("short walks correlate with higher mood, 30-min walks get postponed").
  Don't reach for an ML library or model training here — it would be solving a problem you don't have.
- **V5 (NL assistant):** The most ambitious step, but tractable because it can be built as an LLM
  with **tool/function-calling access to your own V1–V4 REST endpoints** (generate bucket list,
  propose a plan for a time window, suggest a smaller version of an activity) rather than a bespoke
  NLU system. This is a well-trodden pattern now. I'd still treat it as a distinct later phase — it's
  where effort could balloon if scoped loosely.

Nothing here changes the feasibility verdict; it affects sequencing and how much to build ahead of
need.

## 3. Frontend-only vs. backend — recommendation: **both, backend included from V1**

A frontend-only (browser-storage-only) app is possible for V1 alone, but I'd recommend against it
once V2+ is in view, for reasons specific to *this* app rather than a general default:

- **Mood/history data is sensitive** (your own non-functional requirements say so) and you'll likely
  want it available from more than one device/browser eventually. LocalStorage/IndexedDB-only means
  no backup, no cross-device access, and data loss on a browser reset.
- **V3+ needs a place to hold the AI provider key and construct prompts.** Calling an LLM API directly
  from the browser means shipping your API key to the client — not viable. A backend is the natural
  place to own that call, control what data leaves the app ("AI providers should receive only the
  minimum data necessary" is already a stated requirement), and keep the key server-side.
  This is a hard requirement, not a preference: with a client-only frontend, either the key is
  exposed in the browser bundle, or every user of the app shares one key with no way to scope,
  rotate, or meter it per user.
- **Pattern analysis (V4)** is naturally a server-side aggregation job over history you already have
  in one place, not something you want to recompute client-side from a local store.

Given you're most comfortable with Spring Boot, the natural shape is:

- **Frontend:** a TypeScript SPA (React is the least-friction choice given ecosystem/tooling maturity;
  Vue is a fine alternative) — talks to your API over REST, nothing exotic.
- **Backend:** Spring Boot 4.1, following your existing default layering
  (`controller/service/repository/model/dto/exception`), Spock specs, no Lombok — i.e. no deviation
  from your established conventions, this isn't a special case.
- This also sets you up cleanly for the "potential future feature" PWA/mobile entry in your own
  roadmap — same API, different or additional frontend later.

If you'd genuinely rather keep this to a single deployable and skip a separate frontend build/deploy
step, a **Thymeleaf server-rendered Spring Boot app** is a legitimate alternative that still satisfies
the "backend owns the AI key" requirement — worth deciding now since it changes the shape of V1, not
something to bolt on later. But given a weekly drag-and-drop planner grid, a client-side SPA will give
a noticeably nicer interaction model than server-rendered pages with progressive enhancement.

## 4. Database — recommendation: **yes, a relational DB, from V1**

Your data model is inherently relational (activities → planned occurrences → completion records →
mood ratings, with recurrence rules generating occurrences) and benefits from real querying for the
V4 analytics — this isn't a case where you could get away with a flat file or a document store.

- **PostgreSQL** for anything beyond your own laptop (self-hosted, Fly.io/Render/Railway, home
  server, etc.) — standard, free, matches your Spring Boot default stack.
- If you want to start **fully local with zero infra** (single user, single machine, no hosting
  decision yet), an embedded file-based DB (H2 in file mode, or SQLite via a JDBC driver) under the
  same JPA entities is a reasonable temporary substitute — the schema/entities don't materially
  change when you later point the same app at Postgres. Worth deciding explicitly rather than
  defaulting silently, since it affects whether "run the app" means "start a Postgres container" or
  "just run the jar."

## 5. Messaging / queues — recommendation: **no, this would be over-engineering**

Message brokers (Kafka, RabbitMQ, etc.) solve problems around decoupling independent services,
absorbing bursty load across multiple consumers, and surviving consumer downtime. None of that
applies to a single-user personal wellbeing app making occasional synchronous CRUD calls and
occasional LLM requests. Concretely:

- **Plan/complete/edit actions:** ordinary synchronous REST, no queue needed.
- **AI suggestion generation (V3+):** a synchronous backend call to the LLM API is fine at this
  volume; if a particular call is slow enough to want a spinner, that's a UI loading state, not a
  justification for async messaging infrastructure.
- **V4 analytics:** can run as a query-on-demand when the weekly review is opened, or a simple
  scheduled `@Scheduled` job if you want it precomputed — neither needs a broker.

Introducing a message queue here would add operational surface (another service to run, monitor, and
keep alive) with no corresponding problem it solves. Skip it unless a specific, concrete need shows
up in practice (it won't for a single-user app at this scale).

## 6. Other things worth deciding before scaffolding

- **Who is "the user"?** Everything above assumes single-user (you). If there's any chance of this
  being multi-user later, decide now — it changes whether you need real auth (Spring Security +
  proper login) from V1, versus a much lighter single-user guard (e.g. one shared credential, or even
  no auth if it never leaves your own machine/network).
- **Hosting target:** local-only, home server, or a cloud host. Affects the DB decision above and
  whether HTTPS/auth hardening matters from day one.
- **AI provider:** given your existing environment, the Claude API is the natural default; worth
  confirming rather than assuming, since it affects the client library and cost model referenced in
  your privacy section.

## 7a. Multi-user readiness — seams worth building in now

Given self-hosted-now-but-possibly-multi-user-later, the right move isn't building multi-tenancy —
it's avoiding the two things that are genuinely expensive to retrofit onto an established schema and
codebase:

- **Owner association on every entity from day one** (Activity, PlannedOccurrence, MoodRating, etc.
  all carry a user reference), even with exactly one user initially. Adding this later means a
  migration touching every table plus every query; including it from the start costs almost nothing.
- **Real authentication from V1** (Spring Security, even guarding a single account). The expensive
  part of retrofitting auth isn't the login form — it's threading an authenticated principal through
  services and repositories that were written assuming a single implicit user. Cheaper to have that
  shape from the start than to insert it later.

Everything else (per-tenant schemas, admin tooling, billing, invite flows) can genuinely wait until
there's a concrete second user — building those now would be speculative.

## 7b. AI provider — one interface, provider chosen by config

Groq, OpenRouter, and most self-hostable local runtimes (Ollama, vLLM, llama.cpp server, LM Studio)
all speak — or can be configured to speak — the same OpenAI-compatible chat-completions wire format.
That means one Spring interface (e.g. `ChatCompletionClient`) with a single HTTP-based implementation
is likely enough; environment-specific `application-{profile}.yml` values supply the base URL,
API key, and model:

- `local` profile → Groq (fast, generous free tier) or OpenRouter (aggregates several, some free).
- hosted/multi-user profile → same providers initially; swapping to self-hosted inference later is a
  config change (base URL), not a code change, as long as the target speaks the same wire format.

On self-hosting a "light" local LLM for the multi-user case specifically — feasible, but worth being
realistic before committing effort to it:

- It needs a GPU for acceptable latency. CPU-only inference of even a small quantized 7–8B model runs
  seconds-to-tens-of-seconds per reply — a noticeably worse experience for the conversational V5
  assistant than a hosted API.
- Given how low actual call volume will be for this app (a handful of AI calls per user per day/week,
  not a chat product), a hosted free/cheap API will likely be both cheaper and faster than running
  your own GPU box.
- The real justification for self-hosted inference would be **data sovereignty** — mood/mental-health
  data never leaving infrastructure you control — not cost or latency. That's a legitimate reason for
  this specific kind of app, but worth treating as a deliberate future decision if it becomes a real
  requirement, not something to build speculatively now.

Recommendation: build the interface, ship the hosted-API implementation now, defer any local-inference
implementation until there's a concrete reason (a real privacy requirement, or a provider becoming
unviable) rather than building it ahead of need.

## 7c. Hosting — staged recommendation (no prior experience assumed)

You don't need to solve multi-user SaaS hosting to get started.

- **Now — self-hosted, personal use:** Docker Compose bundling the Spring Boot app + Postgres, run on
  your own machine or a home server/NAS. If you want to reach it from your phone without exposing
  anything to the public internet, **Tailscale** sets up a private network to your own instance in
  about ten minutes — a good fit here specifically, since it avoids any public attack surface for what
  is fairly sensitive personal data.
- **If/when you want it reachable without your machine staying on:** **Fly.io** or **Railway** are the
  easiest on-ramps — both deploy straight from a Dockerfile, both offer a managed Postgres add-on, and
  neither requires learning general cloud-ops (no Kubernetes, no hand-configured VMs). I'd point you
  at one of these to actually learn hosting, rather than starting with raw AWS/GCP.
- **If it later grows into real multi-user use:** the same platforms scale into small multi-tenant use
  before anything more sophisticated is needed. At that point add TLS (both provide this
  automatically), managed backups (both offer this), and swap the single-account auth for OAuth login
  (GitHub/Google) rather than building your own password-reset flow.

## 7. Bottom line

Feasible as designed. Recommended shape: **Spring Boot 4.x backend + Postgres (or H2/SQLite for a
local-only start) + a TypeScript SPA frontend, no messaging infrastructure.** This matches your
existing Java/Spring conventions, satisfies the privacy requirement that the AI key and data-sent
decisions stay server-side, and gives V4's pattern analysis a natural home in the backend without
introducing anything (brokers, ML infra) the app doesn't actually need yet.
