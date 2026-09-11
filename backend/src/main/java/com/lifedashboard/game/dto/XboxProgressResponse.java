package com.lifedashboard.game.dto;

import com.lifedashboard.game.XboxAchievementDetailsStatus;
import java.time.Instant;

public record XboxProgressResponse(Long id, Long libraryEntryId, int totalAchievements,
        int unlockedAchievements, double achievementPercent, int totalGamerscore,
        int earnedGamerscore, double gamerscorePercent, Instant lastUnlockedAt,
        Instant lastUpdatedAt, XboxAchievementDetailsStatus achievementDetailsStatus) {}
