package com.lifedashboard.content.dto;

public record KinopoiskMovieCandidate(long filmId, String nameRu, String nameOriginal,
        String year, String posterUrlPreview, Long existingContentId) {}
