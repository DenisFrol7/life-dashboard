package com.lifedashboard.calendar.dto;

import com.lifedashboard.calendar.OccurrenceStatus;

import java.time.Instant;
import java.time.LocalDate;

public record OccurrenceResponse(
        Long id,
        LocalDate occurrenceDate,
        OccurrenceStatus status,
        Instant completedAt,
        String note
) {
}
