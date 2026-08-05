package com.lifedashboard.content.dto;

import java.time.LocalDate;

public record AnimeEpisodeResponse(Long id, Integer episodeNumber, String title,
        Integer durationMinutes, LocalDate releaseDate, boolean watched, long watchCount) {}
