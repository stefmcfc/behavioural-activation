package uk.co.stefirby.behaviouralactivation.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Standalone CLI (no Spring context, no database access) that prints a BCrypt hash for a given
 * plaintext password, for manual password recovery of a locked-out user — see RUNBOOK.md's
 * "Recovering a locked-out user" section. Run via {@code gradlew.bat hashPassword
 * -Ppassword="<new-password>"}; the printed hash is pasted into a manual SQL {@code UPDATE}. Never
 * wired into the running application itself.
 */
public final class PasswordHashCli {

    private PasswordHashCli() {
    }

    public static void main(String[] args) {
        if (args.length != 1 || args[0].isBlank()) {
            System.err.println("Usage: gradlew.bat hashPassword -Ppassword=\"<new-password>\"");
            System.exit(1);
        }
        System.out.println(new BCryptPasswordEncoder().encode(args[0]));
    }
}
