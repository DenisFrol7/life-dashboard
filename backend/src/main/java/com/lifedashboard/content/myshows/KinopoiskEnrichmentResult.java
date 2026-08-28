package com.lifedashboard.content.myshows;

public record KinopoiskEnrichmentResult(int total, int updated, int remaining, boolean rateLimited,
                                        String backupFile) {}
