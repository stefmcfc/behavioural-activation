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
import uk.co.stefirby.behaviouralactivation.dto.SubTaskRequest
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.security.SecurityConfig
import uk.co.stefirby.behaviouralactivation.service.SubTaskService

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(controllers = SubTaskController)
@Import([SecurityConfig, CorsConfig])
class SubTaskControllerSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    ObjectMapper objectMapper

    @SpringBean
    SubTaskService subTaskService = Mock()

    User owner = new User("steve", "hashed-password")
    Activity activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)

    def "PLANNER-003-AC-01/AC-02: creates and returns a new sub-task with the category copied from the parent, 201"() {
        given: "a valid create request"
            def activityId = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([name: "Create a guest list"])

        and: "the service creates the sub-task"
            subTaskService.create("steve", activityId, _ as SubTaskRequest) >> Optional.of(
                new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))

        when: "POST .../sub-tasks is requested"
            def result = mockMvc.perform(post("/api/v1/activities/${activityId}/sub-tasks")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 201 Created with the name and the parent's category"
            result.andExpect(status().isCreated())
            result.andExpect(jsonPath('$.name').value("Create a guest list"))
            result.andExpect(jsonPath('$.category').value("PLEASURABLE"))
    }

    def "PLANNER-003-AC-04: blank or missing name returns 400 without creating a sub-task"() {
        given: "a request with a blank or missing name"
            def activityId = UUID.randomUUID()
            def body = objectMapper.writeValueAsString(requestBody)

        when: "POST .../sub-tasks is requested"
            def result = mockMvc.perform(post("/api/v1/activities/${activityId}/sub-tasks")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())

        and: "no sub-task is created"
            0 * subTaskService.create(_, _, _)

        where:
            requestBody << [
                [:],
                [name: ""],
                [name: "   "]
            ]
    }

    def "PLANNER-003-AC-05/AC-19: creating a sub-task under a not-found-or-not-owned activity returns 404, not creating anything"() {
        given: "the service reports no matching owned activity"
            def activityId = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([name: "Sneaky sub-task"])
            subTaskService.create("steve", activityId, _ as SubTaskRequest) >> Optional.empty()

        when: "POST .../sub-tasks is requested"
            def result = mockMvc.perform(post("/api/v1/activities/${activityId}/sub-tasks")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 404, not 403"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-003-AC-06: a client-supplied category in the POST body has no effect -- the response category still comes only from the parent"() {
        given: "a create request that also supplies a category, which SubTaskRequest has no field for"
            def activityId = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([name: "Create a guest list", category: "NECESSARY"])
            subTaskService.create("steve", activityId, new SubTaskRequest("Create a guest list")) >> Optional.of(
                new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner))

        when: "POST .../sub-tasks is requested"
            def result = mockMvc.perform(post("/api/v1/activities/${activityId}/sub-tasks")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 201, and the category is the parent's, not the client-supplied one"
            result.andExpect(status().isCreated())
            result.andExpect(jsonPath('$.category').value("PLEASURABLE"))
    }

    def "PLANNER-003-AC-07/AC-08: list returns the activity's sub-tasks in the {data, count} envelope"() {
        given: "the service returns the activity's sub-tasks"
            def activityId = UUID.randomUUID()
            subTaskService.listForActivity("steve", activityId) >> Optional.of(
                [new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner)])

        when: "GET .../sub-tasks is requested"
            def result = mockMvc.perform(get("/api/v1/activities/${activityId}/sub-tasks")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is the {data, count} envelope"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(1))
            result.andExpect(jsonPath('$.data[0].name').value("Create a guest list"))
    }

    def "PLANNER-003-AC-09: an activity with no sub-tasks returns 200 with an empty envelope, not 404"() {
        given: "the service returns a present but empty list"
            def activityId = UUID.randomUUID()
            subTaskService.listForActivity("steve", activityId) >> Optional.of([])

        when: "GET .../sub-tasks is requested"
            def result = mockMvc.perform(get("/api/v1/activities/${activityId}/sub-tasks")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with an empty envelope"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(0))
            result.andExpect(jsonPath('$.data').isEmpty())
    }

    def "PLANNER-003-AC-10/AC-19: list on a not-found-or-not-owned activity returns 404"() {
        given: "the service reports no matching owned activity"
            def activityId = UUID.randomUUID()
            subTaskService.listForActivity("steve", activityId) >> Optional.empty()

        when: "GET .../sub-tasks is requested"
            def result = mockMvc.perform(get("/api/v1/activities/${activityId}/sub-tasks")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-003-AC-11: PATCH renames the sub-task and returns 200"() {
        given: "a valid rename request the service applies successfully"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([name: "Create and send a guest list"])
            subTaskService.update("steve", activityId, id, _ as SubTaskRequest) >> Optional.of(
                new SubTask(activity, "Create and send a guest list", ActivityCategory.PLEASURABLE, owner))

        when: "PATCH .../sub-tasks/{id} is requested"
            def result = mockMvc.perform(patch("/api/v1/activities/${activityId}/sub-tasks/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 200 with the renamed sub-task"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.name').value("Create and send a guest list"))
    }

    def "PLANNER-003-AC-12: PATCH with a blank or missing name returns 400 without updating"() {
        given: "a request with a blank or missing name"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString(requestBody)

        when: "PATCH .../sub-tasks/{id} is requested"
            def result = mockMvc.perform(patch("/api/v1/activities/${activityId}/sub-tasks/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())

        and: "no update is applied"
            0 * subTaskService.update(_, _, _, _)

        where:
            requestBody << [
                [:],
                [name: ""]
            ]
    }

    def "PLANNER-003-AC-13/AC-19: PATCH on a not-found-or-not-owned activity or sub-task returns 404, not 403"() {
        given: "the service reports no matching owned sub-task"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([name: "New name"])
            subTaskService.update("steve", activityId, id, _ as SubTaskRequest) >> Optional.empty()

        when: "PATCH .../sub-tasks/{id} is requested"
            def result = mockMvc.perform(patch("/api/v1/activities/${activityId}/sub-tasks/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-003-AC-14: a client-supplied category in the PATCH body has no effect -- category is never editable"() {
        given: "an update request that also supplies a category, which SubTaskRequest has no field for"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([name: "New name", category: "NECESSARY"])
            subTaskService.update("steve", activityId, id, new SubTaskRequest("New name")) >> Optional.of(
                new SubTask(activity, "New name", ActivityCategory.PLEASURABLE, owner))

        when: "PATCH .../sub-tasks/{id} is requested"
            def result = mockMvc.perform(patch("/api/v1/activities/${activityId}/sub-tasks/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response is 200, and the category is unaffected by the client-supplied value"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.category').value("PLEASURABLE"))
    }

    def "PLANNER-003-AC-15: DELETE removes the sub-task and returns 204"() {
        given: "the service deletes the sub-task successfully"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            subTaskService.delete("steve", activityId, id) >> true

        when: "DELETE .../sub-tasks/{id} is requested"
            def result = mockMvc.perform(delete("/api/v1/activities/${activityId}/sub-tasks/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 204 No Content"
            result.andExpect(status().isNoContent())
    }

    def "PLANNER-003-AC-16/AC-19: DELETE on a not-found-or-not-owned activity or sub-task returns 404, not 403"() {
        given: "the service reports no matching owned sub-task"
            def activityId = UUID.randomUUID()
            def id = UUID.randomUUID()
            subTaskService.delete("steve", activityId, id) >> false

        when: "DELETE .../sub-tasks/{id} is requested"
            def result = mockMvc.perform(delete("/api/v1/activities/${activityId}/sub-tasks/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-003-AC-21: an unauthenticated request to sub-tasks returns 401 (inherited SecurityFilterChain rule)"() {
        when: "GET .../sub-tasks is requested with no session"
            def result = mockMvc.perform(get("/api/v1/activities/${UUID.randomUUID()}/sub-tasks"))

        then: "the response is 401, not reaching the controller/service"
            result.andExpect(status().isUnauthorized())
            0 * subTaskService.listForActivity(_, _)
    }
}
