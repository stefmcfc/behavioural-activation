package uk.co.stefirby.behaviouralactivation.security;

import tools.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Guards every {@code /api/v1/**} endpoint behind a session, except the two auth endpoints that
 * must be reachable without one: {@code POST /api/v1/auth/login} (nothing to authenticate against
 * yet) and {@code POST /api/v1/auth/logout} (idempotent — invalidating a session that may not exist
 * is not an authorization failure, see PLANNER-001-AC-09).
 *
 * <p>CSRF is deliberately disabled for V1 — see the spec's Non-functional notes; {@code SameSite=Lax}
 * cookies plus the CORS allow-list are the practical defense for this single-user, not-yet-public
 * app.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, CorsConfigurationSource corsConfigurationSource,
            ObjectMapper objectMapper) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout").permitAll()
                .requestMatchers("/api/v1/**").authenticated()
                .anyRequest().permitAll())
            .exceptionHandling(exceptionHandling -> exceptionHandling
                .authenticationEntryPoint(new JsonAuthenticationEntryPoint(objectMapper)));

        return http.build();
    }
}
