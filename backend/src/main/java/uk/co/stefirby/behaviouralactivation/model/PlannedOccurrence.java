package uk.co.stefirby.behaviouralactivation.model;

import jakarta.persistence.*;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One planned instance of an {@link Activity} or {@link SubTask} against a specific week — either
 * scheduled into a {@code dayOfWeek}+{@code slot} pair, or sitting in the flexible weekend bucket
 * ({@code dayOfWeek}/{@code slot} both null). Exactly one of {@code activity}/{@code subTask} is
 * set, enforced at the database level by {@code chk_planned_occurrences_exactly_one_target}
 * (PLANNER-004-AC-11) in addition to application-level validation in {@code PlanService}
 * (PLANNER-004-AC-10). {@code category} is copied from the referenced {@code Activity}/{@code
 * SubTask} once, at creation time, and never updated again — a snapshot, not a live reference
 * (PLANNER-004-AC-08), mirroring {@code SubTask}'s own category-snapshot precedent. Unlike {@code
 * category}, {@code name} is deliberately NOT snapshotted here — it is resolved live from the
 * linked {@code Activity}/{@code SubTask} at response-mapping time (see {@code PlanController}).
 */
@Entity
@Table(name = "planned_occurrences")
public class PlannedOccurrence {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_id")
    private Activity activity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sub_task_id")
    private SubTask subTask;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActivityCategory category;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week")
    private DayOfWeek dayOfWeek;

    @Enumerated(EnumType.STRING)
    private PlanSlot slot;

    @Column(name = "bucket_position")
    private Integer bucketPosition;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PlannedOccurrence() {
        // JPA
    }

    public PlannedOccurrence(Activity activity, SubTask subTask, ActivityCategory category,
            LocalDate weekStart, DayOfWeek dayOfWeek, PlanSlot slot, User owner) {
        this.activity = activity;
        this.subTask = subTask;
        this.category = category;
        this.weekStart = weekStart;
        this.dayOfWeek = dayOfWeek;
        this.slot = slot;
        this.owner = owner;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void assignSlot(DayOfWeek dayOfWeek, PlanSlot slot) {
        this.dayOfWeek = dayOfWeek;
        this.slot = slot;
        this.bucketPosition = null; // PLANNER-010-AC-06 -- no longer a bucket item
        this.updatedAt = Instant.now();
    }

    public void moveToBucket() {
        this.dayOfWeek = null;
        this.slot = null;
        this.updatedAt = Instant.now();
    }

    public void carryForward() {
        this.weekStart = this.weekStart.plusDays(7);
        this.bucketPosition = null; // PLANNER-010-AC-07 -- reset; caller re-appends in the new week
        this.updatedAt = Instant.now();
    }

    // Automatic-migration path (planner_spec_011_bucket_carry_forward_automation.md) -- distinct from
    // carryForward() above, which stays the manual +7-day single-step mechanism, unchanged. This jumps
    // directly to an arbitrary target week (the real current week, however many weeks away) in one
    // step, and resets bucketPosition (planner_spec_010_bucket_reordering.md) to null so the item is
    // treated as freshly appended to its new week's bucket order (PLANNER-011-AC-06/AC-07).
    public void autoCarryForwardTo(LocalDate newWeekStart) {
        this.weekStart = newWeekStart;
        this.bucketPosition = null;
        this.updatedAt = Instant.now();
    }

    public void assignBucketPosition(int bucketPosition) {
        this.bucketPosition = bucketPosition;
        this.updatedAt = Instant.now();
    }

    public boolean isBucketItem() {
        return dayOfWeek == null && slot == null;
    }

    public UUID getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public Activity getActivity() {
        return activity;
    }

    public SubTask getSubTask() {
        return subTask;
    }

    public ActivityCategory getCategory() {
        return category;
    }

    public LocalDate getWeekStart() {
        return weekStart;
    }

    public DayOfWeek getDayOfWeek() {
        return dayOfWeek;
    }

    public PlanSlot getSlot() {
        return slot;
    }

    public Integer getBucketPosition() {
        return bucketPosition;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
