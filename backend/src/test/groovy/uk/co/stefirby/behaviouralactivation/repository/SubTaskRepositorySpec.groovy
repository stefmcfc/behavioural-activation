package uk.co.stefirby.behaviouralactivation.repository

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User

/**
 * Runs against the real Postgres instance (docker-compose, via V003__create_sub_tasks_table.sql's
 * ON DELETE CASCADE) -- PLANNER-003-AC-17 is a database-level guarantee, not application code, so a
 * mocked repository cannot verify it. PLANNER-003-AC-18 is similarly verified by reloading a
 * persisted row rather than trusting the in-memory constructor argument.
 */
@SpringBootTest
class SubTaskRepositorySpec extends Specification {

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    SubTaskRepository subTaskRepository

    User owner

    def setup() {
        owner = userRepository.save(new User("subtask-cascade-test-${UUID.randomUUID()}", "hashed-password"))
    }

    def cleanup() {
        userRepository.delete(owner)
    }

    def "PLANNER-003-AC-17: deleting the parent activity cascade-deletes its sub-tasks"() {
        given: "an activity with one sub-task"
            def activity = activityRepository.save(
                new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
            subTaskRepository.save(new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))

        when: "the parent activity is deleted"
            activityRepository.delete(activity)

        then: "the sub-task row is gone too, without SubTaskService/ActivityService deleting it explicitly"
            subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(activity.id, owner).isEmpty()
    }

    def "PLANNER-003-AC-18: a persisted SubTask carries its own owner directly, independent of activity.owner"() {
        given: "an activity and a sub-task, both owned by the same user"
            def activity = activityRepository.save(
                new Activity("Read a book", ActivityCategory.PLEASURABLE, null, owner))
            def subTask = subTaskRepository.save(
                new SubTask(activity, "Choose a book", ActivityCategory.PLEASURABLE, owner))

        when: "the sub-task is reloaded from the database"
            def reloaded = subTaskRepository.findById(subTask.id).get()

        then: "its owner is the persisted user_id column, reachable without traversing activity.owner"
            reloaded.owner.id == owner.id

        cleanup:
            subTaskRepository.delete(subTask)
            activityRepository.delete(activity)
    }

    def "PLANNER-012-AC-02: countByActivityIdAndOwner never counts another user's sub-tasks against this activity"() {
        given: "a second owner, unrelated to the one from setup()"
            def otherOwner = userRepository.save(new User("subtask-count-test-${UUID.randomUUID()}", "hashed-password"))

        and: "that owner's activity has two sub-tasks"
            def activity = activityRepository.save(
                new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, otherOwner))
            subTaskRepository.save(new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, otherOwner))
            subTaskRepository.save(new SubTask(activity, "Book a venue", ActivityCategory.PLEASURABLE, otherOwner))

        expect: "the count is correct for the owning user"
            subTaskRepository.countByActivityIdAndOwner(activity.id, otherOwner) == 2

        and: "a different user querying the same activity id sees zero, not the other owner's count"
            subTaskRepository.countByActivityIdAndOwner(activity.id, owner) == 0

        cleanup:
            activityRepository.delete(activity)
            userRepository.delete(otherOwner)
    }

    def "PLANNER-018-AC-01: findByOwner returns every sub-task across all of the owner's activities"() {
        given: "two activities owned by this spec's owner, each with a sub-task"
            def activity = activityRepository.save(
                new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
            def otherActivity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            def guestList = subTaskRepository.save(
                new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
            def chooseRoute = subTaskRepository.save(
                new SubTask(otherActivity, "Choose a route", ActivityCategory.ROUTINE, owner))

        expect: "both sub-tasks, across both activities, are returned"
            subTaskRepository.findByOwner(owner)*.id.toSet() == [guestList.id, chooseRoute.id].toSet()

        cleanup:
            activityRepository.delete(activity)
            activityRepository.delete(otherActivity)
    }

    def "PLANNER-018-AC-02: findByOwner never includes another user's sub-tasks"() {
        given: "a second owner, unrelated to the one from setup(), with their own sub-task"
            def otherOwner = userRepository.save(new User("subtask-bulk-test-${UUID.randomUUID()}", "hashed-password"))
            def otherActivity = activityRepository.save(
                new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, otherOwner))
            subTaskRepository.save(new SubTask(otherActivity, "Create a guest list", ActivityCategory.PLEASURABLE, otherOwner))

        expect: "this spec's owner, who has no sub-tasks of their own, sees an empty list, not the other owner's"
            subTaskRepository.findByOwner(owner).isEmpty()

        cleanup:
            activityRepository.delete(otherActivity)
            userRepository.delete(otherOwner)
    }

    def "PLANNER-018-AC-04: countGroupedByActivityIdForOwner groups counts by activityId, owner-scoped"() {
        given: "two of this spec's owner's activities, with two and zero sub-tasks respectively"
            def activityWithTwo = activityRepository.save(
                new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
            def activityWithZero = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            subTaskRepository.save(new SubTask(activityWithTwo, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
            subTaskRepository.save(new SubTask(activityWithTwo, "Book a venue", ActivityCategory.PLEASURABLE, owner))

        and: "a second owner's activity, also with a sub-task"
            def otherOwner = userRepository.save(new User("subtask-grouped-count-test-${UUID.randomUUID()}", "hashed-password"))
            def otherActivity = activityRepository.save(
                new Activity("Read a book", ActivityCategory.PLEASURABLE, null, otherOwner))
            subTaskRepository.save(new SubTask(otherActivity, "Choose a book", ActivityCategory.PLEASURABLE, otherOwner))

        when: "counts are grouped by activityId for this spec's owner"
            def counts = subTaskRepository.countGroupedByActivityIdForOwner(owner)

        then: "only the owner's own activity with at least one sub-task appears, with the correct count"
            counts.size() == 1
            counts[0].activityId() == activityWithTwo.id
            counts[0].count() == 2L

        and: "the activity with zero sub-tasks, and the other owner's activity, are both absent"
            !counts*.activityId().contains(activityWithZero.id)
            !counts*.activityId().contains(otherActivity.id)

        cleanup:
            activityRepository.delete(activityWithTwo)
            activityRepository.delete(activityWithZero)
            activityRepository.delete(otherActivity)
            userRepository.delete(otherOwner)
    }
}
