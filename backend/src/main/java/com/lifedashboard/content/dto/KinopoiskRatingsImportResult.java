package com.lifedashboard.content.dto;

public record KinopoiskRatingsImportResult(int totalMovies, int created, int updated, int skipped,
        String backupFile) {}
