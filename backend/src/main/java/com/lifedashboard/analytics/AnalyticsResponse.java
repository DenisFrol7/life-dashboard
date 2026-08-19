package com.lifedashboard.analytics;

import java.time.LocalDate;
import java.util.List;

public record AnalyticsResponse(
        LocalDate from,
        LocalDate to,
        LocalDate previousFrom,
        LocalDate previousTo,
        Overview current,
        Overview previous,
        List<DailyPoint> daily
) {
    public record Overview(
            long totalSteps,
            long distanceMeters,
            int activeDays,
            int averageSleepMinutes,
            double averageSleepQuality,
            long completedHabitEntries,
            long trackedHabitEntries,
            int habitCompletionPercent,
            long gameMinutes,
            long gameSessions,
            long unlockedAchievements,
            long moviesWatched,
            long seriesEpisodesWatched,
            long animeEpisodesWatched,
            long pagesRead,
            long readingMinutes
    ) {
    }

    public record DailyPoint(
            LocalDate date,
            long steps,
            long distanceMeters,
            long sleepMinutes,
            long sleepSessions,
            Double sleepQuality,
            long completedHabitEntries,
            long trackedHabitEntries,
            long gameMinutes,
            long gameSessions,
            long unlockedAchievements,
            long moviesWatched,
            long seriesEpisodesWatched,
            long animeEpisodesWatched,
            long pagesRead,
            long readingMinutes
    ) {
    }
}
