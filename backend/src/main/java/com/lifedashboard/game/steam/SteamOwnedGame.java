package com.lifedashboard.game.steam;

import java.time.Instant;

public record SteamOwnedGame(long appId, String title, long playtimeMinutes,
        Instant lastPlayedAt, String iconUrl) {}
