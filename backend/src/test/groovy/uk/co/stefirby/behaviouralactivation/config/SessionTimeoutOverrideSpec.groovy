package uk.co.stefirby.behaviouralactivation.config

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import spock.lang.Specification

@SpringBootTest
class SessionTimeoutOverrideSpec extends Specification {

    @Autowired
    Environment environment

    @DynamicPropertySource
    static void sessionTimeoutOverride(DynamicPropertyRegistry registry) {
        registry.add("SESSION_TIMEOUT", () -> "10m")
    }

    def "PLANNER-016-AC-02: session timeout honors SESSION_TIMEOUT when set"() {
        given: "SESSION_TIMEOUT=10m set via a dynamic property source"
            // registered above via @DynamicPropertySource

        expect: "the resolved session timeout property is 10 minutes"
            environment.getProperty("server.servlet.session.timeout") == "10m"
    }
}
