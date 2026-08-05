package com.lifedashboard.activity.dto;

import java.time.LocalDate;

public record DailyActivityResponse(
        Long id,
        LocalDate activityDate,
        Long steps,
        Long distanceMeters,
        String note
) {
}
