package uk.co.stefirby.behaviouralactivation.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.dto.SubTaskReorderRequest
import uk.co.stefirby.behaviouralactivation.dto.SubTaskRequest
import uk.co.stefirby.behaviouralactivation.exception.InvalidSubTaskRequestException
import uk.co.stefirby.behaviouralactivation.exception.SubTaskReorderNotAllowedException
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

/**
 * Runs against the real Postgres instance (docker-compose) -- planner_spec_023_subtask_reordering.md's
 * own implementation note flags PLANNER-023-AC-01/AC-04/AC-05/AC-09/AC-10/AC-11 (plus AC-03/AC-08,
 * colocated here rather than given a third test class) as depending on real per-activity counts and
 * cross-row query/migration behaviour a mocked repository can't meaningfully prove, mirroring
 * PlanServiceBucketReorderIntegrationSpec.groovy's own setup()/cleanup() throwaway-User pattern.
 */
@SpringBootTest
class SubTaskServiceReorderIntegrationSpec extends Specification {

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    SubTaskRepository subTaskRepository

    @Autowired
    SubTaskService subTaskService

    User owner
    Activity activity

    def setup() {
        owner = userRepository.save(new User("subtask-reorder-test-${UUID.randomUUID()}", "hashed-password"))
        activity = activityRepository.save(new Activity("Go for a walk", ActivityCategory.PLEASURABLE, null, owner))
    }

    def cleanup() {
        activityRepository.delete(activity)
        userRepository.delete(owner)
    }

    // Note on deviation from the spec's own sketch: PLANNER-023-AC-01's stated rationale is the
    // Flyway migration's backfill of pre-existing rows, which isn't provable via a running
    // @SpringBootTest (migrations have already run once, at context startup, before any test method
    // executes) -- mirrors PLANNER-010-AC-01's own precedent of being "exercised implicitly" rather
    // than given a standalone backfill-ordering test. What *is* provable here, and is asserted below,
    // is that the position column round-trips as a real, non-null int once persisted via the normal
    // create path (AC-04 below already covers the append-at-end sequencing).
    def "PLANNER-023-AC-01: a persisted SubTask's position round-trips as a non-null int"() {
        when: "a sub-task is created and reloaded"
            def created = subTaskService.create(owner.username, activity.id, new SubTaskRequest("Create a guest list")).get()
            def reloaded = subTaskRepository.findById(created.id).get()

        then: "position is a real, persisted, non-null value"
            reloaded.position == 0
    }

    def "PLANNER-023-AC-03: listing returns sub-tasks ordered by position, not creation order"() {
        given: "two sub-tasks created in order, then reordered so the second-created is now first"
            def firstCreated = subTaskService.create(owner.username, activity.id, new SubTaskRequest("Created first")).get()
            def secondCreated = subTaskService.create(owner.username, activity.id, new SubTaskRequest("Created second")).get()
            subTaskService.reorder(owner.username, activity.id,
                new SubTaskReorderRequest([secondCreated.id, firstCreated.id]))

        when: "the checklist is listed"
            def listed = subTaskService.listForActivity(owner.username, activity.id).get()

        then: "the list reflects the reordered position, not creation order"
            listed*.id == [secondCreated.id, firstCreated.id]
    }

    def "PLANNER-023-AC-04: creating sub-tasks appends each one at the end of the checklist"() {
        when: "two sub-tasks are created in sequence"
            def first = subTaskService.create(owner.username, activity.id, new SubTaskRequest("First")).get()
            def second = subTaskService.create(owner.username, activity.id, new SubTaskRequest("Second")).get()

        then: "positions are appended in creation order"
            first.position == 0
            second.position == 1
    }

    def "PLANNER-023-AC-05: deleting a middle sub-task renumbers the remaining checklist contiguously"() {
        given: "three sub-tasks in order"
            def a = subTaskService.create(owner.username, activity.id, new SubTaskRequest("A")).get()
            def b = subTaskService.create(owner.username, activity.id, new SubTaskRequest("B")).get()
            def c = subTaskService.create(owner.username, activity.id, new SubTaskRequest("C")).get()

        when: "the middle sub-task is deleted"
            subTaskService.delete(owner.username, activity.id, b.id)

        then: "the remaining two are renumbered 0 and 1, preserving their relative order"
            def remaining = subTaskService.listForActivity(owner.username, activity.id).get()
            remaining*.id == [a.id, c.id]
            remaining*.position == [0, 1]
    }

    def "PLANNER-023-AC-08: a duplicate id in subTaskIds throws InvalidSubTaskRequestException"() {
        given: "one existing sub-task"
            def a = subTaskService.create(owner.username, activity.id, new SubTaskRequest("A")).get()

        when: "a reorder submits its id twice"
            subTaskService.reorder(owner.username, activity.id, new SubTaskReorderRequest([a.id, a.id]))

        then: "InvalidSubTaskRequestException is thrown"
            thrown(InvalidSubTaskRequestException)
    }

    def "PLANNER-023-AC-09: reordering with an id belonging to a different activity returns empty (404), applies no change"() {
        given: "a sub-task under a different activity owned by the same user, and one of this activity's own sub-tasks"
            def otherActivity = activityRepository.save(new Activity("Other activity", ActivityCategory.ROUTINE, null, owner))
            def foreign = subTaskService.create(owner.username, otherActivity.id, new SubTaskRequest("Foreign")).get()
            def mine = subTaskService.create(owner.username, activity.id, new SubTaskRequest("Mine")).get()

        when: "a reorder is submitted against activity.id including the foreign id"
            def result = subTaskService.reorder(owner.username, activity.id,
                new SubTaskReorderRequest([foreign.id, mine.id]))

        then: "the result is empty, and this activity's own sub-task is untouched"
            result.isEmpty()
            subTaskRepository.findById(mine.id).get().position == 0

        cleanup:
            activityRepository.delete(otherActivity)
    }

    def "PLANNER-023-AC-10: submitting a partial set of the checklist's sub-tasks throws 409"() {
        given: "two sub-tasks"
            def a = subTaskService.create(owner.username, activity.id, new SubTaskRequest("A")).get()
            subTaskService.create(owner.username, activity.id, new SubTaskRequest("B"))

        when: "only one of the two current ids is submitted"
            subTaskService.reorder(owner.username, activity.id, new SubTaskReorderRequest([a.id]))

        then: "SubTaskReorderNotAllowedException is thrown"
            thrown(SubTaskReorderNotAllowedException)
    }

    def "PLANNER-023-AC-11: reordering assigns 0..N-1 in the exact submitted order"() {
        given: "three sub-tasks in creation order"
            def a = subTaskService.create(owner.username, activity.id, new SubTaskRequest("A")).get()
            def b = subTaskService.create(owner.username, activity.id, new SubTaskRequest("B")).get()
            def c = subTaskService.create(owner.username, activity.id, new SubTaskRequest("C")).get()

        when: "they are reordered c, a, b"
            def reordered = subTaskService.reorder(owner.username, activity.id,
                new SubTaskReorderRequest([c.id, a.id, b.id])).get()

        then: "positions reflect the submitted order"
            reordered*.id == [c.id, a.id, b.id]
            reordered*.position == [0, 1, 2]
    }
}
