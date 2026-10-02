package uk.co.stefirby.behaviouralactivation.controller

import jakarta.persistence.EntityManagerFactory
import org.hibernate.SessionFactory
import org.hibernate.stat.Statistics
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence
import uk.co.stefirby.behaviouralactivation.model.PlanSlot
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * planner_spec_017_plan_response_n_plus_one.md's AC-02 proof: Hibernate statistics, not just the
 * presence of a {@code JOIN FETCH} in a repository method, confirm the N+1 is actually gone.
 * {@code hibernate.generate_statistics} is enabled for this context only via
 * {@code @DynamicPropertySource} (a dedicated test {@code application-*.yml} profile would enable
 * it for every other test in the module too, which is unnecessary overhead elsewhere).
 *
 * <p>Uses {@link Statistics#getPrepareStatementCount()}, NOT
 * {@link Statistics#getQueryExecutionCount()} -- the latter only counts explicit HQL/JPQL/Criteria
 * query executions, not the individual SQL round trips triggered by entity/proxy loading (e.g.
 * {@code Hibernate.initialize(...)} on a lazy association), which is exactly the mechanism this
 * spec's N+1 runs through ({@code PlanService}'s {@code initializeTarget}). Confirmed empirically
 * while writing this spec: {@code queryExecutionCount} stayed identically flat whether the
 * repository fix was present or deliberately reverted, which would have made this test pass for
 * the wrong reason -- {@code prepareStatementCount} actually moves between those two states.
 *
 * <p>Every occurrence below is backed by its OWN distinct {@code Activity}/{@code SubTask} (never
 * shared across occurrences within the same fetched week) -- sharing one {@code Activity} across
 * many occurrences would let Hibernate's session-level identity map serve every access after the
 * first from its in-memory cache even WITHOUT a {@code JOIN FETCH}, silently masking the exact N+1
 * this spec exists to catch.
 *
 * <p>Runs against the real Postgres instance (docker-compose), like
 * {@code PlannedOccurrenceRepositorySpec}/the other {@code @SpringBootTest} integration specs --
 * lazy-loading/query-count behaviour is a real Hibernate concern a mocked repository can't
 * exercise. {@link PlanController#getWeek} is invoked directly against the real, Spring-managed
 * bean (not over HTTP) -- this project has no existing {@code TestRestTemplate}/real-session-auth
 * integration pattern to build on yet, and calling the controller bean directly exercises the
 * identical {@code migrateStaleBucketItems} -&gt; {@code getWeek} -&gt; {@code findCompletions} -&gt;
 * {@code toResponse} call chain (the same Spring-managed {@code PlanService}, the same Hibernate
 * session) that the HTTP layer would, without needing to also stand up session-based login
 * plumbing that's orthogonal to this spec's N+1 question.
 *
 * <p>PLANNER-017-AC-03's bucket-reorder repository method is proven separately, at the repository
 * level, in {@code PlannedOccurrenceRepositorySpec} -- deliberately NOT duplicated here as a
 * full-endpoint query-count test. Investigated during this spec's implementation: the repository
 * fix alone does measurably reduce {@code PUT /api/v1/plan/bucket/order}'s total query count (a
 * 1-item vs 4-item reorder went from an 11-query delta to a 6-query delta after the fix), but
 * doesn't flatten it to a true constant the way {@code getWeek} does, because
 * {@code PlanService.reorderBucket} builds its *returned* list from a separate, pre-existing,
 * per-submitted-id {@code findByIdAndOwner} loop (one query per id, explicitly unrelated to the
 * activity/subTask/subTask.activity N+1 this spec targets) rather than from the JOIN-FETCHed
 * {@code currentBucket} query this fix touches -- and {@code PlanService.reorderBucket} is
 * explicitly out of scope here (see this spec's Requirement 2 reference note:
 * "PlanService.reorderBucket (unchanged itself)"). A test asserting full constancy for that
 * endpoint would therefore assert something false; see planner_spec_017's own Summary section for
 * the full writeup, and {@code .claude/SPEC_CANDIDATES.md} for the follow-up idea this surfaced.
 */
@SpringBootTest
class PlanControllerQueryCountSpec extends Specification {

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
    PlanController planController

    @Autowired
    EntityManagerFactory entityManagerFactory

    User owner
    List<Activity> allActivities = []
    Statistics statistics

    // Both weeks are well after the "now" (2026-10-02) this spec was written against, so
    // migrateStaleBucketItems's own weekStart-before-current-week query never matches either week
    // here -- its own (constant, owner-only) query cost is unaffected by N either way.
    LocalDate weekWithOne = LocalDate.of(2026, 11, 2)
    LocalDate weekWithTen = LocalDate.of(2026, 11, 9)

    def setup() {
        owner = userRepository.save(new User("query-count-test-${UUID.randomUUID()}", "hashed-password"))

        def soloActivity = activityRepository.save(new Activity("Solo activity", ActivityCategory.ROUTINE, null, owner))
        allActivities << soloActivity
        plannedOccurrenceRepository.save(new PlannedOccurrence(soloActivity, null, ActivityCategory.ROUTINE,
            weekWithOne, DayOfWeek.MONDAY, PlanSlot.MORNING, owner))

        // Plain for loop, not a .each { ... }/.collect { ... } closure -- Groovy's Closure.owner
        // implicit property would otherwise shadow this spec's own `owner` field inside the closure
        // body. Ten DISTINCT activities (half used directly, half via their own distinct sub-task)
        // so each occurrence's lazy association is a genuinely separate row to load -- see the
        // class-level Javadoc on why a shared Activity would mask the N+1 via identity-map caching.
        def days = DayOfWeek.values()
        for (int i = 0; i < 10; i++) {
            def activityForThisOccurrence = activityRepository.save(
                new Activity("Activity $i", ActivityCategory.ROUTINE, null, owner))
            allActivities << activityForThisOccurrence
            if (i % 2 == 0) {
                plannedOccurrenceRepository.save(new PlannedOccurrence(activityForThisOccurrence, null,
                    ActivityCategory.ROUTINE, weekWithTen, days[i % 7], PlanSlot.MORNING, owner))
            } else {
                def subTaskForThisOccurrence = subTaskRepository.save(
                    new SubTask(activityForThisOccurrence, "SubTask $i", ActivityCategory.ROUTINE, owner))
                plannedOccurrenceRepository.save(new PlannedOccurrence(null, subTaskForThisOccurrence,
                    ActivityCategory.ROUTINE, weekWithTen, days[i % 7], PlanSlot.EVENING, owner))
            }
        }

        statistics = entityManagerFactory.unwrap(SessionFactory).statistics
    }

    def cleanup() {
        plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, weekWithOne)
            .each { plannedOccurrenceRepository.delete(it) }
        plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, weekWithTen)
            .each { plannedOccurrenceRepository.delete(it) }
        allActivities.each { activityRepository.delete(it) } // cascades each activity's own sub-tasks
        userRepository.delete(owner)
    }

    def "PLANNER-017-AC-02: GET /api/v1/plan issues a constant number of queries regardless of occurrence count"() {
        given: "an authenticated request as the test owner"
            def authentication = new UsernamePasswordAuthenticationToken(owner.username, null, [])

        when: "fetching the 1-occurrence week"
            statistics.clear()
            def responseWithOne = planController.getWeek(weekWithOne, authentication)
            def queryCountForOne = statistics.prepareStatementCount

        and: "fetching the 10-occurrence week"
            statistics.clear()
            def responseWithTen = planController.getWeek(weekWithTen, authentication)
            def queryCountForTen = statistics.prepareStatementCount

        then: "both requests actually returned the expected occurrence counts"
            responseWithOne.body.count == 1
            responseWithTen.body.count == 10

        and: "query count does not scale with occurrence count"
            queryCountForOne == queryCountForTen
    }
}
