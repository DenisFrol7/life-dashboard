package com.lifedashboard.content.dto;

import java.util.List;

public record KinopoiskRatingsPreview(String profileId, int totalRatings, int totalPages,
        int movieCount, int seriesCount, int existingCount, int newCount, List<Item> movies) {
    public record Item(long filmId, String title, String originalTitle, Integer year, Integer userRating,
            String type, String posterUrlPreview, String genre, Long existingContentId) {}
}
