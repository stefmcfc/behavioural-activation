package uk.co.stefirby.behaviouralactivation.model

import spock.lang.Specification

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate

class PlannedOccurrenceSpec extends Specification {

    User owner = new User("steve", "hashed-password")
    Activity activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
    SubTask subTask = new SubTask(activity, "Chapter one", ActivityCategory.ROUTINE, owner)

    def "constructing a scheduled PlannedOccurrence stores the activity, category, weekStart, dayOfWeek and slot as given"() {
        when: "a PlannedOccurrence is constructed with a day and slot set"
            def before = Instant.now()
            def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE,
                LocalDate.of(2026, 10, 5), DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            def after = Instant.now()

        then: "the given values are set"
            occurrence.activity == activity
            occurrence.subTask == null
            occurrence.category == ActivityCategory.ROUTINE
            occurrence.weekStart == LocalDate.of(2026, 10, 5)
            occurrence.dayOfWeek == DayOfWeek.MONDAY
            occurrence.slot == PlanSlot.MORNING
            occurrence.owner == owner
            !occurrence.bucketItem

        and: "createdAt is set to roughly now, and updatedAt starts equal to createdAt"
            !occurrence.createdAt.isBefore(before)
            !occurrence.createdAt.isAfter(after)
            occurrence.updatedAt == occurrence.createdAt
    }

    def "constructing a weekend-bucket PlannedOccurrence with both dayOfWeek and slot null is a valid bucket item"() {
        when: "a PlannedOccurrence is constructed with no day/slot"
            def occurrence = new PlannedOccurrence(null, subTask, ActivityCategory.ROUTINE,
                LocalDate.of(2026, 10, 5), null, null, owner)

        then: "it reports itself as a bucket item"
            occurrence.subTask == subTask
            occurrence.activity == null
            occurrence.dayOfWeek == null
            occurrence.slot == null
            occurrence.bucketItem
    }

    def "PLANNER-004-AC-16: assignSlot sets dayOfWeek and slot and bumps updatedAt"() {
        given: "an existing weekend-bucket occurrence"
            def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE,
                LocalDate.of(2026, 10, 5), null, null, owner)
            def originalUpdatedAt = occurrence.updatedAt

        when: "the occurrence is assigned a day and slot"
            occurrence.assignSlot(DayOfWeek.TUESDAY, PlanSlot.EVENING)

        then: "the day and slot are set, and it is no longer a bucket item"
            occurrence.dayOfWeek == DayOfWeek.TUESDAY
            occurrence.slot == PlanSlot.EVENING
            !occurrence.bucketItem

        and: "updatedAt is not before the original value"
            !occurrence.updatedAt.isBefore(originalUpdatedAt)
    }

    def "PLANNER-004-AC-17: moveToBucket clears dayOfWeek and slot but leaves weekStart unchanged"() {
        given: "an existing scheduled occurrence"
            def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE,
                LocalDate.of(2026, 10, 5), DayOfWeek.MONDAY, PlanSlot.MORNING, owner)

        when: "the occurrence is moved back to the bucket"
            occurrence.moveToBucket()

        then: "dayOfWeek and slot are cleared"
            occurrence.dayOfWeek == null
            occurrence.slot == null
            occurrence.bucketItem

        and: "weekStart is unchanged"
            occurrence.weekStart == LocalDate.of(2026, 10, 5)
    }
}
