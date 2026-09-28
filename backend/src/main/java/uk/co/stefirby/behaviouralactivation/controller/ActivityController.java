package uk.co.stefirby.behaviouralactivation.controller;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uk.co.stefirby.behaviouralactivation.dto.ActivityListResponse;
import uk.co.stefirby.behaviouralactivation.dto.ActivityRequest;
import uk.co.stefirby.behaviouralactivation.dto.ActivityResponse;
import uk.co.stefirby.behaviouralactivation.model.Activity;
import uk.co.stefirby.behaviouralactivation.service.ActivityService;

/**
 * Thin delegate to {@link ActivityService} — owner-scoping enforced there, not here. Auth itself is
 * inherited unmodified from {@code SecurityConfig}'s existing
 * {@code .requestMatchers("/api/v1/**").authenticated()} rule (PLANNER-002-AC-19).
 */
@RestController
@RequestMapping("/api/v1/activities")
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    @PostMapping
    public ResponseEntity<ActivityResponse> create(@Valid @RequestBody ActivityRequest request,
            Authentication authentication) {
        Activity created = activityService.create(authentication.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(created));
    }

    @GetMapping
    public ResponseEntity<ActivityListResponse> list(Authentication authentication) {
        List<ActivityResponse> data = activityService.listForOwner(authentication.getName()).stream()
            .map(ActivityController::toResponse)
            .toList();
        return ResponseEntity.ok(new ActivityListResponse(data, data.size()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ActivityResponse> update(@PathVariable UUID id, @Valid @RequestBody ActivityRequest request,
            Authentication authentication) {
        return activityService.update(authentication.getName(), id, request)
            .map(activity -> ResponseEntity.ok(toResponse(activity)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication authentication) {
        boolean deleted = activityService.delete(authentication.getName(), id);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    private static ActivityResponse toResponse(Activity activity) {
        return new ActivityResponse(activity.getId(), activity.getName(), activity.getCategory(),
            activity.getDescription(), activity.getCreatedAt());
    }
}
