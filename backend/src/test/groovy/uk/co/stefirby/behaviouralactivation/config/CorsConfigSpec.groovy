package uk.co.stefirby.behaviouralactivation.config

import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import spock.lang.Specification

class CorsConfigSpec extends Specification {

    def "PLANNER-001-AC-14: allows credentials from exactly the configured allow-list, never a wildcard"() {
        given: "app.cors.allowed-origins configured with two origins"
            def config = new CorsConfig("http://localhost:4321, https://planner.example.com")

        when: "the CORS configuration for /api/** is resolved"
            UrlBasedCorsConfigurationSource source = config.corsConfigurationSource() as UrlBasedCorsConfigurationSource
            def corsConfiguration = source.corsConfigurations["/api/**"]

        then: "exactly the configured origins are allowed, not a wildcard"
            corsConfiguration.allowedOrigins == ["http://localhost:4321", "https://planner.example.com"]

        and: "credentialed requests are allowed"
            corsConfiguration.allowCredentials == true
    }

    def "PLANNER-001-AC-14: allows credentials from a single configured origin"() {
        given: "app.cors.allowed-origins configured with one origin"
            def config = new CorsConfig("http://localhost:4321")

        when: "the CORS configuration for /api/** is resolved"
            UrlBasedCorsConfigurationSource source = config.corsConfigurationSource() as UrlBasedCorsConfigurationSource
            def corsConfiguration = source.corsConfigurations["/api/**"]

        then: "exactly that one origin is allowed"
            corsConfiguration.allowedOrigins == ["http://localhost:4321"]
    }
}
