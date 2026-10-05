package uk.co.stefirby.behaviouralactivation.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uk.co.stefirby.behaviouralactivation.model.User;
import uk.co.stefirby.behaviouralactivation.model.WorkDayPattern;

public interface WorkDayPatternRepository extends JpaRepository<WorkDayPattern, UUID> {

    List<WorkDayPattern> findByOwner(User owner);

    // Backs WorkDayService#setPattern's full-replace semantics (PLANNER-021-AC-02) -- every existing
    // row for the owner is deleted before the submitted set is re-inserted.
    long deleteByOwner(User owner);
}
