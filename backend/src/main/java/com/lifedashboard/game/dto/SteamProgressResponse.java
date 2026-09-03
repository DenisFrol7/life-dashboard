package com.lifedashboard.game.dto;

import java.time.Instant;
import java.util.List;

public record SteamProgressResponse(Long id, Long libraryEntryId, Long steamAppId,
        int totalAchievements, int unlockedAchievements, double achievementPercent,
        Instant lastUnlockedAt, Instant lastSyncedAt, List<SteamAchievementResponse> achievements) {}
