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
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

/**
 * planner_spec_018_bulk_sub_task_fetch.md's AC-05 proof -- same Hibernate-statistics technique as
 * {@code PlanControllerQueryCountSpec} (planner_spec_017), applied to
 * {@code GET /api/v1/activities} instead of {@code GET /api/v1/plan}. Uses
 * {@link Statistics#getPrepareStatementCount()}, not {@code getQueryExecutionCount()} -- see that
 * sibling spec's class-level Javadoc for the full writeup of why.
 *
 * <p>Every activity below is backed by its OWN distinct {@code Activity} row (never shared) -- not
 * strictly load-bearing here the way it is for {@code PlannedOccurrence}'s lazy associations (this
 * endpoint's N+1 was a per-activity {@code COUNT} query, not a lazy-proxy load), but kept for
 * consistency with the sibling specs' established pattern.
 *
 * <p>Runs against the real Postgres instance (docker-compose), like the other
 * {@code @SpringBootTest} integration specs in this module.
 */
@SpringBootTest
class ActivityControllerQueryCountSpec extends Specification {

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
    ActivityController activityController

    @Autowired
    EntityManagerFactory entityManagerFactory

    User owner
    User ownerWithTen
    Statistics statistics

    def setup() {
        owner = userRepository.save(new User("activity-query-count-test-${UUID.randomUUID()}", "hashed-password"))
        def soloActivity = activityRepository.save(new Activity("Solo activity", ActivityCategory.ROUTINE, null, owner))
        subTaskRepository.save(new SubTask(soloActivity, "Solo sub-task", ActivityCategory.ROUTINE, owner))

        ownerWithTen = userRepository.save(
            new User("activity-query-count-test-ten-${UUID.randomUUID()}", "hashed-password"))
        // Plain for loop, not a .each { ... } closure -- Groovy's Closure.owner implicit property
        // would otherwise shadow this spec's own `owner`/`ownerWithTen` fields inside the closure
        // body. Half of the ten activities get a sub-task, exercising both branches of the grouped
        // count query's result (present vs. implicitly zero).
        for (int i = 0; i < 10; i++) {
            def activity = activityRepository.save(
                new Activity("Activity $i", ActivityCategory.ROUTINE, null, ownerWithTen))
            if (i % 2 == 0) {
                subTaskRepository.save(new SubTask(activity, "SubTask $i", ActivityCategory.ROUTINE, ownerWithTen))
            }
        }

        statistics = entityManagerFactory.unwrap(SessionFactory).statistics
    }

    def cleanup() {
        activityRepository.findByOwnerOrderByFavouriteDescNameAsc(owner).each { activityRepository.delete(it) }
        activityRepository.findByOwnerOrderByFavouriteDescNameAsc(ownerWithTen).each { activityRepository.delete(it) }
        userRepository.delete(owner)
        userRepository.delete(ownerWithTen)
    }

    def "PLANNER-018-AC-05: GET /api/v1/activities issues a constant number of queries regardless of activity count"() {
        given: "authenticated requests as each test owner"
            def authenticationForOne = new UsernamePasswordAuthenticationToken(owner.username, null, [])
            def authenticationForTen = new UsernamePasswordAuthenticationToken(ownerWithTen.username, null, [])

        when: "fetching the 1-activity owner's bank"
            statistics.clear()
            def responseForOne = activityController.list(false, authenticationForOne)
            def queryCountForOne = statistics.prepareStatementCount

        and: "fetching the 10-activity owner's bank"
            statistics.clear()
            def responseForTen = activityController.list(false, authenticationForTen)
            def queryCountForTen = statistics.prepareStatementCount

        then: "both requests actually returned the expected activity counts, with correct subTaskCount values"
            responseForOne.body.count == 1
            responseForOne.body.data[0].subTaskCount == 1
            responseForTen.body.count == 10
            responseForTen.body.data.findAll { it.subTaskCount == 1 }.size() == 5
            responseForTen.body.data.findAll { it.subTaskCount == 0 }.size() == 5

        and: "query count does not scale with activity count"
            queryCountForOne == queryCountForTen
    }
}
