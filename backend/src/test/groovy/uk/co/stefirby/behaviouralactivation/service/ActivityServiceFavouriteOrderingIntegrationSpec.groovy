package uk.co.stefirby.behaviouralactivation.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

/**
 * Runs against the real Postgres instance (docker-compose), not a mocked repository --
 * planner_spec_015_favourite_activities.md's AC-10/AC-11 depend on Spring Data actually generating a
 * correct `ORDER BY favourite DESC, name ASC` query from the derived method name, which a mocked
 * ActivityRepository (as in ActivityServiceSpec) can't verify -- mirrors
 * ActivityServiceCategoryCascadeIntegrationSpec's precedent for behaviour requiring the real database.
 */
@SpringBootTest
class ActivityServiceFavouriteOrderingIntegrationSpec extends Specification {

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    ActivityService activityService

    User owner

    def setup() {
        owner = userRepository.save(new User("favourite-ordering-test-${UUID.randomUUID()}", "hashed-password"))
    }

    def cleanup() {
        userRepository.delete(owner)
    }

    def "PLANNER-015-AC-10: default list (excludes archived) orders favourites first, alphabetical within group"() {
        given: "three non-archived activities, only 'Zebra errand' favourited"
            def apple = activityRepository.save(new Activity("Apple walk", ActivityCategory.ROUTINE, null, owner))
            def zebra = activityRepository.save(new Activity("Zebra errand", ActivityCategory.ROUTINE, null, owner))
            def mango = activityRepository.save(new Activity("Mango task", ActivityCategory.ROUTINE, null, owner))
            activityService.markFavourite(owner.username, zebra.id)

        when: "activities are listed for the owner, excluding archived (default)"
            def result = activityService.listForOwner(owner.username, false)

        then: "Zebra errand first, then Apple walk, Mango task alphabetically"
            result*.activity()*.name == ["Zebra errand", "Apple walk", "Mango task"]

        cleanup:
            activityRepository.delete(apple)
            activityRepository.delete(zebra)
            activityRepository.delete(mango)
    }

    def "PLANNER-015-AC-11: includeArchived=true still pins an archived favourite to the top"() {
        given: "an archived, favourited activity and a non-archived, non-favourited one"
            def oldFavourite = activityRepository.save(new Activity("Old favourite", ActivityCategory.ROUTINE, null, owner))
            activityService.markFavourite(owner.username, oldFavourite.id)
            activityService.archive(owner.username, oldFavourite.id)
            def currentTask = activityRepository.save(new Activity("Current task", ActivityCategory.ROUTINE, null, owner))

        when: "activities are listed for the owner, including archived"
            def result = activityService.listForOwner(owner.username, true)

        then: "the archived favourite still sorts first"
            result*.activity()*.name == ["Old favourite", "Current task"]

        cleanup:
            activityRepository.delete(oldFavourite)
            activityRepository.delete(currentTask)
    }
}
