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
import uk.co.stefirby.behaviouralactivation.dto.ActivityRequest
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.security.SecurityConfig
import uk.co.stefirby.behaviouralactivation.service.ActivityService

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(controllers = ActivityController)
@Import([SecurityConfig, CorsConfig])
class ActivityControllerSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    ObjectMapper objectMapper

    @SpringBean
    ActivityService activityService = Mock()

    User owner = new User("steve", "hashed-password")

    def "PLANNER-002-AC-01: creates and returns a new activity, 201"() {
        given: "a valid create request"
            def body = objectMapper.writeValueAsString([name: "Walk", category: "ROUTINE"])

        and: "the service creates the activity"
            activityService.create("steve", _ as ActivityRequest) >>
                new Activity("Walk", ActivityCategory.ROUTINE, null, owner)

        when: "POST /api/v1/activities is requested"
            def result = mockMvc.perform(post("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 201 Created with the new activity"
            result.andExpect(status().isCreated())
            result.andExpect(jsonPath('$.name').value("Walk"))
            result.andExpect(jsonPath('$.category').value("ROUTINE"))
    }

    def "PLANNER-002-AC-03: blank or missing name returns 400 without creating an activity"() {
        given: "a request with a blank or missing name"
            def body = objectMapper.writeValueAsString(requestBody)

        when: "POST /api/v1/activities is requested"
            def result = mockMvc.perform(post("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())

        and: "no activity is created"
            0 * activityService.create(_, _)

        where:
            requestBody << [
                [category: "ROUTINE"],
                [name: "", category: "ROUTINE"],
                [name: "   ", category: "ROUTINE"]
            ]
    }

    def "PLANNER-002-AC-04: missing or invalid category returns 400 without creating an activity"() {
        given: "a request with a missing or invalid category"
            def body = objectMapper.writeValueAsString(requestBody)

        when: "POST /api/v1/activities is requested"
            def result = mockMvc.perform(post("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())

        and: "no activity is created"
            0 * activityService.create(_, _)

        where:
            requestBody << [
                [name: "Walk"],
                [name: "Walk", category: "FUN"]
            ]
    }

    def "PLANNER-002-AC-08/AC-09: list returns only my activities in the documented envelope shape"() {
        given: "the service returns the current user's activities"
            activityService.listForOwner("steve") >> [new Activity("Bake", ActivityCategory.PLEASURABLE, null, owner)]

        when: "GET /api/v1/activities is requested"
            def result = mockMvc.perform(get("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is the {data, count} envelope"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(1))
            result.andExpect(jsonPath('$.data[0].name').value("Bake"))
    }

    def "PLANNER-002-AC-11: an empty activity bank returns 200 with an empty data array and zero count"() {
        given: "the service returns no activities"
            activityService.listForOwner("steve") >> []

        when: "GET /api/v1/activities is requested"
            def result = mockMvc.perform(get("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with an empty envelope, not an error"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(0))
            result.andExpect(jsonPath('$.data').isEmpty())
    }

    def "PLANNER-002-AC-12: PUT updates name, category, and description and returns 200"() {
        given: "a valid update request the service applies successfully"
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([name: "Jog", category: "PLEASURABLE", description: "with music"])
            activityService.update("steve", id, _ as ActivityRequest) >>
                Optional.of(new Activity("Jog", ActivityCategory.PLEASURABLE, "with music", owner))

        when: "PUT /api/v1/activities/{id} is requested"
            def result = mockMvc.perform(put("/api/v1/activities/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 200 with the updated activity"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.name').value("Jog"))
            result.andExpect(jsonPath('$.category').value("PLEASURABLE"))
            result.andExpect(jsonPath('$.description').value("with music"))
    }

    def "PLANNER-002-AC-13: PUT with a blank or missing name returns 400 without updating"() {
        given: "a request with a blank or missing name"
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString(requestBody)

        when: "PUT /api/v1/activities/{id} is requested"
            def result = mockMvc.perform(put("/api/v1/activities/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())

        and: "no update is applied"
            0 * activityService.update(_, _, _)

        where:
            requestBody << [
                [category: "ROUTINE"],
                [name: "", category: "ROUTINE"]
            ]
    }

    def "PLANNER-002-AC-14: PUT with an invalid category returns 400 without updating"() {
        given: "a request with an invalid category"
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([name: "Jog", category: "FUN"])

        when: "PUT /api/v1/activities/{id} is requested"
            def result = mockMvc.perform(put("/api/v1/activities/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())

        and: "no update is applied"
            0 * activityService.update(_, _, _)
    }

    def "PLANNER-002-AC-15/AC-18: PUT on another owner's (or nonexistent) activity returns 404, not 403"() {
        given: "the service reports no matching activity for this owner"
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([name: "Read more", category: "PLEASURABLE"])
            activityService.update("steve", id, _ as ActivityRequest) >> Optional.empty()

        when: "PUT /api/v1/activities/{id} is requested"
            def result = mockMvc.perform(put("/api/v1/activities/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-002-AC-16: DELETE removes the activity and returns 204"() {
        given: "the service deletes the activity successfully"
            def id = UUID.randomUUID()
            activityService.delete("steve", id) >> true

        when: "DELETE /api/v1/activities/{id} is requested"
            def result = mockMvc.perform(delete("/api/v1/activities/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 204 No Content"
            result.andExpect(status().isNoContent())
    }

    def "PLANNER-002-AC-17/AC-18: DELETE on another owner's (or nonexistent) activity returns 404, not 403"() {
        given: "the service reports no matching activity for this owner"
            def id = UUID.randomUUID()
            activityService.delete("steve", id) >> false

        when: "DELETE /api/v1/activities/{id} is requested"
            def result = mockMvc.perform(delete("/api/v1/activities/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-002-AC-19: an unauthenticated request to /api/v1/activities returns 401 (inherited SecurityFilterChain rule)"() {
        when: "GET /api/v1/activities is requested with no session"
            def result = mockMvc.perform(get("/api/v1/activities"))

        then: "the response is 401, not reaching the controller/service"
            result.andExpect(status().isUnauthorized())
            0 * activityService.listForOwner(_)
    }
}
