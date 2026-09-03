package com.lifedashboard.game.steam;

import java.time.Instant;

public record SteamAchievementData(String apiName, String displayName, String description,
        String iconUrl, String lockedIconUrl, boolean hidden, boolean unlocked, Instant unlockedAt) {}
