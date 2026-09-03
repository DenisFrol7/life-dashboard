package com.lifedashboard.game.rawg;

import java.time.LocalDate;
import java.util.List;

public record RawgGameCandidate(long rawgId, String slug, String title, LocalDate releaseDate,
        String backgroundUrl, List<String> platforms, Long existingContentId) {}
