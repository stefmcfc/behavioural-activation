package uk.co.stefirby.behaviouralactivation.controller;

import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uk.co.stefirby.behaviouralactivation.dto.BucketReorderRequest;
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceListResponse;
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceMoveRequest;
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceRequest;
import uk.co.stefirby.behaviouralactivation.dto.PlannedOccurrenceResponse;
import uk.co.stefirby.behaviouralactivation.model.CompletionRecord;
import uk.co.stefirby.behaviouralactivation.model.PlannedOccurrence;
import uk.co.stefirby.behaviouralactivation.service.PlanService;

/**
 * Thin delegate to {@link PlanService} -- owner-scoping and validation enforced there, not here.
 * Auth itself is inherited unmodified from {@code SecurityConfig}'s existing
 * {@code .requestMatchers("/api/v1/**").authenticated()} rule (PLANNER-004-AC-37).
 *
 * <p>{@code weekStart} is deliberately taken as an optional {@link LocalDate} (not required),
 * with the missing/non-Monday case delegated to {@code PlanService}'s validation -- this keeps
 * "missing" and "non-Monday" on one {@code 400} code path via {@code InvalidPlanRequestException},
 * rather than relying on Spring's default (and differently-shaped) handling of a missing required
 * request parameter (PLANNER-004-AC-03/AC-04).
 *
 * <p>{@code completed}/{@code completedAt} are resolved per-response from {@code CompletionRecord}
 * lookups (bulk for {@link #getWeek}, single for the other endpoints) rather than being carried on
 * {@link PlannedOccurrence} itself (PLANNER-004-AC-27).
 */
@RestController
@RequestMapping("/api/v1/plan")
public class PlanController {

    private final PlanService planService;

    public PlanController(PlanService planService) {
        this.planService = planService;
    }

    // migrateStaleBucketItems(...) is called first, as a genuinely separate call into PlanService's
    // Spring-managed proxy -- NOT from inside getWeek() itself -- so it gets its own real read-write
    // transaction, committed before getWeek()'s unchanged, @Transactional(readOnly = true) query runs
    // (planner_spec_011_bucket_carry_forward_automation.md, Requirement 4's implementation note,
    // PLANNER-011-AC-08/AC-09). Called unconditionally, even for a missing/invalid weekStart, since
    // migration depends only on the owner, not the requested week.
    @GetMapping
    public ResponseEntity<PlannedOccurrenceListResponse> getWeek(
            @RequestParam(required = false) LocalDate weekStart, Authentication authentication) {
        Set<UUID> migratedIds = planService.migrateStaleBucketItems(authentication.getName());
        List<PlannedOccurrence> occurrences = planService.getWeek(authentication.getName(), weekStart);
        List<UUID> ids = occurrences.stream().map(PlannedOccurrence::getId).toList();
        Map<UUID, CompletionRecord> completions = planService.findCompletions(authentication.getName(), ids);
        List<PlannedOccurrenceResponse> data = occurrences.stream()
            .map(occurrence -> toResponse(occurrence, completions.get(occurrence.getId()),
                migratedIds.contains(occurrence.getId())))
            .toList();
        return ResponseEntity.ok(new PlannedOccurrenceListResponse(data, data.size()));
    }

    @PostMapping("/occurrences")
    public ResponseEntity<PlannedOccurrenceResponse> create(@Valid @RequestBody PlannedOccurrenceRequest request,
            Authentication authentication) {
        return planService.create(authentication.getName(), request)
            .map(occurrence -> ResponseEntity.status(HttpStatus.CREATED).body(toResponse(occurrence, null, false)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/occurrences/{id}")
    public ResponseEntity<PlannedOccurrenceResponse> move(@PathVariable UUID id,
            @RequestBody PlannedOccurrenceMoveRequest request, Authentication authentication) {
        return planService.move(authentication.getName(), id, request)
            .map(occurrence -> {
                CompletionRecord completion = planService.findCompletion(authentication.getName(), id).orElse(null);
                return ResponseEntity.ok(toResponse(occurrence, completion, false));
            })
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/occurrences/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication authentication) {
        boolean deleted = planService.delete(authentication.getName(), id);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PostMapping("/occurrences/{id}/completion")
    public ResponseEntity<PlannedOccurrenceResponse> complete(@PathVariable UUID id, Authentication authentication) {
        return planService.complete(authentication.getName(), id)
            .map(completion -> ResponseEntity.ok(toResponse(completion.getPlannedOccurrence(), completion, false)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/occurrences/{id}/completion")
    public ResponseEntity<Void> uncomplete(@PathVariable UUID id, Authentication authentication) {
        boolean removed = planService.uncomplete(authentication.getName(), id);
        return removed ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PostMapping("/occurrences/{id}/carry-forward")
    public ResponseEntity<PlannedOccurrenceResponse> carryForward(@PathVariable UUID id,
            Authentication authentication) {
        return planService.carryForward(authentication.getName(), id)
            .map(occurrence -> ResponseEntity.ok(toResponse(occurrence, null, false)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/bucket/order")
    public ResponseEntity<PlannedOccurrenceListResponse> reorderBucket(
            @Valid @RequestBody BucketReorderRequest request, Authentication authentication) {
        return planService.reorderBucket(authentication.getName(), request)
            .map(occurrences -> {
                List<UUID> ids = occurrences.stream().map(PlannedOccurrence::getId).toList();
                Map<UUID, CompletionRecord> completions = planService.findCompletions(authentication.getName(), ids);
                List<PlannedOccurrenceResponse> data = occurrences.stream()
                    .map(occurrence -> toResponse(occurrence, completions.get(occurrence.getId()), false))
                    .toList();
                return ResponseEntity.ok(new PlannedOccurrenceListResponse(data, data.size()));
            })
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // recentlyCarriedForward is set true only by getWeek()'s own call site above, for exactly the
    // occurrences that same request's migrateStaleBucketItems(...) call just relocated -- every other
    // call site in this class passes false (planner_spec_011_bucket_carry_forward_automation.md,
    // PLANNER-011-AC-14/AC-15).
    private static PlannedOccurrenceResponse toResponse(PlannedOccurrence occurrence, CompletionRecord completion,
            boolean recentlyCarriedForward) {
        boolean isActivity = occurrence.getActivity() != null;
        UUID activityId = isActivity ? occurrence.getActivity().getId() : null;
        UUID subTaskId = isActivity ? null : occurrence.getSubTask().getId();
        String name = isActivity ? occurrence.getActivity().getName() : occurrence.getSubTask().getName();
        String parentActivityName = isActivity ? null : occurrence.getSubTask().getActivity().getName();
        boolean repeatable = isActivity
            ? occurrence.getActivity().isRepeatable()
            : occurrence.getSubTask().getActivity().isRepeatable();
        boolean completed = completion != null;
        Instant completedAt = completion != null ? completion.getCompletedAt() : null;
        return new PlannedOccurrenceResponse(occurrence.getId(), activityId, subTaskId, name, parentActivityName,
            occurrence.getCategory(), occurrence.getWeekStart(), occurrence.getDayOfWeek(),
            occurrence.getSlot(), completed, completedAt, occurrence.getCreatedAt(), repeatable,
            occurrence.getBucketPosition(), recentlyCarriedForward);
    }
}
