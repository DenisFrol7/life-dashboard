package com.lifedashboard.game.dto;

import java.time.Instant;

public record SteamAchievementResponse(String apiName, String displayName, String description,
        String iconUrl, String lockedIconUrl, boolean hidden, boolean unlocked, Instant unlockedAt) {}
