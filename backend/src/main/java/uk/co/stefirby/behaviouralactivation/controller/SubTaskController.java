package uk.co.stefirby.behaviouralactivation.controller;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uk.co.stefirby.behaviouralactivation.dto.SubTaskListResponse;
import uk.co.stefirby.behaviouralactivation.dto.SubTaskRequest;
import uk.co.stefirby.behaviouralactivation.dto.SubTaskResponse;
import uk.co.stefirby.behaviouralactivation.model.SubTask;
import uk.co.stefirby.behaviouralactivation.service.SubTaskService;

/**
 * Thin delegate to {@link SubTaskService} -- owner-scoping (including parent-activity ownership)
 * enforced there, not here. Auth itself is inherited unmodified from {@code SecurityConfig}'s
 * existing {@code .requestMatchers("/api/v1/**").authenticated()} rule (PLANNER-003-AC-21).
 */
@RestController
@RequestMapping("/api/v1/activities/{activityId}/sub-tasks")
public class SubTaskController {

    private final SubTaskService subTaskService;

    public SubTaskController(SubTaskService subTaskService) {
        this.subTaskService = subTaskService;
    }

    @PostMapping
    public ResponseEntity<SubTaskResponse> create(@PathVariable UUID activityId,
            @Valid @RequestBody SubTaskRequest request, Authentication authentication) {
        return subTaskService.create(authentication.getName(), activityId, request)
            .map(subTask -> ResponseEntity.status(HttpStatus.CREATED).body(toResponse(subTask)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<SubTaskListResponse> list(@PathVariable UUID activityId, Authentication authentication) {
        return subTaskService.listForActivity(authentication.getName(), activityId)
            .map(SubTaskController::toListResponse)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}")
    public ResponseEntity<SubTaskResponse> update(@PathVariable UUID activityId, @PathVariable UUID id,
            @Valid @RequestBody SubTaskRequest request, Authentication authentication) {
        return subTaskService.update(authentication.getName(), activityId, id, request)
            .map(subTask -> ResponseEntity.ok(toResponse(subTask)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID activityId, @PathVariable UUID id,
            Authentication authentication) {
        boolean deleted = subTaskService.delete(authentication.getName(), activityId, id);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    private static ResponseEntity<SubTaskListResponse> toListResponse(List<SubTask> subTasks) {
        List<SubTaskResponse> data = subTasks.stream().map(SubTaskController::toResponse).toList();
        return ResponseEntity.ok(new SubTaskListResponse(data, data.size()));
    }

    private static SubTaskResponse toResponse(SubTask subTask) {
        return new SubTaskResponse(subTask.getId(), subTask.getActivity().getId(), subTask.getName(),
            subTask.getCategory(), subTask.getCreatedAt());
    }
}
