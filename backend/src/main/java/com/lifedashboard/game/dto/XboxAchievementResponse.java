package com.lifedashboard.game.dto;

import java.time.Instant;

public record XboxAchievementResponse(String achievementId, String displayName,
        String description, String lockedDescription, String iconUrl, int gamerscore,
        boolean hidden, boolean unlocked, Instant unlockedAt) {
}
