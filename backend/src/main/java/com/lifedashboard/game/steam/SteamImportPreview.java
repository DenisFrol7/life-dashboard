package com.lifedashboard.game.steam;

import java.util.List;

public record SteamImportPreview(String profileName, int totalGames, long totalPlaytimeMinutes,
        int alreadyImported, int matchedExisting, int reviewRequired, int newGames,
        List<SteamImportPreviewItem> games) {}
