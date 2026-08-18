package com.lifedashboard.game.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;

public record XboxAchievementGroupRequest(@NotBlank @Size(max = 200) String name,
        @Min(0) int totalAchievements, @Min(0) int unlockedAchievements,
        @Min(0) int totalGamerscore, @Min(0) int earnedGamerscore, Instant completedAt) {}
