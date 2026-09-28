package uk.co.stefirby.behaviouralactivation.model

import spock.lang.Specification

import java.time.Instant

class ActivitySpec extends Specification {

    User owner = new User("steve", "hashed-password")

    def "PLANNER-002-AC-05: constructing an Activity stores description when supplied and null when omitted"() {
        when: "an Activity is constructed"
            def before = Instant.now()
            def activity = new Activity(name, ActivityCategory.ROUTINE, description, owner)
            def after = Instant.now()

        then: "name, category, description, and owner are set as given"
            activity.name == name
            activity.category == ActivityCategory.ROUTINE
            activity.description == description
            activity.owner == owner

        and: "createdAt is set to roughly now, and updatedAt starts equal to createdAt"
            !activity.createdAt.isBefore(before)
            !activity.createdAt.isAfter(after)
            activity.updatedAt == activity.createdAt

        where:
            name   | description
            "Walk" | "A short walk around the block"
            "Read" | null
    }

    def "PLANNER-002-AC-06: ActivityCategory has exactly the three fixed values, never free text"() {
        expect: "exactly ROUTINE, NECESSARY, and PLEASURABLE"
            ActivityCategory.values() as Set ==
                [ActivityCategory.ROUTINE, ActivityCategory.NECESSARY, ActivityCategory.PLEASURABLE] as Set
    }

    def "PLANNER-002-AC-07: update changes name, category, and description, and bumps updatedAt"() {
        given: "an existing activity"
            def activity = new Activity("Walk", ActivityCategory.ROUTINE, null, owner)
            def originalUpdatedAt = activity.updatedAt

        when: "the activity is updated with different values"
            activity.update("Jog", ActivityCategory.PLEASURABLE, "with music")

        then: "the new values are stored"
            activity.name == "Jog"
            activity.category == ActivityCategory.PLEASURABLE
            activity.description == "with music"

        and: "updatedAt is not before the original value"
            !activity.updatedAt.isBefore(originalUpdatedAt)
    }
}
