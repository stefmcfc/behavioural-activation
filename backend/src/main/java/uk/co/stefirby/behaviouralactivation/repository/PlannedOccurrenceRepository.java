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
}
