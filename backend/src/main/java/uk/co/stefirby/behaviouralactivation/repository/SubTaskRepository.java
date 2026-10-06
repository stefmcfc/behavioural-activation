package uk.co.stefirby.behaviouralactivation.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uk.co.stefirby.behaviouralactivation.model.SubTask;
import uk.co.stefirby.behaviouralactivation.model.User;

public interface SubTaskRepository extends JpaRepository<SubTask, UUID> {

    // planner_spec_023_subtask_reordering.md (PLANNER-023-AC-03) -- renamed from
    // findByActivityIdAndOwnerOrderByCreatedAtAsc now that sub-tasks carry a persisted manual
    // position; ordering by createdAt is no longer true of the shipped system.
    List<SubTask> findByActivityIdAndOwnerOrderByPositionAsc(UUID activityId, User owner);

    Optional<SubTask> findByIdAndActivityIdAndOwner(UUID id, UUID activityId, User owner);

    // Added for planner_spec_004_week_planning.md's POST /api/v1/plan/occurrences -- that request
    // carries only a subTaskId (no activityId), so PlanService needs to resolve+own-check a
    // SubTask by id alone, unlike SubTaskService's activity-scoped lookups above.
    Optional<SubTask> findByIdAndOwner(UUID id, User owner);

    // Added for planner_spec_012_subtask_count.md -- ActivityResponse.subTaskCount, owner-scoped
    // like every other query here (PLANNER-012-AC-02). Reused by planner_spec_023_subtask_reordering.md
    // (PLANNER-023-AC-04) as the new sub-task's append-at-end position.
    long countByActivityIdAndOwner(UUID activityId, User owner);

    // planner_spec_023_subtask_reordering.md (PLANNER-023-AC-09) -- the bulk fetch backing
    // SubTaskService.reorder(). Scoped by activityId (not just owner) so an id belonging to a
    // different activity, or a different owner, simply isn't found -- collapsing into the same 404
    // as any other not-found/not-yours case, with no separate "wrong activity" 409 needed (see the
    // spec's Overview).
    List<SubTask> findByIdInAndActivityIdAndOwner(Collection<UUID> ids, UUID activityId, User owner);

    // planner_spec_018_bulk_sub_task_fetch.md (PLANNER-018-AC-01/AC-02) -- backs the new
    // GET /api/v1/sub-tasks bulk endpoint: every sub-task owned by the authenticated user, across
    // all of their activities, in one query.
    List<SubTask> findByOwner(User owner);

    // planner_spec_018_bulk_sub_task_fetch.md (PLANNER-018-AC-04) -- a derived-query method name
    // can't express a GROUP BY, so this is a custom @Query, the "real complexity/scale reason"
    // structure.md's "no custom @Query methods unless..." caveat anticipates. Replaces
    // ActivityService.listForOwner's former one-countByActivityIdAndOwner-call-per-activity loop
    // with a single bulk query. Only activities with at least one sub-task appear in the result --
    // callers must default missing activityIds to zero.
    @Query("SELECT new uk.co.stefirby.behaviouralactivation.repository.SubTaskCountProjection("
        + "s.activity.id, COUNT(s)) "
        + "FROM SubTask s WHERE s.owner = :owner GROUP BY s.activity.id")
    List<SubTaskCountProjection> countGroupedByActivityIdForOwner(@Param("owner") User owner);
}
