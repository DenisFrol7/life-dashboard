package com.lifedashboard.game.dto;

import com.lifedashboard.game.XboxAchievementGroupType;

public record XboxAchievementGroupResponse(Long id, Long libraryEntryId, String name,
        XboxAchievementGroupType groupType, int totalAchievements, int unlockedAchievements,
        double achievementPercent, int totalGamerscore, int earnedGamerscore,
        double gamerscorePercent) {}
