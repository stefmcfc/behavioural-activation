package uk.co.stefirby.behaviouralactivation.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * One checklist item under a parent {@link Activity} — lets a large or daunting activity be broken
 * down into smaller, more approachable steps. One level deep only: a {@code SubTask} belongs to
 * exactly one {@link Activity} and has no self-referential nesting of its own. Carries its own
 * {@link User} owner directly (not just reachable via {@code activity.getOwner()}), per the
 * multi-user owner seam in {@code .claude/steering/structure.md} (PLANNER-003-AC-18). {@code
 * category} is copied from the parent {@code Activity} at creation time (PLANNER-003-AC-02), and —
 * as of {@code planner_spec_014_subtask_category_cascade.md}, superseding the original
 * PLANNER-003-AC-20 snapshot-forever behavior — is cascaded to the parent's current value whenever
 * {@code ActivityService.update()} changes it (PLANNER-014-AC-01), via {@link #recategorize}.
 */
@Entity
@Table(name = "sub_tasks")
public class SubTask {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id", nullable = false)
    private Activity activity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActivityCategory category;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SubTask() {
        // JPA
    }

    public SubTask(Activity activity, String name, ActivityCategory category, User owner) {
        this.activity = activity;
        this.name = name;
        this.category = category;
        this.owner = owner;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void rename(String name) {
        this.name = name;
        this.updatedAt = Instant.now();
    }

    // PLANNER-014-AC-01 -- called from ActivityService.update() when the parent Activity's category
    // changes, cascading that new value to every existing sub-task. Same pattern as rename().
    public void recategorize(ActivityCategory category) {
        this.category = category;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Activity getActivity() {
        return activity;
    }

    public User getOwner() {
        return owner;
    }

    public String getName() {
        return name;
    }

    public ActivityCategory getCategory() {
        return category;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
