package uk.co.stefirby.behaviouralactivation.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceMoveRequest
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceRequest
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.PlanSlot
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Runs against the real Postgres instance (docker-compose), not a mocked repository --
 * planner_spec_008_occurrence_detail_card.md's own implementation note flags that
 * {@code SubTask.activity} is itself a LAZY {@code @ManyToOne} association, one hop further out than
 * {@code PlanService.initializeTarget(...)} force-initialized before this spec. A mocked repository
 * would hand back a plain in-memory {@code SubTask} whose {@code activity} reference is never a real
 * Hibernate proxy, so it could never catch a missing {@code Hibernate.initialize(...)} call the way a
 * real, transaction-bound proxy does once the owning {@code PlanService} method has returned. Mirrors
 * {@code PlanServiceAutoArchiveIntegrationSpec}'s precedent of a real-Postgres companion spec for
 * behaviour a mock can't verify.
 */
@SpringBootTest
class PlanServiceSubTaskParentNameIntegrationSpec extends Specification {

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
    Activity activity
    SubTask subTask
    LocalDate monday = LocalDate.of(2026, 10, 5)

    def setup() {
        owner = userRepository.save(new User("sub-task-parent-name-test-${UUID.randomUUID()}", "hashed-password"))
        activity = activityRepository.save(
            new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
        subTask = subTaskRepository.save(
            new SubTask(activity, "Chapter one", activity.category, owner))
    }

    def cleanup() {
        activityRepository.delete(activity)
        userRepository.delete(owner)
    }

    def "PLANNER-008-AC-04: getWeek() initializes a sub-task occurrence's parent activity without LazyInitializationException"() {
        given: "a sub-task planned this week, against real Postgres"
            planService.create(owner.username,
                new PlannedOccurrenceRequest(null, subTask.id, monday, DayOfWeek.MONDAY, PlanSlot.MORNING))

        when: "the week is fetched, and the nested parent activity is read outside getWeek()'s own transaction"
            def occurrences = planService.getWeek(owner.username, monday)
            def parentActivityName = occurrences.find { it.subTask != null }.subTask.activity.name

        then: "no LazyInitializationException is thrown, and the correct parent activity name is returned"
            noExceptionThrown()
            parentActivityName == activity.name
    }

    def "PLANNER-008-AC-05: create() initializes a new sub-task occurrence's parent activity without LazyInitializationException"() {
        when: "a sub-task is planned via create(), and its parent activity is read outside that transaction"
            def occurrence = planService.create(owner.username,
                new PlannedOccurrenceRequest(null, subTask.id, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()
            def parentActivityName = occurrence.subTask.activity.name

        then: "no LazyInitializationException is thrown, and the correct parent activity name is returned"
            noExceptionThrown()
            parentActivityName == activity.name
    }

    def "PLANNER-008-AC-06: move() initializes a moved sub-task occurrence's parent activity without LazyInitializationException"() {
        given: "a sub-task occurrence already sitting in the weekend bucket"
            def created = planService.create(owner.username,
                new PlannedOccurrenceRequest(null, subTask.id, monday, null, null)).get()

        when: "it is moved into a grid slot, and its parent activity is read outside that transaction"
            def moved = planService.move(owner.username, created.id,
                new PlannedOccurrenceMoveRequest(DayOfWeek.MONDAY, PlanSlot.MORNING)).get()
            def parentActivityName = moved.subTask.activity.name

        then: "no LazyInitializationException is thrown, and the correct parent activity name is returned"
            noExceptionThrown()
            parentActivityName == activity.name
    }

    def "PLANNER-008-AC-07: complete() initializes a completed sub-task occurrence's parent activity without LazyInitializationException"() {
        given: "a sub-task occurrence planned this week"
            def created = planService.create(owner.username,
                new PlannedOccurrenceRequest(null, subTask.id, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()

        when: "it is completed, and its parent activity is read outside that transaction"
            def completion = planService.complete(owner.username, created.id).get()
            def parentActivityName = completion.plannedOccurrence.subTask.activity.name

        then: "no LazyInitializationException is thrown, and the correct parent activity name is returned"
            noExceptionThrown()
            parentActivityName == activity.name
    }

    def "PLANNER-008-AC-08: carryForward() initializes a carried-forward sub-task occurrence's parent activity without LazyInitializationException"() {
        given: "an incomplete sub-task occurrence in the weekend bucket"
            def created = planService.create(owner.username,
                new PlannedOccurrenceRequest(null, subTask.id, monday, null, null)).get()

        when: "it is carried forward, and its parent activity is read outside that transaction"
            def carried = planService.carryForward(owner.username, created.id).get()
            def parentActivityName = carried.subTask.activity.name

        then: "no LazyInitializationException is thrown, and the correct parent activity name is returned"
            noExceptionThrown()
            parentActivityName == activity.name
    }
}
