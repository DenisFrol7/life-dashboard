package com.lifedashboard.content.myshows;

import java.util.List;
import java.util.Map;

public record MyShowsImportPreview(
        int totalSeries,
        int totalEpisodeWatches,
        int matchedSeries,
        int newSeries,
        int ambiguousSeries,
        Map<String, Integer> statuses,
        List<SeriesPreview> series,
        List<String> warnings) {

    public record SeriesPreview(
            String title,
            String status,
            Integer rating,
            Integer watchedEpisodes,
            Integer remainingEpisodes,
            String match,
            Long contentId) {}
}
