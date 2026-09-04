package com.lifedashboard.game.openxbl;

import java.time.Instant;

public record OpenXblProgress(long titleId, int totalAchievements, int unlockedAchievements,
        int totalGamerscore, int earnedGamerscore, Instant lastUnlockedAt,
        boolean exactAchievementDetails) {
}
