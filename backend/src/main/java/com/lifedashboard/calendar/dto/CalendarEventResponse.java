package com.lifedashboard.calendar.dto;

import com.lifedashboard.calendar.CalendarEventStatus;
import com.lifedashboard.calendar.EventType;
import com.lifedashboard.calendar.ScheduleType;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

public record CalendarEventResponse(
        Long id,
        String title,
        String description,
        EventType eventType,
        ScheduleType scheduleType,
        LocalDate startDate,
        LocalDate repeatUntil,
        LocalTime startTime,
        LocalTime endTime,
        boolean allDay,
        String location,
        CalendarEventStatus status,
        Set<Integer> scheduleDays
) {
}
