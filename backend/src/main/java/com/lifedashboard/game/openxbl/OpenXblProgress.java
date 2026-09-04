package com.lifedashboard.game.openxbl;

import java.time.Instant;
import java.util.List;

public record OpenXblProgress(long titleId, int totalAchievements, int unlockedAchievements,
        int totalGamerscore, int earnedGamerscore, Instant lastUnlockedAt,
        boolean exactAchievementDetails, List<OpenXblAchievement> achievements) {

    public OpenXblProgress {
        achievements = achievements == null ? List.of() : List.copyOf(achievements);
    }

    public OpenXblProgress(long titleId, int totalAchievements, int unlockedAchievements,
            int totalGamerscore, int earnedGamerscore, Instant lastUnlockedAt,
            boolean exactAchievementDetails) {
        this(titleId, totalAchievements, unlockedAchievements, totalGamerscore,
                earnedGamerscore, lastUnlockedAt, exactAchievementDetails, List.of());
    }
}
