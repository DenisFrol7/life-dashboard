package com.lifedashboard.calendar;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    List<CalendarEvent> findAllByUserIdOrderByStartDateAscIdAsc(Long userId);

    Optional<CalendarEvent> findByIdAndUserId(Long id, Long userId);
}
