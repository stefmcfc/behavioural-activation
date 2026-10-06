package uk.co.stefirby.behaviouralactivation.service

import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.dto.SubTaskRequest
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

class SubTaskServiceSpec extends Specification {

    SubTaskRepository subTaskRepository = Mock()
    ActivityRepository activityRepository = Mock()
    UserRepository userRepository = Mock()
    SubTaskService service = new SubTaskService(subTaskRepository, activityRepository, userRepository)

    User owner = new User("steve", "hashed-password")
    User otherUser = new User("someone-else", "hashed-password")

    def "PLANNER-003-AC-02/AC-03: create copies the parent activity's category and assigns the owner from the resolved principal, never the request body"() {
        given: "the authenticated username resolves to a User who owns the parent activity"
            def activityId = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.of(activity)

        and: "the repository saves whatever sub-task it is given"
            SubTask savedArgument = null
            subTaskRepository.save(_ as SubTask) >> { SubTask s -> savedArgument = s; return s }

        when: "a sub-task is created under that activity"
            def result = service.create("steve", activityId, new SubTaskRequest("Create a guest list"))

        then: "the saved sub-task copies the parent's category and is owned by the resolved User"
            savedArgument.category == ActivityCategory.PLEASURABLE
            savedArgument.owner == owner
            savedArgument.activity == activity
            savedArgument.name == "Create a guest list"

        and: "the returned sub-task reflects the saved values"
            result.isPresent()
            result.get().category == ActivityCategory.PLEASURABLE
            result.get().owner == owner
    }

    def "PLANNER-003-AC-05/AC-19: create returns empty (404) when the parent activity doesn't exist or isn't owned by the caller"() {
        given: "the repository finds no owned activity for this id"
            def activityId = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.empty()

        when: "a sub-task creation is attempted"
            def result = service.create("steve", activityId, new SubTaskRequest("Sneaky sub-task"))

        then: "the result is empty, and nothing is saved"
            result.isEmpty()
            0 * subTaskRepository.save(_)
    }

    def "PLANNER-003-AC-07: listForActivity returns the parent activity's sub-tasks from the repository's owner-and-activity-scoped, createdAt-ordered query"() {
        given: "the authenticated username resolves to a User who owns the parent activity"
            def activityId = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.of(activity)

        and: "the repository returns sub-tasks for that activity and owner"
            def subTasks = [new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner)]
            subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(activityId, owner) >> subTasks

        when: "sub-tasks are listed for that activity"
            def result = service.listForActivity("steve", activityId)

        then: "the repository's result is returned unchanged"
            result.isPresent()
            result.get() == subTasks
    }

    def "PLANNER-003-AC-09: listForActivity returns a present but empty list when the activity has no sub-tasks"() {
        given: "an owned activity with no sub-tasks"
            def activityId = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def activity = new Activity("Read a book", ActivityCategory.PLEASURABLE, null, owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.of(activity)
            subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(activityId, owner) >> []

        when: "sub-tasks are listed"
            def result = service.listForActivity("steve", activityId)

        then: "the result is present (not a 404) but empty"
            result.isPresent()
            result.get().isEmpty()
    }

    def "PLANNER-003-AC-10/AC-19: listForActivity returns empty (404) when the parent activity doesn't exist or isn't owned by the caller"() {
        given: "the repository finds no owned activity for this id"
            def activityId = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.empty()

        when: "sub-tasks are listed"
            def result = service.listForActivity("steve", activityId)

        then: "the result is empty"
            result.isEmpty()
    }

    def "PLANNER-003-AC-11: update renames the owner's sub-task under the owned parent activity"() {
        given: "the authenticated username resolves to a User who owns the parent activity and the sub-task"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.of(activity)
            def existing = new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner)
            subTaskRepository.findByIdAndActivityIdAndOwner(id, activityId, owner) >> Optional.of(existing)

        when: "the sub-task is renamed"
            def result = service.update("steve", activityId, id, new SubTaskRequest("Create and send a guest list"))

        then: "the renamed sub-task is returned"
            result.isPresent()
            result.get().name == "Create and send a guest list"
    }

    def "PLANNER-003-AC-13/AC-19: update returns empty (404) when the parent activity isn't owned"() {
        given: "the repository finds no owned activity for this id"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.empty()

        when: "an update is attempted"
            def result = service.update("steve", activityId, id, new SubTaskRequest("New name"))

        then: "the result is empty"
            result.isEmpty()
            0 * subTaskRepository.findByIdAndActivityIdAndOwner(_, _, _)
    }

    def "PLANNER-003-AC-13/AC-19: update returns empty (404) when the sub-task id doesn't exist or isn't owned, even though the parent activity is owned"() {
        given: "the parent activity is owned, but no matching sub-task is found"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.of(activity)
            subTaskRepository.findByIdAndActivityIdAndOwner(id, activityId, owner) >> Optional.empty()

        when: "an update is attempted"
            def result = service.update("steve", activityId, id, new SubTaskRequest("New name"))

        then: "the result is empty"
            result.isEmpty()
    }

    def "PLANNER-003-AC-15: delete removes the owner's sub-task under the owned parent activity and returns true"() {
        given: "the parent activity and sub-task are both owned"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.of(activity)
            def existing = new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner)
            subTaskRepository.findByIdAndActivityIdAndOwner(id, activityId, owner) >> Optional.of(existing)

        and: "the PLANNER-023-AC-05 renumbering lookup after delete finds no remaining siblings"
            subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(activityId, owner) >> []

        when: "delete is requested"
            def deleted = service.delete("steve", activityId, id)

        then: "the repository deletes it"
            1 * subTaskRepository.delete(existing)

        and: "the service reports success"
            deleted
    }

    def "PLANNER-003-AC-16/AC-19: delete returns false, and deletes nothing, when the parent activity isn't owned"() {
        given: "the repository finds no owned activity for this id"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.empty()

        when: "delete is attempted"
            def deleted = service.delete("steve", activityId, id)

        then: "nothing is deleted"
            0 * subTaskRepository.delete(_)

        and: "the service reports failure"
            !deleted
    }

    def "PLANNER-018-AC-01/AC-02: listForOwner returns every sub-task owned by the resolved user, from the repository's owner-scoped query"() {
        given: "the authenticated username resolves to a User"
            userRepository.findByUsername("steve") >> Optional.of(owner)

        and: "the repository returns sub-tasks across multiple activities for that owner"
            def activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)
            def otherActivity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def subTasks = [
                new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner),
                new SubTask(otherActivity, "Choose a route", ActivityCategory.ROUTINE, owner)
            ]
            subTaskRepository.findByOwner(owner) >> subTasks

        when: "every sub-task is listed for that username"
            def result = service.listForOwner("steve")

        then: "the repository's owner-scoped result is returned unchanged"
            result == subTasks
    }

    def "PLANNER-018-AC-01: listForOwner returns an empty list, not null or an error, when the owner has no sub-tasks at all"() {
        given: "the authenticated username resolves to a User with no sub-tasks"
            userRepository.findByUsername("steve") >> Optional.of(owner)
            subTaskRepository.findByOwner(owner) >> []

        when: "every sub-task is listed for that username"
            def result = service.listForOwner("steve")

        then: "the result is an empty list"
            result.isEmpty()
    }

    def "PLANNER-003-AC-16/AC-19: delete returns false, and deletes nothing, when the sub-task id doesn't exist or isn't owned"() {
        given: "the parent activity is owned, but no matching sub-task is found"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.of(activity)
            subTaskRepository.findByIdAndActivityIdAndOwner(id, activityId, owner) >> Optional.empty()

        when: "delete is attempted"
            def deleted = service.delete("steve", activityId, id)

        then: "nothing is deleted"
            0 * subTaskRepository.delete(_)

        and: "the service reports failure"
            !deleted
    }
}
