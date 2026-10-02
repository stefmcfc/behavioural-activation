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
import uk.co.stefirby.behaviouralactivation.service.ActivityWithSubTaskCount

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

    def "PLANNER-006-AC-01/AC-02: the create response reflects the created activity's repeatable and (always-false) archived state"() {
        given: "a valid create request"
            def body = objectMapper.writeValueAsString([name: "Apply for jobs", category: "NECESSARY", repeatable: false])

        and: "the service creates the activity"
            activityService.create("steve", _ as ActivityRequest) >>
                new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)

        when: "POST /api/v1/activities is requested"
            def result = mockMvc.perform(post("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response reflects repeatable: false and archived: false"
            result.andExpect(status().isCreated())
            result.andExpect(jsonPath('$.repeatable').value(false))
            result.andExpect(jsonPath('$.archived').value(false))
    }

    def "PLANNER-006-AC-04: a client-supplied archived value in the create request body has no effect on what is passed to the service"() {
        given: "a create request that also attempts to set archived: true"
            def body = objectMapper.writeValueAsString([name: "Walk", category: "ROUTINE", archived: true])
            ActivityRequest captured = null
            activityService.create("steve", _ as ActivityRequest) >> { String username, ActivityRequest request ->
                captured = request
                return new Activity("Walk", ActivityCategory.ROUTINE, null, owner)
            }

        when: "POST /api/v1/activities is requested"
            mockMvc.perform(post("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "ActivityRequest declares no archived field to even carry the client-supplied value"
            captured != null
            !ActivityRequest.declaredFields*.name.contains("archived")
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
            activityService.listForOwner("steve", false) >>
                [new ActivityWithSubTaskCount(new Activity("Bake", ActivityCategory.PLEASURABLE, null, owner), 0)]

        when: "GET /api/v1/activities is requested"
            def result = mockMvc.perform(get("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is the {data, count} envelope"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(1))
            result.andExpect(jsonPath('$.data[0].name').value("Bake"))
    }

    def "PLANNER-012-AC-01: list carries each activity's own subTaskCount"() {
        given: "the service pairs two activities with different sub-task counts"
            def withSubTasks = new Activity("Walk", ActivityCategory.ROUTINE, null, owner)
            def withoutSubTasks = new Activity("Read", ActivityCategory.PLEASURABLE, null, owner)
            activityService.listForOwner("steve", false) >> [
                new ActivityWithSubTaskCount(withSubTasks, 2),
                new ActivityWithSubTaskCount(withoutSubTasks, 0)
            ]

        when: "GET /api/v1/activities is requested"
            def result = mockMvc.perform(get("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "each activity's response carries its own count"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data[0].subTaskCount').value(2))
            result.andExpect(jsonPath('$.data[1].subTaskCount').value(0))
    }

    def "PLANNER-012-AC-01: create response carries subTaskCount: 0 -- a new activity can't have sub-tasks yet"() {
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

        then: "the response carries subTaskCount: 0, with no call to count sub-tasks"
            result.andExpect(status().isCreated())
            result.andExpect(jsonPath('$.subTaskCount').value(0))
            0 * activityService.countSubTasks(_, _)
    }

    def "PLANNER-012-AC-01: update response carries the activity's real current subTaskCount"() {
        given: "a valid update request the service applies successfully"
            def id = UUID.randomUUID()
            def body = objectMapper.writeValueAsString([name: "Jog", category: "PLEASURABLE", description: "with music"])
            activityService.update("steve", id, _ as ActivityRequest) >>
                Optional.of(new Activity("Jog", ActivityCategory.PLEASURABLE, "with music", owner))
            activityService.countSubTasks("steve", id) >> 3

        when: "PUT /api/v1/activities/{id} is requested"
            def result = mockMvc.perform(put("/api/v1/activities/${id}")
                .with(SecurityMockMvcRequestPostProcessors.user("steve"))
                .contentType("application/json")
                .content(body))

        then: "the response carries the real current count, not an assumed 0"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.subTaskCount').value(3))
    }

    def "PLANNER-012-AC-01: archive response carries the activity's real current subTaskCount"() {
        given: "the service archives the activity"
            def id = UUID.randomUUID()
            activityService.archive("steve", id) >>
                Optional.of(new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner).tap { archive() })
            activityService.countSubTasks("steve", id) >> 1

        when: "POST /api/v1/activities/{id}/archive is requested"
            def result = mockMvc.perform(post("/api/v1/activities/${id}/archive")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response carries the real current count, not an assumed 0"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.subTaskCount').value(1))
    }

    def "PLANNER-002-AC-11: an empty activity bank returns 200 with an empty data array and zero count"() {
        given: "the service returns no activities"
            activityService.listForOwner("steve", false) >> []

        when: "GET /api/v1/activities is requested"
            def result = mockMvc.perform(get("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with an empty envelope, not an error"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(0))
            result.andExpect(jsonPath('$.data').isEmpty())
    }

    def "PLANNER-006-AC-10: GET /api/v1/activities with no includeArchived param excludes archived (default false)"() {
        when: "GET /api/v1/activities is requested with no includeArchived param"
            def result = mockMvc.perform(get("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the service is called with includeArchived=false"
            result.andExpect(status().isOk())
            1 * activityService.listForOwner("steve", false) >> []
    }

    def "PLANNER-006-AC-11: GET /api/v1/activities?includeArchived=true asks the service for the full (mixed) list"() {
        given: "the service returns a mixed set"
            activityService.listForOwner("steve", true) >>
                [new ActivityWithSubTaskCount(new Activity("Bake", ActivityCategory.PLEASURABLE, null, owner), 0)]

        when: "GET /api/v1/activities?includeArchived=true is requested"
            def result = mockMvc.perform(get("/api/v1/activities?includeArchived=true")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response reflects the service's includeArchived=true result"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.count').value(1))
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
            0 * activityService.listForOwner(_, _)
    }

    def "PLANNER-006-AC-05: POST .../archive succeeds, 200, with archived: true"() {
        given: "the service archives the activity"
            def id = UUID.randomUUID()
            activityService.archive("steve", id) >>
                Optional.of(new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner).tap { archive() })

        when: "POST /api/v1/activities/{id}/archive is requested"
            def result = mockMvc.perform(post("/api/v1/activities/${id}/archive")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with archived: true"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.archived').value(true))
    }

    def "PLANNER-006-AC-06: POST .../archive on an already-archived activity is still a 200, not an error"() {
        given: "the service reports the (already-archived) activity, idempotently"
            def id = UUID.randomUUID()
            def alreadyArchived = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            alreadyArchived.archive()
            activityService.archive("steve", id) >> Optional.of(alreadyArchived)

        when: "POST /api/v1/activities/{id}/archive is requested again"
            def result = mockMvc.perform(post("/api/v1/activities/${id}/archive")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is still 200, still archived, no error"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.archived').value(true))
    }

    def "PLANNER-006-AC-07: POST .../archive on another owner's (or nonexistent) activity returns 404"() {
        given: "the service reports no matching activity for this owner"
            def id = UUID.randomUUID()
            activityService.archive("steve", id) >> Optional.empty()

        when: "POST /api/v1/activities/{id}/archive is requested"
            def result = mockMvc.perform(post("/api/v1/activities/${id}/archive")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-006-AC-08: DELETE .../archive unarchives and returns 204"() {
        given: "the service unarchives the activity successfully"
            def id = UUID.randomUUID()
            activityService.unarchive("steve", id) >> true

        when: "DELETE /api/v1/activities/{id}/archive is requested"
            def result = mockMvc.perform(delete("/api/v1/activities/${id}/archive")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 204 No Content"
            result.andExpect(status().isNoContent())
    }

    def "PLANNER-006-AC-09: DELETE .../archive on another owner's (or nonexistent) activity returns 404"() {
        given: "the service reports no matching activity for this owner"
            def id = UUID.randomUUID()
            activityService.unarchive("steve", id) >> false

        when: "DELETE /api/v1/activities/{id}/archive is requested"
            def result = mockMvc.perform(delete("/api/v1/activities/${id}/archive")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-006-AC-18: an unauthenticated request to the archive endpoints returns 401 (inherited SecurityFilterChain rule)"() {
        when: "the archive/unarchive endpoints are requested with no session"
            def archiveResult = mockMvc.perform(post("/api/v1/activities/${UUID.randomUUID()}/archive"))
            def unarchiveResult = mockMvc.perform(delete("/api/v1/activities/${UUID.randomUUID()}/archive"))

        then: "both responses are 401, not reaching the controller/service"
            archiveResult.andExpect(status().isUnauthorized())
            unarchiveResult.andExpect(status().isUnauthorized())
            0 * activityService.archive(_, _)
            0 * activityService.unarchive(_, _)
    }

    def "PLANNER-015-AC-03: POST .../favourite succeeds, 200, with favourite: true"() {
        given: "the service marks the activity favourite"
            def id = UUID.randomUUID()
            activityService.markFavourite("steve", id) >>
                Optional.of(new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner).tap { markFavourite() })

        when: "POST /api/v1/activities/{id}/favourite is requested"
            def result = mockMvc.perform(post("/api/v1/activities/${id}/favourite")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with favourite: true"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.favourite').value(true))
    }

    def "PLANNER-015-AC-03: POST .../favourite response carries the activity's real current subTaskCount"() {
        given: "the service marks the activity favourite"
            def id = UUID.randomUUID()
            activityService.markFavourite("steve", id) >>
                Optional.of(new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner).tap { markFavourite() })
            activityService.countSubTasks("steve", id) >> 1

        when: "POST /api/v1/activities/{id}/favourite is requested"
            def result = mockMvc.perform(post("/api/v1/activities/${id}/favourite")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response carries the real current count, not an assumed 0"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.subTaskCount').value(1))
    }

    def "PLANNER-015-AC-04: POST .../favourite on an already-favourited activity is still a 200, not an error"() {
        given: "the service reports the (already-favourited) activity, idempotently"
            def id = UUID.randomUUID()
            def alreadyFavourite = new Activity("Apply for jobs", ActivityCategory.NECESSARY, null, false, owner)
            alreadyFavourite.markFavourite()
            activityService.markFavourite("steve", id) >> Optional.of(alreadyFavourite)

        when: "POST /api/v1/activities/{id}/favourite is requested again"
            def result = mockMvc.perform(post("/api/v1/activities/${id}/favourite")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is still 200, still favourite, no error"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.favourite').value(true))
    }

    def "PLANNER-015-AC-05: POST .../favourite on another owner's (or nonexistent) activity returns 404"() {
        given: "the service reports no matching activity for this owner"
            def id = UUID.randomUUID()
            activityService.markFavourite("steve", id) >> Optional.empty()

        when: "POST /api/v1/activities/{id}/favourite is requested"
            def result = mockMvc.perform(post("/api/v1/activities/${id}/favourite")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-015-AC-06: DELETE .../favourite unmarks favourite and returns 204"() {
        given: "the service unmarks the activity's favourite status successfully"
            def id = UUID.randomUUID()
            activityService.unmarkFavourite("steve", id) >> true

        when: "DELETE /api/v1/activities/{id}/favourite is requested"
            def result = mockMvc.perform(delete("/api/v1/activities/${id}/favourite")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 204 No Content"
            result.andExpect(status().isNoContent())
    }

    def "PLANNER-015-AC-07: DELETE .../favourite on an already-not-favourited activity is still a 204, not an error"() {
        given: "the service reports success idempotently"
            def id = UUID.randomUUID()
            activityService.unmarkFavourite("steve", id) >> true

        when: "DELETE /api/v1/activities/{id}/favourite is requested"
            def result = mockMvc.perform(delete("/api/v1/activities/${id}/favourite")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is still 204, no error"
            result.andExpect(status().isNoContent())
    }

    def "PLANNER-015-AC-08: DELETE .../favourite on another owner's (or nonexistent) activity returns 404"() {
        given: "the service reports no matching activity for this owner"
            def id = UUID.randomUUID()
            activityService.unmarkFavourite("steve", id) >> false

        when: "DELETE /api/v1/activities/{id}/favourite is requested"
            def result = mockMvc.perform(delete("/api/v1/activities/${id}/favourite")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 404"
            result.andExpect(status().isNotFound())
    }

    def "PLANNER-015-AC-12: the create response reflects favourite: false for a newly created activity"() {
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

        then: "the response reflects favourite: false"
            result.andExpect(status().isCreated())
            result.andExpect(jsonPath('$.favourite').value(false))
    }

    def "PLANNER-015-AC-12: list carries each activity's own favourite status"() {
        given: "the service pairs a favourited and a non-favourited activity"
            def favourite = new Activity("Zebra errand", ActivityCategory.ROUTINE, null, owner).tap { markFavourite() }
            def notFavourite = new Activity("Apple walk", ActivityCategory.ROUTINE, null, owner)
            activityService.listForOwner("steve", false) >> [
                new ActivityWithSubTaskCount(favourite, 0),
                new ActivityWithSubTaskCount(notFavourite, 0)
            ]

        when: "GET /api/v1/activities is requested"
            def result = mockMvc.perform(get("/api/v1/activities")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "each activity's response carries its own favourite status"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.data[0].favourite').value(true))
            result.andExpect(jsonPath('$.data[1].favourite').value(false))
    }

    def "PLANNER-015-AC-12: client-supplied favourite in the create/update request body has no effect -- there is no field to carry it"() {
        expect: "ActivityRequest declares no favourite field"
            !ActivityRequest.declaredFields*.name.contains("favourite")
    }

    def "PLANNER-015-AC-12: an unauthenticated request to the favourite endpoints returns 401 (inherited SecurityFilterChain rule)"() {
        when: "the favourite/unmark-favourite endpoints are requested with no session"
            def markResult = mockMvc.perform(post("/api/v1/activities/${UUID.randomUUID()}/favourite"))
            def unmarkResult = mockMvc.perform(delete("/api/v1/activities/${UUID.randomUUID()}/favourite"))

        then: "both responses are 401, not reaching the controller/service"
            markResult.andExpect(status().isUnauthorized())
            unmarkResult.andExpect(status().isUnauthorized())
            0 * activityService.markFavourite(_, _)
            0 * activityService.unmarkFavourite(_, _)
    }
}
