package com.lifedashboard.game.dto;

import java.time.Instant;

public record SteamLibrarySummaryResponse(Long libraryEntryId, Long steamAppId,
        int totalAchievements, int unlockedAchievements, double achievementPercent,
        Instant lastUnlockedAt, Instant lastSyncedAt) {}
