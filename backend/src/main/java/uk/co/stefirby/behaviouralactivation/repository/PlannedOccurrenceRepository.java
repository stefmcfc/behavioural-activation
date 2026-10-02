package uk.co.stefirby.behaviouralactivation.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence;
import uk.co.stefirby.behaviouralactivation.model.User;

public interface PlannedOccurrenceRepository extends JpaRepository<PlannedOccurrence, UUID> {

    // planner_spec_017_plan_response_n_plus_one.md (PLANNER-017-AC-01) -- a derived-query method
    // name can't express a JOIN FETCH, so this is a custom @Query, the "real complexity/scale
    // reason" structure.md's "no custom @Query methods unless..." caveat anticipates. LEFT (not
    // inner) JOIN FETCH across all three relationships: an occurrence has exactly one of
    // activity/subTask set, never both, so an inner join on either would silently drop rows.
    // Backs PlanController.getWeek's response mapping, which otherwise triggers one extra SELECT per
    // occurrence.getActivity()/getSubTask() access, plus one more per sub-task's
    // getActivity() -- an N+1 that used to scale linearly with the week's occurrence count.
    @Query("SELECT o FROM PlannedOccurrence o "
        + "LEFT JOIN FETCH o.activity "
        + "LEFT JOIN FETCH o.subTask st "
        + "LEFT JOIN FETCH st.activity "
        + "WHERE o.owner = :owner AND o.weekStart = :weekStart "
        + "ORDER BY o.createdAt ASC")
    List<PlannedOccurrence> findByOwnerAndWeekStartOrderByCreatedAtAsc(
        @Param("owner") User owner, @Param("weekStart") LocalDate weekStart);

    Optional<PlannedOccurrence> findByIdAndOwner(UUID id, User owner);

    long countByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNull(User owner, LocalDate weekStart);

    // PLANNER-017-AC-03 -- identical JOIN FETCH treatment for PlanService.reorderBucket's result set
    // (planner_spec_010_bucket_reordering.md's origin query), fixing the same N+1 on the lower-
    // frequency bucket-reorder write path.
    @Query("SELECT o FROM PlannedOccurrence o "
        + "LEFT JOIN FETCH o.activity "
        + "LEFT JOIN FETCH o.subTask st "
        + "LEFT JOIN FETCH st.activity "
        + "WHERE o.owner = :owner AND o.weekStart = :weekStart "
        + "AND o.dayOfWeek IS NULL AND o.slot IS NULL "
        + "ORDER BY o.bucketPosition ASC")
    List<PlannedOccurrence> findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc(
        @Param("owner") User owner, @Param("weekStart") LocalDate weekStart);

    // planner_spec_011_bucket_carry_forward_automation.md's stale-bucket-item detection -- bucket
    // items only (dayOfWeek/slot both null, PLANNER-011-AC-03); grid-scheduled occurrences are never
    // selected by this query, regardless of how old their weekStart is (PLANNER-011-AC-12).
    List<PlannedOccurrence> findByOwnerAndDayOfWeekIsNullAndSlotIsNullAndWeekStartBefore(
        User owner, LocalDate weekStart);
}
