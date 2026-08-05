package com.lifedashboard.sleep.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.Instant;

public record SleepSessionRequest(
        @NotNull Instant startedAt,
        @NotNull Instant endedAt,
        @PositiveOrZero Integer deepSleepMinutes,
        @PositiveOrZero Integer lightSleepMinutes,
        @PositiveOrZero Integer remSleepMinutes,
        @PositiveOrZero Integer awakeMinutes,
        @Min(1) @Max(5) Integer qualityRating,
        String note
) {
}
