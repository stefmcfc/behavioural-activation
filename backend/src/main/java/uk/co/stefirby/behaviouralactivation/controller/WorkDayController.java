package uk.co.stefirby.behaviouralactivation.controller;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uk.co.stefirby.behaviouralactivation.dto.WorkDayListResponse;
import uk.co.stefirby.behaviouralactivation.dto.WorkDayOverrideRequest;
import uk.co.stefirby.behaviouralactivation.dto.WorkDayPatternRequest;
import uk.co.stefirby.behaviouralactivation.dto.WorkDayPatternResponse;
import uk.co.stefirby.behaviouralactivation.dto.WorkDayResponse;
import uk.co.stefirby.behaviouralactivation.service.WorkDayService;

/**
 * Thin delegate to {@link WorkDayService} -- owner-scoping and validation enforced there, not here.
 * Auth itself is inherited unmodified from {@code SecurityConfig}'s existing
 * {@code .requestMatchers("/api/v1/**").authenticated()} rule
 * (planner_spec_021_work_day_marking.md).
 *
 * <p>{@code weekStart} is deliberately taken as an optional {@link LocalDate} (not required), with
 * the missing/non-Monday case delegated to {@code WorkDayService}'s validation -- mirrors
 * {@code PlanController#getWeek}'s identical treatment (PLANNER-021-AC-05).
 */
@RestController
@RequestMapping("/api/v1/work-days")
public class WorkDayController {

    private final WorkDayService workDayService;

    public WorkDayController(WorkDayService workDayService) {
        this.workDayService = workDayService;
    }

    @GetMapping("/pattern")
    public ResponseEntity<WorkDayPatternResponse> getPattern(Authentication authentication) {
        return ResponseEntity.ok(new WorkDayPatternResponse(workDayService.getPattern(authentication.getName())));
    }

    @PutMapping("/pattern")
    public ResponseEntity<WorkDayPatternResponse> setPattern(@Valid @RequestBody WorkDayPatternRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(
            new WorkDayPatternResponse(workDayService.setPattern(authentication.getName(), request.days())));
    }

    @GetMapping
    public ResponseEntity<WorkDayListResponse> getWeek(@RequestParam(required = false) LocalDate weekStart,
            Authentication authentication) {
        List<WorkDayResponse> data = workDayService.getWeek(authentication.getName(), weekStart);
        return ResponseEntity.ok(new WorkDayListResponse(data, data.size()));
    }

    @PutMapping("/{date}")
    public ResponseEntity<WorkDayResponse> setOverride(@PathVariable LocalDate date,
            @Valid @RequestBody WorkDayOverrideRequest request, Authentication authentication) {
        return ResponseEntity.ok(workDayService.setOverride(authentication.getName(), date, request.workDay()));
    }
}
