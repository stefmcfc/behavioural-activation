package uk.co.stefirby.behaviouralactivation.controller

import tools.jackson.databind.ObjectMapper
import org.spockframework.spring.SpringBean
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.config.CorsConfig
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
import uk.co.stefirby.behaviouralactivation.security.SecurityConfig
import uk.co.stefirby.behaviouralactivation.service.PlanService

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(controllers = PlanController)
@Import([SecurityConfig, CorsConfig])
class PlanControllerSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    ObjectMapper objectMapper

    @SpringBean
    PlanService planService = Mock()

    User owner = new User("steve", "hashed-password")
    Activity activity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)
    SubTask subTask = new SubTask(activity, "Chapter one", ActivityCategory.ROUTINE, owner)
    LocalDate monday = LocalDate.of(2026, 10, 5)

    def "PLANNER-004-AC-01/AC-02: GET /api/v1/plan returns the week's occurrences in the {data, count} envelope"() {
        given: "the service returns one scheduled occurrence for the week"
            def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            planService.getWeek("steve", monday) >> [occurrence]
            planService.findCompletions("steve", _) >> [:]

        when: "GET /api/v1/plan is requested"
            def result = mockMvc.perform(get("/api/v1/plan?weekStart=2026-10-05")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is the {data, count} envelope"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(1))
            result.andExpect(jsonPath('$.data[0].name').value("Go for a walk"))
            result.andExpect(jsonPath('$.data[0].category').value("ROUTINE"))
            result.andExpect(jsonPath('$.data[0].dayOfWeek').value("MONDAY"))
            result.andExpect(jsonPath('$.data[0].slot').value("MORNING"))
    }

    def "PLANNER-008-AC-02/AC-09: a whole-activity occurrence's response has parentActivityName null, other fields unaffected"() {
        given: "the service returns one whole-activity occurrence for the week"
            def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            planService.getWeek("steve", monday) >> [occurrence]
            planService.findCompletions("steve", _) >> [:]

        when: "GET /api/v1/plan is requested"
            def result = mockMvc.perform(get("/api/v1/plan?weekStart=2026-10-05")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "parentActivityName is null, and the existing fields are unchanged"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data[0].name').value("Go for a walk"))
            result.andExpect(jsonPath('$.data[0].parentActivityName').doesNotExist())
            result.andExpect(jsonPath('$.data[0].category').value("ROUTINE"))
            result.andExpect(jsonPath('$.data[0].dayOfWeek').value("MONDAY"))
    }

    def "PLANNER-008-AC-03: a sub-task occurrence's response carries its parent activity's name"() {
        given: "the service returns one sub-task occurrence for the week"
            def occurrence = new PlannedOccurrence(null, subTask, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            planService.getWeek("steve", monday) >> [occurrence]
            planService.findCompletions("steve", _) >> [:]

        when: "GET /api/v1/plan is requested"
            def result = mockMvc.perform(get("/api/v1/plan?weekStart=2026-10-05")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the sub-task's own name and its parent activity's name are both present"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data[0].name').value("Chapter one"))
            result.andExpect(jsonPath('$.data[0].parentActivityName').value("Go for a walk"))
    }

    def "PLANNER-013-AC-01: an activity-sourced occurrence's response resolves repeatable from the activity directly"() {
        given: "the service returns one occurrence for a repeatable activity"
            def repeatableActivity = new Activity("Walk", ActivityCategory.ROUTINE, null, true, owner)
            def occurrence = new PlannedOccurrence(repeatableActivity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            planService.getWeek("steve", monday) >> [occurrence]
            planService.findCompletions("steve", _) >> [:]

        when: "GET /api/v1/plan is requested"
            def result = mockMvc.perform(get("/api/v1/plan?weekStart=2026-10-05")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "repeatable reflects the activity's own value"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data[0].repeatable').value(true))
    }

    def "PLANNER-013-AC-02: a sub-task-sourced occurrence's response resolves repeatable from its parent activity, not itself"() {
        given: "the service returns one occurrence for a sub-task of a one-off parent activity"
            def oneOffActivity = new Activity("Big project", ActivityCategory.ROUTINE, null, false, owner)
            def oneOffSubTask = new SubTask(oneOffActivity, "Step one", ActivityCategory.ROUTINE, owner)
            def occurrence = new PlannedOccurrence(null, oneOffSubTask, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            planService.getWeek("steve", monday) >> [occurrence]
            planService.findCompletions("steve", _) >> [:]

        when: "GET /api/v1/plan is requested"
            def result = mockMvc.perform(get("/api/v1/plan?weekStart=2026-10-05")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "repeatable reflects the PARENT activity's value, not some independent sub-task value"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data[0].repeatable').value(false))
    }

    def "PLANNER-004-AC-05: GET /api/v1/plan returns 200 with an empty envelope, not 404, for an empty week"() {
        given: "the service returns no occurrences"
            planService.getWeek("steve", monday) >> []

        when: "GET /api/v1/plan is requested"
            def result = mockMvc.perform(get("/api/v1/plan?weekStart=2026-10-05")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with an empty envelope"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(0))
            result.andExpect(jsonPath('$.data').isEmpty())
    }

    def "PLANNER-004-AC-03/AC-04: GET /api/v1/plan returns 400 for a missing or non-Monday weekStart"() {
        given: "the service rejects the weekStart as invalid"
            planService.getWeek("steve", _) >> { throw new InvalidPlanRequestException("weekStart is required and must be a Monday") }

        when: "GET /api/v1/plan is requested"
            def result = mockMvc.perform(get(uri)
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())

        where:
            uri << ["/api/v1/plan", "/api/v1/plan?weekStart=2026-10-06"]
    }

    def "PLANNER-004-AC-06/AC-08: POST /api/v1/plan/occurrences creates a scheduled occurrence, 201"() {
        given: "a valid create request"
            def activityId = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([activityId: activityId, weekStart: "2026-10-05",
                dayOfWeek: "MONDAY", slot: "MORNING"])
            planService.create("steve", _ as PlannedOccurrenceRequest) >> Optional.of(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                    DayOfWeek.MONDAY, PlanSlot.MORNING, owner))

        when: "POST /api/v1/plan/occurrences is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 201 with the created occurrence"
            result.andExpect(status().isCreated())
            result.andExpect(jsonPath('$.category').value("ROUTINE"))
            result.andExpect(jsonPath('$.dayOfWeek').value("MONDAY"))
            result.andExpect(jsonPath('$.slot').value("MORNING"))
    }

    def "PLANNER-004-AC-07: POST /api/v1/plan/occurrences creates a weekend-bucket occurrence with no day/slot, 201"() {
        given: "a valid create request with no dayOfWeek/slot"
            def subTaskId = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([subTaskId: subTaskId, weekStart: "2026-10-05"])
            planService.create("steve", _ as PlannedOccurrenceRequest) >> Optional.of(
                new PlannedOccurrence(null, subTask, ActivityCategory.ROUTINE, monday, null, null, owner))

        when: "POST /api/v1/plan/occurrences is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 201 with no day/slot set"
            result.andExpect(status().isCreated())
            result.andExpect(jsonPath('$.dayOfWeek').doesNotExist())
            result.andExpect(jsonPath('$.slot').doesNotExist())
    }

    def "PLANNER-004-AC-10: POST /api/v1/plan/occurrences returns 400 when neither or both of activityId/subTaskId are set"() {
        given: "the service rejects the request as invalid"
            planService.create("steve", _ as PlannedOccurrenceRequest) >> { throw new InvalidPlanRequestException("bad") }
            def body = objectMapper.writeValueAsString(requestBody)

        when: "POST /api/v1/plan/occurrences is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())

        where:
            requestBody << [
                [weekStart: "2026-10-05"],
                [activityId: UUID.randomUUID(), subTaskId: UUID.randomUUID(), weekStart: "2026-10-05"]
            ]
    }

    def "PLANNER-004-AC-12: POST /api/v1/plan/occurrences returns 400 when exactly one of dayOfWeek/slot is set"() {
        given: "the service rejects the request as invalid"
            planService.create("steve", _ as PlannedOccurrenceRequest) >> { throw new InvalidPlanRequestException("bad") }
            def body = objectMapper.writeValueAsString([activityId: UUID.randomUUID(), weekStart: "2026-10-05",
                dayOfWeek: "MONDAY"])

        when: "POST /api/v1/plan/occurrences is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    def "PLANNER-004-AC-13: POST /api/v1/plan/occurrences returns 400 for a missing weekStart"() {
        given: "a request with no weekStart"
            def body = objectMapper.writeValueAsString([activityId: UUID.randomUUID()])

        when: "POST /api/v1/plan/occurrences is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 400, and the service is never invoked"
            result.andExpect(status().isBadRequest())
            0 * planService.create(_, _)
    }

    def "PLANNER-004-AC-14/AC-15: POST /api/v1/plan/occurrences returns 404 when the referenced activity or sub-task isn't found/owned"() {
        given: "the service reports no matching owned target"
            def activityId = UUID.randomUUID()
            planService.create("steve", _ as PlannedOccurrenceRequest) >> Optional.empty()
            def body = objectMapper.writeValueAsString([activityId: activityId, weekStart: "2026-10-05",
                dayOfWeek: "MONDAY", slot: "MORNING"])

        when: "POST /api/v1/plan/occurrences is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 404, not 403"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-004-AC-16: PATCH /api/v1/plan/occurrences/{id} reschedules and returns 200"() {
        given: "the service reschedules the occurrence successfully"
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([dayOfWeek: "WEDNESDAY", slot: "EVENING"])
            planService.move("steve", id, _ as PlannedOccurrenceMoveRequest) >> Optional.of(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                    DayOfWeek.WEDNESDAY, PlanSlot.EVENING, owner))
            planService.findCompletion("steve", id) >> Optional.empty()

        when: "PATCH /api/v1/plan/occurrences/{id} is requested"
            def result = mockMvc.perform(patch("/api/v1/plan/occurrences/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 200 with the rescheduled occurrence"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.dayOfWeek').value("WEDNESDAY"))
            result.andExpect(jsonPath('$.slot').value("EVENING"))
    }

    def "PLANNER-004-AC-17: PATCH /api/v1/plan/occurrences/{id} demotes to the bucket and returns 200"() {
        given: "the service demotes the occurrence successfully"
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([dayOfWeek: null, slot: null])
            planService.move("steve", id, _ as PlannedOccurrenceMoveRequest) >> Optional.of(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday, null, null, owner))
            planService.findCompletion("steve", id) >> Optional.empty()

        when: "PATCH /api/v1/plan/occurrences/{id} is requested"
            def result = mockMvc.perform(patch("/api/v1/plan/occurrences/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 200 with dayOfWeek/slot cleared and weekStart unchanged"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.dayOfWeek').doesNotExist())
            result.andExpect(jsonPath('$.slot').doesNotExist())
            result.andExpect(jsonPath('$.weekStart').value("2026-10-05"))
    }

    def "PLANNER-004-AC-18: PATCH /api/v1/plan/occurrences/{id} returns 400 when exactly one of dayOfWeek/slot is set"() {
        given: "the service rejects the request as invalid"
            def id = UUID.randomUUID()
            planService.move("steve", id, _ as PlannedOccurrenceMoveRequest) >> { throw new InvalidPlanRequestException("bad") }
            def body = objectMapper.writeValueAsString([dayOfWeek: "MONDAY"])

        when: "PATCH /api/v1/plan/occurrences/{id} is requested"
            def result = mockMvc.perform(patch("/api/v1/plan/occurrences/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())
    }

    def "PLANNER-004-AC-19: PATCH /api/v1/plan/occurrences/{id} returns 404 for a not-found-or-not-owned id"() {
        given: "the service reports no matching owned occurrence"
            def id = UUID.randomUUID()
            planService.move("steve", id, _ as PlannedOccurrenceMoveRequest) >> Optional.empty()
            def body = objectMapper.writeValueAsString([dayOfWeek: "MONDAY", slot: "MORNING"])

        when: "PATCH /api/v1/plan/occurrences/{id} is requested"
            def result = mockMvc.perform(patch("/api/v1/plan/occurrences/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-004-AC-20: DELETE /api/v1/plan/occurrences/{id} removes the occurrence and returns 204"() {
        given: "the service deletes the occurrence successfully"
            def id = UUID.randomUUID()
            planService.delete("steve", id) >> true

        when: "DELETE /api/v1/plan/occurrences/{id} is requested"
            def result = mockMvc.perform(delete("/api/v1/plan/occurrences/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 204 No Content"
            result.andExpect(status().isNoContent())
    }

    def "PLANNER-004-AC-21: DELETE /api/v1/plan/occurrences/{id} returns 404 for a not-found-or-not-owned id"() {
        given: "the service reports no matching owned occurrence"
            def id = UUID.randomUUID()
            planService.delete("steve", id) >> false

        when: "DELETE /api/v1/plan/occurrences/{id} is requested"
            def result = mockMvc.perform(delete("/api/v1/plan/occurrences/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-004-AC-22: POST .../occurrences/{id}/completion completes the occurrence and returns 200"() {
        given: "the service creates a CompletionRecord for the occurrence"
            def id = UUID.randomUUID()
            def occurrence = new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday,
                DayOfWeek.MONDAY, PlanSlot.MORNING, owner)
            def completedAt = Instant.parse("2026-10-05T09:00:00Z")
            def completion = new CompletionRecord(occurrence, owner, completedAt)
            planService.complete("steve", id) >> Optional.of(completion)

        when: "POST .../completion is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences/${id}/completion")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with completed: true"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.completed').value(true))
            result.andExpect(jsonPath('$.completedAt').value("2026-10-05T09:00:00Z"))
    }

    def "PLANNER-004-AC-26: POST .../occurrences/{id}/completion returns 404 for a not-found-or-not-owned id"() {
        given: "the service reports no matching owned occurrence"
            def id = UUID.randomUUID()
            planService.complete("steve", id) >> Optional.empty()

        when: "POST .../completion is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences/${id}/completion")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-004-AC-24: DELETE .../occurrences/{id}/completion undoes completion and returns 204"() {
        given: "the service removes the CompletionRecord successfully"
            def id = UUID.randomUUID()
            planService.uncomplete("steve", id) >> true

        when: "DELETE .../completion is requested"
            def result = mockMvc.perform(delete("/api/v1/plan/occurrences/${id}/completion")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 204 No Content"
            result.andExpect(status().isNoContent())
    }

    def "PLANNER-004-AC-25/AC-26: DELETE .../occurrences/{id}/completion returns 404 when not currently complete or not found/owned"() {
        given: "the service reports no effect"
            def id = UUID.randomUUID()
            planService.uncomplete("steve", id) >> false

        when: "DELETE .../completion is requested"
            def result = mockMvc.perform(delete("/api/v1/plan/occurrences/${id}/completion")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-004-AC-28: POST .../occurrences/{id}/carry-forward advances weekStart by 7 days and returns 200"() {
        given: "the service carries the occurrence forward successfully"
            def id = UUID.randomUUID()
            planService.carryForward("steve", id) >> Optional.of(
                new PlannedOccurrence(activity, null, ActivityCategory.ROUTINE, monday.plusDays(7), null, null, owner))

        when: "POST .../carry-forward is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences/${id}/carry-forward")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with weekStart advanced"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.weekStart').value("2026-10-12"))
    }

    def "PLANNER-004-AC-29/AC-30: POST .../occurrences/{id}/carry-forward returns 409 when the service rejects it as ineligible"() {
        given: "the service rejects the carry-forward as ineligible"
            def id = UUID.randomUUID()
            planService.carryForward("steve", id) >> { throw new CarryForwardNotAllowedException("bad") }

        when: "POST .../carry-forward is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences/${id}/carry-forward")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 409"
            result.andExpect(status().isConflict())
    }

    def "PLANNER-004-AC-31: POST .../occurrences/{id}/carry-forward returns 404 for a not-found-or-not-owned id"() {
        given: "the service reports no matching owned occurrence"
            def id = UUID.randomUUID()
            planService.carryForward("steve", id) >> Optional.empty()

        when: "POST .../carry-forward is requested"
            def result = mockMvc.perform(post("/api/v1/plan/occurrences/${id}/carry-forward")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-004-AC-37: an unauthenticated request to /api/v1/plan returns 401 (inherited SecurityFilterChain rule)"() {
        when: "GET /api/v1/plan is requested with no session"
            def result = mockMvc.perform(get("/api/v1/plan?weekStart=2026-10-05"))

        then: "the response is 401, not reaching the controller/service"
            result.andExpect(status().isUnauthorized())
            0 * planService.getWeek(_, _)
    }
}
