Behavioural Activation Planner — Product & Development Outline

1. Product summary

A personal Behavioural Activation (BA) planner inspired by Activity Lift, designed around the user's Talking Therapies work and adapted to their preferred way of planning.

The app should help a user:

Build a bank of activities.

Categorise activities as Routine, Necessary, or Pleasurable.

Plan activities across a week.

Use more structured planning on weekdays.

Keep weekends flexible through a bucket-list approach.

Record completion and optionally how an activity affected mood.

Review patterns over time.

Eventually use AI to personalise suggestions and help create realistic plans.

Core BA philosophy

The app should support Behavioural Activation rather than attempt to replace therapy.

The basic model is:

Activity → action despite current mood → experience of pleasure/achievement/connection → feedback into future activity choices.

AI should be a personalisation and planning layer, not the source of therapeutic rules or diagnosis.

2. Planning model

Weekdays

The preferred approach is to plan weekdays in advance and broadly stick to the plan.

A typical working day can be:

Morning: one planned routine or small activity.

Work: a substantial protected work block, which can count as Routine/Necessary/achievement depending on the BA model being used.

Evening: one pleasurable activity chosen with some flexibility.

The app should not require an exact Routine/Necessary/Pleasurable ratio every single day. Balance should be considered across the week.

Work should not be treated as something that must be compensated for by adding lots of additional activities. Completing a planned workday is itself a valid achievement.

Weekends

Weekends should use a bucket list rather than rigid time-based scheduling because plans can be intermittent.

Example:

Go for a walk

Go somewhere for coffee

Cook something interesting

See a friend

Work on a personal project

Watch a film

Do one household task

The user chooses from the bucket list according to circumstances, energy, social plans and opportunity.

Activity categorisation

Activities should be categorised according to their purpose, rather than permanently assigning an activity to only one category.

For example:

Cooking dinner because food is needed → Necessary.

Trying a new curry recipe because it sounds enjoyable → Pleasurable.

A daily walk as part of a routine → Routine.

A walk somewhere interesting because it is enjoyable → Pleasurable.

3. Development roadmap

Version 1 — Core planner

Goal

Create the simplest useful BA planning application.

Features

Activity catalogue.

Three categories:

Routine

Necessary

Pleasurable

Weekly planner.

Morning / Afternoon / Evening slots.

Add an activity to a day and time slot.

Mark an activity complete.

Edit, move and remove planned activities.

Basic activity history.

Success criterion

The user can create a weekday BA plan, follow it, and record what was completed without needing another planning tool.

Version 2 — Tracking and personal reflection

Goal

Understand how activities actually affect the user.

Features

Mood rating before an activity.

Mood rating after an activity.

Optional pleasure rating.

Optional achievement rating.

Optional notes.

Activity completion history.

Recurring activities.

Weekly summary.

Ability to see which activities tend to produce positive outcomes.

Potential weekly review

Planned activities

Completed activities

Completion rate

Category balance

Average mood change

Activities with strongest positive effect

Activities repeatedly postponed

Success criterion

The user can look back at a week and learn which activities were useful rather than simply seeing a list of completed tasks.

Version 3 — Intelligent suggestions and planning assistance

Goal

Use AI to reduce planning effort while keeping the user in control.

Features

Suggest activities based on the user's existing activity bank.

Suggest a balanced week.

Turn vague intentions into concrete activities.

Example:

"I should exercise."

becomes:

"Take a 15-minute walk after breakfast on Tuesday."

Suggest smaller alternatives when an activity feels too difficult.

Suggest neglected activities.

Suggest alternatives when something is repeatedly postponed.

Generate a weekend bucket list.

Take existing commitments into account.

Important constraint

AI should work primarily from the user's own activities, preferences and history rather than inventing generic therapeutic advice.

Success criterion

The user can ask the app for help planning a realistic week and receive suggestions that feel personally relevant rather than generic.

Version 4 — Personalised behavioural patterns

Goal

Allow the application to learn what works for the individual user.

Features

Identify activities that consistently improve mood.

Identify activities that are often planned but not completed.

Identify preferred times for different activities.

Identify over-ambitious planning patterns.

Identify category imbalance.

Recommend activities based on historical effectiveness.

Recommend a smaller version of activities when the user repeatedly struggles to complete them.

Compare weekday and weekend patterns.

Personalised weekly review.

Example insight

"You've completed short walks 8 times this month and your average post-activity mood has been higher on those days. You tend to postpone 30-minute walks, so consider scheduling shorter ones."

The app should present this as an observation, not a medical conclusion.

Success criterion

The app becomes increasingly useful because it understands the user's actual behaviour rather than relying solely on manually configured preferences.

Version 5 — AI behavioural activation assistant

Goal

Provide a natural-language interface over the planning and personalisation system.

Example interactions

"I've got a free Saturday but don't want to plan every hour."

The app could generate a flexible bucket list.

"I've had a terrible day and don't have much energy."

The app could suggest smaller activities from the user's existing activity bank.

"I've got three hours free this afternoon."

The app could propose a mixture of routine, necessary and pleasurable activities.

"I keep postponing cleaning the bathroom."

The app could suggest breaking it into a smaller task or choosing a more suitable time.

"Plan my working week."

The app could account for work commitments and construct a realistic BA plan around them.

AI principles

User remains in control.

Suggestions can always be edited or rejected.

No diagnosis.

No pretending to be a therapist.

No replacement for professional treatment.

Avoid excessive notifications or pressure.

Prefer small, achievable actions over ambitious schedules.

Learn from explicit user feedback.

Success criterion

The assistant feels like a planning partner that understands the user's activity history and preferences without becoming intrusive or prescriptive.

4. User stories and acceptance criteria

Epic 1 — Activity management

US-001: Create an activity

As a user, I want to create an activity so that I can reuse it when planning my week.

Acceptance criteria:

I can enter an activity name.

I can select Routine, Necessary or Pleasurable.

I can optionally add a description.

I can save the activity.

The activity appears in my activity bank.

I can edit or delete the activity.

US-002: Categorise an activity by purpose

As a user, I want to choose the category of an activity based on its purpose.

Acceptance criteria:

An activity can have a primary category.

I can change its category.

The category can be changed when planning an individual occurrence if appropriate.

Historical records retain the category that applied at the time.

Epic 2 — Weekly planning

US-003: View a weekly plan

As a user, I want to see my week divided into mornings, afternoons and evenings so that I can plan activities around my normal routine.

Acceptance criteria:

The planner displays the current week.

Each day has Morning, Afternoon and Evening sections.

I can navigate between weeks.

Planned activities are clearly visible.

Completed activities are visually distinguishable.

US-004: Plan an activity

As a user, I want to assign an activity to a particular day and time period.

Acceptance criteria:

I can select an activity from my activity bank.

I can assign it to a day.

I can assign Morning, Afternoon or Evening.

I can move an activity to another slot.

I can remove an activity without deleting it from my activity bank.

US-005: Record work

As a user, I want to record work as a planned activity/block so that I don't feel I need to schedule additional activities around a full working day.

Acceptance criteria:

Work can occupy a Morning or Afternoon block.

Work can be treated as Routine, Necessary or Achievement depending on the configured model.

The planner does not require additional activities to compensate for a work block.

I can mark work as completed.

US-006: Plan a weekday

As a user, I want to plan weekdays in advance so that I don't have to make activity decisions based on how I feel at the time.

Acceptance criteria:

I can create a plan for Monday-Friday.

I can save the plan.

Planned activities remain visible throughout the week.

I can make changes when circumstances genuinely change.

The app does not penalise me for changing the plan.

Epic 3 — Flexible weekends

US-007: Create a weekend bucket list

As a user, I want to create a flexible list of activities for the weekend rather than assigning everything to specific times.

Acceptance criteria:

I can add activities to a weekend bucket list.

Bucket-list activities do not require a time slot.

I can mark bucket-list activities complete.

I can move an activity from the bucket list into a scheduled slot.

I can carry unfinished activities forward or discard them.

US-008: Balance weekend activities

As a user, I want to see the mix of Routine, Necessary and Pleasurable activities in my weekend bucket list.

Acceptance criteria:

The app displays category counts.

It highlights significant imbalance without treating it as failure.

It does not require an exact ratio.

Epic 4 — Completion and reflection

US-009: Complete an activity

As a user, I want to mark an activity as completed so that I can see what I actually did.

Acceptance criteria:

I can mark an activity complete.

Completion records the date/time.

I can undo completion.

Completed activities appear in history.

US-010: Record mood

As a user, I want to record my mood before and after an activity so that I can understand whether activities are helping me.

Acceptance criteria:

Mood can be recorded before an activity.

Mood can be recorded after an activity.

Both values are optional.

The app can calculate the change.

The user can review historical mood/activity data.

US-011: Record pleasure and achievement

As a user, I want to record how pleasurable or rewarding an activity was.

Acceptance criteria:

I can optionally rate pleasure.

I can optionally rate achievement.

Ratings are associated with the activity occurrence.

Ratings can be reviewed later.

Epic 5 — Recurring activities

US-012: Create recurring activities

As a user, I want to make some activities recurring so that I don't have to recreate them every week.

Acceptance criteria:

I can set an activity to recur.

I can choose applicable days.

I can choose Morning, Afternoon or Evening.

I can pause or remove recurrence.

Individual occurrences can be edited without necessarily changing the recurring rule.

Important: recurring activities should not encourage repetitive plans where the same activity appears every day unless the user explicitly wants that.

Epic 6 — Weekly review

US-013: Review my week

As a user, I want to review my week so that I can understand what happened rather than simply seeing a completion percentage.

Acceptance criteria:

I can see planned versus completed activities.

I can see category distribution.

I can see mood changes where recorded.

I can identify activities that were repeatedly postponed.

I can identify activities associated with positive outcomes.

The review uses neutral language and does not frame missed activities as failure.

US-014: Learn from the week

As a user, I want the app to help me identify useful patterns without making clinical claims.

Acceptance criteria:

Insights are presented as observations.

The app can identify repeated patterns.

The app does not diagnose or make medical claims.

I can dismiss or ignore an insight.

Epic 7 — AI assistance

US-015: Generate activity suggestions

As a user, I want the app to suggest activities based on my existing activity bank and history.

Acceptance criteria:

Suggestions can use my existing activities.

Suggestions consider recent activity history.

Suggestions can consider category balance.

I can accept, edit or reject a suggestion.

Rejected suggestions do not automatically reappear repeatedly.

US-016: Make an activity smaller

As a user, I want AI to turn an ambitious activity into a smaller version when I am struggling.

Acceptance criteria:

I can ask for a smaller version.

The original activity is preserved.

The smaller version is clearly identified as an alternative.

I can schedule the alternative.

Example:

"Clean the house" → "Clean the bathroom for 10 minutes."

US-017: Generate a realistic weekly plan

As a user, I want AI to help construct a realistic weekly plan around my existing commitments.

Acceptance criteria:

Existing work/appointments are respected.

The system considers the user's preferred weekday structure.

The system can include routine, necessary and pleasurable activities.

It avoids excessive scheduling.

The user must approve the resulting plan before it becomes active.

US-018: Generate a weekend bucket list

As a user, I want AI to suggest a flexible weekend bucket list.

Acceptance criteria:

Suggestions are based on my activity bank and preferences.

The list contains a mixture of activity types.

Activities do not have to be assigned to specific times.

The user can edit the list before accepting it.

5. Non-functional requirements

Privacy

Because this is a personal wellbeing application:

Personal activity and mood data should be treated as sensitive.

Data should not be used for advertising.

AI providers should receive only the minimum data necessary.

The application should clearly explain where AI requests are sent.

Users should be able to delete their data.

UX

Planning should be quick.

Adding an activity should require minimal interaction.

Completion should be one action.

The application should never feel like a productivity scorecard.

Missed activities should not be presented as failure.

Rescheduling should be easy.

The interface should favour calm, simple presentation over gamification.

AI safety

AI must not diagnose.

AI must not claim to provide therapy.

AI should not contradict the user's therapist's instructions.

AI should favour achievable actions.

AI suggestions should remain optional.

The user should be able to disable AI features.

6. Potential future features

These should not be part of the initial build unless they emerge naturally from real usage:

Mobile application / PWA.

Notifications.

Calendar integration.

Import existing activities from therapy worksheets.

Export weekly reports for discussion with a therapist.

Multiple activity templates.

Natural-language activity entry.

Voice input.

Local/on-device AI.

More sophisticated trend analysis.

Personal activity effectiveness scoring.

Optional social/connection activity tracking.

7. Guiding principle

The app should help the user do useful things despite how they feel, not give them another system to optimise.

The measure of success is therefore not:

"Did I complete 100% of my plan?"

It is:

"Did this help me create more structure, activity, pleasure, achievement and connection in my life?"