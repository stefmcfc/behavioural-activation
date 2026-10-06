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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import uk.co.stefirby.behaviouralactivation.dto.SubTaskListResponse;
import uk.co.stefirby.behaviouralactivation.dto.SubTaskReorderRequest;
import uk.co.stefirby.behaviouralactivation.dto.SubTaskRequest;
import uk.co.stefirby.behaviouralactivation.dto.SubTaskResponse;
import uk.co.stefirby.behaviouralactivation.model.SubTask;
import uk.co.stefirby.behaviouralactivation.service.SubTaskService;

/**
 * Thin delegate to {@link SubTaskService} -- owner-scoping (including parent-activity ownership)
 * enforced there, not here. Auth itself is inherited unmodified from {@code SecurityConfig}'s
 * existing {@code .requestMatchers("/api/v1/**").authenticated()} rule (PLANNER-003-AC-21).
 *
 * <p>Hosts both the nested, single-activity sub-task endpoints (unchanged since
 * planner_spec_003_sub_tasks.md) and the bulk {@code GET /api/v1/sub-tasks} endpoint added by
 * planner_spec_018_bulk_sub_task_fetch.md. The class-level {@code @RequestMapping} prefix the nested
 * endpoints used to share has been moved onto each of their methods individually -- Spring doesn't
 * support a method-level mapping "escaping" a class-level prefix, and the bulk endpoint has no single
 * {@code activityId} to nest under (see that spec's Overview for the "option (a) vs (b)" choice).
 */
@RestController
public class SubTaskController {

    private static final String NESTED_BASE_PATH = "/api/v1/activities/{activityId}/sub-tasks";

    private final SubTaskService subTaskService;

    public SubTaskController(SubTaskService subTaskService) {
        this.subTaskService = subTaskService;
    }

    @PostMapping(NESTED_BASE_PATH)
    public ResponseEntity<SubTaskResponse> create(@PathVariable UUID activityId,
            @Valid @RequestBody SubTaskRequest request, Authentication authentication) {
        return subTaskService.create(authentication.getName(), activityId, request)
            .map(subTask -> ResponseEntity.status(HttpStatus.CREATED).body(toResponse(subTask)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping(NESTED_BASE_PATH)
    public ResponseEntity<SubTaskListResponse> list(@PathVariable UUID activityId, Authentication authentication) {
        return subTaskService.listForActivity(authentication.getName(), activityId)
            .map(SubTaskController::toListResponse)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping(NESTED_BASE_PATH + "/{id}")
    public ResponseEntity<SubTaskResponse> update(@PathVariable UUID activityId, @PathVariable UUID id,
            @Valid @RequestBody SubTaskRequest request, Authentication authentication) {
        return subTaskService.update(authentication.getName(), activityId, id, request)
            .map(subTask -> ResponseEntity.ok(toResponse(subTask)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping(NESTED_BASE_PATH + "/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID activityId, @PathVariable UUID id,
            Authentication authentication) {
        boolean deleted = subTaskService.delete(authentication.getName(), activityId, id);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    // planner_spec_023_subtask_reordering.md (PLANNER-023-AC-06/AC-12) -- full-list-replacement
    // reorder of the activity's sub-task checklist.
    @PutMapping(NESTED_BASE_PATH + "/order")
    public ResponseEntity<SubTaskListResponse> reorder(@PathVariable UUID activityId,
            @Valid @RequestBody SubTaskReorderRequest request, Authentication authentication) {
        return subTaskService.reorder(authentication.getName(), activityId, request)
            .map(SubTaskController::toListResponse)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // planner_spec_018_bulk_sub_task_fetch.md (PLANNER-018-AC-01/AC-02/AC-03) -- every sub-task
    // owned by the authenticated user, across all of their activities, in one call.
    @GetMapping("/api/v1/sub-tasks")
    public ResponseEntity<SubTaskListResponse> listAll(Authentication authentication) {
        return toListResponse(subTaskService.listForOwner(authentication.getName()));
    }

    private static ResponseEntity<SubTaskListResponse> toListResponse(List<SubTask> subTasks) {
        List<SubTaskResponse> data = subTasks.stream().map(SubTaskController::toResponse).toList();
        return ResponseEntity.ok(new SubTaskListResponse(data, data.size()));
    }

    private static SubTaskResponse toResponse(SubTask subTask) {
        return new SubTaskResponse(subTask.getId(), subTask.getActivity().getId(), subTask.getName(),
            subTask.getCategory(), subTask.getCreatedAt(), subTask.getPosition());
    }
}
