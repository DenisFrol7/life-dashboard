package com.lifedashboard.game.steam;

public record SteamImportResult(int requested, int imported, int catalogCreated,
        int linkedExistingCatalog, int skippedAlreadyImported,
        int rawgEnriched, int steamGridDbCovers, String backupFile) {}
