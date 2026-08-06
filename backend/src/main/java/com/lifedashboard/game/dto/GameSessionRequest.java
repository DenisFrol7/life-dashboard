package com.lifedashboard.game.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;

public record GameSessionRequest(@NotNull Instant startedAt,
        @NotNull @Min(1) Integer durationMinutes, @Size(max = 5000) String note,
        @Min(0) int unlockedAchievements, @Min(0) int earnedGamerscore) {
    public GameSessionRequest(Instant startedAt, Integer durationMinutes, String note) {
        this(startedAt, durationMinutes, note, 0, 0);
    }
}
