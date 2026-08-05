package com.lifedashboard.game.dto;

import jakarta.validation.constraints.PositiveOrZero;

public record XboxProgressRequest(
        @PositiveOrZero int totalAchievements,
        @PositiveOrZero int unlockedAchievements,
        @PositiveOrZero int totalGamerscore,
        @PositiveOrZero int earnedGamerscore) {}
