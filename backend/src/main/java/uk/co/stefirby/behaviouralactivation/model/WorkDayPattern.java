package uk.co.stefirby.behaviouralactivation.model;

import jakarta.persistence.*;
import java.time.DayOfWeek;
import java.util.UUID;

/**
 * One day of the week the owner has marked as normally a work day — the recurring default half of
 * the hybrid pattern/override design (planner_spec_021_work_day_marking.md). One row per
 * {@code (owner, dayOfWeek)}; an owner with zero rows has no recurring work days, the safe, opt-in
 * default for a new user (PLANNER-021-AC-01). {@code WorkDayService#setPattern} always fully
 * replaces an owner's rows rather than editing them in place, so this entity carries no mutation
 * methods and no {@code createdAt}/{@code updatedAt} timestamps.
 */
@Entity
@Table(name = "work_day_patterns")
public class WorkDayPattern {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false)
    private DayOfWeek dayOfWeek;

    protected WorkDayPattern() {
        // JPA
    }

    public WorkDayPattern(User owner, DayOfWeek dayOfWeek) {
        this.owner = owner;
        this.dayOfWeek = dayOfWeek;
    }

    public UUID getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public DayOfWeek getDayOfWeek() {
        return dayOfWeek;
    }
}
