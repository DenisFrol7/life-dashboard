package com.lifedashboard.game.steam;

import java.time.Instant;

public record SteamImportPreviewItem(long appId, String title, long playtimeMinutes,
        Instant lastPlayedAt, String iconUrl, SteamImportMatch match,
        Long matchedContentId, String matchedContentTitle, Long matchedLibraryEntryId) {}
