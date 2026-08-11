package com.lifedashboard.content.dto;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Max;
import java.time.Instant;

public record BulkEpisodeRequest(
        @Positive @Max(1000) int count,
        @Positive Integer durationMinutes,
        Boolean markWatched,
        Instant watchedAt) {}
