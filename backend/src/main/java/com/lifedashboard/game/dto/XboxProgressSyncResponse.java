package com.lifedashboard.game.dto;

import java.time.Instant;

public record XboxProgressSyncResponse(Long xboxTitleId, String xboxTitle,
        boolean exactAchievementDetails, boolean manualDlcGroupsPreserved,
        Instant lastUnlockedAt, boolean completionRecorded, XboxProgressResponse progress) {
}
