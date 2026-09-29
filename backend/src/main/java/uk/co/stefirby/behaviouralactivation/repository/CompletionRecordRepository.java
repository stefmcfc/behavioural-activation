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

    // Added for planner_spec_006_repeatable_activities.md's auto-archive check (PLANNER-006-AC-14/
    // AC-15) -- one query returning every CompletionRecord whose target occurrence's subTask id is
    // in the given set, across all weeks, not just the current one. PlanService reduces this to the
    // *set* of subTaskIds that have at least one completed occurrence and compares it against the
    // activity's full sub-task id set.
    List<CompletionRecord> findByOwnerAndPlannedOccurrence_SubTask_IdIn(User owner, List<UUID> subTaskIds);
}
