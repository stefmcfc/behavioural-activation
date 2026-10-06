package uk.co.stefirby.behaviouralactivation.controller

import org.spockframework.spring.SpringBean
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.config.ClockConfig
import uk.co.stefirby.behaviouralactivation.config.CorsConfig
import uk.co.stefirby.behaviouralactivation.security.SecurityConfig
import uk.co.stefirby.behaviouralactivation.service.ExportService

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/**
 * planner_spec_025_data_export.md -- proves the controller's HTTP wiring (status, headers) against
 * a mocked ExportService; the generated SQL content itself (AC-02 through AC-13) depends on real
 * owner-scoped data and is proved by ExportServiceIntegrationSpec instead, mirroring this
 * codebase's existing WebMvcTest-mocked-service / real-Postgres-integration-spec split (e.g.
 * WorkDayControllerSpec vs. WorkDayService's own integration coverage).
 */
@WebMvcTest(controllers = ExportController)
@Import([SecurityConfig, CorsConfig, ClockConfig])
class ExportControllerSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @SpringBean
    ExportService exportService = Mock()

    def "PLANNER-025-AC-01: GET /api/v1/export returns 200 with a Content-Disposition attachment header"() {
        given: "the service returns a generated export"
            exportService.generateExport("steve") >> "-- comment\nBEGIN;\nCOMMIT;\n"

        when: "GET /api/v1/export is requested"
            def result = mockMvc.perform(get("/api/v1/export")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with an attachment Content-Disposition header naming a .sql file"
            result.andExpect(status().isOk())
            def contentDisposition = result.andReturn().response.getHeader("Content-Disposition")
            contentDisposition != null
            contentDisposition.contains("attachment")
            contentDisposition.contains(".sql")
    }

    def "an unauthenticated request to /api/v1/export returns 401 (inherited SecurityFilterChain rule)"() {
        when: "GET /api/v1/export is requested with no session"
            def result = mockMvc.perform(get("/api/v1/export"))

        then: "the response is 401, not reaching the controller/service"
            result.andExpect(status().isUnauthorized())
            0 * exportService.generateExport(_)
    }
}
