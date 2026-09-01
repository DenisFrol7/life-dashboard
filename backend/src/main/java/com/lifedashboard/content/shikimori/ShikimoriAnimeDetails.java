package com.lifedashboard.content.shikimori;

import com.lifedashboard.content.ReleaseStatus;

public record ShikimoriAnimeDetails(long shikimoriId, String title, String originalTitle,
        Integer releaseYear, String description, String coverUrl, ReleaseStatus releaseStatus,
        String genre, Integer durationMinutes, int episodeCount, Long existingContentId) {}
