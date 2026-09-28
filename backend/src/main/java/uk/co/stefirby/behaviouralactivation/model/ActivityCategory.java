package uk.co.stefirby.behaviouralactivation.model;

/**
 * An {@link Activity}'s primary category, per US-002 — exactly one of these three, never free text.
 * Per-occurrence category override and historical snapshots (US-002's remaining ACs) are out of
 * scope here — see {@code planner_spec_002_activity_bank.md}'s Out of scope note.
 */
public enum ActivityCategory {
    ROUTINE,
    NECESSARY,
    PLEASURABLE
}
