package com.lifedashboard.game.dto;

import jakarta.validation.constraints.*;

public record XboxAchievementGroupRequest(@NotBlank @Size(max = 200) String name,
        @Min(0) int totalAchievements, @Min(0) int unlockedAchievements,
        @Min(0) int totalGamerscore, @Min(0) int earnedGamerscore) {}
