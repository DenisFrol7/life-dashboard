package com.lifedashboard.content.dto;

import java.util.List;

public record ViewingSeasonResponse(Long id, Long contentId, Integer seasonNumber, String title,
        Integer releaseYear, SeasonCompletionResponse completion, List<ViewingEpisodeResponse> episodes) {}
