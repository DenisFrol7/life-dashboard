package com.lifedashboard.game.dto;

public record XboxLibrarySummaryResponse(Long libraryEntryId, XboxProgressResponse progress,
        XboxAchievementGroupResponse baseGame) {}
