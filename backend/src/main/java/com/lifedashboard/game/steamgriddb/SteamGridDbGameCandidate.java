package com.lifedashboard.game.steamgriddb;

import java.util.List;

public record SteamGridDbGameCandidate(long steamGridDbId, String name, boolean verified,
        List<String> types) {}
