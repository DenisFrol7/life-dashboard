package com.lifedashboard.game.steam;

import jakarta.validation.constraints.Positive;

public record SteamImportGameRequest(@Positive long appId,
        SteamImportResolution resolution) {
    public SteamImportGameRequest(long appId) {
        this(appId, null);
    }
}
