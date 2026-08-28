package com.lifedashboard.content.myshows;

import java.util.List;

public record KinopoiskMatchPreview(
        int totalSeries,
        int matchedSeries,
        int reviewRequired,
        int notFound,
        List<SeriesMatch> series) {

    public record SeriesMatch(
            String title,
            String status,
            String match,
            Long selectedFilmId,
            List<Candidate> candidates) {}

    public record Candidate(
            Long filmId,
            String nameRu,
            String nameEn,
            String year,
            String type) {}
}
