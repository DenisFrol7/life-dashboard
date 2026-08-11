package com.lifedashboard.content.dto;
import java.time.Instant;
public record SeasonCompletionResponse(Long id, Long seasonId, Instant completedAt, Integer episodeCount) {}
