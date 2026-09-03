package com.lifedashboard.game.steam;

import java.util.List;

public record SteamAchievementSnapshot(long appId, String gameName,
        List<SteamAchievementData> achievements) {}
