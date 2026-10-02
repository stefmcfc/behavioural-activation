package uk.co.stefirby.behaviouralactivation.repository

import jakarta.persistence.EntityManager
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence
import uk.co.stefirby.behaviouralactivation.model.PlanSlot
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Runs against the real Postgres instance (docker-compose, via
 * V004__create_planned_occurrences_table.sql's ON DELETE CASCADE and CHECK constraints) --
 * PLANNER-004-AC-11/AC-32/AC-33 are database-level guarantees, not application code, so a mocked
 * repository cannot verify them.
 */
@SpringBootTest
class PlannedOccurrenceRepositorySpec extends Specification {

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    SubTaskRepository subTaskRepository

    @Autowired
    PlannedOccurrenceRepository plannedOccurrenceRepository

    @Autowired
    EntityManager entityManager

    User owner
    LocalDate monday = LocalDate.of(2026, 10, 5)

    def setup() {
        owner = userRepository.save(new User("plan-cascade-test-${UUID.randomUUID()}", "hashed-password"))
    }

    def cleanup() {
        userRepository.delete(owner)
    }

    def "PLANNER-004-AC-32: deleting the parent activity cascade-deletes its planned occurrences"() {
        given: "an activity with one scheduled occurrence"
            def activity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                    DayOfWeek.MONDAY, PlanSlot.MORNING, owner))

        when: "the parent activity is deleted"
            activityRepository.delete(activity)

        then: "the planned occurrence row is gone too, without PlanService/ActivityService deleting it explicitly"
            plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, monday).isEmpty()
    }

    def "PLANNER-004-AC-33: deleting the parent sub-task cascade-deletes its planned occurrences"() {
        given: "a sub-task with one weekend-bucket occurrence"
            def activity = activityRepository.save(
                new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
            def subTask = subTaskRepository.save(
                new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
            plannedOccurrenceRepository.save(
                new PlannedOccurrence(null, subTask, ActivityCategory.PLEASURABLE, monday, null, null, owner))

        when: "the parent sub-task is deleted"
            subTaskRepository.delete(subTask)

        then: "the planned occurrence row is gone too, without PlanService/SubTaskService deleting it explicitly"
            plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, monday).isEmpty()

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-004-AC-11: the database rejects a row with both activity_id and sub_task_id set, bypassing PlanService"() {
        given: "an activity and a sub-task, both owned by the same user"
            def activity = activityRepository.save(
                new Activity("Read a book", ActivityCategory.PLEASURABLE, null, owner))
            def subTask = subTaskRepository.save(
                new SubTask(activity, "Chapter one", ActivityCategory.PLEASURABLE, owner))

        when: "an occurrence with both targets set is saved directly, bypassing PlanService's validation"
            plannedOccurrenceRepository.saveAndFlush(
                new PlannedOccurrence(activity, subTask, ActivityCategory.PLEASURABLE, monday, null, null, owner))

        then: "the database itself rejects it via the CHECK constraint"
            thrown(DataIntegrityViolationException)

        cleanup:
            subTaskRepository.delete(subTask)
            activityRepository.delete(activity)
    }

    def "PLANNER-004-AC-11: the database rejects a row with neither activity_id nor sub_task_id set"() {
        when: "an occurrence with no target set is saved directly"
            plannedOccurrenceRepository.saveAndFlush(
                new PlannedOccurrence(null, null, ActivityCategory.PLEASURABLE, monday, null, null, owner))

        then: "the database itself rejects it via the CHECK constraint"
            thrown(DataIntegrityViolationException)
    }

    def "PLANNER-017-AC-01: findByOwnerAndWeekStartOrderByCreatedAtAsc returns occurrences with activity/subTask/subTask.activity already initialized"() {
        given: "an activity-based and a sub-task-based occurrence for the same week"
            def activity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            def subTask = subTaskRepository.save(
                new SubTask(activity, "subtask 1", ActivityCategory.ROUTINE, owner))
            plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                    DayOfWeek.MONDAY, PlanSlot.MORNING, owner))
            plannedOccurrenceRepository.save(
                new PlannedOccurrence(null, subTask, ActivityCategory.ROUTINE, monday, null, null, owner))

        when: "fetched via the repository method, outside any further open Hibernate session"
            def results = plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, monday)
            entityManager.clear() // detach -- a lazy proxy would now throw if accessed

        then: "every relationship is already populated, no LazyInitializationException"
            results.find { it.activity != null }.activity.name == 'Go for a walk'
            def subTaskOccurrence = results.find { it.subTask != null }
            subTaskOccurrence.subTask.name == 'subtask 1'
            subTaskOccurrence.subTask.activity.name == 'Go for a walk'

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-017-AC-03: findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc also returns initialized relationships"() {
        given: "an activity-based and a sub-task-based occurrence, both sitting in the weekend bucket (dayOfWeek/slot both null)"
            def activity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            def subTask = subTaskRepository.save(
                new SubTask(activity, "subtask 1", ActivityCategory.ROUTINE, owner))
            def bucketActivityOccurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday, null, null, owner))
            bucketActivityOccurrence.assignBucketPosition(0)
            def bucketSubTaskOccurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(null, subTask, ActivityCategory.ROUTINE, monday, null, null, owner))
            bucketSubTaskOccurrence.assignBucketPosition(1)
            plannedOccurrenceRepository.flush()

        when: "fetched via the bucket-order repository method, outside any further open Hibernate session"
            def results = plannedOccurrenceRepository
                .findByOwnerAndWeekStartAndDayOfWeekIsNullAndSlotIsNullOrderByBucketPositionAsc(owner, monday)
            entityManager.clear() // detach -- a lazy proxy would now throw if accessed

        then: "every relationship is already populated, no LazyInitializationException"
            results.size() == 2
            results.find { it.activity != null }.activity.name == 'Go for a walk'
            def subTaskOccurrence = results.find { it.subTask != null }
            subTaskOccurrence.subTask.name == 'subtask 1'
            subTaskOccurrence.subTask.activity.name == 'Go for a walk'

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-019-AC-01: findByIdInAndOwner returns the matching occurrences with relationships already initialized"() {
        given: "an activity-based and a sub-task-based occurrence, both owned by this spec's owner"
            def activity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            def subTask = subTaskRepository.save(
                new SubTask(activity, "subtask 1", ActivityCategory.ROUTINE, owner))
            def activityOccurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday, null, null, owner))
            def subTaskOccurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(null, subTask, ActivityCategory.ROUTINE, monday, null, null, owner))

        when: "fetched by id via the new bulk method, outside any further open Hibernate session"
            def results = plannedOccurrenceRepository
                .findByIdInAndOwner([activityOccurrence.id, subTaskOccurrence.id], owner)
            entityManager.clear() // detach -- a lazy proxy would now throw if accessed

        then: "both are returned, with every relationship already populated"
            results.size() == 2
            results.find { it.activity != null }.activity.name == 'Go for a walk'
            results.find { it.subTask != null }.subTask.activity.name == 'Go for a walk'

        cleanup:
            activityRepository.delete(activity)
    }
}
