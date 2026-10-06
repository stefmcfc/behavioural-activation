package uk.co.stefirby.behaviouralactivation.controller

import tools.jackson.databind.ObjectMapper
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.mock.web.MockHttpSession
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/**
 * planner_spec_024_change_password.md's genuine round-trip proof -- PLANNER-024-AC-01's "the new
 * password now authenticates, and the old one no longer does" and PLANNER-024-AC-04's "the old
 * session no longer authenticates" both depend on a REAL AuthenticationManager/PasswordEncoder/
 * session, which AuthControllerSpec's mocked @WebMvcTest deliberately doesn't exercise -- that spec
 * proves wiring; this one proves actual behavior against the real Postgres instance (docker-compose),
 * mirroring SubTaskServiceReorderIntegrationSpec's own throwaway-User setup()/cleanup() pattern.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerChangePasswordIntegrationSpec extends Specification {

    private static final String ORIGINAL_PASSWORD = "original-strong-password"

    @Autowired
    MockMvc mockMvc

    @Autowired
    ObjectMapper objectMapper

    @Autowired
    UserRepository userRepository

    @Autowired
    PasswordEncoder passwordEncoder

    User owner

    def setup() {
        owner = userRepository.save(
            new User("change-password-test-${UUID.randomUUID()}", passwordEncoder.encode(ORIGINAL_PASSWORD)))
    }

    def cleanup() {
        userRepository.delete(owner)
    }

    private MockHttpSession loginSession() {
        def session = new MockHttpSession()
        def body = objectMapper.writeValueAsString([username: owner.username, password: ORIGINAL_PASSWORD])
        mockMvc.perform(post("/api/v1/auth/login")
            .session(session)
            .contentType("application/json")
            .content(body))
            .andExpect(status().isOk())
        return session
    }

    def "PLANNER-024-AC-01: a valid password change updates the stored hash -- new password authenticates, old one doesn't"() {
        given: "an authenticated session and a valid change-password request"
            def session = loginSession()
            def changeBody = objectMapper.writeValueAsString(
                [currentPassword: ORIGINAL_PASSWORD, newPassword: "a-new-strong-password"])

        when: "PATCH /api/v1/auth/password is requested"
            def result = mockMvc.perform(patch("/api/v1/auth/password")
                .session(session)
                .contentType("application/json")
                .content(changeBody))

        then: "the response is 204"
            result.andExpect(status().isNoContent())

        and: "the new password now authenticates"
            def newLoginBody = objectMapper.writeValueAsString([username: owner.username, password: "a-new-strong-password"])
            mockMvc.perform(post("/api/v1/auth/login").contentType("application/json").content(newLoginBody))
                .andExpect(status().isOk())

        and: "the old password no longer authenticates"
            def oldLoginBody = objectMapper.writeValueAsString([username: owner.username, password: ORIGINAL_PASSWORD])
            mockMvc.perform(post("/api/v1/auth/login").contentType("application/json").content(oldLoginBody))
                .andExpect(status().isUnauthorized())
    }

    def "PLANNER-024-AC-02: an incorrect current password returns 401, original password unchanged"() {
        given: "an authenticated session and a request with the wrong current password"
            def session = loginSession()
            def changeBody = objectMapper.writeValueAsString(
                [currentPassword: "totally-wrong-password", newPassword: "a-new-strong-password"])

        when: "PATCH /api/v1/auth/password is requested"
            def result = mockMvc.perform(patch("/api/v1/auth/password")
                .session(session)
                .contentType("application/json")
                .content(changeBody))

        then: "the response is 401"
            result.andExpect(status().isUnauthorized())

        and: "the original password still authenticates"
            def loginBody = objectMapper.writeValueAsString([username: owner.username, password: ORIGINAL_PASSWORD])
            mockMvc.perform(post("/api/v1/auth/login").contentType("application/json").content(loginBody))
                .andExpect(status().isOk())
    }

    def "PLANNER-024-AC-04: a successful password change invalidates the current session"() {
        given: "an authenticated session and a valid change-password request"
            def session = loginSession()
            def changeBody = objectMapper.writeValueAsString(
                [currentPassword: ORIGINAL_PASSWORD, newPassword: "a-new-strong-password"])

        when: "PATCH /api/v1/auth/password succeeds"
            mockMvc.perform(patch("/api/v1/auth/password")
                .session(session)
                .contentType("application/json")
                .content(changeBody))
                .andExpect(status().isNoContent())

        and: "the same session is used for a subsequent authenticated request"
            def result = mockMvc.perform(get("/api/v1/auth/me").session(session))

        then: "the old session no longer authenticates"
            result.andExpect(status().isUnauthorized())
    }
}
