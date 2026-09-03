package com.lifedashboard.game.rawg;

import com.lifedashboard.content.ReleaseStatus;
import java.time.LocalDate;
import java.util.List;

public record RawgGameDetails(long rawgId, String slug, String rawgUrl, String title,
        String originalTitle, Integer releaseYear, LocalDate releaseDate, String description,
        String backgroundUrl, String genre, String developer, ReleaseStatus releaseStatus,
        List<String> platforms, Long existingContentId) {}
