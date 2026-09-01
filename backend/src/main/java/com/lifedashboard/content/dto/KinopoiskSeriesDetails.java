package com.lifedashboard.content.dto;

import com.lifedashboard.content.ReleaseStatus;

public record KinopoiskSeriesDetails(long filmId, String title, String originalTitle,
        Integer releaseYear, String description, String coverUrl, ReleaseStatus releaseStatus,
        String genre, int seasonCount, int episodeCount, Long existingContentId) {}
