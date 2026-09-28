package uk.co.stefirby.behaviouralactivation.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uk.co.stefirby.behaviouralactivation.model.Activity;
import uk.co.stefirby.behaviouralactivation.model.User;

public interface ActivityRepository extends JpaRepository<Activity, UUID> {

    List<Activity> findByOwnerOrderByNameAsc(User owner);

    Optional<Activity> findByIdAndOwner(UUID id, User owner);
}
