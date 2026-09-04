package com.lifedashboard.game.openxbl;

import java.util.List;

public record XboxImportPreview(int totalGames, int alreadyImported,
        int matchedExisting, int reviewRequired, int newGames,
        List<XboxImportPreviewItem> games) {}
