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

    // PLANNER-003-AC-20 ("changing the parent's category later does not change an existing
    // sub-task's category") formerly lived here, asserting the opposite of the shipped behaviour.
    // It was SUPERSEDED 2026-10-01 by planner_spec_014_subtask_category_cascade.md's
    // PLANNER-014-AC-01 (ActivityService.update() now cascades a category change to every existing
    // sub-task) -- see that spec's Requirement 1 for the reversal rationale. Coverage for the real
    // (opposite) behaviour now lives in ActivityServiceCategoryCascadeIntegrationSpec's
    // "PLANNER-014-AC-01" and "PLANNER-014-AC-02" tests.

    def "PLANNER-014-AC-01/recategorize: recategorize changes the category and bumps updatedAt"() {
        given: "an existing sub-task"
            def subTask = new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner)
            def originalUpdatedAt = subTask.updatedAt

        when: "the sub-task is recategorized"
            subTask.recategorize(ActivityCategory.NECESSARY)

        then: "the new category is stored"
            subTask.category == ActivityCategory.NECESSARY

        and: "updatedAt is not before the original value"
            !subTask.updatedAt.isBefore(originalUpdatedAt)
    }
}
