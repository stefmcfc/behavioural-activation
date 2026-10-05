package uk.co.stefirby.behaviouralactivation.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.co.stefirby.behaviouralactivation.dto.WorkDayResponse;
import uk.co.stefirby.behaviouralactivation.exception.InvalidPlanRequestException;
import uk.co.stefirby.behaviouralactivation.model.User;
import uk.co.stefirby.behaviouralactivation.model.WorkDayOverride;
import uk.co.stefirby.behaviouralactivation.model.WorkDayPattern;
import uk.co.stefirby.behaviouralactivation.repository.UserRepository;
import uk.co.stefirby.behaviouralactivation.repository.WorkDayOverrideRepository;
import uk.co.stefirby.behaviouralactivation.repository.WorkDayPatternRepository;

/**
 * Owner-scoping for the recurring work-day pattern and its per-date overrides lives here, not in
 * {@code WorkDayController} -- mirroring {@code ActivityService}/{@code PlanService}'s precedent:
 * every method resolves the owning {@link User} itself from the authenticated username, never
 * trusting a client-supplied field (planner_spec_021_work_day_marking.md, PLANNER-021-AC-03/AC-10).
 *
 * <p>{@link #getWeek} reuses {@code PlanService#validateWeekStart}'s exact validation rule and
 * message text via the same {@link InvalidPlanRequestException}, rather than introducing a second
 * exception type for an equivalent "give me a week" 400 (PLANNER-021-AC-05).
 */
@Service
public class WorkDayService {

    private final WorkDayPatternRepository workDayPatternRepository;
    private final WorkDayOverrideRepository workDayOverrideRepository;
    private final UserRepository userRepository;

    public WorkDayService(WorkDayPatternRepository workDayPatternRepository,
            WorkDayOverrideRepository workDayOverrideRepository, UserRepository userRepository) {
        this.workDayPatternRepository = workDayPatternRepository;
        this.workDayOverrideRepository = workDayOverrideRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public Set<DayOfWeek> getPattern(String ownerUsername) {
        User owner = resolveOwner(ownerUsername);
        return patternDaysFor(owner);
    }

    // Full-replace semantics (PLANNER-021-AC-02) -- every existing row for the owner is deleted
    // before one new row per submitted day is inserted, rather than diffing against the previous set.
    // The flush() after delete is required, not cosmetic: Hibernate's action queue always executes
    // every pending insert before any pending delete within one flush, regardless of call order, so
    // without it, re-submitting a day that was already in the old pattern (e.g. keeping Monday while
    // adding Wednesday) inserts the new Monday row before the old one is deleted and trips
    // work_day_patterns' unique (user_id, day_of_week) constraint.
    @Transactional
    public Set<DayOfWeek> setPattern(String ownerUsername, Set<DayOfWeek> days) {
        User owner = resolveOwner(ownerUsername);
        workDayPatternRepository.deleteByOwner(owner);
        workDayPatternRepository.flush();
        Set<DayOfWeek> toSave = days == null ? Set.of() : days;
        toSave.forEach(day -> workDayPatternRepository.save(new WorkDayPattern(owner, day)));
        return toSave;
    }

    @Transactional(readOnly = true)
    public List<WorkDayResponse> getWeek(String ownerUsername, LocalDate weekStart) {
        validateWeekStart(weekStart);
        User owner = resolveOwner(ownerUsername);
        Set<DayOfWeek> pattern = patternDaysFor(owner);
        LocalDate weekEnd = weekStart.plusDays(6);
        Map<LocalDate, Boolean> overridesByDate = workDayOverrideRepository
            .findByOwnerAndDateBetween(owner, weekStart, weekEnd).stream()
            .collect(Collectors.toMap(WorkDayOverride::getDate, WorkDayOverride::isWorkDay));

        List<WorkDayResponse> week = new ArrayList<>();
        for (int offset = 0; offset < 7; offset++) {
            LocalDate date = weekStart.plusDays(offset);
            DayOfWeek dayOfWeek = date.getDayOfWeek();
            // An override always wins over the pattern for its exact date (PLANNER-021-AC-08), in
            // both directions -- forcing a day true or false regardless of the pattern's own say.
            boolean workDay = overridesByDate.containsKey(date)
                ? overridesByDate.get(date)
                : pattern.contains(dayOfWeek);
            week.add(new WorkDayResponse(date, dayOfWeek, workDay));
        }
        return week;
    }

    // Upserts by (owner, date) -- looks up the existing row before deciding insert vs. update, so
    // calling this twice for the same date never creates a duplicate row (PLANNER-021-AC-09), backed
    // by work_day_overrides' own unique (user_id, date) constraint as a database-level backstop.
    @Transactional
    public WorkDayResponse setOverride(String ownerUsername, LocalDate date, boolean workDay) {
        User owner = resolveOwner(ownerUsername);
        WorkDayOverride override = workDayOverrideRepository.findByOwnerAndDate(owner, date)
            .map(existing -> {
                existing.update(workDay);
                return existing;
            })
            .orElseGet(() -> workDayOverrideRepository.save(new WorkDayOverride(owner, date, workDay)));
        return new WorkDayResponse(date, date.getDayOfWeek(), override.isWorkDay());
    }

    private Set<DayOfWeek> patternDaysFor(User owner) {
        return workDayPatternRepository.findByOwner(owner).stream()
            .map(WorkDayPattern::getDayOfWeek)
            .collect(Collectors.toCollection(HashSet::new));
    }

    // Mirrors PlanService#validateWeekStart exactly -- same InvalidPlanRequestException type and
    // message text, reused rather than duplicated as a new exception for an equivalent "give me a
    // week" validation rule (PLANNER-021-AC-05).
    private void validateWeekStart(LocalDate weekStart) {
        if (weekStart == null || !weekStart.getDayOfWeek().equals(DayOfWeek.MONDAY)) {
            throw new InvalidPlanRequestException("weekStart is required and must be a Monday");
        }
    }

    private User resolveOwner(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + username));
    }
}
