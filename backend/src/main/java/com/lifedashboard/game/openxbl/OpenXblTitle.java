package com.lifedashboard.game.openxbl;

import java.time.Instant;
import java.util.List;

public record OpenXblTitle(long titleId, String name, List<String> devices,
        int currentAchievements, int totalAchievements, int currentGamerscore,
        int totalGamerscore, int sourceVersion, Instant lastPlayedAt) {
}
