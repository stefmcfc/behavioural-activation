package uk.co.stefirby.behaviouralactivation.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.PlanSlot
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceRequest

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Runs against the real Postgres instance (docker-compose), not a mocked repository --
 * planner_spec_006_repeatable_activities.md's own implementation note flags PLANNER-006-AC-15's
 * "complete the last of N sub-tasks" case as exactly the scenario where a mocked
 * CompletionRecordRepository can't prove the *within-the-same-transaction* flush/visibility timing
 * actually works: the CompletionRecord for the sub-task being completed right now is saved by
 * upsertCompletion(...) earlier in PlanService.complete(), and maybeAutoArchive's own query
 * (findByOwnerAndPlannedOccurrence_SubTask_IdIn) must see it without an explicit flush() call,
 * relying on Hibernate's default FlushModeType.AUTO. Mirrors CompletionRecordRepositorySpec's
 * precedent of a real-Postgres companion spec for behaviour a mock can't verify.
 */
@SpringBootTest
class PlanServiceAutoArchiveIntegrationSpec extends Specification {

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    SubTaskRepository subTaskRepository

    @Autowired
    PlannedOccurrenceRepository plannedOccurrenceRepository

    @Autowired
    PlanService planService

    User owner
    LocalDate monday = LocalDate.of(2026, 10, 5)

    def setup() {
        owner = userRepository.save(new User("auto-archive-test-${UUID.randomUUID()}", "hashed-password"))
    }

    def cleanup() {
        userRepository.delete(owner)
    }

    def "PLANNER-006-AC-14/AC-15: completing the last of N sub-tasks archives the parent in that same request"() {
        given: "a non-repeatable activity with two sub-tasks, one already completed"
            def activity = activityRepository.save(
                new Activity("Organise a leaving party", ActivityCategory.PLEASURABLE, null, false, owner))
            def firstSubTask = subTaskRepository.save(
                new SubTask(activity, "Book a venue", activity.category, owner))
            def secondSubTask = subTaskRepository.save(
                new SubTask(activity, "Send invitations", activity.category, owner))

            def firstOccurrence = planService.create(owner.username,
                new PlannedOccurrenceRequest(null, firstSubTask.id, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()
            def secondOccurrence = planService.create(owner.username,
                new PlannedOccurrenceRequest(null, secondSubTask.id, monday, DayOfWeek.TUESDAY, PlanSlot.MORNING)).get()

            planService.complete(owner.username, firstOccurrence.id)

        expect: "the activity is not yet archived after only the first sub-task completes"
            !activityRepository.findById(activity.id).get().archived

        when: "the second (last remaining) sub-task's occurrence is completed"
            def result = planService.complete(owner.username, secondOccurrence.id)

        then: "the completion succeeds, and the parent activity is archived in that same request"
            result.isPresent()
            activityRepository.findById(activity.id).get().archived

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-006-AC-13: completing a no-sub-tasks activity's own occurrence auto-archives it against real Postgres"() {
        given: "a non-repeatable activity with no sub-tasks, planned this week"
            def activity = activityRepository.save(
                new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner))
            def occurrence = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()

        when: "the occurrence is completed"
            def result = planService.complete(owner.username, occurrence.id)

        then: "the response succeeds and the activity is now archived"
            result.isPresent()
            activityRepository.findById(activity.id).get().archived

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-006-AC-17: a repeatable activity never auto-archives against real Postgres"() {
        given: "a repeatable activity with no sub-tasks"
            def activity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.PLEASURABLE, null, true, owner))
            def occurrence = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()

        when: "the occurrence is completed"
            planService.complete(owner.username, occurrence.id)

        then: "the activity is still not archived"
            !activityRepository.findById(activity.id).get().archived

        cleanup:
            activityRepository.delete(activity)
    }
}
