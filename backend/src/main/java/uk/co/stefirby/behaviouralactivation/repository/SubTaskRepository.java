package uk.co.stefirby.behaviouralactivation.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uk.co.stefirby.behaviouralactivation.model.SubTask;
import uk.co.stefirby.behaviouralactivation.model.User;

public interface SubTaskRepository extends JpaRepository<SubTask, UUID> {

    List<SubTask> findByActivityIdAndOwnerOrderByCreatedAtAsc(UUID activityId, User owner);

    Optional<SubTask> findByIdAndActivityIdAndOwner(UUID id, UUID activityId, User owner);
}
