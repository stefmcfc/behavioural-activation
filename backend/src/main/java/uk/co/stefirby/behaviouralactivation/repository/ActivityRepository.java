package uk.co.stefirby.behaviouralactivation.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uk.co.stefirby.behaviouralactivation.model.Activity;
import uk.co.stefirby.behaviouralactivation.model.User;

public interface ActivityRepository extends JpaRepository<Activity, UUID> {

    // ORDER BY favourite DESC, name ASC -- sorts favourited activities (true) before non-favourited
    // (false), alphabetically within each group (PLANNER-015-AC-11).
    List<Activity> findByOwnerOrderByFavouriteDescNameAsc(User owner);

    // Default (non-archived) list case for GET /api/v1/activities (Requirement 3), also ordered
    // favourites-first (PLANNER-015-AC-10) -- findByOwnerOrderByFavouriteDescNameAsc above is kept
    // unmodified for the includeArchived=true case.
    List<Activity> findByOwnerAndArchivedFalseOrderByFavouriteDescNameAsc(User owner);

    Optional<Activity> findByIdAndOwner(UUID id, User owner);
}
