package uk.co.stefirby.behaviouralactivation.exception

import org.springframework.http.HttpInputMessage
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.validation.BeanPropertyBindingResult
import org.springframework.core.MethodParameter
import org.springframework.web.servlet.resource.NoResourceFoundException
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
            bindingResult.addError(new FieldError("loginRequest", "username", "username is required"))
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

    def "PLANNER-002 design decision: renders a malformed JSON body (e.g. an invalid enum literal) as 400, not the 500 catch-all"() {
        given: "a message-not-readable exception, as Jackson throws for an invalid enum literal like category: FUN"
            def ex = new HttpMessageNotReadableException("JSON parse error", Stub(HttpInputMessage))

        when: "the exception is handled"
            def response = handler.handleMalformedRequest(ex)

        then: "the status is 400, not 500"
            response.statusCode == HttpStatus.BAD_REQUEST

        and: "the body has a message and no stack trace field"
            response.body.message() != null
    }

    def "TOOLING-001-AC-01: renders a NoResourceFoundException as 404, not the 500 catch-all"() {
        given: "a NoResourceFoundException, as Spring throws for an unmapped path like '/' or '/favicon.ico'"
            def ex = new NoResourceFoundException(HttpMethod.GET, "/", "/")

        when: "the exception is handled"
            def response = handler.handleNoResourceFoundException(ex)

        then: "the status is 404, not 500"
            response.statusCode == HttpStatus.NOT_FOUND

        and: "the body uses the standard ApiError shape"
            response.body.message() == "Not found"
            response.body.details() == null
    }

    def "TOOLING-001-AC-02: an unrelated exception still renders as the 500 catch-all"() {
        when: "a generic, unhandled exception type is handled"
            def response = handler.handleUnexpectedException(new RuntimeException("boom"))

        then: "the status is still 500"
            response.statusCode == HttpStatus.INTERNAL_SERVER_ERROR

        and: "the body is still the generic message"
            response.body.message() == "An unexpected error occurred"
    }
}
