package uk.co.stefirby.behaviouralactivation.service

import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.dto.ActivityRequest
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskCountProjection
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

class ActivityServiceSpec extends Specification {

    ActivityRepository activityRepository = Mock()
    UserRepository userRepository = Mock()
    SubTaskRepository subTaskRepository = Mock()
    ActivityService service = new ActivityService(activityRepository, userRepository, subTaskRepository)

    User owner = new User("steve", "hashed-password")

    // Test-only helper: Activity.id is a plain @GeneratedValue field with no setter (only populated
    // on persist), but PLANNER-018-AC-04's mocked-repository test needs distinct, non-null activity
    // ids to exercise the grouped-count-by-activityId lookup meaningfully. Mirrors PlanServiceSpec's
    // identical withId(...) helper.
    private static <T> T withId(T entity, UUID id) {
        def field = entity.class.getDeclaredField("id")
        field.accessible = true
        field.set(entity, id)
        return entity
    }

    def "PLANNER-002-AC-01/AC-02: create resolves the owner from the authenticated username, never the request body, and saves via the repository"() {
        given: "the authenticated username resolves to a User"
            userRepository.findByUsername("steve") >> Optional.of(owner)

        and: "the repository saves whatever activity it is given"
            Activity savedArgument = null
            activityRepository.save(_ as Activity) >> { Activity a -> savedArgument = a; return a }

        and: "a valid create request"
            def request = new ActivityRequest("Walk", ActivityCategory.ROUTINE, null, null)

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
            def created = service.create("steve", new ActivityRequest("Walk", ActivityCategory.ROUTINE, description, null))

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
            activityRepository.findByOwnerAndArchivedFalseOrderByFavouriteDescNameAsc(owner) >> activities
            subTaskRepository.countGroupedByActivityIdForOwner(owner) >> []

        when: "activities are listed for that username, excluding archived (default)"
            def result = service.listForOwner("steve", false)

        then: "the repository's result is returned unchanged, paired with its sub-task count"
            result*.activity() == activities
    }

    def "PLANNER-002-AC-11: listForOwner returns an empty list when the owner has no activities"() {
        given:
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByOwnerAndArchivedFalseOrderByFavouriteDescNameAsc(owner) >> []
            subTaskRepository.countGroupedByActivityIdForOwner(owner) >> []

        when:
            def result = service.listForOwner("steve", false)

        then:
            result.isEmpty()
    }

    def "PLANNER-006-AC-10/AC-11: listForOwner queries the archived-inclusive repository method only when includeArchived is true"() {
        given: "the authenticated username resolves to a User"
            userRepository.findByUsername("steve") >> Optional.of(owner)

        and: "the repository returns activities for the full (mixed) list"
            def activities = [new Activity("Bake", ActivityCategory.PLEASURABLE, null, owner)]
            activityRepository.findByOwnerOrderByFavouriteDescNameAsc(owner) >> activities
            subTaskRepository.countGroupedByActivityIdForOwner(owner) >> []

        when: "activities are listed with includeArchived=true"
            def result = service.listForOwner("steve", true)

        then: "the archived-inclusive query is used, and the excluding one is never called"
            result*.activity() == activities
            0 * activityRepository.findByOwnerAndArchivedFalseOrderByFavouriteDescNameAsc(_)
    }

    def "PLANNER-012-AC-01: listForOwner pairs each activity with its own owner-scoped sub-task count"() {
        given: "the authenticated username resolves to a User"
            userRepository.findByUsername("steve") >> Optional.of(owner)

        and: "the owner has two activities, one with sub-tasks and one without"
            def withSubTasks = withId(new Activity("Walk", ActivityCategory.ROUTINE, null, owner), UUID.randomUUID())
            def withoutSubTasks = withId(new Activity("Read", ActivityCategory.PLEASURABLE, null, owner), UUID.randomUUID())
            activityRepository.findByOwnerAndArchivedFalseOrderByFavouriteDescNameAsc(owner) >> [withSubTasks, withoutSubTasks]
            subTaskRepository.countGroupedByActivityIdForOwner(owner) >> [new SubTaskCountProjection(withSubTasks.id, 2L)]

        when: "activities are listed"
            def result = service.listForOwner("steve", false)

        then: "each activity's own count is carried through, not shared or swapped"
            result.find { it.activity() == withSubTasks }.subTaskCount() == 2
            result.find { it.activity() == withoutSubTasks }.subTaskCount() == 0
    }

    def "PLANNER-012-AC-02: listForOwner's sub-task counts are scoped to the resolved owner, not a client-suppliable value"() {
        given: "the authenticated username resolves to a User"
            userRepository.findByUsername("steve") >> Optional.of(owner)

        and: "the owner has one activity"
            def activity = new Activity("Walk", ActivityCategory.ROUTINE, null, owner)
            activityRepository.findByOwnerAndArchivedFalseOrderByFavouriteDescNameAsc(owner) >> [activity]

        when: "activities are listed"
            service.listForOwner("steve", false)

        then: "the grouped count query is issued against the resolved owner, never any other user"
            1 * subTaskRepository.countGroupedByActivityIdForOwner(owner) >> []
    }

    def "PLANNER-018-AC-04: listForOwner resolves subTaskCount via one bulk grouped query, with byte-identical values to the old per-activity loop"() {
        given: "the authenticated username resolves to a User"
            userRepository.findByUsername("steve") >> Optional.of(owner)

        and: "three activities with varying sub-task counts, including zero"
            def activityWithTwo = withId(new Activity("Walk", ActivityCategory.ROUTINE, null, owner), UUID.randomUUID())
            def activityWithZero = withId(new Activity("Read", ActivityCategory.PLEASURABLE, null, owner), UUID.randomUUID())
            def activityWithFive = withId(new Activity("Cook", ActivityCategory.NECESSARY, null, owner), UUID.randomUUID())
            activityRepository.findByOwnerAndArchivedFalseOrderByFavouriteDescNameAsc(owner) >>
                [activityWithTwo, activityWithZero, activityWithFive]

        when: "activities are listed"
            def result = service.listForOwner("steve", false)

        then: "the grouped query is called exactly once, not once per activity (activityWithZero is absent from the result -- it has no sub-tasks)"
            1 * subTaskRepository.countGroupedByActivityIdForOwner(owner) >> [
                new SubTaskCountProjection(activityWithTwo.id, 2L),
                new SubTaskCountProjection(activityWithFive.id, 5L)
            ]
            0 * subTaskRepository.countByActivityIdAndOwner(_, _)

        and: "each activity's own count is carried through correctly, including the implicit zero"
            result*.subTaskCount() == [2L, 0L, 5L]
    }

    def "PLANNER-012-AC-01: countSubTasks returns the owner-scoped count for a single activity"() {
        given: "the authenticated username resolves to a User"
            def activityId = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            subTaskRepository.countByActivityIdAndOwner(activityId, owner) >> 3

        when: "the sub-task count is requested for that activity"
            def count = service.countSubTasks("steve", activityId)

        then:
            count == 3
    }

    def "PLANNER-002-AC-07/AC-12: update changes name, category, and description on the owner's activity"() {
        given: "the authenticated username resolves to a User, who owns the target activity"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Walk", ActivityCategory.ROUTINE, null, owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        and: "the category is changing, so the PLANNER-014-AC-01 cascade looks up this owner's sub-tasks (none here)"
            subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(existing.id, owner) >> []

        when: "the activity is updated"
            def result = service.update("steve", id, new ActivityRequest("Jog", ActivityCategory.PLEASURABLE, "with music", null))

        then: "the updated activity is returned"
            result.isPresent()
            result.get().name == "Jog"
            result.get().category == ActivityCategory.PLEASURABLE
            result.get().description == "with music"
    }

    def "PLANNER-014-AC-01: update recategorizes every existing sub-task when the activity's category changes"() {
        given: "the authenticated username resolves to a User, who owns the target activity and two sub-tasks"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)
            def guestList = new SubTask(existing, "Create a guest list", ActivityCategory.PLEASURABLE, owner)
            def venue = new SubTask(existing, "Book a venue", ActivityCategory.PLEASURABLE, owner)
            subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(existing.id, owner) >> [guestList, venue]

        when: "the activity's category is changed to NECESSARY"
            service.update("steve", id, new ActivityRequest(existing.name, ActivityCategory.NECESSARY, existing.description, null))

        then: "both sub-tasks are recategorized to match"
            guestList.category == ActivityCategory.NECESSARY
            venue.category == ActivityCategory.NECESSARY
    }

    def "PLANNER-014-AC-02: update never queries for sub-tasks to cascade when the category is unchanged"() {
        given: "the authenticated username resolves to a User, who owns the target activity"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Walk", ActivityCategory.ROUTINE, null, owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "the activity is updated with the same category, only the name changed"
            service.update("steve", id, new ActivityRequest("Jog", ActivityCategory.ROUTINE, null, null))

        then: "the PLANNER-014-AC-01 cascade lookup never runs -- no unnecessary sub-task query/write"
            0 * subTaskRepository.findByActivityIdAndOwnerOrderByPositionAsc(_, _)
    }

    def "PLANNER-002-AC-15/AC-18: update returns empty when the id doesn't exist or belongs to a different owner"() {
        given: "the repository finds no activity for this owner and id"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "an update is attempted"
            def result = service.update("steve", id, new ActivityRequest("Jog", ActivityCategory.PLEASURABLE, null, null))

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

    def "PLANNER-006-AC-01: create defaults repeatable to true when the request omits it"() {
        given:
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.save(_ as Activity) >> { Activity a -> a }

        when: "an activity is created with no repeatable field in the request"
            def created = service.create("steve", new ActivityRequest("Go for a walk", ActivityCategory.PLEASURABLE, null, null))

        then: "repeatable defaults to true"
            created.repeatable
    }

    def "PLANNER-006-AC-02: create honours an explicit repeatable: false"() {
        given:
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.save(_ as Activity) >> { Activity a -> a }

        when: "an activity is created with repeatable: false"
            def created = service.create("steve", new ActivityRequest("Apply for jobs", ActivityCategory.NECESSARY, null, false))

        then: "repeatable is false"
            !created.repeatable
    }

    def "PLANNER-006-AC-03: update changes the repeatable field on the owner's activity, exactly like name/category/description"() {
        given: "the authenticated username resolves to a User, who owns the target activity"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, true, owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "the activity is updated with repeatable: false"
            def result = service.update("steve", id, new ActivityRequest("Apply for jobs", ActivityCategory.NECESSARY, null, false))

        then: "repeatable is updated"
            result.isPresent()
            !result.get().repeatable
    }

    def "PLANNER-006-AC-05/AC-06: archive sets archived to true, idempotently, on the owner's activity"() {
        given: "the authenticated username resolves to a User, who owns the target activity"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            if (alreadyArchived) {
                existing.archive()
            }
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "archive is requested"
            def result = service.archive("steve", id)

        then: "the activity is archived, whether or not it already was"
            result.isPresent()
            result.get().archived

        where:
            alreadyArchived << [false, true]
    }

    def "PLANNER-006-AC-07: archive returns empty when the id doesn't exist or belongs to a different owner"() {
        given:
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "archive is attempted"
            def result = service.archive("steve", id)

        then: "the result is empty"
            result.isEmpty()
    }

    def "PLANNER-006-AC-08: unarchive sets archived to false on the owner's activity and returns true"() {
        given: "the authenticated username resolves to a User, who owns an already-archived activity"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            existing.archive()
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "unarchive is requested"
            def unarchived = service.unarchive("steve", id)

        then: "the activity is no longer archived, and the service reports success"
            !existing.archived
            unarchived
    }

    def "PLANNER-006-AC-09: unarchive returns false when the id doesn't exist or belongs to a different owner"() {
        given:
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "unarchive is attempted"
            def unarchived = service.unarchive("steve", id)

        then: "the service reports failure"
            !unarchived
    }

    def "PLANNER-015-AC-03/AC-04: markFavourite sets favourite to true, idempotently, on the owner's activity"() {
        given: "the authenticated username resolves to a User, who owns the target activity"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            if (alreadyFavourite) {
                existing.markFavourite()
            }
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "markFavourite is requested"
            def result = service.markFavourite("steve", id)

        then: "the activity is favourited, whether or not it already was"
            result.isPresent()
            result.get().favourite

        where:
            alreadyFavourite << [false, true]
    }

    def "PLANNER-015-AC-05: markFavourite returns empty when the id doesn't exist or belongs to a different owner"() {
        given:
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "markFavourite is attempted"
            def result = service.markFavourite("steve", id)

        then: "the result is empty"
            result.isEmpty()
    }

    def "PLANNER-015-AC-06/AC-07: unmarkFavourite sets favourite to false on the owner's activity and returns true, idempotently"() {
        given: "the authenticated username resolves to a User, who owns a favourited activity"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            existing.markFavourite()
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "unmarkFavourite is requested"
            def unmarked = service.unmarkFavourite("steve", id)

        then: "the activity is no longer favourited, and the service reports success"
            !existing.favourite
            unmarked
    }

    def "PLANNER-015-AC-08: unmarkFavourite returns false when the id doesn't exist or belongs to a different owner"() {
        given:
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            activityRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "unmarkFavourite is attempted"
            def unmarked = service.unmarkFavourite("steve", id)

        then: "the service reports failure"
            !unmarked
    }

    def "PLANNER-015-AC-09: archive/unarchive never change favourite, and markFavourite/unmarkFavourite never change archived"() {
        given: "the authenticated username resolves to a User, who owns a favourited activity"
            def id = UUID.randomUUID()
            userRepository.findByUsername("steve") >> Optional.of(owner)
            def existing = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            existing.markFavourite()
            activityRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "the activity is archived"
            def archived = service.archive("steve", id).get()

        then: "favourite is unchanged"
            archived.favourite
            archived.archived

        when: "favourite is unmarked"
            service.unmarkFavourite("steve", id)

        then: "archived is unchanged"
            existing.archived
            !existing.favourite
    }
}
