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
            subTaskRepository.findByActivityIdAndOwnerOrderByCreatedAtAsc(activity.id, owner).isEmpty()
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
}
