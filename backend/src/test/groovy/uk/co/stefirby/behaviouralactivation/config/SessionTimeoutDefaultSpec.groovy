package uk.co.stefirby.behaviouralactivation.config

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import spock.lang.Specification

@SpringBootTest
class SessionTimeoutDefaultSpec extends Specification {

    @Autowired
    Environment environment

    def "PLANNER-016-AC-01: session timeout defaults to 30 minutes when SESSION_TIMEOUT is unset"() {
        given: "the application context loaded with no SESSION_TIMEOUT env var"
            // SESSION_TIMEOUT not set in the test environment

        expect: "the resolved session timeout property is 30 minutes"
            environment.getProperty("server.servlet.session.timeout") == "30m"
    }
}
