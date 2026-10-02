/**
 * Null-marked via JSpecify: every type, parameter, and return value in this package is non-null by
 * default unless explicitly annotated {@code @Nullable}. Matches the {@code @NullMarked} contract
 * Spring Security/Boot's own interfaces implemented here already declare
 * ({@code AuthenticationEntryPoint}, {@code UserDetailsService}, {@code CommandLineRunner}) --
 * confirmed by inspecting their bytecode directly: none of the overridden methods' parameters carry
 * a {@code @Nullable} annotation, so this package's blanket non-null default is a faithful match, not
 * an assumption.
 */
@NullMarked
package uk.co.stefirby.behaviouralactivation.security;

import org.jspecify.annotations.NullMarked;
