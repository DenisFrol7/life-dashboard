package com.lifedashboard.game.dto;

import java.time.Instant;

public record GamePlaythroughResponse(Long id, Long libraryEntryId, Integer playthroughNumber,
        Instant completedAt, Long playtimeMinutes, String note) {}
