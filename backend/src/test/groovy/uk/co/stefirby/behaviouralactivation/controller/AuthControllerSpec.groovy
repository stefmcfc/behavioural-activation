package uk.co.stefirby.behaviouralactivation.controller

import org.hamcrest.Matchers
import tools.jackson.databind.ObjectMapper
import org.spockframework.spring.SpringBean
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.mock.web.MockHttpSession
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
import org.springframework.test.web.servlet.MockMvc
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.config.CorsConfig
import uk.co.stefirby.behaviouralactivation.security.SecurityConfig

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(controllers = AuthController)
@Import([SecurityConfig, CorsConfig])
class AuthControllerSpec extends Specification {

    @Autowired
    MockMvc mockMvc

    @Autowired
    ObjectMapper objectMapper

    @SpringBean
    AuthenticationManager authenticationManager = Mock()

    def "PLANNER-001-AC-05: successful login authenticates, stores session, returns username"() {
        given: "a valid username/password body"
            def body = objectMapper.writeValueAsString([username: "steve", password: "correct-horse"])

        and: "AuthenticationManager authenticates it successfully"
            Authentication authenticated = new UsernamePasswordAuthenticationToken(
                "steve", null, [new SimpleGrantedAuthority("ROLE_USER")])
            authenticationManager.authenticate(_) >> authenticated

        when: "POST /api/v1/auth/login is requested"
            def result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType("application/json")
                .content(body))

        then: "the response is 200 with the username"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.username').value("steve"))

        and: "a session is established (session attribute carries the security context)"
            result.andReturn().request.getSession(false) != null
    }

    def "PLANNER-001-AC-06: rejects login with incorrect password, generic message"() {
        given: "a login body with the wrong password"
            def body = objectMapper.writeValueAsString([username: "steve", password: "wrong"])

        and: "AuthenticationManager rejects it"
            authenticationManager.authenticate(_) >> { throw new BadCredentialsException("Bad credentials") }

        when: "POST /api/v1/auth/login is requested"
            def result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType("application/json")
                .content(body))

        then: "the response is 401"
            result.andExpect(status().isUnauthorized())

        and: "the message does not reveal which field was wrong"
            result.andExpect(jsonPath('$.message').value(Matchers.not(
                    Matchers.containsString("username"))))
            result.andExpect(jsonPath('$.message').value(Matchers.not(
                    Matchers.containsString("password"))))
    }

    def "PLANNER-001-AC-07: missing username or password returns 400 without calling AuthenticationManager"() {
        given: "a login body missing required fields"
            def body = objectMapper.writeValueAsString(requestBody)

        when: "POST /api/v1/auth/login is requested"
            def result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType("application/json")
                .content(body))

        then: "the response is 400"
            result.andExpect(status().isBadRequest())

        and: "AuthenticationManager is never called"
            0 * authenticationManager.authenticate(_)

        where:
            requestBody << [
                [:],
                [username: "steve"],
                [password: "s3cret"],
                [username: "", password: ""]
            ]
    }

    def "PLANNER-001-AC-08: logout invalidates the current session and returns 200"() {
        given: "an active session"
            def session = new MockHttpSession()

        when: "POST /api/v1/auth/logout is requested"
            def result = mockMvc.perform(post("/api/v1/auth/logout").session(session))

        then: "the response is 200"
            result.andExpect(status().isOk())

        and: "the session is invalidated"
            session.isInvalid()
    }

    def "PLANNER-001-AC-09: logout with no active session is still 200 (idempotent)"() {
        when: "POST /api/v1/auth/logout is requested with no session"
            def result = mockMvc.perform(post("/api/v1/auth/logout"))

        then: "the response is 200, not an error"
            result.andExpect(status().isOk())
    }

    def "PLANNER-001-AC-10: /auth/me returns 200 with the username when authenticated"() {
        when: "GET /api/v1/auth/me is requested with an authenticated principal"
            def result = mockMvc.perform(get("/api/v1/auth/me")
                .with(SecurityMockMvcRequestPostProcessors.user("steve")))

        then: "the response is 200 with the username"
            result.andExpect(status().isOk())
            result.andExpect(jsonPath('$.username').value("steve"))
    }

    def "PLANNER-001-AC-11 and AC-13: /auth/me without a session returns 401, not a redirect"() {
        when: "GET /api/v1/auth/me is requested with no session"
            def result = mockMvc.perform(get("/api/v1/auth/me"))

        then: "the response is 401"
            result.andExpect(status().isUnauthorized())

        and: "there is no redirect Location header"
            result.andReturn().response.getHeader("Location") == null
    }

    def "PLANNER-001-AC-12: /api/v1/auth/login is reachable without a session, unlike other /api/v1/** endpoints"() {
        given: "a valid login body and an AuthenticationManager that authenticates it"
            def body = objectMapper.writeValueAsString([username: "steve", password: "correct-horse"])
            authenticationManager.authenticate(_) >> new UsernamePasswordAuthenticationToken(
                "steve", null, [new SimpleGrantedAuthority("ROLE_USER")])

        when: "POST /api/v1/auth/login is requested with no prior session"
            def result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType("application/json")
                .content(body))

        then: "it is not rejected for lack of authentication"
            result.andExpect(status().isOk())
    }

    def "PLANNER-001-AC-16: error responses share one JSON shape and never leak a stack trace"() {
        given: "an empty login body"
            def body = objectMapper.writeValueAsString([:])

        when: "POST /api/v1/auth/login is requested"
            def result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType("application/json")
                .content(body))

        then: "the body has a message field"
            result.andExpect(jsonPath('$.message').exists())

        and: "no stack trace or raw exception fields leak"
            result.andExpect(jsonPath('$.trace').doesNotExist())
            result.andExpect(jsonPath('$.exception').doesNotExist())
    }
}
