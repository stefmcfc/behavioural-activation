package uk.co.stefirby.behaviouralactivation.controller

import org.spockframework.spring.SpringBean
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.config.CorsConfig
import uk.co.stefirby.behaviouralactivation.model.Activity
import uk.co.stefirby.behaviouralactivation.model.ActivityCategory
import uk.co.stefirby.behaviouralactivation.model.SubTask
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.security.SecurityConfig
import uk.co.stefirby.behaviouralactivation.service.SubTaskService

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/**
 * planner_spec_018_bulk_sub_task_fetch.md -- GET /api/v1/sub-tasks, the new bulk, cross-activity
 * sub-task endpoint. Separate from SubTaskControllerSpec.groovy (which covers the pre-existing,
 * activity-nested endpoints) purely for file-size/readability; both specs target the same
 * SubTaskController class. Mocks SubTaskService, same style as SubTaskControllerSpec -- owner-scoping
 * itself (PLANNER-018-AC-02) is proven at the repository/service layer
 * (SubTaskRepositorySpec/SubTaskServiceSpec), not re-proven here.
 */
@WebMvcTest(controllers = SubTaskController)
@Import([SecurityConfig, CorsConfig])
class SubTaskControllerBulkListSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @SpringBean
    SubTaskService subTaskService = Mock()

    User owner = new User("steve", "hashed-password")
    Activity activity = new Activity("Organise a birthday party", ActivityCategory.PLEASURABLE, null, owner)
    Activity otherActivity = new Activity("Go for a walk", ActivityCategory.ROUTINE, null, owner)

    def "PLANNER-018-AC-01: returns every sub-task across all of the user's activities in the {data, count} envelope"() {
        given: "the service returns sub-tasks spanning two activities"
            subTaskService.listForOwner("steve") >> [
                new SubTask(activity, "Create a guest list", ActivityCategory.PLEASURABLE, owner),
                new SubTask(activity, "Book a venue", ActivityCategory.PLEASURABLE, owner),
                new SubTask(otherActivity, "Choose a route", ActivityCategory.ROUTINE, owner)
            ]

        when: "GET /api/v1/sub-tasks is requested"
            def result = mockMvc.perform(get("/api/v1/sub-tasks")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with every sub-task, across both activities"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(3))
            result.andExpect(jsonPath('$.data[0].name').value("Create a guest list"))
            result.andExpect(jsonPath('$.data[1].name').value("Book a venue"))
            result.andExpect(jsonPath('$.data[2].name').value("Choose a route"))
    }

    def "PLANNER-018-AC-01: a user with no sub-tasks at all gets an empty envelope, not an error"() {
        given: "the service reports no sub-tasks"
            subTaskService.listForOwner("steve") >> []

        when: "GET /api/v1/sub-tasks is requested"
            def result = mockMvc.perform(get("/api/v1/sub-tasks")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with an empty envelope"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(0))
            result.andExpect(jsonPath('$.data').isEmpty())
    }

    def "PLANNER-018-AC-03: an unauthenticated request returns 401 (inherited SecurityFilterChain rule)"() {
        when: "GET /api/v1/sub-tasks is requested with no session"
            def result = mockMvc.perform(get("/api/v1/sub-tasks"))

        then: "the response is 401, not reaching the controller/service"
            result.andExpect(status().isUnauthorized())
            0 * subTaskService.listForOwner(_)
    }
}
