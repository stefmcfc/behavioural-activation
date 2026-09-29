package uk.co.stefirby.behaviouralactivation.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uk.co.stefirby.behaviouralactivation.model.Activity;
import uk.co.stefirby.behaviouralactivation.model.User;

public interface ActivityRepository extends JpaRepository<Activity, UUID> {

    List<Activity> findByOwnerOrderByNameAsc(User owner);

    // Default (non-archived) list case for GET /api/v1/activities (Requirement 3) --
    // findByOwnerOrderByNameAsc above is kept unmodified for the includeArchived=true case.
    List<Activity> findByOwnerAndArchivedFalseOrderByNameAsc(User owner);

    Optional<Activity> findByIdAndOwner(UUID id, User owner);
}
