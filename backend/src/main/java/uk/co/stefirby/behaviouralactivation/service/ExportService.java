package uk.co.stefirby.behaviouralactivation.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.co.stefirby.behaviouralactivation.model.Activity;
import uk.co.stefirby.behaviouralactivation.model.CompletionRecord;
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence;
import uk.co.stefirby.behaviouralactivation.model.SubTask;
import uk.co.stefirby.behaviouralactivation.model.User;
import uk.co.stefirby.behaviouralactivation.model.WorkDayOverride;
import uk.co.stefirby.behaviouralactivation.model.WorkDayPattern;
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository;
import uk.co.stefirby.behaviouralactivation.repository.CompletionRecordRepository;
import uk.co.stefirby.behaviouralactivation.repository.PlannedOccurrenceRepository;
import uk.co.stefirby.behaviouralactivation.repository.SubTaskRepository;
import uk.co.stefirby.behaviouralactivation.repository.UserRepository;
import uk.co.stefirby.behaviouralactivation.repository.WorkDayOverrideRepository;
import uk.co.stefirby.behaviouralactivation.repository.WorkDayPatternRepository;

/**
 * Generates a replayable SQL export of every row the authenticated user owns, across all six
 * user-owned tables (planner_spec_025_data_export.md). This is a read-only, export-only feature --
 * no new way to mutate data, see the spec's Overview.
 *
 * <p>The one design rule every statement below follows without exception: {@code user_id} is NEVER
 * emitted as a literal UUID. {@link User#getId()} is only ever stable until the next database wipe
 * -- {@code UserBootstrapRunner} re-seeds the bootstrap user with a brand-new generated id every
 * time the {@code users} table is empty. Every generated {@code INSERT} instead resolves
 * {@code user_id} via a {@code (SELECT id FROM users WHERE username = '...')} subquery, tied to the
 * *username*, which survives a reset. Every OTHER primary/foreign key (activity id, sub-task id,
 * occurrence id, ...) IS emitted as its real literal UUID -- those only need to stay internally
 * self-consistent with each other within the same exported file, which they already are.
 *
 * <p>No {@code users} row is ever exported and no password hash ever appears in the output
 * (PLANNER-025-AC-11) -- the target database's own bootstrap flow is exclusively responsible for
 * creating the user row this export's subqueries resolve against.
 */
@Service
public class ExportService {

    private final ActivityRepository activityRepository;
    private final SubTaskRepository subTaskRepository;
    private final PlannedOccurrenceRepository plannedOccurrenceRepository;
    private final CompletionRecordRepository completionRecordRepository;
    private final WorkDayPatternRepository workDayPatternRepository;
    private final WorkDayOverrideRepository workDayOverrideRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    @SuppressWarnings("java:S107") // one service deliberately backing export across six tables -- see CLAUDE.md note
    public ExportService(ActivityRepository activityRepository, SubTaskRepository subTaskRepository,
            PlannedOccurrenceRepository plannedOccurrenceRepository,
            CompletionRecordRepository completionRecordRepository,
            WorkDayPatternRepository workDayPatternRepository,
            WorkDayOverrideRepository workDayOverrideRepository, UserRepository userRepository, Clock clock) {
        this.activityRepository = activityRepository;
        this.subTaskRepository = subTaskRepository;
        this.plannedOccurrenceRepository = plannedOccurrenceRepository;
        this.completionRecordRepository = completionRecordRepository;
        this.workDayPatternRepository = workDayPatternRepository;
        this.workDayOverrideRepository = workDayOverrideRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public String generateExport(String ownerUsername) {
        User owner = resolveOwner(ownerUsername);
        String userIdSubquery = userIdSubquery(owner.getUsername());

        StringBuilder sql = new StringBuilder();
        appendHeaderComment(sql, owner.getUsername());
        sql.append("BEGIN;\n\n");

        appendActivities(sql, owner, userIdSubquery);
        appendSubTasks(sql, owner, userIdSubquery);
        appendPlannedOccurrences(sql, owner, userIdSubquery);
        appendCompletionRecords(sql, owner, userIdSubquery);
        appendWorkDayPatterns(sql, owner, userIdSubquery);
        appendWorkDayOverrides(sql, owner, userIdSubquery);

        sql.append("COMMIT;\n");
        return sql.toString();
    }

    // PLANNER-025-AC-12 -- a leading comment block stating the export timestamp, the source
    // username, and the replay precondition (a users row with a matching username must already
    // exist in the target database, i.e. the app's normal migration/bootstrap flow must have
    // already run).
    private void appendHeaderComment(StringBuilder sql, String username) {
        sql.append("-- Behavioural Activation Planner data export\n");
        sql.append("-- Exported at: ").append(Instant.now(clock)).append('\n');
        sql.append("-- Source username: ").append(username).append('\n');
        sql.append("-- Replay precondition: a users row with username '").append(username)
            .append("' must already exist in the target database (run this app's normal Flyway\n");
        sql.append("-- migrations and bootstrap flow first) -- this file never creates or modifies the users table.\n\n");
    }

    // PLANNER-025-AC-03 -- every owned Activity, including archived ones (findByOwnerOrderBy... is
    // the unfiltered superset method, matching the reference the spec calls out).
    private void appendActivities(StringBuilder sql, User owner, String userIdSubquery) {
        List<Activity> activities = activityRepository.findByOwnerOrderByFavouriteDescNameAsc(owner);
        for (Activity activity : activities) {
            sql.append("INSERT INTO activities (id, user_id, name, category, description, created_at, "
                + "updated_at, repeatable, archived, favourite) VALUES (")
                .append(uuidLiteral(activity.getId())).append(", ")
                .append(userIdSubquery).append(", ")
                .append(stringLiteral(activity.getName())).append(", ")
                .append(enumLiteral(activity.getCategory())).append(", ")
                .append(nullableStringLiteral(activity.getDescription())).append(", ")
                .append(instantLiteral(activity.getCreatedAt())).append(", ")
                .append(instantLiteral(activity.getUpdatedAt())).append(", ")
                .append(booleanLiteral(activity.isRepeatable())).append(", ")
                .append(booleanLiteral(activity.isArchived())).append(", ")
                .append(booleanLiteral(activity.isFavourite()))
                .append(");\n");
        }
        sql.append('\n');
    }

    // PLANNER-025-AC-04 -- every owned SubTask, activity_id referencing the same id emitted above.
    private void appendSubTasks(StringBuilder sql, User owner, String userIdSubquery) {
        List<SubTask> subTasks = subTaskRepository.findByOwner(owner);
        for (SubTask subTask : subTasks) {
            sql.append("INSERT INTO sub_tasks (id, activity_id, user_id, name, category, created_at, "
                + "updated_at, position) VALUES (")
                .append(uuidLiteral(subTask.getId())).append(", ")
                .append(uuidLiteral(subTask.getActivity().getId())).append(", ")
                .append(userIdSubquery).append(", ")
                .append(stringLiteral(subTask.getName())).append(", ")
                .append(enumLiteral(subTask.getCategory())).append(", ")
                .append(instantLiteral(subTask.getCreatedAt())).append(", ")
                .append(instantLiteral(subTask.getUpdatedAt())).append(", ")
                .append(subTask.getPosition())
                .append(");\n");
        }
        sql.append('\n');
    }

    // PLANNER-025-AC-05 -- every owned PlannedOccurrence, preserving the activity/sub-task XOR:
    // exactly one of activity_id/sub_task_id is emitted as its original value, the other as NULL.
    private void appendPlannedOccurrences(StringBuilder sql, User owner, String userIdSubquery) {
        List<PlannedOccurrence> occurrences = plannedOccurrenceRepository.findByOwner(owner);
        for (PlannedOccurrence occurrence : occurrences) {
            UUID activityId = occurrence.getActivity() == null ? null : occurrence.getActivity().getId();
            UUID subTaskId = occurrence.getSubTask() == null ? null : occurrence.getSubTask().getId();
            sql.append("INSERT INTO planned_occurrences (id, user_id, activity_id, sub_task_id, category, "
                + "week_start, day_of_week, slot, created_at, updated_at, bucket_position, notes) VALUES (")
                .append(uuidLiteral(occurrence.getId())).append(", ")
                .append(userIdSubquery).append(", ")
                .append(nullableUuidLiteral(activityId)).append(", ")
                .append(nullableUuidLiteral(subTaskId)).append(", ")
                .append(enumLiteral(occurrence.getCategory())).append(", ")
                .append(dateLiteral(occurrence.getWeekStart())).append(", ")
                .append(nullableEnumLiteral(occurrence.getDayOfWeek())).append(", ")
                .append(nullableEnumLiteral(occurrence.getSlot())).append(", ")
                .append(instantLiteral(occurrence.getCreatedAt())).append(", ")
                .append(instantLiteral(occurrence.getUpdatedAt())).append(", ")
                .append(nullableIntLiteral(occurrence.getBucketPosition())).append(", ")
                .append(nullableStringLiteral(occurrence.getNotes()))
                .append(");\n");
        }
        sql.append('\n');
    }

    // PLANNER-025-AC-06 -- every owned CompletionRecord, planned_occurrence_id referencing the same
    // id emitted above.
    private void appendCompletionRecords(StringBuilder sql, User owner, String userIdSubquery) {
        List<CompletionRecord> completionRecords = completionRecordRepository.findByOwner(owner);
        for (CompletionRecord completionRecord : completionRecords) {
            sql.append("INSERT INTO completion_records (id, user_id, planned_occurrence_id, completed_at, "
                + "created_at) VALUES (")
                .append(uuidLiteral(completionRecord.getId())).append(", ")
                .append(userIdSubquery).append(", ")
                .append(uuidLiteral(completionRecord.getPlannedOccurrence().getId())).append(", ")
                .append(instantLiteral(completionRecord.getCompletedAt())).append(", ")
                .append(instantLiteral(completionRecord.getCreatedAt()))
                .append(");\n");
        }
        sql.append('\n');
    }

    // PLANNER-025-AC-07 -- every owned WorkDayPattern row.
    private void appendWorkDayPatterns(StringBuilder sql, User owner, String userIdSubquery) {
        List<WorkDayPattern> patterns = workDayPatternRepository.findByOwner(owner);
        for (WorkDayPattern pattern : patterns) {
            sql.append("INSERT INTO work_day_patterns (id, user_id, day_of_week) VALUES (")
                .append(uuidLiteral(pattern.getId())).append(", ")
                .append(userIdSubquery).append(", ")
                .append(enumLiteral(pattern.getDayOfWeek()))
                .append(");\n");
        }
        sql.append('\n');
    }

    // PLANNER-025-AC-07 -- every owned WorkDayOverride row.
    private void appendWorkDayOverrides(StringBuilder sql, User owner, String userIdSubquery) {
        List<WorkDayOverride> overrides = workDayOverrideRepository.findByOwner(owner);
        for (WorkDayOverride override : overrides) {
            sql.append("INSERT INTO work_day_overrides (id, user_id, date, work_day, created_at, "
                + "updated_at) VALUES (")
                .append(uuidLiteral(override.getId())).append(", ")
                .append(userIdSubquery).append(", ")
                .append(dateLiteral(override.getDate())).append(", ")
                .append(booleanLiteral(override.isWorkDay())).append(", ")
                .append(instantLiteral(override.getCreatedAt())).append(", ")
                .append(instantLiteral(override.getUpdatedAt()))
                .append(");\n");
        }
        sql.append('\n');
    }

    // The one subquery every generated INSERT's user_id column uses -- never a literal UUID. See
    // the class javadoc for why.
    private String userIdSubquery(String username) {
        return "(SELECT id FROM users WHERE username = '" + escapeSql(username) + "')";
    }

    private String uuidLiteral(UUID id) {
        return "'" + id + "'";
    }

    private String nullableUuidLiteral(UUID id) {
        return id == null ? "NULL" : uuidLiteral(id);
    }

    // PLANNER-025-AC-08 -- doubles any embedded single quote ('Mum's birthday' -> 'Mum''s birthday')
    // per standard SQL string-literal escaping, applied to every free-text value before it is
    // interpolated into the generated SQL.
    private String stringLiteral(String value) {
        return "'" + escapeSql(value) + "'";
    }

    private String nullableStringLiteral(String value) {
        return value == null ? "NULL" : stringLiteral(value);
    }

    private String escapeSql(String value) {
        return value.replace("'", "''");
    }

    private String enumLiteral(Enum<?> value) {
        return "'" + value.name() + "'";
    }

    private String nullableEnumLiteral(Enum<?> value) {
        return value == null ? "NULL" : enumLiteral(value);
    }

    private String instantLiteral(Instant value) {
        return "'" + value + "'";
    }

    private String dateLiteral(LocalDate value) {
        return "'" + value + "'";
    }

    private String booleanLiteral(boolean value) {
        return value ? "TRUE" : "FALSE";
    }

    private String nullableIntLiteral(Integer value) {
        return value == null ? "NULL" : String.valueOf(value);
    }

    private User resolveOwner(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + username));
    }
}
