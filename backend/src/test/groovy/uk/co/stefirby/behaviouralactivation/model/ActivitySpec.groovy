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

    def "PLANNER-006-AC-01: the unchanged 4-arg constructor defaults repeatable to true and archived to false"() {
        when: "an Activity is constructed via the existing 4-arg constructor"
            def activity = new Activity("Walk", ActivityCategory.ROUTINE, null, owner)

        then: "repeatable defaults to true, and archived defaults to false"
            activity.repeatable
            !activity.archived
    }

    def "PLANNER-006-AC-02: the 5-arg constructor stores the given repeatable value, always starting non-archived"() {
        when: "an Activity is constructed with an explicit repeatable value"
            def activity = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, repeatable, owner)

        then: "repeatable is set as given, and archived starts false"
            activity.repeatable == repeatable
            !activity.archived

        where:
            repeatable << [true, false]
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

    def "PLANNER-006-AC-03 (unchanged 3-arg overload): the existing update(...) overload preserves the current repeatable value"() {
        given: "an existing one-off activity"
            def activity = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)

        when: "the activity is updated via the unchanged 3-arg overload"
            activity.update("Apply for jobs (updated)", ActivityCategory.NECESSARY, "with cover letter")

        then: "repeatable is unchanged"
            !activity.repeatable
    }

    def "PLANNER-006-AC-03: the 4-arg update(...) overload changes repeatable, exactly like name/category/description"() {
        given: "an existing repeatable activity"
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def originalUpdatedAt = activity.updatedAt

        when: "the activity is updated with repeatable: false"
            activity.update("Go for a walk", ActivityCategory.ROUTINE, null, false)

        then: "repeatable is updated, and updatedAt is not before the original value"
            !activity.repeatable
            !activity.updatedAt.isBefore(originalUpdatedAt)
    }

    def "PLANNER-006-AC-04/model: archive() is the only way archived becomes true -- never via update(...)"() {
        given: "an existing activity"
            def activity = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)

        when: "update(...) is called, with no archived parameter to even pass"
            activity.update("Apply for jobs", ActivityCategory.NECESSARY, null, false)

        then: "archived is still false"
            !activity.archived

        when: "archive() is called explicitly"
            activity.archive()

        then: "archived becomes true"
            activity.archived
    }

    def "PLANNER-006-AC-05/AC-06: archive() sets archived to true, idempotently, and bumps updatedAt"() {
        given: "a non-archived activity"
            def activity = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            def originalUpdatedAt = activity.updatedAt

        when: "archive() is called"
            activity.archive()

        then: "archived is true, and updatedAt is not before the original value"
            activity.archived
            !activity.updatedAt.isBefore(originalUpdatedAt)

        when: "archive() is called again on an already-archived activity"
            activity.archive()

        then: "it remains archived, without error"
            activity.archived
    }

    def "PLANNER-006-AC-08: unarchive() sets archived to false and bumps updatedAt"() {
        given: "an archived activity"
            def activity = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            activity.archive()
            def originalUpdatedAt = activity.updatedAt

        when: "unarchive() is called"
            activity.unarchive()

        then: "archived is false, and updatedAt is not before the original value"
            !activity.archived
            !activity.updatedAt.isBefore(originalUpdatedAt)
    }

    def "PLANNER-015-AC-01: both constructors default favourite to false"() {
        when: "an Activity is constructed via either constructor"
            def viaFourArg = new Activity("Walk", ActivityCategory.ROUTINE, null, owner)
            def viaFiveArg = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)

        then: "favourite defaults to false in both cases"
            !viaFourArg.favourite
            !viaFiveArg.favourite
    }

    def "PLANNER-015-AC-01/AC-02: update(...) never sets favourite -- there is no parameter to even pass"() {
        given: "an existing activity"
            def activity = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)

        when: "update(...) is called, with no favourite parameter to even pass"
            activity.update("Apply for jobs", ActivityCategory.NECESSARY, null, false)

        then: "favourite is still false"
            !activity.favourite

        when: "markFavourite() is called explicitly"
            activity.markFavourite()

        then: "favourite becomes true"
            activity.favourite

        when: "update(...) is called again on a favourited activity"
            activity.update("Apply for jobs (renamed)", ActivityCategory.NECESSARY, null, false)

        then: "favourite is still true -- update(...) never touches it"
            activity.favourite
    }

    def "PLANNER-015-AC-03/AC-04: markFavourite() sets favourite to true, idempotently, and bumps updatedAt"() {
        given: "a non-favourited activity"
            def activity = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            def originalUpdatedAt = activity.updatedAt

        when: "markFavourite() is called"
            activity.markFavourite()

        then: "favourite is true, and updatedAt is not before the original value"
            activity.favourite
            !activity.updatedAt.isBefore(originalUpdatedAt)

        when: "markFavourite() is called again on an already-favourited activity"
            activity.markFavourite()

        then: "it remains favourited, without error"
            activity.favourite
    }

    def "PLANNER-015-AC-06/AC-07: unmarkFavourite() sets favourite to false, idempotently, and bumps updatedAt"() {
        given: "a favourited activity"
            def activity = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            activity.markFavourite()
            def originalUpdatedAt = activity.updatedAt

        when: "unmarkFavourite() is called"
            activity.unmarkFavourite()

        then: "favourite is false, and updatedAt is not before the original value"
            !activity.favourite
            !activity.updatedAt.isBefore(originalUpdatedAt)

        when: "unmarkFavourite() is called again on an already-not-favourited activity"
            activity.unmarkFavourite()

        then: "it remains not favourited, without error"
            !activity.favourite
    }

    def "PLANNER-015-AC-09: archive()/unarchive() never change favourite, and markFavourite()/unmarkFavourite() never change archived"() {
        given: "a favourited activity"
            def activity = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            activity.markFavourite()

        when: "the activity is archived"
            activity.archive()

        then: "favourite is unchanged"
            activity.favourite
            activity.archived

        when: "the activity is unarchived"
            activity.unarchive()

        then: "favourite is still unchanged"
            activity.favourite
            !activity.archived

        when: "the activity is unmarked as favourite after being archived again"
            activity.archive()
            activity.unmarkFavourite()

        then: "archived is unchanged"
            activity.archived
            !activity.favourite
    }
}
