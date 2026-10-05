package uk.co.stefirby.behaviouralactivation.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uk.co.stefirby.behaviouralactivation.model.User;
import uk.co.stefirby.behaviouralactivation.model.WorkDayOverride;

public interface WorkDayOverrideRepository extends JpaRepository<WorkDayOverride, UUID> {

    Optional<WorkDayOverride> findByOwnerAndDate(User owner, LocalDate date);

    // Backs WorkDayService#getWeek's effective-work-day computation for a whole week in one query
    // (PLANNER-021-AC-04), inclusive of both endpoints.
    List<WorkDayOverride> findByOwnerAndDateBetween(User owner, LocalDate start, LocalDate end);
}
