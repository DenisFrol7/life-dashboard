package com.lifedashboard.game.steamgriddb;

public record SteamGridDbCoverCandidate(long steamGridDbGameId, long gridId, String imageUrl,
        String thumbnailUrl, int score, String style, String authorName) {}
