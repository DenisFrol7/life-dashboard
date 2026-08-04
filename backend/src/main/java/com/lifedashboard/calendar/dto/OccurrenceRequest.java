package com.lifedashboard.calendar.dto;

import com.lifedashboard.calendar.OccurrenceStatus;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record OccurrenceRequest(
        @NotNull OccurrenceStatus status,
        Instant completedAt,
        String note
) {
}
