package uk.co.stefirby.behaviouralactivation.repository

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.CompletionRecord
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence
import uk.co.stefirby.behaviouralactivation.model.PlanSlot
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate

/**
 * Runs against the real Postgres instance (docker-compose, via
 * V005__create_completion_records_table.sql's ON DELETE CASCADE) -- PLANNER-004-AC-34 is a
 * database-level guarantee, not application code, so a mocked repository cannot verify it.
 */
@SpringBootTest
class CompletionRecordRepositorySpec extends Specification {

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    SubTaskRepository subTaskRepository

    @Autowired
    PlannedOccurrenceRepository plannedOccurrenceRepository

    @Autowired
    CompletionRecordRepository completionRecordRepository

    User owner
    LocalDate monday = LocalDate.of(2026, 10, 5)

    def setup() {
        owner = userRepository.save(new User("completion-cascade-test-${UUID.randomUUID()}", "hashed-password"))
    }

    def cleanup() {
        userRepository.delete(owner)
    }

    def "PLANNER-004-AC-34: deleting a PlannedOccurrence cascade-deletes its CompletionRecord"() {
        given: "a scheduled, completed occurrence"
            def activity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            def occurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                    DayOfWeek.MONDAY, PlanSlot.MORNING, owner))
            completionRecordRepository.save(new CompletionRecord(occurrence, owner, Instant.now()))

        when: "the planned occurrence is deleted"
            plannedOccurrenceRepository.delete(occurrence)

        then: "the completion record row is gone too, without PlanService deleting it explicitly"
            completionRecordRepository.findByPlannedOccurrenceIdAndOwner(occurrence.id, owner).isEmpty()

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-004-AC-34: deleting the grandparent Activity transitively cascade-deletes the CompletionRecord too"() {
        given: "a scheduled, completed occurrence"
            def activity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            def occurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                    DayOfWeek.MONDAY, PlanSlot.MORNING, owner))
            completionRecordRepository.save(new CompletionRecord(occurrence, owner, Instant.now()))

        when: "the grandparent activity is deleted"
            activityRepository.delete(activity)

        then: "both the occurrence and its completion record are gone"
            plannedOccurrenceRepository.findById(occurrence.id).isEmpty()
            completionRecordRepository.findByPlannedOccurrenceIdAndOwner(occurrence.id, owner).isEmpty()
    }

    def "PLANNER-004-AC-35: a saved CompletionRecord persists its own owner reference directly"() {
        given: "a scheduled occurrence"
            def activity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            def occurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                    DayOfWeek.MONDAY, PlanSlot.MORNING, owner))

        when: "a completion record is saved for it"
            def saved = completionRecordRepository.save(new CompletionRecord(occurrence, owner, Instant.now()))

        then: "the persisted record carries its own owner reference"
            completionRecordRepository.findById(saved.id).get().owner.id == owner.id

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-027-AC-06: countByOwnerAndPlannedOccurrence_Activity_Id/countByOwnerAndPlannedOccurrence_SubTask_Activity_Id count direct and sub-task-routed completions independently"() {
        given: "a directly-completed occurrence and a sub-task occurrence with no completion"
            def activity = activityRepository.save(
                new Activity("Deep clean the kitchen", ActivityCategory.NECESSARY, null, owner))
            def subTask = subTaskRepository.save(
                new SubTask(activity, "Clean the oven", ActivityCategory.NECESSARY, owner))
            def directOccurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.NECESSARY, monday,
                    DayOfWeek.MONDAY, PlanSlot.MORNING, owner))
            plannedOccurrenceRepository.save(
                new PlannedOccurrence(null, subTask, ActivityCategory.NECESSARY, monday, null, null, owner))
            completionRecordRepository.save(new CompletionRecord(directOccurrence, owner, Instant.now()))

        expect: "completionCount reports only the completed, directly-targeted occurrence"
            completionRecordRepository.countByOwnerAndPlannedOccurrence_Activity_Id(owner, activity.id) == 1L
            completionRecordRepository.countByOwnerAndPlannedOccurrence_SubTask_Activity_Id(owner, activity.id) == 0L

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-027-AC-07: both completion count queries report zero for an activity with no completion records"() {
        given: "an activity with no occurrences at all"
            def activity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.PLEASURABLE, null, owner))

        expect: "both counts are zero"
            completionRecordRepository.countByOwnerAndPlannedOccurrence_Activity_Id(owner, activity.id) == 0L
            completionRecordRepository.countByOwnerAndPlannedOccurrence_SubTask_Activity_Id(owner, activity.id) == 0L

        cleanup:
            activityRepository.delete(activity)
    }
}
