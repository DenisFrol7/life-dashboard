package com.lifedashboard.game.openxbl;

import java.time.Instant;
import java.util.List;

public record OpenXblTitle(long titleId, String name, List<String> devices,
        int currentAchievements, int totalAchievements, int currentGamerscore,
        int totalGamerscore, int sourceVersion, Instant lastPlayedAt,
        String mediaItemType, String imageUrl, boolean gamePass) {

    public OpenXblTitle(long titleId, String name, List<String> devices,
            int currentAchievements, int totalAchievements, int currentGamerscore,
            int totalGamerscore, int sourceVersion, Instant lastPlayedAt) {
        this(titleId, name, devices, currentAchievements, totalAchievements,
                currentGamerscore, totalGamerscore, sourceVersion, lastPlayedAt,
                null, null, false);
    }
}
