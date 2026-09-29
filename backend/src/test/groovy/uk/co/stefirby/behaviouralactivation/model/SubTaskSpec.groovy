package uk.co.stefirby.behaviouralactivation.model

import spock.lang.Specification

import java.time.Instant

class SubTaskSpec extends Specification {

    User owner = new User("steve", "hashed-password")
    Activity activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)

    def "constructing a SubTask stores name, category, activity, and owner as given"() {
        when: "a SubTask is constructed"
            def before = Instant.now()
            def subTask = new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner)
            def after = Instant.now()

        then: "the given values are set"
            subTask.activity == activity
            subTask.name == "Create a guest list"
            subTask.category == ActivityCategory.PLEASURABLE
            subTask.owner == owner

        and: "createdAt is set to roughly now, and updatedAt starts equal to createdAt"
            !subTask.createdAt.isBefore(before)
            !subTask.createdAt.isAfter(after)
            subTask.updatedAt == subTask.createdAt
    }

    def "PLANNER-003-AC-11: rename changes the name and bumps updatedAt"() {
        given: "an existing sub-task"
            def subTask = new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner)
            def originalUpdatedAt = subTask.updatedAt

        when: "the sub-task is renamed"
            subTask.rename("Create and send a guest list")

        then: "the new name is stored"
            subTask.name == "Create and send a guest list"

        and: "updatedAt is not before the original value"
            !subTask.updatedAt.isBefore(originalUpdatedAt)
    }

    def "PLANNER-003-AC-20: a SubTask's stored category does not follow a later change to its parent Activity's category"() {
        given: "a sub-task created while the parent activity was PLEASURABLE"
            def subTask = new SubTask(activity, "Create a guest list", activity.category, owner)

        when: "the parent activity's category is later changed to NECESSARY"
            activity.update(activity.name, ActivityCategory.NECESSARY, activity.description)

        then: "the sub-task's already-stored category is unchanged"
            subTask.category == ActivityCategory.PLEASURABLE
    }
}
