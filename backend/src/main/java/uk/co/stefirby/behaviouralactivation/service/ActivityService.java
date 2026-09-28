package uk.co.stefirby.behaviouralactivation.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uk.co.stefirby.behaviouralactivation.dto.ActivityRequest;
import uk.co.stefirby.behaviouralactivation.model.Activity;
import uk.co.stefirby.behaviouralactivation.model.User;
import uk.co.stefirby.behaviouralactivation.repository.ActivityRepository;
import uk.co.stefirby.behaviouralactivation.repository.UserRepository;

/**
 * Owner-scoping for the activity bank lives here, not in {@code ActivityController} — every method
 * resolves the owning {@link User} itself from the authenticated username (never trusting a
 * client-supplied field) and every read/write against {@link ActivityRepository} is scoped to that
 * owner. {@link #update(String, UUID, ActivityRequest)} and {@link #delete(String, UUID)} return an
 * empty/{@code false} result identically whether the id doesn't exist at all or belongs to a
 * different owner — see PLANNER-002-AC-18, never distinguishable from the response.
 */
@Service
public class ActivityService {

    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;

    public ActivityService(ActivityRepository activityRepository, UserRepository userRepository) {
        this.activityRepository = activityRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Activity create(String ownerUsername, ActivityRequest request) {
        User owner = resolveOwner(ownerUsername);
        Activity activity = new Activity(request.name(), request.category(), request.description(), owner);
        return activityRepository.save(activity);
    }

    @Transactional(readOnly = true)
    public List<Activity> listForOwner(String ownerUsername) {
        User owner = resolveOwner(ownerUsername);
        return activityRepository.findByOwnerOrderByNameAsc(owner);
    }

    @Transactional
    public Optional<Activity> update(String ownerUsername, UUID id, ActivityRequest request) {
        User owner = resolveOwner(ownerUsername);
        return activityRepository.findByIdAndOwner(id, owner)
            .map(activity -> {
                activity.update(request.name(), request.category(), request.description());
                return activity;
            });
    }

    @Transactional
    public boolean delete(String ownerUsername, UUID id) {
        User owner = resolveOwner(ownerUsername);
        return activityRepository.findByIdAndOwner(id, owner)
            .map(activity -> {
                activityRepository.delete(activity);
                return true;
            })
            .orElse(false);
    }

    private User resolveOwner(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + username));
    }
}
