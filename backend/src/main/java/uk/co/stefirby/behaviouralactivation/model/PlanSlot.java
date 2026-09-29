package uk.co.stefirby.behaviouralactivation.model;

/**
 * A coarse time-of-day slot for a scheduled {@link PlannedOccurrence} (US-003). Deliberately
 * coarse, not clock-time — see {@code .claude/ideas/future_ideas.md}'s "Finer-grained/custom time
 * slots" entry for why this is left as a simple three-value enum for V1.
 */
public enum PlanSlot {
    MORNING,
    AFTERNOON,
    EVENING
}
