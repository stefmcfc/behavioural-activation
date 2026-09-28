package uk.co.stefirby.behaviouralactivation.security

import org.springframework.security.crypto.password.PasswordEncoder
import spock.lang.Specification
import uk.co.stefirby.behaviouralactivation.model.User
import uk.co.stefirby.behaviouralactivation.repository.UserRepository

class UserBootstrapRunnerSpec extends Specification {

    UserRepository userRepository = Mock()
    PasswordEncoder passwordEncoder = Mock()

    def "PLANNER-001-AC-01 and AC-02: seeds exactly one user from env vars, password stored hashed"() {
        given: "no User row exists and bootstrap env vars are set"
            userRepository.count() >> 0
            passwordEncoder.encode("s3cret") >> "bcrypt-hash-of-s3cret"
            def runner = new UserBootstrapRunner(userRepository, passwordEncoder, "steve", "s3cret")

        when: "the application starts"
            runner.run()

        then: "exactly one User row is saved"
            1 * userRepository.save({ User user ->
                user.username == "steve" && user.passwordHash == "bcrypt-hash-of-s3cret"
            }) >> { User user -> user }

        and: "the password is stored hashed, never in plaintext"
            0 * userRepository.save({ User user -> user.passwordHash == "s3cret" })
    }

    def "PLANNER-001-AC-03: does not create another user if one already exists"() {
        given: "a User row already exists"
            userRepository.count() >> 1
            def runner = new UserBootstrapRunner(userRepository, passwordEncoder, "steve", "s3cret")

        when: "the application starts"
            runner.run()

        then: "no user is saved"
            0 * userRepository.save(_)
    }

    def "PLANNER-001-AC-04: fails startup when no user exists and bootstrap env vars are unset"() {
        given: "no User row exists and bootstrap env vars are missing"
            userRepository.count() >> 0
            def runner = new UserBootstrapRunner(userRepository, passwordEncoder, username, password)

        when: "the application starts"
            runner.run()

        then: "startup fails with a clear error, and no user is saved"
            def ex = thrown(IllegalStateException)
            ex.message.contains("APP_BOOTSTRAP_USERNAME")
            0 * userRepository.save(_)

        where:
            username | password
            ""       | "s3cret"
            "steve"  | ""
            ""       | ""
            null     | null
    }
}
