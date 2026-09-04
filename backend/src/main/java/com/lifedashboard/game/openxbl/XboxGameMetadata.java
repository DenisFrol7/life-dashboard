package com.lifedashboard.game.openxbl;

import com.lifedashboard.game.rawg.RawgClient;
import com.lifedashboard.game.steamgriddb.SteamGridDbCoverCandidate;
import com.lifedashboard.game.steamgriddb.SteamGridDbGameCandidate;

public record XboxGameMetadata(RawgClient.GameData rawg,
        SteamGridDbGameCandidate steamGridDbGame,
        SteamGridDbCoverCandidate verticalCover) {}
