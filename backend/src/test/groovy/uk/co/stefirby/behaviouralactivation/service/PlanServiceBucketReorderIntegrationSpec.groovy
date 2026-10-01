package uk.co.stefirby.behaviouralactivation.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.dto.BucketReorderRequest
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceMoveRequest
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceRequest
import uk.co.stefirby.behaviouralactivation.exception.BucketReorderNotAllowedException
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.PlanSlot
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Runs against the real Postgres instance (docker-compose), not a mocked repository --
 * planner_spec_010_bucket_reordering.md's own implementation note flags these ACs as depending on
 * real per-week counts and cross-row query behaviour that a mocked repository can't meaningfully
 * prove, mirroring PlanServiceAutoArchiveIntegrationSpec.groovy's precedent and its own
 * setup()/cleanup() throwaway-User pattern.
 */
@SpringBootTest
class PlanServiceBucketReorderIntegrationSpec extends Specification {

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    PlannedOccurrenceRepository plannedOccurrenceRepository

    @Autowired
    PlanService planService

    User owner
    Activity activity
    LocalDate monday = LocalDate.of(2026, 10, 5)

    def setup() {
        owner = userRepository.save(new User("bucket-reorder-test-${UUID.randomUUID()}", "hashed-password"))
        activity = activityRepository.save(new Activity("Go for a walk", ActivityCategory.PLEASURABLE, null, owner))
    }

    def cleanup() {
        activityRepository.delete(activity)
        userRepository.delete(owner)
    }

    def "PLANNER-010-AC-03: creating bucket items appends each one at the end of the week's order"() {
        given: "two existing bucket items this week"
            def first = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()
            def second = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

        when: "a third bucket item is created"
            def third = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

        then: "positions are appended in creation order"
            first.bucketPosition == 0
            second.bucketPosition == 1
            third.bucketPosition == 2
    }

    def "PLANNER-010-AC-04: creating a grid-scheduled item leaves bucketPosition null"() {
        when: "a scheduled occurrence is created"
            def created = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()

        then: "bucketPosition is null"
            created.bucketPosition == null
    }

    def "PLANNER-010-AC-05: demoting a scheduled occurrence to the bucket appends it at the end of the existing bucket order"() {
        given: "one existing bucket item this week, and a scheduled occurrence to demote"
            planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null))
            def scheduled = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()

        when: "it is demoted back to the bucket"
            def demoted = planService.move(owner.username, scheduled.id,
                new PlannedOccurrenceMoveRequest(null, null)).get()

        then: "it is appended after the existing bucket item"
            demoted.bucketPosition == 1
    }

    def "PLANNER-010-AC-06: promoting a bucket item into a grid slot clears its bucketPosition"() {
        given: "a bucket item"
            def created = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

        when: "it is moved into a grid slot"
            def moved = planService.move(owner.username, created.id,
                new PlannedOccurrenceMoveRequest(DayOfWeek.MONDAY, PlanSlot.MORNING)).get()

        then: "bucketPosition is null"
            moved.bucketPosition == null
    }

    def "PLANNER-010-AC-07: carrying a bucket item forward resets and re-appends its bucketPosition in the new week"() {
        given: "one bucket item already sitting in next week's bucket, and a bucket item this week to carry forward"
            def nextWeek = monday.plusDays(7)
            planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, nextWeek, null, null))
            def toCarry = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

        when: "it is carried forward"
            def carried = planService.carryForward(owner.username, toCarry.id).get()

        then: "it lands in next week's bucket, appended after the item already there, not preserving its old position"
            carried.weekStart == nextWeek
            carried.bucketPosition == 1
    }

    def "PLANNER-010-AC-11: reordering with an id owned by a different user returns empty (404), applies no change"() {
        given: "a bucket item owned by a different user, and one of the caller's own bucket items"
            def otherOwner = userRepository.save(new User("other-${UUID.randomUUID()}", "hashed-password"))
            def otherActivity = activityRepository.save(new Activity("Other's activity", ActivityCategory.ROUTINE, null, otherOwner))
            def foreign = planService.create(otherOwner.username,
                new PlannedOccurrenceRequest(otherActivity.id, null, monday, null, null)).get()
            def mine = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

        when: "the caller submits a reorder including the foreign id"
            def result = planService.reorderBucket(owner.username, new BucketReorderRequest(monday, [foreign.id, mine.id]))

        then: "the result is empty, and the caller's own item is untouched"
            result.isEmpty()
            plannedOccurrenceRepository.findByIdAndOwner(mine.id, owner).get().bucketPosition == 0

        cleanup:
            activityRepository.delete(otherActivity)
            userRepository.delete(otherOwner)
    }

    def "PLANNER-010-AC-12: reordering an id that is not currently a bucket item throws 409"() {
        given: "a scheduled (non-bucket) occurrence"
            def scheduled = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)).get()

        when: "a reorder submits its id"
            planService.reorderBucket(owner.username, new BucketReorderRequest(monday, [scheduled.id]))

        then: "BucketReorderNotAllowedException is thrown"
            thrown(BucketReorderNotAllowedException)
    }

    def "PLANNER-010-AC-13: submitting a partial set of the week's bucket items throws 409"() {
        given: "two bucket items this week"
            def a = planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()
            planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null))

        when: "only one of the two current bucket ids is submitted"
            planService.reorderBucket(owner.username, new BucketReorderRequest(monday, [a.id]))

        then: "BucketReorderNotAllowedException is thrown"
            thrown(BucketReorderNotAllowedException)
    }

    def "PLANNER-010-AC-14: reordering assigns 0..N-1 in the exact submitted order"() {
        given: "three bucket items in creation order"
            def a = planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()
            def b = planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()
            def c = planService.create(owner.username, new PlannedOccurrenceRequest(activity.id, null, monday, null, null)).get()

        when: "they are reordered c, a, b"
            def reordered = planService.reorderBucket(owner.username,
                new BucketReorderRequest(monday, [c.id, a.id, b.id])).get()

        then: "positions reflect the submitted order"
            reordered*.id == [c.id, a.id, b.id]
            reordered*.bucketPosition == [0, 1, 2]
    }
}
