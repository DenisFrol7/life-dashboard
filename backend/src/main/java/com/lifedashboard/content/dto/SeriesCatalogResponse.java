package com.lifedashboard.content.dto;

import com.lifedashboard.content.*;
import java.time.LocalDate;
import java.time.Instant;

public record SeriesCatalogResponse(Long id, String title, String originalTitle, ContentFormat format,
        Integer releaseYear, String description, String coverUrl, Integer durationMinutes,
        ReleaseStatus releaseStatus, String genre, String developer, LocalDate releaseDate,
        Long libraryId, UserContentStatus userStatus, Short rating, boolean favorite,
        Instant startedAt, Instant completedAt, String personalNote,
        long seasonCount, long episodeCount, long watchedEpisodeCount, long watchedMinutes) {}
