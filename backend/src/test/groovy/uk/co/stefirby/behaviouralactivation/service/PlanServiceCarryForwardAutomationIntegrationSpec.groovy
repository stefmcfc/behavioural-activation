package uk.co.stefirby.behaviouralactivation.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceRequest
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.CompletionRecord
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence
import uk.co.stefirby.behaviouralactivation.model.PlanSlot
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.CompletionRecordRepository
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository
import uk.co.stefirby.behaviouralactivation.model.User

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

/**
 * Runs against the real Postgres instance (docker-compose), not a mocked repository --
 * planner_spec_011_bucket_carry_forward_automation.md's Requirement 4 implementation note flags
 * exactly this class of transaction-boundary bug (migrateStaleBucketItems(...)'s mutation surviving
 * past its own transaction, ahead of getWeek()'s separate @Transactional(readOnly = true) query) as
 * one a mocked repository cannot catch -- mirrors PlanServiceAutoArchiveIntegrationSpec.groovy's and
 * PlanServiceBucketReorderIntegrationSpec.groovy's precedent, including their setup()/cleanup()
 * throwaway-User pattern.
 *
 * <p>PLANNER-011-AC-13/AC-14/AC-15 (PlanController's recentlyCarriedForward response mapping) are
 * covered separately in PlanControllerSpec.groovy's existing @WebMvcTest, mocking PlanService --
 * that mapping is pure boolean set-containment logic in the controller, not something that needs a
 * real Postgres round-trip to prove, matching this codebase's existing split between
 * transaction/persistence concerns (here) and response-shape mapping concerns (PlanControllerSpec).
 *
 * <p>PLANNER-011-AC-01/AC-02 (the Clock injection itself producing the right Monday) is covered
 * separately in PlanServiceSpec.groovy's mocked unit test, not here: a {@code PlanService} instance
 * constructed by plain {@code new} (not through Spring's container) has no {@code @Transactional}
 * AOP proxy at all, so each repository call below it runs its own disjoint mini-transaction and
 * hands back an already-detached entity by the time {@code autoCarryForwardTo(...)} mutates it --
 * nothing would ever be flushed, which isn't what AC-01/AC-02 is trying to prove (the Clock
 * computation itself, not persistence). The *durable persistence* behaviour this class's own
 * precedent exists to catch is instead exercised by AC-06/AC-08 below, via the real, Spring-managed
 * {@code planService} bean and its real {@code Clock.systemDefaultZone()} bean.
 */
@SpringBootTest
class PlanServiceCarryForwardAutomationIntegrationSpec extends Specification {

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    SubTaskRepository subTaskRepository

    @Autowired
    CompletionRecordRepository completionRecordRepository

    @Autowired
    PlannedOccurrenceRepository plannedOccurrenceRepository

    @Autowired
    PlanService planService

    User owner
    Activity activity

    // Computed from the real system clock -- planService's own autowired Clock bean is
    // Clock.systemDefaultZone(), so these mirror what migrateStaleBucketItems(...) will actually use.
    LocalDate currentWeekMonday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
    LocalDate twoWeeksAgoMonday = currentWeekMonday.minusDays(14)
    LocalDate threeWeeksAgoMonday = currentWeekMonday.minusDays(21)

    def setup() {
        owner = userRepository.save(new User("carry-forward-automation-test-${UUID.randomUUID()}", "hashed-password"))
        activity = activityRepository.save(new Activity("Go for a walk", ActivityCategory.PLEASURABLE, null, owner))
    }

    def cleanup() {
        activityRepository.delete(activity)
        userRepository.delete(owner)
    }

    def "PLANNER-011-AC-04: a stale bucket item that is already complete is excluded from migration"() {
        given: "a stale bucket item with a CompletionRecord"
            def stale = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.PLEASURABLE, twoWeeksAgoMonday,
                    null, null, owner))
            completionRecordRepository.save(new CompletionRecord(stale, owner, Instant.now()))

        when: "migrateStaleBucketItems is called"
            def migratedIds = planService.migrateStaleBucketItems(owner.username)

        then: "the item is not migrated, and its weekStart is unchanged"
            !(stale.id in migratedIds)
            plannedOccurrenceRepository.findById(stale.id).get().weekStart == twoWeeksAgoMonday
    }

    def "PLANNER-011-AC-06/AC-08: a bucket item stale by several weeks jumps to the real current week in one step, durably persisted"() {
        given: "an incomplete bucket item stale by three weeks"
            def created = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, threeWeeksAgoMonday, null, null)).get()

        when: "migrateStaleBucketItems is called, and the result is re-read via a fresh repository call"
            def migratedIds = planService.migrateStaleBucketItems(owner.username)
            def persisted = plannedOccurrenceRepository.findById(created.id).get()

        then: "the item lands directly on the real current week's Monday, not one 7-day hop, and it is durably persisted"
            migratedIds == [created.id] as Set
            persisted.weekStart == currentWeekMonday
    }

    def "PLANNER-011-AC-07: migration resets bucketPosition to null"() {
        given: "an incomplete, stale bucket item with a non-null bucketPosition from a prior week's order"
            def stale = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.PLEASURABLE, twoWeeksAgoMonday,
                    null, null, owner))
            stale.assignBucketPosition(2)
            plannedOccurrenceRepository.save(stale)

        when: "migrateStaleBucketItems is called"
            planService.migrateStaleBucketItems(owner.username)

        then: "bucketPosition is reset to null, so the item is treated as freshly appended"
            plannedOccurrenceRepository.findById(stale.id).get().bucketPosition == null
    }

    def "PLANNER-011-AC-10: a migrated item does not appear when a non-current week is explicitly requested"() {
        given: "a stale bucket item that will be migrated to the real current week"
            def created = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, twoWeeksAgoMonday, null, null)).get()

        when: "migrateStaleBucketItems runs, then the original (now stale) week is requested"
            planService.migrateStaleBucketItems(owner.username)
            def staleWeekResult = planService.getWeek(owner.username, twoWeeksAgoMonday)

        then: "the migrated item is absent from that week's result"
            !staleWeekResult.any { it.id == created.id }
    }

    def "PLANNER-011-AC-11: a migrated item appears in the current-week response, same request sequence"() {
        given: "a stale bucket item that will be migrated to the real current week"
            def created = planService.create(owner.username,
                new PlannedOccurrenceRequest(activity.id, null, twoWeeksAgoMonday, null, null)).get()

        when: "migrateStaleBucketItems runs, then the real current week is requested"
            def migratedIds = planService.migrateStaleBucketItems(owner.username)
            def currentWeekResult = planService.getWeek(owner.username, currentWeekMonday)

        then: "the migrated item is present in the current week's result"
            created.id in migratedIds
            currentWeekResult.any { it.id == created.id }
    }

    def "PLANNER-011-AC-12: a stale grid-scheduled occurrence is never touched by migration"() {
        given: "a scheduled (non-bucket) occurrence with a stale weekStart"
            def scheduled = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, twoWeeksAgoMonday,
                    DayOfWeek.MONDAY, PlanSlot.MORNING, owner))

        when: "migrateStaleBucketItems is called"
            def migratedIds = planService.migrateStaleBucketItems(owner.username)

        then: "the scheduled occurrence is not migrated"
            !(scheduled.id in migratedIds)
            plannedOccurrenceRepository.findById(scheduled.id).get().weekStart == twoWeeksAgoMonday
    }

    def "PLANNER-011-AC-05: migration never touches another owner's stale bucket item"() {
        given: "a stale bucket item owned by a different user"
            def otherOwner = userRepository.save(new User("other-carry-forward-${UUID.randomUUID()}", "hashed-password"))
            def otherActivity = activityRepository.save(
                new Activity("Someone else's activity", ActivityCategory.ROUTINE, null, otherOwner))
            def foreign = plannedOccurrenceRepository.save(
                new PlannedOccurrence(otherActivity, null, ActivityCategory.ROUTINE, twoWeeksAgoMonday,
                    null, null, otherOwner))

        when: "migrateStaleBucketItems is called for the caller, not the foreign owner"
            def migratedIds = planService.migrateStaleBucketItems(owner.username)

        then: "the foreign owner's stale item is untouched"
            !(foreign.id in migratedIds)
            plannedOccurrenceRepository.findById(foreign.id).get().weekStart == twoWeeksAgoMonday

        cleanup:
            activityRepository.delete(otherActivity)
            userRepository.delete(otherOwner)
    }
}
