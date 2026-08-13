package com.lifedashboard.content.dto;

import com.lifedashboard.content.*;

public record AnimeSummaryResponse(Long id, String title, String originalTitle, Integer releaseYear,
        String coverUrl, ReleaseStatus releaseStatus, UserContentStatus userStatus,
        Short rating, boolean favorite, long seasonCount, long episodeCount, long watchedEpisodeCount,
        long watchedMinutes) {}
