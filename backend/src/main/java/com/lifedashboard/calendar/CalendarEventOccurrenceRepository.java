package com.lifedashboard.calendar;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CalendarEventOccurrenceRepository extends JpaRepository<CalendarEventOccurrence, Long> {

    Optional<CalendarEventOccurrence> findByEventIdAndOccurrenceDate(Long eventId, LocalDate occurrenceDate);

    List<CalendarEventOccurrence> findAllByEventIdOrderByOccurrenceDateAsc(Long eventId);
}
