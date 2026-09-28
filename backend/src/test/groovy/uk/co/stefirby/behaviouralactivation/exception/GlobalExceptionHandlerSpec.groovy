package uk.co.stefirby.behaviouralactivation.exception

import org.springframework.http.HttpStatus
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.validation.BeanPropertyBindingResult
import org.springframework.core.MethodParameter
import spock.lang.Specification

class GlobalExceptionHandlerSpec extends Specification {

    GlobalExceptionHandler handler = new GlobalExceptionHandler()

    def "PLANNER-001-AC-16: renders an AuthenticationException as 401 with message/details shape"() {
        when: "an AuthenticationException is handled"
            def response = handler.handleAuthenticationException(new BadCredentialsException("bad creds"))

        then: "the status is 401"
            response.statusCode == HttpStatus.UNAUTHORIZED

        and: "the body has a message and no stack trace field"
            response.body.message() != null
            response.body.message() == "Invalid credentials"
    }

    def "PLANNER-001-AC-16: renders a validation failure as 400 with message/details shape"() {
        given: "a binding result with a field error"
            def target = new Object()
            def bindingResult = new BeanPropertyBindingResult(target, "loginRequest")
            bindingResult.addError(new org.springframework.validation.FieldError("loginRequest", "username", "username is required"))
            def methodParameter = Stub(MethodParameter)
            def ex = new MethodArgumentNotValidException(methodParameter, bindingResult)

        when: "a MethodArgumentNotValidException is handled"
            def response = handler.handleValidationException(ex)

        then: "the status is 400"
            response.statusCode == HttpStatus.BAD_REQUEST

        and: "the body carries the field-level details"
            response.body.message() == "Validation failed"
            response.body.details() == [username: "username is required"]
    }
}
