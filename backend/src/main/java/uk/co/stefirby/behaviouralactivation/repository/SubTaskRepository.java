package uk.co.stefirby.behaviouralactivation.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uk.co.stefirby.behaviouralactivation.model.SubTask;
import uk.co.stefirby.behaviouralactivation.model.User;

public interface SubTaskRepository extends JpaRepository<SubTask, UUID> {

    List<SubTask> findByActivityIdAndOwnerOrderByCreatedAtAsc(UUID activityId, User owner);

    Optional<SubTask> findByIdAndActivityIdAndOwner(UUID id, UUID activityId, User owner);

    // Added for planner_spec_004_week_planning.md's POST /api/v1/plan/occurrences -- that request
    // carries only a subTaskId (no activityId), so PlanService needs to resolve+own-check a
    // SubTask by id alone, unlike SubTaskService's activity-scoped lookups above.
    Optional<SubTask> findByIdAndOwner(UUID id, User owner);
}
