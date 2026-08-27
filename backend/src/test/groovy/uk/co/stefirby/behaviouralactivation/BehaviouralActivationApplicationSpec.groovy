package uk.co.stefirby.behaviouralactivation

import org.springframework.boot.test.context.SpringBootTest
import spock.lang.Specification

@SpringBootTest
class BehaviouralActivationApplicationSpec extends Specification {

    def "the Spring application context loads"() {
        expect: "context startup does not throw"
            true
    }
}
