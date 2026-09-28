package uk.co.stefirby.behaviouralactivation.service

import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.dto.ActivityRequest
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

class ActivityServiceSpec extends Specification {

    ActivityRepository activityRepository = Mock()
    UserRepository userRepository = Mock()
    ActivityService service = new ActivityService(activityRepository, userRepository)

    User owner = new User("steve", "hashed-password")

    def "PLANNER-002-AC-01/AC-02: create resolves the owner from the authenticated username, never the request body, and saves via the repository"() {
        given: "the authenticated username resolves to a User"
            userRepository.findByUsername("steve") >> Optional.of(owner)

        and: "the repository saves whatever activity it is given"
            Activity savedArgument = null
            activityRepository.save(_ as Activity) >> { Activity a -> savedArgument = a; return a }

        and: "a valid create request"
            def request = new ActivityRequest("Walk", ActivityCategory.ROUTINE, null)

        when: "an activity is created for that username"
            def created = service.create("steve", request)

        then: "the saved activity is owned by the resolved User, not anything from the request"
            savedArgument.owner == owner
            savedArgument.name == "Walk"

        and: "the returned activity reflects the saved values"
            created.owner == owner
            created.name == "Walk"
            created.category == ActivityCategory.ROUTINE
    }

    def "PLANNER-002-AC-05: create stores a supplied description, or null when omitted"() {
        given:
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.save(_ as Activity) >> { Activity a -> a }

        when: "an activity is created with the given description"
            def created = service.create("steve", new ActivityRequest("Walk", ActivityCategory.ROUTINE, description))

        then:
            created.description == description

        where:
            description << ["A short walk", null]
    }

    def "PLANNER-002-AC-08/AC-10: listForOwner returns the resolved owner's activities from the repository's ordered query"() {
        given: "the authenticated username resolves to a User"
            userRepository.findByUsername("steve") >> Optional.of(owner)

        and: "the repository returns activities for that owner"
            def activities = [new Activity("Bake", ActivityCategory.PLEASURABLE, null, owner)]
            activityRepository.findByOwnerOrderByNameAsc(owner) >> activities

        when: "activities are listed for that username"
            def result = service.listForOwner("steve")

        then: "the repository's result is returned unchanged"
            result == activities
    }

    def "PLANNER-002-AC-11: listForOwner returns an empty list when the owner has no activities"() {
        given:
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByOwnerOrderByNameAsc(owner) >> []

        when:
            def result = service.listForOwner("steve")

        then:
            result.isEmpty()
    }

    def "PLANNER-002-AC-07/AC-12: update changes name, category, and description on the owner's activity"() {
        given: "the authenticated username resolves to a User, who owns the target activity"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Walk", ActivityCategory.ROUTINE, null, owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "the activity is updated"
            def result = service.update("steve", id, new ActivityRequest("Jog", ActivityCategory.PLEASURABLE, "with music"))

        then: "the updated activity is returned"
            result.isPresent()
            result.get().name == "Jog"
            result.get().category == ActivityCategory.PLEASURABLE
            result.get().description == "with music"
    }

    def "PLANNER-002-AC-15/AC-18: update returns empty when the id doesn't exist or belongs to a different owner"() {
        given: "the repository finds no activity for this owner and id"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "an update is attempted"
            def result = service.update("steve", id, new ActivityRequest("Jog", ActivityCategory.PLEASURABLE, null))

        then: "the result is empty -- no update applied"
            result.isEmpty()
    }

    def "PLANNER-002-AC-16: delete removes the owner's activity via the repository and returns true"() {
        given: "the repository finds the owner's activity"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Walk", ActivityCategory.ROUTINE, null, owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "delete is requested"
            def deleted = service.delete("steve", id)

        then: "the repository deletes it"
            1 * activityRepository.delete(existing)

        and: "the service reports success"
            deleted
    }

    def "PLANNER-002-AC-17/AC-18: delete returns false, and deletes nothing, when the id doesn't exist or belongs to a different owner"() {
        given: "the repository finds no activity for this owner and id"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "delete is attempted"
            def deleted = service.delete("steve", id)

        then: "nothing is deleted"
            0 * activityRepository.delete(_)

        and: "the service reports failure"
            !deleted
    }
}
