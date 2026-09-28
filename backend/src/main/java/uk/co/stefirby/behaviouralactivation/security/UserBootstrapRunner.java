package uk.co.stefirby.behaviouralactivation.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import uk.co.stefirby.behaviouralactivation.model.User;
import uk.co.stefirby.behaviouralactivation.repository.UserRepository;

/**
 * Seeds exactly one {@link User} row from {@code APP_BOOTSTRAP_USERNAME}/{@code APP_BOOTSTRAP_PASSWORD}
 * on first startup — there is no self-registration flow for this single-account app. Idempotent
 * across restarts: if a {@code User} row already exists, it does nothing. If none exists and the
 * bootstrap env vars aren't set, startup fails loudly rather than starting an app nobody can log
 * into.
 */
@Component
public class UserBootstrapRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String bootstrapUsername;
    private final String bootstrapPassword;

    public UserBootstrapRunner(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.bootstrap.username:}") String bootstrapUsername,
            @Value("${app.bootstrap.password:}") String bootstrapPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.bootstrapUsername = bootstrapUsername;
        this.bootstrapPassword = bootstrapPassword;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            return;
        }

        if (!StringUtils.hasText(bootstrapUsername) || !StringUtils.hasText(bootstrapPassword)) {
            throw new IllegalStateException(
                "No user account exists and APP_BOOTSTRAP_USERNAME/APP_BOOTSTRAP_PASSWORD are not "
                    + "set — set both environment variables and restart so a login-capable user can "
                    + "be seeded.");
        }

        userRepository.save(new User(bootstrapUsername, passwordEncoder.encode(bootstrapPassword)));
    }
}
