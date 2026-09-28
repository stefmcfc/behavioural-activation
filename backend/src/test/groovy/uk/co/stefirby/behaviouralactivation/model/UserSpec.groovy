package uk.co.stefirby.behaviouralactivation.model

import spock.lang.Specification

import java.time.Instant

class UserSpec extends Specification {

    def "constructing a User sets username, passwordHash and a createdAt timestamp"() {
        when: "a User is constructed with a username and password hash"
            def before = Instant.now()
            def user = new User("steve", "hashed-password")
            def after = Instant.now()

        then: "the username and passwordHash are set as given"
            user.username == "steve"
            user.passwordHash == "hashed-password"

        and: "createdAt is set to roughly now"
            !user.createdAt.isBefore(before)
            !user.createdAt.isAfter(after)
    }
}
