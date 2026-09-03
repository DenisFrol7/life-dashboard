package com.lifedashboard.game.steam;

import com.lifedashboard.game.rawg.RawgClient;
import com.lifedashboard.game.steamgriddb.SteamGridDbCoverCandidate;
import com.lifedashboard.game.steamgriddb.SteamGridDbGameCandidate;

public record SteamGameMetadata(RawgClient.GameData rawg,
        SteamGridDbGameCandidate steamGridDbGame,
        SteamGridDbCoverCandidate verticalCover) {
    public static SteamGameMetadata empty() {
        return new SteamGameMetadata(null, null, null);
    }
}
