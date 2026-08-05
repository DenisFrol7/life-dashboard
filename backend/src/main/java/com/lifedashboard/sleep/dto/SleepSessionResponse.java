package com.lifedashboard.sleep.dto;

import java.time.Instant;

public record SleepSessionResponse(
        Long id,
        Instant startedAt,
        Instant endedAt,
        Integer deepSleepMinutes,
        Integer lightSleepMinutes,
        Integer remSleepMinutes,
        Integer awakeMinutes,
        Integer qualityRating,
        String note
) {
}
