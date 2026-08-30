package com.lifedashboard.content.dto;

import com.lifedashboard.content.ContentFormat;
import com.lifedashboard.content.ReleaseStatus;

public record KinopoiskMovieDetails(long filmId, String title, String originalTitle,
        ContentFormat format, Integer releaseYear, String description, String coverUrl,
        Integer durationMinutes, ReleaseStatus releaseStatus, String genre,
        Long existingContentId) {}
