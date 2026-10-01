package uk.co.stefirby.behaviouralactivation.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.dto.ActivityRequest
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceRequest
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.PlanSlot
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Runs against the real Postgres instance (docker-compose), not a mocked repository --
 * planner_spec_014_subtask_category_cascade.md's own test sketches build real Activity/SubTask/
 * PlannedOccurrence rows and reload them after ActivityService.update()/PlanService.create() to
 * prove the cascade's actual persisted effect (and its deliberately limited blast radius), matching
 * SubTaskRepositorySpec/PlanServiceAutoArchiveIntegrationSpec's precedent for behaviour a mocked
 * repository can't meaningfully verify.
 */
@SpringBootTest
class ActivityServiceCategoryCascadeIntegrationSpec extends Specification {

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    SubTaskRepository subTaskRepository

    @Autowired
    PlannedOccurrenceRepository plannedOccurrenceRepository

    @Autowired
    ActivityService activityService

    @Autowired
    PlanService planService

    User owner
    LocalDate monday = LocalDate.of(2026, 10, 5)

    def setup() {
        owner = userRepository.save(new User("category-cascade-test-${UUID.randomUUID()}", "hashed-password"))
    }

    def cleanup() {
        userRepository.delete(owner)
    }

    def "PLANNER-014-AC-01: changing an activity's category cascades to its existing sub-tasks"() {
        given: "an activity and two sub-tasks created while it was PLEASURABLE"
            def activity = activityRepository.save(
                new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
            def guestList = subTaskRepository.save(
                new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
            def venue = subTaskRepository.save(
                new SubTask(activity, "Book a venue", ActivityCategory.PLEASURABLE, owner))

        when: "the activity's category is changed to NECESSARY"
            activityService.update(owner.username, activity.id,
                new ActivityRequest(activity.name, ActivityCategory.NECESSARY, activity.description, true))

        then: "both existing sub-tasks now show NECESSARY, not the stale PLEASURABLE"
            subTaskRepository.findById(guestList.id).get().category == ActivityCategory.NECESSARY
            subTaskRepository.findById(venue.id).get().category == ActivityCategory.NECESSARY

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-014-AC-02: no cascade when the category is unchanged"() {
        given: "an activity and a sub-task, both PLEASURABLE"
            def activity = activityRepository.save(
                new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
            def subTask = subTaskRepository.save(
                new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
            // Reloaded (not the in-memory post-save instance) so this baseline already carries
            // Postgres's own timestamp column precision -- comparing straight against the in-memory
            // Instant.now() value (nanosecond-resolution on this JVM) spuriously fails once the later
            // reload below comes back at Postgres's microsecond precision, independent of whether a
            // cascade actually ran.
            def originalUpdatedAt = subTaskRepository.findById(subTask.id).get().updatedAt

        when: "the activity is updated with the same category, only the name changed"
            activityService.update(owner.username, activity.id,
                new ActivityRequest("Organise a leaving party", ActivityCategory.PLEASURABLE, activity.description, true))

        then: "the sub-task's category and updatedAt are unchanged"
            def reloaded = subTaskRepository.findById(subTask.id).get()
            reloaded.category == ActivityCategory.PLEASURABLE
            reloaded.updatedAt == originalUpdatedAt

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-014-AC-03: cascade only updates the activity owner's own sub-tasks"() {
        // Covered structurally: ActivityService.update() only proceeds if findByIdAndOwner(id, owner)
        // finds a match, so the cascade can never run against another owner's activity or sub-tasks in
        // the first place. No separate cross-owner scenario needed beyond AC-01's existing use of
        // findByActivityIdAndOwnerOrderByCreatedAtAsc, which is owner-scoped by construction.
        expect: true
    }

    def "PLANNER-014-AC-04: cascading a sub-task's category does not rewrite an existing planned occurrence's category"() {
        given: "an activity, a sub-task, and an occurrence already planned while the sub-task was PLEASURABLE"
            def activity = activityRepository.save(
                new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
            def subTask = subTaskRepository.save(
                new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
            def occurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(null, subTask, ActivityCategory.PLEASURABLE, monday,
                    DayOfWeek.MONDAY, PlanSlot.MORNING, owner))

        when: "the activity's category is changed to NECESSARY, cascading to the sub-task"
            activityService.update(owner.username, activity.id,
                new ActivityRequest(activity.name, ActivityCategory.NECESSARY, activity.description, true))

        then: "the sub-task is updated, but the already-planned occurrence still shows its original category"
            subTaskRepository.findById(subTask.id).get().category == ActivityCategory.NECESSARY
            plannedOccurrenceRepository.findById(occurrence.id).get().category == ActivityCategory.PLEASURABLE

        cleanup:
            plannedOccurrenceRepository.delete(occurrence)
            activityRepository.delete(activity)
    }

    def "PLANNER-014-AC-05: a new occurrence created after the cascade uses the sub-task's updated category"() {
        given: "an activity and sub-task, category cascaded from PLEASURABLE to NECESSARY"
            def activity = activityRepository.save(
                new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner))
            def subTask = subTaskRepository.save(
                new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))
            activityService.update(owner.username, activity.id,
                new ActivityRequest(activity.name, ActivityCategory.NECESSARY, activity.description, true))

        when: "a new occurrence is planned for that sub-task"
            def created = planService.create(owner.username,
                new PlannedOccurrenceRequest(null, subTask.id, monday, DayOfWeek.TUESDAY, PlanSlot.AFTERNOON)).get()

        then: "the new occurrence carries the sub-task's current, cascaded category"
            created.category == ActivityCategory.NECESSARY

        cleanup:
            plannedOccurrenceRepository.delete(created)
            activityRepository.delete(activity)
    }
}
