package uk.co.stefirby.behaviouralactivation.service

import spock.lang.Specification

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate

import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceMoveRequest
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceRequest
import uk.co.stefirby.behaviouralactivation.exception.CarryForwardNotAllowedException
import uk.co.stefirby.behaviouralactivation.exception.InvalidPlanRequestException
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.CompletionRecord
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence
import uk.co.stefirby.behaviouralactivation.model.PlanSlot
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.CompletionRecordRepository
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

class PlanServiceSpec extends Specification {

    PlannedOccurrenceRepository plannedOccurrenceRepository = Mock()
    CompletionRecordRepository completionRecordRepository = Mock()
    ActivityRepository activityRepository = Mock()
    SubTaskRepository subTaskRepository = Mock()
    UserRepository userRepository = Mock()
    PlanService service = new PlanService(plannedOccurrenceRepository, completionRecordRepository,
        activityRepository, subTaskRepository, userRepository)

    User owner = new User("steve", "hashed-password")
    LocalDate monday = LocalDate.of(2026, 10, 5)

    def setup() {
        userRepository.findByUsername("steve") >> Optional.of(owner)
    }

    def "PLANNER-004-AC-01: getWeek returns the repository's owner-and-week-scoped, createdAt-ordered result"() {
        given: "the repository returns a fixed list for this owner and week"
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def occurrences = [new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)]
            plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, monday) >> occurrences

        when: "the week is fetched"
            def result = service.getWeek("steve", monday)

        then: "the repository's result is returned unchanged"
            result == occurrences
    }

    def "PLANNER-004-AC-05: getWeek returns an empty list, not an error, when nothing is planned"() {
        given: "the repository finds nothing for this owner and week"
            plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(owner, monday) >> []

        when: "the week is fetched"
            def result = service.getWeek("steve", monday)

        then: "the result is present but empty"
            result.isEmpty()
    }

    def "PLANNER-004-AC-03/AC-04: getWeek throws InvalidPlanRequestException for a missing or non-Monday weekStart, without querying"() {
        when: "the week is fetched with an invalid weekStart"
            service.getWeek("steve", weekStart)

        then: "an InvalidPlanRequestException is thrown, and the repository is never queried"
            thrown(InvalidPlanRequestException)
            0 * plannedOccurrenceRepository.findByOwnerAndWeekStartOrderByCreatedAtAsc(_, _)

        where:
            weekStart << [null, LocalDate.of(2026, 10, 6)]
    }

    def "PLANNER-004-AC-06/AC-08/AC-09: create builds a scheduled occurrence with category copied from the activity"() {
        given: "an owned activity"
            def activityId = UUID.randomUUID()
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.of(activity)
            def request = new PlannedOccurrenceRequest(activityId, null, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)

        and: "the repository saves whatever occurrence it is given"
            PlannedOccurrence saved = null
            plannedOccurrenceRepository.save(_ as PlannedOccurrence) >> { PlannedOccurrence o -> saved = o; return o }

        when: "an occurrence is created"
            def result = service.create("steve", request)

        then: "the saved occurrence copies the activity's category and is owned by the resolved User"
            saved.category == ActivityCategory.ROUTINE
            saved.owner == owner
            saved.activity == activity
            saved.subTask == null
            saved.dayOfWeek == DayOfWeek.MONDAY
            saved.slot == PlanSlot.MORNING

        and: "the returned occurrence reflects the saved values"
            result.isPresent()
            result.get() == saved
    }

    def "PLANNER-004-AC-07/AC-08: create builds a weekend-bucket occurrence with category copied from the sub-task"() {
        given: "an owned sub-task"
            def subTaskId = UUID.randomUUID()
            def activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)
            def subTask = new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner)
            subTaskRepository.findByIdAndOwner(subTaskId, owner) >> Optional.of(subTask)
            def request = new PlannedOccurrenceRequest(null, subTaskId, monday, null, null)

        and: "the repository saves whatever occurrence it is given"
            PlannedOccurrence saved = null
            plannedOccurrenceRepository.save(_ as PlannedOccurrence) >> { PlannedOccurrence o -> saved = o; return o }

        when: "an occurrence is created"
            def result = service.create("steve", request)

        then: "the saved occurrence copies the sub-task's category, has no day/slot, and is a bucket item"
            saved.category == ActivityCategory.PLEASURABLE
            saved.subTask == subTask
            saved.activity == null
            saved.dayOfWeek == null
            saved.slot == null
            saved.bucketItem
            result.isPresent()
    }

    def "PLANNER-004-AC-10: create throws InvalidPlanRequestException when neither or both of activityId/subTaskId are set, without saving"() {
        given: "a request with an invalid activityId/subTaskId combination"
            def request = new PlannedOccurrenceRequest(activityId, subTaskId, monday, null, null)

        when: "an occurrence is created"
            service.create("steve", request)

        then: "an InvalidPlanRequestException is thrown, and nothing is saved"
            thrown(InvalidPlanRequestException)
            0 * plannedOccurrenceRepository.save(_)
            0 * activityRepository.findByIdAndOwner(_, _)
            0 * subTaskRepository.findByIdAndOwner(_, _)

        where:
            activityId          | subTaskId
            null                 | null
            UUID.randomUUID()   | UUID.randomUUID()
    }

    def "PLANNER-004-AC-12: create throws InvalidPlanRequestException when exactly one of dayOfWeek/slot is set, without saving"() {
        given: "a request with an unpaired dayOfWeek/slot"
            def activityId = UUID.randomUUID()
            def request = new PlannedOccurrenceRequest(activityId, null, monday, dayOfWeek, slot)

        when: "an occurrence is created"
            service.create("steve", request)

        then: "an InvalidPlanRequestException is thrown, and nothing is saved"
            thrown(InvalidPlanRequestException)
            0 * plannedOccurrenceRepository.save(_)

        where:
            dayOfWeek          | slot
            DayOfWeek.MONDAY   | null
            null                | PlanSlot.MORNING
    }

    def "PLANNER-004-AC-13: create throws InvalidPlanRequestException for a missing or non-Monday weekStart, without saving"() {
        given: "a request with an invalid weekStart"
            def activityId = UUID.randomUUID()
            def request = new PlannedOccurrenceRequest(activityId, null, LocalDate.of(2026, 10, 6),
                DayOfWeek.MONDAY, PlanSlot.MORNING)

        when: "an occurrence is created"
            service.create("steve", request)

        then: "an InvalidPlanRequestException is thrown, and nothing is saved"
            thrown(InvalidPlanRequestException)
            0 * plannedOccurrenceRepository.save(_)
            0 * activityRepository.findByIdAndOwner(_, _)
    }

    def "PLANNER-004-AC-14/AC-36: create returns empty (404) when activityId doesn't exist or isn't owned by the caller"() {
        given: "the repository finds no owned activity for this id"
            def activityId = UUID.randomUUID()
            activityRepository.findByIdAndOwner(activityId, owner) >> Optional.empty()
            def request = new PlannedOccurrenceRequest(activityId, null, monday, DayOfWeek.MONDAY, PlanSlot.MORNING)

        when: "an occurrence is created"
            def result = service.create("steve", request)

        then: "the result is empty, and nothing is saved"
            result.isEmpty()
            0 * plannedOccurrenceRepository.save(_)
    }

    def "PLANNER-004-AC-15/AC-36: create returns empty (404) when subTaskId doesn't exist or isn't owned by the caller"() {
        given: "the repository finds no owned sub-task for this id"
            def subTaskId = UUID.randomUUID()
            subTaskRepository.findByIdAndOwner(subTaskId, owner) >> Optional.empty()
            def request = new PlannedOccurrenceRequest(null, subTaskId, monday, null, null)

        when: "an occurrence is created"
            def result = service.create("steve", request)

        then: "the result is empty, and nothing is saved"
            result.isEmpty()
            0 * plannedOccurrenceRepository.save(_)
    }

    def "PLANNER-004-AC-16: move with both dayOfWeek and slot set reschedules the occurrence"() {
        given: "an existing owned occurrence, currently a bucket item"
            def id = UUID.randomUUID()
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def existing = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday, null, null, owner)
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)
            def request = new PlannedOccurrenceMoveRequest(DayOfWeek.WEDNESDAY, PlanSlot.EVENING)

        when: "the occurrence is moved"
            def result = service.move("steve", id, request)

        then: "the occurrence is scheduled to the new day/slot"
            result.isPresent()
            result.get().dayOfWeek == DayOfWeek.WEDNESDAY
            result.get().slot == PlanSlot.EVENING
    }

    def "PLANNER-004-AC-17: move with both dayOfWeek and slot cleared demotes the occurrence to the bucket, leaving weekStart unchanged"() {
        given: "an existing owned, scheduled occurrence"
            def id = UUID.randomUUID()
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def existing = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)
            def request = new PlannedOccurrenceMoveRequest(null, null)

        when: "the occurrence is moved"
            def result = service.move("steve", id, request)

        then: "the occurrence is demoted to the bucket, weekStart unchanged"
            result.isPresent()
            result.get().dayOfWeek == null
            result.get().slot == null
            result.get().weekStart == monday
    }

    def "PLANNER-004-AC-18: move throws InvalidPlanRequestException when exactly one of dayOfWeek/slot is set, applying no change"() {
        given: "an existing owned occurrence"
            def id = UUID.randomUUID()
            def request = new PlannedOccurrenceMoveRequest(dayOfWeek, slot)

        when: "the occurrence is moved"
            service.move("steve", id, request)

        then: "an InvalidPlanRequestException is thrown, and the repository is never looked up"
            thrown(InvalidPlanRequestException)
            0 * plannedOccurrenceRepository.findByIdAndOwner(_, _)

        where:
            dayOfWeek          | slot
            DayOfWeek.MONDAY   | null
            null                | PlanSlot.MORNING
    }

    def "PLANNER-004-AC-19/AC-36: move returns empty (404) when the id doesn't exist or isn't owned by the caller"() {
        given: "the repository finds no owned occurrence for this id"
            def id = UUID.randomUUID()
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.empty()
            def request = new PlannedOccurrenceMoveRequest(DayOfWeek.MONDAY, PlanSlot.MORNING)

        when: "the occurrence is moved"
            def result = service.move("steve", id, request)

        then: "the result is empty"
            result.isEmpty()
    }

    def "PLANNER-004-AC-20: delete removes the owner's occurrence and returns true, without deleting the underlying activity"() {
        given: "an existing owned occurrence"
            def id = UUID.randomUUID()
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def existing = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "delete is requested"
            def deleted = service.delete("steve", id)

        then: "the repository deletes only the occurrence"
            1 * plannedOccurrenceRepository.delete(existing)
            0 * activityRepository.delete(_)

        and: "the service reports success"
            deleted
    }

    def "PLANNER-004-AC-21/AC-36: delete returns false, and deletes nothing, when the id doesn't exist or isn't owned by the caller"() {
        given: "the repository finds no owned occurrence for this id"
            def id = UUID.randomUUID()
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "delete is attempted"
            def deleted = service.delete("steve", id)

        then: "nothing is deleted"
            0 * plannedOccurrenceRepository.delete(_)

        and: "the service reports failure"
            !deleted
    }

    def "PLANNER-004-AC-22/AC-35: complete creates a CompletionRecord owned by the caller when none exists"() {
        given: "an existing owned occurrence with no CompletionRecord yet"
            def id = UUID.randomUUID()
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def existing = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)
            completionRecordRepository.findByPlannedOccurrenceIdAndOwner(_, owner) >> Optional.empty()

        and: "the repository saves whatever record it is given"
            CompletionRecord saved = null
            completionRecordRepository.save(_ as CompletionRecord) >> { CompletionRecord r -> saved = r; return r }

        when: "the occurrence is completed"
            def result = service.complete("steve", id)

        then: "a new CompletionRecord is created, owned by the caller, referencing the occurrence"
            result.isPresent()
            saved.owner == owner
            saved.plannedOccurrence == existing
            saved.completedAt != null
    }

    def "PLANNER-004-AC-23: re-completing an already-complete occurrence updates completedAt rather than creating a second record"() {
        given: "an existing owned occurrence with an existing CompletionRecord"
            def id = UUID.randomUUID()
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def existing = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            def existingCompletion = new CompletionRecord(existing, owner, Instant.parse("2026-10-05T09:00:00Z"))
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)
            completionRecordRepository.findByPlannedOccurrenceIdAndOwner(_, owner) >> Optional.of(existingCompletion)

        when: "the occurrence is completed again"
            def result = service.complete("steve", id)

        then: "the existing record's completedAt is updated, and no second record is saved"
            result.isPresent()
            result.get() == existingCompletion
            0 * completionRecordRepository.save(_)
    }

    def "PLANNER-004-AC-26: complete returns empty (404) when the id doesn't exist or isn't owned by the caller"() {
        given: "the repository finds no owned occurrence for this id"
            def id = UUID.randomUUID()
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "complete is attempted"
            def result = service.complete("steve", id)

        then: "the result is empty, and nothing is saved"
            result.isEmpty()
            0 * completionRecordRepository.save(_)
    }

    def "PLANNER-004-AC-24: uncomplete deletes the occurrence's CompletionRecord and returns true"() {
        given: "an existing owned, completed occurrence"
            def id = UUID.randomUUID()
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def existing = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            def completion = new CompletionRecord(existing, owner, Instant.now())
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)
            completionRecordRepository.findByPlannedOccurrenceIdAndOwner(_, owner) >> Optional.of(completion)

        when: "uncomplete is requested"
            def removed = service.uncomplete("steve", id)

        then: "the CompletionRecord is deleted"
            1 * completionRecordRepository.delete(completion)

        and: "the service reports success"
            removed
    }

    def "PLANNER-004-AC-25: uncomplete returns false when the occurrence has no current CompletionRecord"() {
        given: "an existing owned occurrence with no CompletionRecord"
            def id = UUID.randomUUID()
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def existing = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)
            completionRecordRepository.findByPlannedOccurrenceIdAndOwner(_, owner) >> Optional.empty()

        when: "uncomplete is requested"
            def removed = service.uncomplete("steve", id)

        then: "nothing is deleted, and the service reports failure"
            0 * completionRecordRepository.delete(_)
            !removed
    }

    def "PLANNER-004-AC-26: uncomplete returns false when the id doesn't exist or isn't owned by the caller"() {
        given: "the repository finds no owned occurrence for this id"
            def id = UUID.randomUUID()
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "uncomplete is attempted"
            def removed = service.uncomplete("steve", id)

        then: "nothing is deleted, and the service reports failure"
            0 * completionRecordRepository.delete(_)
            !removed
    }

    def "PLANNER-004-AC-28: carryForward advances weekStart by 7 days, keeping the same occurrence, for an incomplete bucket item"() {
        given: "an existing owned, incomplete weekend-bucket occurrence"
            def id = UUID.randomUUID()
            def activity = new Activity("Go for a bike ride", ActivityCategory.PLEASURABLE, null, owner)
            def existing = new PlannedOccurrence(activity, null, ActivityCategory.PLEASURABLE, monday, null, null, owner)
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)
            completionRecordRepository.findByPlannedOccurrenceIdAndOwner(_, owner) >> Optional.empty()

        when: "carry-forward is requested"
            def result = service.carryForward("steve", id)

        then: "weekStart is advanced by 7 days on the same occurrence"
            result.isPresent()
            result.get() == existing
            result.get().weekStart == monday.plusDays(7)
    }

    def "PLANNER-004-AC-29: carryForward throws CarryForwardNotAllowedException for a scheduled (non-bucket) occurrence, without changing weekStart"() {
        given: "an existing owned, scheduled occurrence"
            def id = UUID.randomUUID()
            def activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
            def existing = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)

        when: "carry-forward is requested"
            service.carryForward("steve", id)

        then: "a CarryForwardNotAllowedException is thrown, and weekStart is unchanged"
            thrown(CarryForwardNotAllowedException)
            existing.weekStart == monday
    }

    def "PLANNER-004-AC-30: carryForward throws CarryForwardNotAllowedException for an already-complete occurrence, without changing weekStart"() {
        given: "an existing owned, complete weekend-bucket occurrence"
            def id = UUID.randomUUID()
            def activity = new Activity("Go for a bike ride", ActivityCategory.PLEASURABLE, null, owner)
            def existing = new PlannedOccurrence(activity, null, ActivityCategory.PLEASURABLE, monday, null, null, owner)
            def completion = new CompletionRecord(existing, owner, Instant.now())
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.of(existing)
            completionRecordRepository.findByPlannedOccurrenceIdAndOwner(_, owner) >> Optional.of(completion)

        when: "carry-forward is requested"
            service.carryForward("steve", id)

        then: "a CarryForwardNotAllowedException is thrown, and weekStart is unchanged"
            thrown(CarryForwardNotAllowedException)
            existing.weekStart == monday
    }

    def "PLANNER-004-AC-31: carryForward returns empty (404) when the id doesn't exist or isn't owned by the caller"() {
        given: "the repository finds no owned occurrence for this id"
            def id = UUID.randomUUID()
            plannedOccurrenceRepository.findByIdAndOwner(id, owner) >> Optional.empty()

        when: "carry-forward is attempted"
            def result = service.carryForward("steve", id)

        then: "the result is empty"
            result.isEmpty()
    }

    def "PLANNER-004-AC-27: findCompletions returns a bulk map keyed by occurrence id, without querying for an empty id list"() {
        given: "no occurrence ids"
        when: "completions are looked up"
            def result = service.findCompletions("steve", [])

        then: "an empty map is returned, and the repository is never queried"
            result.isEmpty()
            0 * completionRecordRepository.findByOwnerAndPlannedOccurrenceIdIn(_, _)
    }
}
