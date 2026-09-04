package com.lifedashboard.game.openxbl;

import java.time.Instant;

public record OpenXblAchievement(String achievementId, String displayName, String description,
        String lockedDescription, String iconUrl, int gamerscore, boolean hidden,
        boolean unlocked, Instant unlockedAt) {
}
