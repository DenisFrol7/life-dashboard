package com.lifedashboard.anime.dto;

import java.util.List;

public record AnimeSeasonResponse(Long id, Integer seasonNumber, String title,
        Integer releaseYear, List<AnimeEpisodeResponse> episodes) {}
