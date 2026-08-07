package com.lifedashboard.game.dto;

import java.time.Instant;

public record GameSessionResponse(Long id, Long libraryEntryId, Long contentId, String title,
        Instant startedAt, Integer durationMinutes, String note, int unlockedAchievements,
        int earnedGamerscore, Long achievementGroupId, String achievementGroupName) {}
