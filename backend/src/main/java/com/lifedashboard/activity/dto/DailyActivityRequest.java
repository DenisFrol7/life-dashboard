package com.lifedashboard.activity.dto;

import jakarta.validation.constraints.PositiveOrZero;

public record DailyActivityRequest(
        @PositiveOrZero Long steps,
        @PositiveOrZero Long distanceMeters,
        String note
) {
}
