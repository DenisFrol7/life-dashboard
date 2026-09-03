package com.lifedashboard.game.dto;

import com.lifedashboard.game.GamePlaythroughSource;
import java.time.Instant;

public record GamePlaythroughResponse(Long id, Long libraryEntryId, Integer playthroughNumber,
        Instant completedAt, Long playtimeMinutes, GamePlaythroughSource completionSource, String note) {}
