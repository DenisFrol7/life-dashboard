package com.lifedashboard.game.dto;

import java.util.List;

public record SteamRecentSyncResponse(int recentlyPlayed, int matchedLibraryCopies,
        int updated, int upToDate, int initiallySynced, int remainingUnsynced,
        int notImported, int failed,
        List<GameResult> games) {

    public record GameResult(Long libraryEntryId, long steamAppId, String title,
            Status status, Integer unlockedAchievements, Integer totalAchievements,
            String message) {}

    public enum Status {
        UPDATED,
        INITIALIZED,
        UP_TO_DATE,
        FAILED
    }
}
