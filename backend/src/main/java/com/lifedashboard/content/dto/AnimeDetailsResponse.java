package com.lifedashboard.content.dto;

import com.lifedashboard.content.*;
import java.time.Instant;
import java.util.List;

public record AnimeDetailsResponse(Long id, String title, String originalTitle, Integer releaseYear,
        String description, String coverUrl, ReleaseStatus releaseStatus, UserContentStatus userStatus,
        Short rating, boolean favorite, Instant startedAt, Instant completedAt, String personalNote,
        List<AnimeSeasonResponse> seasons) {}
