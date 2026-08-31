package com.lifedashboard.content.dto;

public record KinopoiskMovieEnrichmentResult(int total, int updated, int remaining,
        boolean quotaExhausted, String backupFile) {}
