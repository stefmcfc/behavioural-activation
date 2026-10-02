package uk.co.stefirby.behaviouralactivation.service

import jakarta.persistence.EntityManagerFactory
import org.hibernate.SessionFactory
import org.hibernate.stat.Statistics
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.dto.BucketReorderRequest
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

import java.time.LocalDate

/**
 * planner_spec_019_bucket_reorder_query_scaling.md's AC-03 proof -- same Hibernate-statistics
 * technique as {@code PlanControllerQueryCountSpec} (planner_spec_017), applied to
 * {@code PlanService.reorderBucket} instead of {@code PlanController.getWeek}. Uses
 * {@link Statistics#getPrepareStatementCount()}, not {@code getQueryExecutionCount()} -- the latter
 * doesn't count lazy-proxy-initialization round trips, which is exactly the mechanism this spec's
 * fix touches (see {@code PlanControllerQueryCountSpec}'s class-level Javadoc for the full
 * writeup of that finding).
 *
 * <p>Every bucket item below is backed by its OWN distinct {@code Activity}/{@code SubTask} (never
 * shared across occurrences) -- a shared entity would be served from Hibernate's session-level
 * identity map regardless of {@code JOIN FETCH}, silently masking the exact N+1 this test exists to
 * catch (the same finding {@code planner_spec_017} made first).
 *
 * <p><b>Real finding, confirmed by direct measurement (not assumed):</b> the raw, total
 * {@code prepareStatementCount} for a reorder call is NOT perfectly flat across different N, even
 * after this spec's fix -- it's {@code 3 + N} (3 constant reads: owner lookup, the new bulk
 * {@code findByIdInAndOwner}, and the {@code currentBucket} fetch; plus exactly N UPDATEs). Those N
 * UPDATEs are {@code PlanService.reorderBucket}'s pre-existing, explicitly-out-of-scope
 * position-assignment writes (see planner_spec_019's Overview: "N necessary UPDATEs for N changed
 * rows, not an N+1 *read* bug") -- {@code PlannedOccurrence.assignBucketPosition} unconditionally
 * touches {@code updatedAt} via {@code Instant.now()} on every call, so every submitted occurrence
 * is dirty-checked as changed regardless of whether its {@code bucketPosition} value actually
 * differs, and Hibernate issues one UPDATE per dirty entity (no batching is configured in
 * {@code application.yml}). This is a real, necessary write, not the N+1 read bug this spec targets
 * -- so this test asserts the fix's actual claim by subtracting that known, expected N-sized write
 * component before comparing, isolating the constant *read* count the fix is actually about.
 *
 * <p>Runs against the real Postgres instance (docker-compose), like the other
 * {@code @SpringBootTest} integration specs in this module -- lazy-loading/query-count behaviour is
 * a real Hibernate concern a mocked repository can't exercise.
 */
@SpringBootTest
class PlanServiceReorderBucketQueryCountSpec extends Specification {

    @DynamicPropertySource
    static void hibernateStatistics(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true")
    }

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    SubTaskRepository subTaskRepository

    @Autowired
    PlannedOccurrenceRepository plannedOccurrenceRepository

    @Autowired
    PlanService planService

    @Autowired
    EntityManagerFactory entityManagerFactory

    User owner
    List<Activity> allActivities = []
    Statistics statistics

    LocalDate weekWithOne = LocalDate.of(2026, 11, 16)
    LocalDate weekWithSix = LocalDate.of(2026, 11, 23)

    UUID idA
    List<UUID> sixIdsInSomeNewOrder

    def setup() {
        owner = userRepository.save(new User("reorder-query-count-test-${UUID.randomUUID()}", "hashed-password"))

        def soloActivity = activityRepository.save(new Activity("Solo activity", ActivityCategory.PLEASURABLE, null, owner))
        allActivities << soloActivity
        def soloOccurrence = plannedOccurrenceRepository.save(
            new PlannedOccurrence(soloActivity, null, ActivityCategory.PLEASURABLE, weekWithOne, null, null, owner))
        soloOccurrence.assignBucketPosition(0)
        idA = soloOccurrence.id

        // Plain for loop, not a .each { ... }/.collect { ... } closure -- Groovy's Closure.owner
        // implicit property would otherwise shadow this spec's own `owner` field inside the closure
        // body. Six DISTINCT activities (half used directly, half via their own distinct sub-task) so
        // each occurrence's lazy association is a genuinely separate row to load -- see the
        // class-level Javadoc on why a shared Activity would mask the N+1 via identity-map caching.
        List<PlannedOccurrence> occurrences = []
        for (int i = 0; i < 6; i++) {
            def activityForThisOccurrence = activityRepository.save(
                new Activity("Bucket activity $i", ActivityCategory.PLEASURABLE, null, owner))
            allActivities << activityForThisOccurrence
            PlannedOccurrence occurrence
            if (i % 2 == 0) {
                occurrence = plannedOccurrenceRepository.save(new PlannedOccurrence(
                    activityForThisOccurrence, null, ActivityCategory.PLEASURABLE, weekWithSix, null, null, owner))
            } else {
                def subTaskForThisOccurrence = subTaskRepository.save(
                    new SubTask(activityForThisOccurrence, "SubTask $i", ActivityCategory.PLEASURABLE, owner))
                occurrence = plannedOccurrenceRepository.save(new PlannedOccurrence(
                    null, subTaskForThisOccurrence, ActivityCategory.PLEASURABLE, weekWithSix, null, null, owner))
            }
            occurrence.assignBucketPosition(i)
            occurrences << occurrence
        }
        plannedOccurrenceRepository.flush()
        // Reverse the creation order -- a genuine reorder, not a no-op matching the existing order.
        sixIdsInSomeNewOrder = occurrences.reverse()*.id

        statistics = entityManagerFactory.unwrap(SessionFactory).statistics
    }

    def cleanup() {
        plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, weekWithOne)
            .each { plannedOccurrenceRepository.delete(it) }
        plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, weekWithSix)
            .each { plannedOccurrenceRepository.delete(it) }
        allActivities.each { activityRepository.delete(it) } // cascades each activity's own sub-tasks
        userRepository.delete(owner)
    }

    def "PLANNER-019-AC-03: reorderBucket issues a constant number of queries regardless of submitted-item count"() {
        when: "reordering the 1-item week (trivial no-op reorder, same single id)"
            statistics.clear()
            def resultForOne = planService.reorderBucket(owner.username, new BucketReorderRequest(weekWithOne, [idA]))
            def queryCountForOne = statistics.prepareStatementCount

        and: "reordering the 6-item week"
            statistics.clear()
            def resultForSix = planService.reorderBucket(owner.username,
                new BucketReorderRequest(weekWithSix, sixIdsInSomeNewOrder))
            def queryCountForSix = statistics.prepareStatementCount

        then: "both reorders actually succeeded"
            resultForOne.isPresent()
            resultForSix.isPresent()
            resultForSix.get()*.id == sixIdsInSomeNewOrder

        and: "the constant (non-write) read-query count does not scale with submitted-item count -- see class Javadoc: the raw total legitimately differs by exactly N, the pre-existing, explicitly-out-of-scope position-assignment UPDATE per submitted occurrence, not the N+1 read this spec fixes"
            (queryCountForOne - resultForOne.get().size()) == (queryCountForSix - resultForSix.get().size())
    }
}
