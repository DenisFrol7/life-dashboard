package com.lifedashboard.game.steam;

import java.util.List;

public record SteamLibrary(String profileName, List<SteamOwnedGame> games) {}
