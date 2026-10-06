package uk.co.stefirby.behaviouralactivation.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.CompletionRecord
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence
import uk.co.stefirby.behaviouralactivation.model.PlanSlot
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.model.WorkDayOverride
import uk.co.stefirby.behaviouralactivation.model.WorkDayPattern
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository
import uk.co.stefirby.behaviouralactivation.repository.CompletionRecordRepository
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository
import uk.co.stefirby.behaviouralactivation.repository.UserRepository
import uk.co.stefirby.behaviouralactivation.repository.WorkDayOverrideRepository
import uk.co.stefirby.behaviouralactivation.repository.WorkDayPatternRepository

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate

/**
 * Runs against the real Postgres instance (docker-compose) -- planner_spec_025_data_export.md's
 * own implementation note flags cross-user scoping (AC-02) and SQL escaping (AC-08) as depending on
 * real per-row data a mocked repository can't meaningfully prove, and the remaining content/
 * ordering/safety ACs are most directly proved against the same real fixtures. Mirrors
 * SubTaskServiceReorderIntegrationSpec's own throwaway-User setup()/cleanup() pattern.
 */
@SpringBootTest
class ExportServiceIntegrationSpec extends Specification {

    @Autowired
    UserRepository userRepository

    @Autowired
    ActivityRepository activityRepository

    @Autowired
    SubTaskRepository subTaskRepository

    @Autowired
    PlannedOccurrenceRepository plannedOccurrenceRepository

    @Autowired
    CompletionRecordRepository completionRecordRepository

    @Autowired
    WorkDayPatternRepository workDayPatternRepository

    @Autowired
    WorkDayOverrideRepository workDayOverrideRepository

    @Autowired
    ExportService exportService

    User owner
    LocalDate monday = LocalDate.of(2026, 10, 5)

    def setup() {
        owner = userRepository.save(new User("export-test-${UUID.randomUUID()}", "hashed-password"))
    }

    def cleanup() {
        userRepository.delete(owner)
    }

    def "PLANNER-025-AC-02: export includes only the authenticated user's own data"() {
        given: "an activity owned by a different user, and one owned by the caller"
            def otherOwner = userRepository.save(new User("other-${UUID.randomUUID()}", "hashed"))
            def foreignActivity = activityRepository.save(new Activity("Not mine", ActivityCategory.ROUTINE, null, otherOwner))
            def myActivity = activityRepository.save(new Activity("Mine", ActivityCategory.ROUTINE, null, owner))

        when: "the caller exports their data"
            def sql = exportService.generateExport(owner.username)

        then: "only the caller's own activity appears"
            sql.contains("'Mine'")
            !sql.contains("'Not mine'")

        cleanup:
            activityRepository.delete(myActivity)
            activityRepository.delete(foreignActivity)
            userRepository.delete(otherOwner)
    }

    def "PLANNER-025-AC-03: activities are exported with their original id, columns, and a user_id subquery"() {
        given: "an owned activity"
            def activity = activityRepository.save(
                new Activity("Go for a walk", ActivityCategory.ROUTINE, "Around the block", owner))

        when: "the data is exported"
            def sql = exportService.generateExport(owner.username)

        then: "the INSERT contains the activity's id, name, category, and a user_id subquery, never a literal UUID"
            sql.contains("INSERT INTO activities")
            sql.contains("'${activity.id}'")
            sql.contains("'Go for a walk'")
            sql.contains("'ROUTINE'")
            sql.contains("(SELECT id FROM users WHERE username = '${owner.username}')")
            !sql.contains("'${owner.id}'")

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-025-AC-04: sub-tasks are exported with their original id and intact activity_id FK"() {
        given: "an activity with one sub-task"
            def activity = activityRepository.save(new Activity("Clean the house", ActivityCategory.ROUTINE, null, owner))
            def subTask = subTaskRepository.save(new SubTask(activity, "Vacuum", ActivityCategory.ROUTINE, owner))

        when: "the data is exported"
            def sql = exportService.generateExport(owner.username)

        then: "the sub-task's INSERT references the same activity id emitted for its parent"
            sql.contains("INSERT INTO sub_tasks")
            sql.contains("'${subTask.id}'")
            sql.contains("'${activity.id}'")
            sql.contains("'Vacuum'")

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-025-AC-05: planned occurrences are exported preserving the activity/sub-task XOR"() {
        given: "an activity-targeted occurrence and a sub-task-targeted occurrence"
            def activity = activityRepository.save(new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            def subTaskActivity = activityRepository.save(new Activity("Clean the house", ActivityCategory.ROUTINE, null, owner))
            def subTask = subTaskRepository.save(new SubTask(subTaskActivity, "Vacuum", ActivityCategory.ROUTINE, owner))
            def activityOccurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday, DayOfWeek.MONDAY, PlanSlot.MORNING, owner))
            def subTaskOccurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(null, subTask, ActivityCategory.ROUTINE, monday, DayOfWeek.TUESDAY, PlanSlot.AFTERNOON, owner))

        when: "the data is exported"
            def sql = exportService.generateExport(owner.username)
            def activityOccurrenceLine = sql.readLines().find { it.contains("'${activityOccurrence.id}'") }
            def subTaskOccurrenceLine = sql.readLines().find { it.contains("'${subTaskOccurrence.id}'") }

        then: "the activity-targeted occurrence has a real activity_id and a NULL sub_task_id"
            activityOccurrenceLine.contains("'${activity.id}'")
            activityOccurrenceLine.contains("NULL")

        and: "the sub-task-targeted occurrence has a real sub_task_id and a NULL activity_id"
            subTaskOccurrenceLine.contains("'${subTask.id}'")
            subTaskOccurrenceLine.contains("NULL")

        cleanup:
            activityRepository.delete(activity)
            activityRepository.delete(subTaskActivity)
    }

    def "PLANNER-025-AC-06: completion records are exported with an intact planned_occurrence_id FK"() {
        given: "a completed occurrence"
            def activity = activityRepository.save(new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            def occurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday, DayOfWeek.MONDAY, PlanSlot.MORNING, owner))
            def completion = completionRecordRepository.save(new CompletionRecord(occurrence, owner, Instant.now()))

        when: "the data is exported"
            def sql = exportService.generateExport(owner.username)

        then: "the completion record's INSERT references the same occurrence id"
            sql.contains("INSERT INTO completion_records")
            sql.contains("'${completion.id}'")
            sql.contains("'${occurrence.id}'")

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-025-AC-07: work-day patterns and overrides are exported"() {
        given: "a work-day pattern and an override"
            def pattern = workDayPatternRepository.save(new WorkDayPattern(owner, DayOfWeek.FRIDAY))
            def override = workDayOverrideRepository.save(new WorkDayOverride(owner, LocalDate.of(2026, 12, 25), false))

        when: "the data is exported"
            def sql = exportService.generateExport(owner.username)

        then: "both are present in the output"
            sql.contains("INSERT INTO work_day_patterns")
            sql.contains("'${pattern.id}'")
            sql.contains("'FRIDAY'")
            sql.contains("INSERT INTO work_day_overrides")
            sql.contains("'${override.id}'")
            sql.contains("'2026-12-25'")

        cleanup:
            workDayPatternRepository.delete(pattern)
            workDayOverrideRepository.delete(override)
    }

    def "PLANNER-025-AC-08: an embedded single quote in a free-text field is escaped"() {
        given: "an activity with an apostrophe in its name"
            def activity = activityRepository.save(new Activity("Mum's birthday", ActivityCategory.PLEASURABLE, null, owner))

        when: "the data is exported"
            def sql = exportService.generateExport(owner.username)

        then: "the apostrophe is doubled, producing valid SQL"
            sql.contains("'Mum''s birthday'")

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-025-AC-09: statements are ordered to satisfy foreign-key dependencies"() {
        given: "one of each entity type"
            def activity = activityRepository.save(new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))
            def subTask = subTaskRepository.save(new SubTask(activity, "Stretch first", ActivityCategory.ROUTINE, owner))
            def occurrence = plannedOccurrenceRepository.save(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday, DayOfWeek.MONDAY, PlanSlot.MORNING, owner))
            completionRecordRepository.save(new CompletionRecord(occurrence, owner, Instant.now()))

        when: "the data is exported"
            def sql = exportService.generateExport(owner.username)

        then: "each table's INSERT block appears in the file in FK dependency order"
            def activitiesIndex = sql.indexOf("INSERT INTO activities")
            def subTasksIndex = sql.indexOf("INSERT INTO sub_tasks")
            def occurrencesIndex = sql.indexOf("INSERT INTO planned_occurrences")
            def completionsIndex = sql.indexOf("INSERT INTO completion_records")
            activitiesIndex < subTasksIndex
            subTasksIndex < occurrencesIndex
            occurrencesIndex < completionsIndex

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-025-AC-10: the script is wrapped in a transaction"() {
        when: "the data is exported"
            def sql = exportService.generateExport(owner.username)

        then: "the output starts with BEGIN; and ends with COMMIT;"
            sql.contains("BEGIN;")
            sql.trim().endsWith("COMMIT;")
            sql.indexOf("BEGIN;") < sql.indexOf("COMMIT;")
    }

    def "PLANNER-025-AC-11: no users row or password hash is ever included"() {
        given: "an owned activity"
            def activity = activityRepository.save(new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner))

        when: "the data is exported"
            def sql = exportService.generateExport(owner.username)

        then: "no INSERT INTO users statement and no password hash ever appears"
            !sql.contains("INSERT INTO users")
            !sql.contains(owner.passwordHash)

        cleanup:
            activityRepository.delete(activity)
    }

    def "PLANNER-025-AC-12: a leading comment documents the replay precondition"() {
        when: "the data is exported"
            def sql = exportService.generateExport(owner.username)
            def beginIndex = sql.indexOf("BEGIN;")
            def header = sql.substring(0, beginIndex)

        then: "every leading line is a SQL comment, naming the username and the replay precondition"
            header.trim().readLines().every { it.trim().isEmpty() || it.trim().startsWith("--") }
            header.contains(owner.username)
            header.toLowerCase().contains("users")
    }

    def "PLANNER-025-AC-13: a user with no data gets a valid, near-empty file, not an error"() {
        when: "a freshly-created user with zero owned rows exports"
            def sql = exportService.generateExport(owner.username)

        then: "the output is a valid file with the header comment and BEGIN;/COMMIT;, no INSERT statements"
            sql.contains("BEGIN;")
            sql.trim().endsWith("COMMIT;")
            !sql.contains("INSERT INTO")
    }
}
