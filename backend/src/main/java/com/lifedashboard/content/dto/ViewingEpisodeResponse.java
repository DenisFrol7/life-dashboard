package com.lifedashboard.content.dto;

import java.time.LocalDate;
import java.util.List;

public record ViewingEpisodeResponse(Long id, Long seasonId, Integer episodeNumber, String title,
        Integer durationMinutes, LocalDate releaseDate, List<WatchResponse> watches) {}
