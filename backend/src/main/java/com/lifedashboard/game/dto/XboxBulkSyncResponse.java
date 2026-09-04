package com.lifedashboard.game.dto;

import java.util.List;

public record XboxBulkSyncResponse(int totalXboxCopies, int linkedCopies,
        int updated, int initialized, int upToDate, int skippedUnlinked,
        int failed, int completionsRecorded, int playtimeUpdated,
        int playtimeUnavailable, int playthroughPlaytimeUpdated,
        boolean playtimeSyncFailed, List<GameResult> games) {

    public record GameResult(Long libraryEntryId, Long xboxTitleId, String title,
            Status status, Integer unlockedAchievements, Integer totalAchievements,
            String message) {}

    public enum Status {
        UPDATED,
        INITIALIZED,
        UP_TO_DATE,
        FAILED
    }
}
