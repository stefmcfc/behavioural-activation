package uk.co.stefirby.behaviouralactivation.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * An explicit, per-date pin of a date's work-day status — the per-date-exception half of the hybrid
 * pattern/override design (planner_spec_021_work_day_marking.md). One row per
 * {@code (owner, date)}; when present, it always wins over whatever the owner's
 * {@link WorkDayPattern} would otherwise say for that date's day-of-week (PLANNER-021-AC-08).
 * {@code WorkDayService#setOverride} upserts by {@code (owner, date)} rather than ever inserting a
 * second row for the same pair (PLANNER-021-AC-09), backstopped by this table's own
 * unique {@code (user_id, date)} database constraint.
 */
@Entity
@Table(name = "work_day_overrides")
public class WorkDayOverride {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "work_day", nullable = false)
    private boolean workDay;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected WorkDayOverride() {
        // JPA
    }

    public WorkDayOverride(User owner, LocalDate date, boolean workDay) {
        this.owner = owner;
        this.date = date;
        this.workDay = workDay;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void update(boolean workDay) {
        this.workDay = workDay;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public LocalDate getDate() {
        return date;
    }

    public boolean isWorkDay() {
        return workDay;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
