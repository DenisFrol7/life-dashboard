package com.lifedashboard.dashboard.dto;

import java.time.LocalDate;

public record DashboardResponse(LocalDate date, ActivitySummary activity, SleepSummary sleep,
        HabitSummary habits, CalendarSummary calendar, long journalEntries, GamingSummary gaming,
        MediaSummary media) {
    public record ActivitySummary(Long steps, Long distanceMeters) {}
    public record SleepSummary(long durationMinutes, Integer qualityRating, int sessions) {}
    public record HabitSummary(int scheduled, int completed, int skipped, double completionPercent) {}
    public record CalendarSummary(int scheduled, int events, int reminders,
            int completedTasks, int pendingTasks) {}
    public record GamingSummary(long durationMinutes, int sessions) {}
    public record MediaSummary(int currentMovies, int currentSeries, int pausedSeries,
            int currentAnime, int pausedAnime, int currentGames) {}
}
