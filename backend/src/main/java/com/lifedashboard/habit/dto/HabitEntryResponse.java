package com.lifedashboard.habit.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record HabitEntryResponse(
        Long id,
        LocalDate entryDate,
        BigDecimal value,
        BigDecimal targetValueSnapshot,
        boolean skipped,
        String note,
        Instant recordedAt
) {
}
