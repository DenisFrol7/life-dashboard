package com.lifedashboard.content.shikimori;

public record ShikimoriImportResult(int total, int animeCreated, int moviesCreated,
        int updated, int skipped, int episodeWatches, String backupFile) {}
