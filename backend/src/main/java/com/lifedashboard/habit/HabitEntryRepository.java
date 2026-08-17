package com.lifedashboard.habit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HabitEntryRepository extends JpaRepository<HabitEntry, Long> {

    Optional<HabitEntry> findByHabitIdAndEntryDate(Long habitId, LocalDate entryDate);

    List<HabitEntry> findAllByHabitIdOrderByEntryDateAsc(Long habitId);

    @EntityGraph(attributePaths = "habit")
    List<HabitEntry> findAllByHabitUserIdAndEntryDate(Long userId, LocalDate entryDate);
}
