package com.lifedashboard.game.openxbl;

import java.time.Instant;

public record XboxImportPreviewItem(long titleId, String title, String platformCode,
        Instant lastPlayedAt, String imageUrl, int unlockedAchievements,
        int totalAchievements, int earnedGamerscore, int totalGamerscore,
        String suggestedSourceCode, XboxImportMatch match, Long matchedContentId,
        String matchedContentTitle, Long matchedLibraryEntryId) {}
