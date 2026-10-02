package uk.co.stefirby.behaviouralactivation.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * An entry in a user's activity bank (US-001) — reusable when planning a week. Every {@code Activity}
 * carries an owning {@link User} from creation, per the multi-user seam in
 * {@code .claude/steering/structure.md}.
 */
@Entity
@Table(name = "activities")
public class Activity {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActivityCategory category;

    @Column
    private String description;

    @Column(nullable = false)
    private boolean repeatable;

    @Column(nullable = false)
    private boolean archived;

    @Column(nullable = false)
    private boolean favourite;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Activity() {
        // JPA
    }

    // Unchanged signature -- defaults repeatable to true, matching the DB column default.
    public Activity(String name, ActivityCategory category, String description, User owner) {
        this(name, category, description, true, owner);
    }

    public Activity(String name, ActivityCategory category, String description, boolean repeatable, User owner) {
        this.name = name;
        this.category = category;
        this.description = description;
        this.repeatable = repeatable;
        this.archived = false;
        this.favourite = false;
        this.owner = owner;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    // Unchanged signature -- preserves the current repeatable value.
    public void update(String name, ActivityCategory category, String description) {
        update(name, category, description, this.repeatable);
    }

    public void update(String name, ActivityCategory category, String description, boolean repeatable) {
        this.name = name;
        this.category = category;
        this.description = description;
        this.repeatable = repeatable;
        this.updatedAt = Instant.now();
    }

    // The only two places archived is ever set -- never from update(...), never client-supplied
    // (PLANNER-006-AC-04).
    public void archive() {
        this.archived = true;
        this.updatedAt = Instant.now();
    }

    public void unarchive() {
        this.archived = false;
        this.updatedAt = Instant.now();
    }

    // The only two places favourite is ever set -- never from update(...), never client-supplied
    // (PLANNER-015-AC-01/AC-02), fully orthogonal to archived (PLANNER-015-AC-09).
    public void markFavourite() {
        this.favourite = true;
        this.updatedAt = Instant.now();
    }

    public void unmarkFavourite() {
        this.favourite = false;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
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

    public String getDescription() {
        return description;
    }

    public boolean isRepeatable() {
        return repeatable;
    }

    public boolean isArchived() {
        return archived;
    }

    public boolean isFavourite() {
        return favourite;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
