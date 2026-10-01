package uk.co.stefirby.behaviouralactivation.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence;
import uk.co.stefirby.behaviouralactivation.model.User;

public interface PlannedOccurrenceRepository extends JpaRepository<PlannedOccurrence, UUID> {

    List<PlannedOccurrence> findByOwnerAndWeekStartOrderByCreatedAtAsc(User owner, LocalDate weekStart);

    Optional<PlannedOccurrence> findByIdAndOwner(UUID id, User owner);

    long countByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNull(User owner, LocalDate weekStart);

    List<PlannedOccurrence> findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc(
        User owner, LocalDate weekStart);

    // planner_spec_011_bucket_carry_forward_automation.md's stale-bucket-item detection -- bucket
    // items only (dayOfWeek/slot both null, PLANNER-011-AC-03); grid-scheduled occurrences are never
    // selected by this query, regardless of how old their weekStart is (PLANNER-011-AC-12).
    List<PlannedOccurrence> findByOwnerAndDayOfWeekIsNullAndSlotIsNullAndWeekStartBefore(
        User owner, LocalDate weekStart);
}
