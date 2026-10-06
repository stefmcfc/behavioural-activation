package uk.co.stefirby.behaviouralactivation.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uk.co.stefirby.behaviouralactivation.dto.AuthResponse;
import uk.co.stefirby.behaviouralactivation.dto.ChangePasswordRequest;
import uk.co.stefirby.behaviouralactivation.dto.LoginRequest;
import uk.co.stefirby.behaviouralactivation.model.User;
import uk.co.stefirby.behaviouralactivation.repository.UserRepository;

/**
 * Custom JSON login/logout/me endpoints — deliberately not Spring Security's default redirect-based
 * {@code formLogin}, which doesn't fit a JSON SPA. See PLANNER-001-AC-05 through AC-11.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();

    public AuthController(AuthenticationManager authenticationManager, UserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        Authentication authenticationRequest =
            UsernamePasswordAuthenticationToken.unauthenticated(request.username(), request.password());
        Authentication authenticationResult = authenticationManager.authenticate(authenticationRequest);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authenticationResult);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, httpRequest, httpResponse);

        return ResponseEntity.ok(new AuthResponse(authenticationResult.getName()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        invalidateSession(httpRequest);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(Authentication authentication) {
        return ResponseEntity.ok(new AuthResponse(authentication.getName()));
    }

    // planner_spec_024_change_password.md (PLANNER-024-AC-01 through AC-04) -- no AuthService layer
    // exists for this controller yet (see login()/logout() above), so this follows the same direct
    // style: current-password verification reuses AuthenticationManager.authenticate(...) exactly as
    // login() does, just against the already-authenticated principal's own username rather than one
    // from the request body. A wrong current password throws BadCredentialsException, already mapped
    // to 401 by GlobalExceptionHandler's existing AuthenticationException handler -- no new exception
    // type needed.
    @PatchMapping("/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request,
            Authentication authentication, HttpServletRequest httpRequest) {
        authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(authentication.getName(), request.currentPassword()));

        User user = userRepository.findByUsername(authentication.getName())
            .orElseThrow(() -> new UsernameNotFoundException("Invalid username or password"));
        user.changePassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        // PLANNER-024-AC-04 -- deliberate: a changed password must not leave the session that made
        // the change still valid afterward. Identical to logout()'s own invalidation logic.
        invalidateSession(httpRequest);

        return ResponseEntity.noContent().build();
    }

    private void invalidateSession(HttpServletRequest httpRequest) {
        HttpSession session = httpRequest.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }
}
