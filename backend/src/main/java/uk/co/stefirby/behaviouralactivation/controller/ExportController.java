package uk.co.stefirby.behaviouralactivation.controller;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uk.co.stefirby.behaviouralactivation.service.ExportService;

/**
 * Thin delegate to {@link ExportService} -- owner-scoping lives there, not here, matching every
 * other controller in this codebase. This is the first non-JSON-returning endpoint in the app
 * (planner_spec_025_data_export.md, PLANNER-025-AC-01): {@code GET /api/v1/export} returns the
 * generated SQL as a downloadable file body rather than a JSON envelope. Auth itself is inherited
 * unmodified from {@code SecurityConfig}'s existing {@code .requestMatchers("/api/v1/**")
 * .authenticated()} rule.
 */
@RestController
@RequestMapping("/api/v1/export")
public class ExportController {

    private static final MediaType SQL_MEDIA_TYPE = MediaType.valueOf("application/sql");

    private final ExportService exportService;
    private final Clock clock;

    public ExportController(ExportService exportService, Clock clock) {
        this.exportService = exportService;
        this.clock = clock;
    }

    @GetMapping
    public ResponseEntity<byte[]> export(Authentication authentication) {
        String sql = exportService.generateExport(authentication.getName());
        byte[] body = sql.getBytes(StandardCharsets.UTF_8);
        String filename = "behavioural-activation-export-" + LocalDate.now(clock) + ".sql";

        return ResponseEntity.ok()
            .contentType(SQL_MEDIA_TYPE)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .body(body);
    }
}
