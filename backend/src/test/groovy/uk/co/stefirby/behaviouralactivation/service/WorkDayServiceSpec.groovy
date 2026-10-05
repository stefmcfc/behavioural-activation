package uk.co.stefirby.behaviouralactivation.service

import spock.lang.Specification

import java.time.DayOfWeek
import java.time.LocalDate

import uk.co.stefirby.behaviouralactivation.exception.InvalidPlanRequestException
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.model.WorkDayOverride
import uk.co.stefirby.behaviouralactivation.model.WorkDayPattern
import uk.co.stefirby.behaviouralactivation.repository.UserRepository
import uk.co.stefirby.behaviouralactivation.repository.WorkDayOverrideRepository
import uk.co.stefirby.behaviouralactivation.repository.WorkDayPatternRepository

import static java.time.DayOfWeek.FRIDAY
import static java.time.DayOfWeek.MONDAY
import static java.time.DayOfWeek.SATURDAY
import static java.time.DayOfWeek.SUNDAY
import static java.time.DayOfWeek.THURSDAY
import static java.time.DayOfWeek.TUESDAY
import static java.time.DayOfWeek.WEDNESDAY

class WorkDayServiceSpec extends Specification {

    WorkDayPatternRepository workDayPatternRepository = Mock()
    WorkDayOverrideRepository workDayOverrideRepository = Mock()
    UserRepository userRepository = Mock()
    WorkDayService service = new WorkDayService(workDayPatternRepository, workDayOverrideRepository, userRepository)

    User owner = new User("steve", "hashed-password")

    def setup() {
        userRepository.findByUsername("steve") >> Optional.of(owner)
    }

    def "PLANNER-021-AC-01: fetching the pattern for a user with none set returns empty"() {
        given: "the repository has no pattern rows for this owner"
            workDayPatternRepository.findByOwner(owner) >> []

        when: "the pattern is fetched"
            def result = service.getPattern("steve")

        then: "an empty set is returned"
            result.isEmpty()
    }

    def "PLANNER-021-AC-02: setting the pattern fully replaces the previous one"() {
        given: "the repository saves whatever pattern row it is given"
            List<WorkDayPattern> saved = []
            workDayPatternRepository.save(_ as WorkDayPattern) >> { WorkDayPattern p -> saved << p; return p }

        when: "the pattern is replaced with just Friday"
            def result = service.setPattern("steve", [FRIDAY] as Set)

        then: "the owner's existing rows are deleted first, and only Friday is saved"
            1 * workDayPatternRepository.deleteByOwner(owner)
            saved*.dayOfWeek == [FRIDAY]

        and: "the new set is returned"
            result == [FRIDAY] as Set
    }

    // Regression test for a real bug found during manual browser verification: setPattern() called
    // deleteByOwner() then save() for each new day in the same transaction with no flush() between
    // them. Hibernate's action queue always executes every pending insert before any pending delete
    // within one flush, regardless of call order -- so re-submitting a day still present in the old
    // pattern (e.g. keeping Monday while adding Wednesday) inserted the new Monday row before the old
    // one was deleted, and tripped work_day_patterns' unique (user_id, day_of_week) constraint with a
    // real 500 in Postgres. A mock-based unit test can't exercise Hibernate's flush ordering directly,
    // so this asserts the call-order contract the fix (service.setPattern's explicit flush()) relies
    // on: delete, then flush, then every save -- using Spock's ordered then: blocks.
    def "PLANNER-021-AC-02 regression: flush() runs between delete and save, so an overlapping day is not double-inserted before its old row is deleted"() {
        when: "the pattern is replaced with a set that still includes a previously-set day"
            service.setPattern("steve", [MONDAY, WEDNESDAY] as Set)

        then: "the owner's existing rows are deleted first"
            1 * workDayPatternRepository.deleteByOwner(owner)

        then: "the delete is flushed before any new row is saved"
            1 * workDayPatternRepository.flush()

        then: "only then are the new rows saved"
            2 * workDayPatternRepository.save(_ as WorkDayPattern)
    }

    def "PLANNER-021-AC-02: setting an empty pattern clears every existing row without saving any"() {
        when: "the pattern is replaced with an empty set"
            def result = service.setPattern("steve", [] as Set)

        then: "the owner's existing rows are deleted, and nothing new is saved"
            1 * workDayPatternRepository.deleteByOwner(owner)
            0 * workDayPatternRepository.save(_)
            result.isEmpty()
    }

    def "PLANNER-021-AC-03: getPattern and setPattern resolve the owner from the authenticated username, never a caller-supplied id"() {
        given: "a different authenticated user"
            def otherOwner = new User("imogen", "hashed-password")
            userRepository.findByUsername("imogen") >> Optional.of(otherOwner)
            workDayPatternRepository.findByOwner(otherOwner) >> [new WorkDayPattern(otherOwner, MONDAY)]
            workDayPatternRepository.findByOwner(owner) >> []

        when: "each owner fetches their own pattern"
            def resultForOwner = service.getPattern("steve")
            def resultForOtherOwner = service.getPattern("imogen")

        then: "each sees only their own rows"
            resultForOwner.isEmpty()
            resultForOtherOwner == [MONDAY] as Set
    }

    def "PLANNER-021-AC-04/AC-08: effective week combines pattern and overrides, override wins in both directions"() {
        given: "a Mon-Fri recurring pattern"
            // Captured into a local var before the closure below -- inside a Groovy closure, the bare
            // name "owner" resolves to Closure.owner (the enclosing object), shadowing this
            // specification's own `owner` field of the same name.
            def patternOwner = owner
            def patternRows = [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY].collect { new WorkDayPattern(patternOwner, it) }
            workDayPatternRepository.findByOwner(owner) >> patternRows

        and: "Wednesday is overridden to false, and Saturday is overridden to true"
            def wednesday = LocalDate.of(2026, 10, 14)
            def saturday = LocalDate.of(2026, 10, 17)
            workDayOverrideRepository.findByOwnerAndDateBetween(owner, LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 18)) >>
                [new WorkDayOverride(owner, wednesday, false), new WorkDayOverride(owner, saturday, true)]

        when: "the effective week is fetched"
            def week = service.getWeek("steve", LocalDate.of(2026, 10, 12))

        then: "exactly 7 entries are returned, one per date"
            week.size() == 7

        and: "pattern days are true except the overridden Wednesday, and Saturday is true via override"
            week.find { it.dayOfWeek() == MONDAY }.workDay()
            week.find { it.dayOfWeek() == TUESDAY }.workDay()
            week.find { it.dayOfWeek() == WEDNESDAY }.workDay() == false
            week.find { it.dayOfWeek() == THURSDAY }.workDay()
            week.find { it.dayOfWeek() == FRIDAY }.workDay()
            week.find { it.dayOfWeek() == SATURDAY }.workDay()
            week.find { it.dayOfWeek() == SUNDAY }.workDay() == false
    }

    def "PLANNER-021-AC-05: a missing or non-Monday weekStart throws InvalidPlanRequestException with PlanService's exact message, without querying"() {
        when: "the week is fetched with an invalid weekStart"
            service.getWeek("steve", weekStart)

        then: "an InvalidPlanRequestException is thrown with the shared message, and nothing is queried"
            def ex = thrown(InvalidPlanRequestException)
            ex.message == "weekStart is required and must be a Monday"
            0 * workDayPatternRepository.findByOwner(_)
            0 * workDayOverrideRepository.findByOwnerAndDateBetween(_, _, _)

        where:
            weekStart << [null, LocalDate.of(2026, 10, 13)]
    }

    def "PLANNER-021-AC-06: a brand-new user with no pattern and no overrides sees no work days anywhere"() {
        given: "no pattern rows and no override rows"
            workDayPatternRepository.findByOwner(owner) >> []
            workDayOverrideRepository.findByOwnerAndDateBetween(owner, _, _) >> []

        when: "the effective week is fetched"
            def week = service.getWeek("steve", LocalDate.of(2026, 10, 12))

        then: "all 7 entries are workDay: false"
            week.size() == 7
            week.every { !it.workDay() }
    }

    def "PLANNER-021-AC-07: setting an override for a new date creates it and returns the resolved value"() {
        given: "no existing override for this date"
            def date = LocalDate.of(2026, 10, 17)
            workDayOverrideRepository.findByOwnerAndDate(owner, date) >> Optional.empty()
            WorkDayOverride saved = null
            workDayOverrideRepository.save(_ as WorkDayOverride) >> { WorkDayOverride o -> saved = o; return o }

        when: "the override is set"
            def result = service.setOverride("steve", date, true)

        then: "a new row is saved, owned by the resolved owner, for the given date"
            saved.owner == owner
            saved.date == date
            saved.workDay

        and: "the response reflects the resolved date/dayOfWeek/workDay"
            result.date() == date
            result.dayOfWeek() == date.dayOfWeek
            result.workDay()
    }

    def "PLANNER-021-AC-07/AC-09: setting an override for an existing date updates it rather than creating a second row"() {
        given: "an existing override for this date"
            def date = LocalDate.of(2026, 10, 14)
            def existing = new WorkDayOverride(owner, date, true)
            workDayOverrideRepository.findByOwnerAndDate(owner, date) >> Optional.of(existing)

        when: "the override is set again with a different value"
            def result = service.setOverride("steve", date, false)

        then: "the existing row is updated in place, and nothing new is saved"
            0 * workDayOverrideRepository.save(_)
            existing.workDay == false

        and: "the response reflects the latest value"
            result.workDay() == false
    }

    def "PLANNER-021-AC-10: setOverride scopes its lookup and save to the resolved authenticated owner, not a caller-supplied id"() {
        given: "a different authenticated user, with no existing override"
            def otherOwner = new User("imogen", "hashed-password")
            userRepository.findByUsername("imogen") >> Optional.of(otherOwner)
            def date = LocalDate.of(2026, 10, 14)
            workDayOverrideRepository.save(_ as WorkDayOverride) >> { WorkDayOverride o -> o }

        when: "that user sets an override"
            service.setOverride("imogen", date, true)

        then: "the lookup is scoped to that resolved owner, never the other owner, and returns empty for a fresh pair"
            // Declared here (not in "given:") with its own return value -- a stub for the same
            // invocation declared in "given:" would be shadowed by this cardinality-checking
            // interaction, which otherwise defaults to a null return (Spock's last-interaction-wins
            // matching), causing a NullPointerException downstream in the service.
            1 * workDayOverrideRepository.findByOwnerAndDate(otherOwner, date) >> Optional.empty()
            0 * workDayOverrideRepository.findByOwnerAndDate(owner, _)
    }
}
