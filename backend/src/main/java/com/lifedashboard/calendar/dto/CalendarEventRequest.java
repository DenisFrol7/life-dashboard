package com.lifedashboard.calendar.dto;

import com.lifedashboard.calendar.CalendarEventStatus;
import com.lifedashboard.calendar.EventType;
import com.lifedashboard.calendar.ScheduleType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

public record CalendarEventRequest(
        @NotBlank @Size(max = 300) String title,
        String description,
        @NotNull EventType eventType,
        @NotNull ScheduleType scheduleType,
        @NotNull LocalDate startDate,
        LocalDate repeatUntil,
        LocalTime startTime,
        LocalTime endTime,
        boolean allDay,
        @Size(max = 500) String location,
        @NotNull CalendarEventStatus status,
        Set<@NotNull @Min(1) @Max(7) Integer> scheduleDays
) {
}
