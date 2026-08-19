package com.lifedashboard.calendar;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    List<CalendarEvent> findAllByUserIdOrderByStartDateAscIdAsc(Long userId);

    @Query("""
            select event from CalendarEvent event
            where event.user.id = :userId
              and event.status = com.lifedashboard.calendar.CalendarEventStatus.ACTIVE
              and event.startDate <= :date
              and (event.repeatUntil is null or event.repeatUntil >= :date)
            order by event.startDate, event.id
            """)
    List<CalendarEvent> findCandidatesForDate(@Param("userId") Long userId, @Param("date") LocalDate date);

    Optional<CalendarEvent> findByIdAndUserId(Long id, Long userId);
}
