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
import uk.co.stefirby.behaviouralactivation.dto.WorkDayResponse
import uk.co.stefirby.behaviouralactivation.exception.InvalidPlanRequestException
import uk.co.stefirby.behaviouralactivation.security.SecurityConfig
import uk.co.stefirby.behaviouralactivation.service.WorkDayService

import java.time.DayOfWeek
import java.time.LocalDate

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(controllers = WorkDayController)
@Import([SecurityConfig, CorsConfig])
class WorkDayControllerSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    ObjectMapper objectMapper

    @SpringBean
    WorkDayService workDayService = Mock()

    def "PLANNER-021-AC-01: GET /api/v1/work-days/pattern returns 200 with an empty days set for a fresh owner"() {
        given: "the service reports no pattern days"
            workDayService.getPattern("steve") >> ([] as Set)

        when: "GET /api/v1/work-days/pattern is requested"
            def result = mockMvc.perform(get("/api/v1/work-days/pattern")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with an empty days array"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.days').isEmpty())
    }

    def "PLANNER-021-AC-02: PUT /api/v1/work-days/pattern replaces the pattern and returns 200 with the new set"() {
        given: "the service returns the newly-set pattern"
            workDayService.setPattern("steve", _ as Set) >> ([DayOfWeek.FRIDAY] as Set)
            def body = objectMapper.writeValueAsString([days: ["FRIDAY"]])

        when: "PUT /api/v1/work-days/pattern is requested"
            def result = mockMvc.perform(put("/api/v1/work-days/pattern")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 200 with the new days set"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.days[0]').value("FRIDAY"))
    }

    def "PLANNER-021-AC-02: PUT /api/v1/work-days/pattern returns 400 when days is missing"() {
        when: "PUT /api/v1/work-days/pattern is requested with no days field"
            def result = mockMvc.perform(put("/api/v1/work-days/pattern")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content("{}"))

        then: "the response is 400, and the service is never invoked"
            result.andExpect(status().isBadRequest())
            0 * workDayService.setPattern(_, _)
    }

    def "PLANNER-021-AC-04: GET /api/v1/work-days?weekStart=... returns 200 with the {data, count} envelope"() {
        given: "the service returns 7 resolved entries for the week"
            def monday = LocalDate.of(2026, 10, 12)
            def week = (0..6).collect { offset ->
                def date = monday.plusDays(offset)
                new WorkDayResponse(date, date.dayOfWeek, offset < 5)
            }
            workDayService.getWeek("steve", monday) >> week

        when: "GET /api/v1/work-days is requested"
            def result = mockMvc.perform(get("/api/v1/work-days?weekStart=2026-10-12")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with exactly 7 entries in the {data, count} envelope"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(7))
            result.andExpect(jsonPath('$.data.length()').value(7))
            result.andExpect(jsonPath('$.data[0].date').value("2026-10-12"))
            result.andExpect(jsonPath('$.data[0].dayOfWeek').value("MONDAY"))
            result.andExpect(jsonPath('$.data[0].workDay').value(true))
            result.andExpect(jsonPath('$.data[6].workDay').value(false))
    }

    def "PLANNER-021-AC-05: GET /api/v1/work-days returns 400 for a missing or non-Monday weekStart"() {
        given: "the service rejects the weekStart as invalid"
            workDayService.getWeek("steve", _) >>
                { throw new InvalidPlanRequestException("weekStart is required and must be a Monday") }

        when: "GET /api/v1/work-days is requested"
            def result = mockMvc.perform(get(uri)
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 400 with the shared message"
            result.andExpect(status().isBadRequest())
            result.andExpect(jsonPath('$.message').value("weekStart is required and must be a Monday"))

        where:
            uri << ["/api/v1/work-days", "/api/v1/work-days?weekStart=2026-10-13"]
    }

    def "PLANNER-021-AC-07: PUT /api/v1/work-days/{date} sets the override and returns 200 with the resolved shape"() {
        given: "the service sets the override and returns the resolved response"
            def date = LocalDate.of(2026, 10, 17)
            workDayService.setOverride("steve", date, true) >> new WorkDayResponse(date, date.dayOfWeek, true)
            def body = objectMapper.writeValueAsString([workDay: true])

        when: "PUT /api/v1/work-days/{date} is requested"
            def result = mockMvc.perform(put("/api/v1/work-days/2026-10-17")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 200 with the date, dayOfWeek, and workDay"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.date').value("2026-10-17"))
            result.andExpect(jsonPath('$.dayOfWeek').value("SATURDAY"))
            result.andExpect(jsonPath('$.workDay').value(true))
    }

    def "PLANNER-021-AC-07: PUT /api/v1/work-days/{date} returns 400 when workDay is missing"() {
        when: "PUT /api/v1/work-days/{date} is requested with no workDay field"
            def result = mockMvc.perform(put("/api/v1/work-days/2026-10-17")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content("{}"))

        then: "the response is 400, and the service is never invoked"
            result.andExpect(status().isBadRequest())
            0 * workDayService.setOverride(_, _, _)
    }

    def "an unauthenticated request to /api/v1/work-days returns 401 (inherited SecurityFilterChain rule)"() {
        when: "GET /api/v1/work-days/pattern is requested with no session"
            def result = mockMvc.perform(get("/api/v1/work-days/pattern"))

        then: "the response is 401, not reaching the controller/service"
            result.andExpect(status().isUnauthorized())
            0 * workDayService.getPattern(_)
    }
}
