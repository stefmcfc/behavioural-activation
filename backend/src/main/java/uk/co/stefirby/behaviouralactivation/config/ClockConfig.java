package uk.co.stefirby.behaviouralactivation.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// planner_spec_011_bucket_carry_forward_automation.md -- the first injectable Clock bean in this
// backend. Clock.systemDefaultZone() is a no-behaviour-change stand-in for the implicit JVM-zone
// default the no-arg Instant.now()/LocalDate.now() overloads would otherwise use; services that need
// a testable/controllable "now" take this bean via constructor injection instead of calling those
// no-arg overloads directly (PLANNER-011-AC-01/AC-02).
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
