package com.lifedashboard.game.openxbl;

public record XboxImportResult(int requested, int imported, int catalogCreated,
        int linkedExistingCatalog, int skippedAlreadyImported,
        int rawgEnriched, int steamGridDbCovers, String backupFile) {}
