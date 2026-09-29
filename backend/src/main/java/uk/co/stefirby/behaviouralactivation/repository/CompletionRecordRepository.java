package uk.co.stefirby.behaviouralactivation.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uk.co.stefirby.behaviouralactivation.model.CompletionRecord;
import uk.co.stefirby.behaviouralactivation.model.User;

public interface CompletionRecordRepository extends JpaRepository<CompletionRecord, UUID> {

    Optional<CompletionRecord> findByPlannedOccurrenceIdAndOwner(UUID plannedOccurrenceId, User owner);

    // Bulk lookup for PlanController's GET /api/v1/plan response mapping -- one query for the
    // whole week's occurrences, not one per occurrence (avoids N+1).
    List<CompletionRecord> findByOwnerAndPlannedOccurrenceIdIn(User owner, List<UUID> plannedOccurrenceIds);
}
