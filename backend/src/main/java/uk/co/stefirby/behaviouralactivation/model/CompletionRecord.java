package uk.co.stefirby.behaviouralactivation.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Marks a {@link PlannedOccurrence} as done (US-009). At most one {@code CompletionRecord} exists
 * per occurrence -- enforced at the database level by a {@code UNIQUE} constraint on
 * {@code planned_occurrence_id} -- so "complete" is create-or-update (idempotent, see
 * {@code PlanService#complete}, PLANNER-004-AC-22/AC-23) rather than ever producing a duplicate row.
 * Deleting the parent {@code PlannedOccurrence} row cascade-deletes this record via
 * {@code fk_completion_records_planned_occurrence}'s {@code ON DELETE CASCADE}
 * (PLANNER-004-AC-34), and transitively so does deleting the grandparent {@code Activity}/
 * {@code SubTask}.
 */
@Entity
@Table(name = "completion_records")
public class CompletionRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "planned_occurrence_id", nullable = false, unique = true)
    private PlannedOccurrence plannedOccurrence;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected CompletionRecord() {
        // JPA
    }

    public CompletionRecord(PlannedOccurrence plannedOccurrence, User owner, Instant completedAt) {
        this.plannedOccurrence = plannedOccurrence;
        this.owner = owner;
        this.completedAt = completedAt;
        this.createdAt = Instant.now();
    }

    public void recompleteAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public UUID getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public PlannedOccurrence getPlannedOccurrence() {
        return plannedOccurrence;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
