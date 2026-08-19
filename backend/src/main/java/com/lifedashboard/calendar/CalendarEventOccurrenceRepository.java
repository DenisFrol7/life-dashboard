package com.lifedashboard.calendar;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CalendarEventOccurrenceRepository extends JpaRepository<CalendarEventOccurrence, Long> {

    Optional<CalendarEventOccurrence> findByEventIdAndOccurrenceDate(Long eventId, LocalDate occurrenceDate);

    List<CalendarEventOccurrence> findAllByEventIdOrderByOccurrenceDateAsc(Long eventId);

    @EntityGraph(attributePaths = "event")
    List<CalendarEventOccurrence> findAllByEventUserIdAndOccurrenceDateBetweenOrderByOccurrenceDateAsc(
            Long userId, LocalDate from, LocalDate to);

    @EntityGraph(attributePaths = "event")
    List<CalendarEventOccurrence> findAllByEventUserIdAndOccurrenceDate(Long userId, LocalDate occurrenceDate);
}
