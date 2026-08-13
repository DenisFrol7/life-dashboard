package com.lifedashboard.content.dto;

import com.lifedashboard.content.*;
import java.time.*;

public record MovieCatalogResponse(Long id, String title, String originalTitle, ContentFormat format,
        Integer releaseYear, String description, String coverUrl, Integer durationMinutes,
        ReleaseStatus releaseStatus, String genre, String developer, LocalDate releaseDate,
        Long libraryId, UserContentStatus userStatus, Short rating, boolean favorite,
        Instant startedAt, Instant completedAt, String personalNote, long watchCount, long watchedMinutes) {}
