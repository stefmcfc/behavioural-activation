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

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Activity() {
        // JPA
    }

    public Activity(String name, ActivityCategory category, String description, User owner) {
        this.name = name;
        this.category = category;
        this.description = description;
        this.owner = owner;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void update(String name, ActivityCategory category, String description) {
        this.name = name;
        this.category = category;
        this.description = description;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
