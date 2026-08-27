# Behavioural Activation Planner

## What it does
A personal Behavioural Activation (BA) planner, inspired by Activity Lift and adapted to the
user's own Talking Therapies work and planning preferences. It helps build a bank of activities,
categorise them by purpose (Routine, Necessary, Pleasurable), plan structured weekdays and a
flexible weekend bucket list, record completion and mood, and — later — use AI to help personalise
suggestions and build realistic plans.

Full product outline, roadmap, and user stories: `.claude/HIGH_LEVEL_DESIGN.md`. Feasibility
review and architecture decisions: `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md`.

## Who it's for
Personal use — starts as a single-user app for the owner. Multi-user readiness is being built in
from V1 (see `tech.md`/`structure.md`) so it's *feasible* to open up to more users later, but
nobody else is using it yet — don't build multi-tenant features (invites, billing, admin tooling)
ahead of a concrete second user.

## Core philosophy

The app supports Behavioural Activation, it doesn't replace therapy:

Activity → action despite current mood → experience of pleasure/achievement/connection → feedback
into future activity choices.

AI (V3+) is a personalisation and planning layer, not a source of therapeutic rules or diagnosis.
It never diagnoses, never claims to provide therapy, and never contradicts the user's therapist's
instructions.

## Planning model

- **Weekdays**: planned in advance and broadly stuck to. A typical day: one planned morning
  activity, a protected work block (itself a valid achievement — not something that must be
  "compensated for" with extra activities), one evening pleasurable activity chosen with some
  flexibility. No fixed Routine/Necessary/Pleasurable ratio is required per day — balance is
  considered across the week.
- **Weekends**: a bucket list rather than rigid time-based scheduling, since weekend plans are
  intermittent. The user picks from the list according to circumstances, energy, and opportunity.
- **Categorisation is by purpose, not a fixed label per activity** — the same activity (e.g.
  cooking) can be Necessary one day and Pleasurable another, depending on why it's being done.
  Historical records retain the category that applied at the time it was planned.

## Roadmap (see `.claude/HIGH_LEVEL_DESIGN.md` §3 for full detail)

| Version | Goal |
|---|---|
| V1 | Core planner — activity bank, three categories, weekly Morning/Afternoon/Evening grid, complete/edit/move |
| V2 | Tracking and reflection — mood/pleasure/achievement ratings, recurring activities, weekly summary |
| V3 | AI suggestions — activity suggestions, vague-intention-to-concrete-activity, smaller alternatives, weekend bucket-list generation |
| V4 | Personalised behavioural patterns — descriptive analytics over the user's own history (not ML) |
| V5 | NL assistant — conversational interface with tool-calling access to the app's own V1–V4 endpoints |

## Goals
- A planner the user actually keeps using, that fits how they already plan (structured weekdays,
  flexible weekends) rather than imposing a generic productivity model.
- Never frame missed activities as failure — neutral language throughout, review over scorecard.
- Feasible path to multi-user later without a costly retrofit (see `structure.md`'s ownership/auth
  seams).
- AI stays optional, personalised from the user's own data, and always requires approval before a
  suggestion becomes an active plan.

## Non-goals
- Diagnosis or therapy replacement — ever.
- A generic productivity/gamification app — no streaks-as-guilt, no 100%-completion scorecards.
- Building ML/model-training infrastructure for V4 — that version is plain descriptive analytics
  (SQL aggregation) over the user's own data, not a model.
- Self-hosted/local LLM inference — deferred unless a concrete data-sovereignty requirement forces
  it later (see `.claude/HIGH_LEVEL_DESIGN_FEEDBACK.md` §7b). AI features consume a hosted API
  behind one provider-agnostic interface.
- A message broker or async job infrastructure — explicitly rejected as over-engineering for a
  single/small-user personal app (see feedback doc §5).

## Known constraints
- Sensitive data: mood and activity history are treated as sensitive personal data, never used for
  advertising, and AI providers receive only the minimum data necessary.
- Deployment starts self-hosted (Docker Compose + Tailscale, no public attack surface) before any
  cloud hosting is considered.
