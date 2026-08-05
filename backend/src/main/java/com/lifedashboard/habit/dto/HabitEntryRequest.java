package com.lifedashboard.habit.dto;

import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;

public record HabitEntryRequest(
        @Digits(integer = 12, fraction = 2) BigDecimal value,
        boolean skipped,
        String note
) {
}
