package com.lifedashboard.analytics;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class AnalyticsControllerIntegrationTests {

    private static final LocalDate FROM = LocalDate.of(2098, 5, 1);
    private static final LocalDate TO = LocalDate.of(2098, 5, 7);

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private JdbcTemplate jdbc;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
        jdbc.update("DELETE FROM daily_activity WHERE user_id = 1 AND activity_date BETWEEN ? AND ?", FROM, TO);
        jdbc.update("INSERT INTO daily_activity(user_id, activity_date, steps, distance_meters) VALUES (1, ?, 7000, 5100)", FROM);
        jdbc.update("INSERT INTO daily_activity(user_id, activity_date, steps, distance_meters) VALUES (1, ?, 500, 300)", FROM.plusDays(1));
    }

    @Test
    void returnsDailySeriesAndOverviewForRequestedPeriod() throws Exception {
        mockMvc.perform(get("/api/analytics").param("from", FROM.toString()).param("to", TO.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value(FROM.toString()))
                .andExpect(jsonPath("$.to").value(TO.toString()))
                .andExpect(jsonPath("$.daily.length()").value(7))
                .andExpect(jsonPath("$.current.totalSteps").value(7500))
                .andExpect(jsonPath("$.current.distanceMeters").value(5400))
                .andExpect(jsonPath("$.current.activeDays").value(1))
                .andExpect(jsonPath("$.daily[0].steps").value(7000));
    }

    @Test
    void rejectsPeriodsLongerThanOneYear() throws Exception {
        mockMvc.perform(get("/api/analytics").param("from", "2097-01-01").param("to", "2098-01-02"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnsAllTimeAnalyticsFromEarliestRecordedActivity() throws Exception {
        LocalDate earliest = FROM.minusYears(2);
        jdbc.update("INSERT INTO daily_activity(user_id, activity_date, steps, distance_meters) VALUES (1, ?, 1234, 800)",
                earliest);
        Long historicalMovieId = addContent("Historical movie before tracking began", "MOVIE", "LIVE_ACTION");
        jdbc.update("""
                INSERT INTO movie_watch_history(user_id, content_id, watched_at, watch_number)
                VALUES (1, ?, ?::date + time '12:00', 1)
                """, historicalMovieId, earliest.minusYears(1));

        mockMvc.perform(get("/api/analytics").param("allTime", "true").param("to", TO.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value(earliest.toString()))
                .andExpect(jsonPath("$.to").value(TO.toString()))
                .andExpect(jsonPath("$.current.totalSteps").value(8734))
                .andExpect(jsonPath("$.current.moviesWatched").value(0));
    }

    @Test
    void doesNotCountBulkEpisodeWatchesWhenCompletionDateIsUnknown() throws Exception {
        Long contentId = jdbc.queryForObject("""
                INSERT INTO content_items(title, item_type, format, release_status)
                VALUES ('Historical anime for analytics test', 'ANIME', 'ANIME', 'ENDED') RETURNING id
                """, Long.class);
        Long seasonId = jdbc.queryForObject(
                "INSERT INTO content_seasons(content_id, season_number) VALUES (?, 1) RETURNING id",
                Long.class, contentId);
        Long episodeId = jdbc.queryForObject("""
                INSERT INTO content_episodes(season_id, episode_number, title)
                VALUES (?, 1, 'Episode 1') RETURNING id
                """, Long.class, seasonId);
        jdbc.update("""
                INSERT INTO episode_watch_history(user_id, episode_id, watched_at, watch_number, is_bulk)
                VALUES (1, ?, ?::date + time '12:00', 1, true)
                """, episodeId, FROM);

        mockMvc.perform(get("/api/analytics").param("from", FROM.toString()).param("to", TO.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.animeEpisodesWatched").value(0));

        jdbc.update("""
                INSERT INTO season_completion_history(user_id, season_id, completed_at, episode_count)
                VALUES (1, ?, NULL, 1)
                """, seasonId);

        mockMvc.perform(get("/api/analytics").param("from", FROM.toString()).param("to", TO.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.animeEpisodesWatched").value(0));

        jdbc.update("UPDATE season_completion_history SET completed_at = ?::date + time '12:00' WHERE season_id = ?",
                FROM, seasonId);
        mockMvc.perform(get("/api/analytics").param("from", FROM.toString()).param("to", TO.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.animeEpisodesWatched").value(1));
    }

    @Test
    void doesNotTreatCompletedLibraryEntriesAsCurrentActivityWithoutHistory() throws Exception {
        addCompletedLibraryEntry("Historical movie without watch history", "MOVIE", "LIVE_ACTION");
        addCompletedLibraryEntry("Historical series without watch history", "SERIES", "LIVE_ACTION");
        addCompletedLibraryEntry("Historical anime without watch history", "ANIME", "ANIME");
        addCompletedLibraryEntry("Historical game without sessions", "GAME", null);
        addCompletedLibraryEntry("Historical book without sessions", "BOOK", null);

        mockMvc.perform(get("/api/analytics").param("from", FROM.toString()).param("to", TO.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.moviesWatched").value(0))
                .andExpect(jsonPath("$.current.seriesEpisodesWatched").value(0))
                .andExpect(jsonPath("$.current.animeEpisodesWatched").value(0))
                .andExpect(jsonPath("$.current.gameMinutes").value(0))
                .andExpect(jsonPath("$.current.gameSessions").value(0))
                .andExpect(jsonPath("$.current.unlockedAchievements").value(0))
                .andExpect(jsonPath("$.current.pagesRead").value(0))
                .andExpect(jsonPath("$.current.readingMinutes").value(0));
    }

    @Test
    void aggregatesSleepHabitsGamingMediaAndReading() throws Exception {
        jdbc.update("""
                INSERT INTO sleep_sessions(user_id, started_at, ended_at, awake_minutes, quality_rating)
                VALUES (1, ?::date + time '22:00', ?::date + interval '1 day' + time '06:00', 30, 4)
                """, FROM.minusDays(1), FROM.minusDays(1));

        Long habitId = jdbc.queryForObject("""
                INSERT INTO habits(user_id, name, tracking_type, data_source, target_value,
                                   schedule_type, start_date, status)
                VALUES (1, 'Analytics test habit', 'BOOLEAN', 'MANUAL', 1, 'DAILY', ?, 'ACTIVE')
                RETURNING id
                """, Long.class, FROM);
        jdbc.update("""
                INSERT INTO habit_entries(habit_id, entry_date, value, target_value_snapshot)
                VALUES (?, ?, 1, 1), (?, ?, 0, 1)
                """, habitId, FROM, habitId, FROM.plusDays(1));

        Long gameContentId = addContent("Analytics test game", "GAME", null);
        Long gameLibraryId = addLibraryEntry(gameContentId);
        Long platformId = jdbc.queryForObject("SELECT id FROM gaming_platforms ORDER BY id LIMIT 1", Long.class);
        Long sourceId = jdbc.queryForObject("SELECT id FROM game_sources ORDER BY id LIMIT 1", Long.class);
        Long userGameId = jdbc.queryForObject("""
                INSERT INTO user_game_library(user_content_id, platform_id, source_id, access_type)
                VALUES (?, ?, ?, 'OWNED') RETURNING id
                """, Long.class, gameLibraryId, platformId, sourceId);
        jdbc.update("""
                INSERT INTO game_sessions(library_entry_id, started_at, duration_minutes,
                                          unlocked_achievements, earned_gamerscore)
                VALUES (?, ?::date + time '18:00', 60, 2, 40)
                """, userGameId, FROM);

        Long movieId = addContent("Analytics test movie", "MOVIE", "LIVE_ACTION");
        jdbc.update("""
                INSERT INTO movie_watch_history(user_id, content_id, watched_at, watch_number)
                VALUES (1, ?, ?::date + time '20:00', 1)
                """, movieId, FROM);
        addEpisodeWatch("Analytics test series", "SERIES", "LIVE_ACTION", FROM);
        addEpisodeWatch("Analytics test anime", "ANIME", "ANIME", FROM);

        Long bookContentId = addContent("Analytics test book", "BOOK", null);
        Long bookLibraryId = addLibraryEntry(bookContentId);
        jdbc.update("""
                INSERT INTO books(content_id, author, book_format, page_count)
                VALUES (?, 'Test author', 'PAPER', 200)
                """, bookContentId);
        jdbc.update("""
                INSERT INTO reading_sessions(user_content_id, started_at, duration_minutes,
                                             pages_read, listened_minutes)
                VALUES (?, ?::date + time '19:00', 30, 25, 0)
                """, bookLibraryId, FROM);

        mockMvc.perform(get("/api/analytics").param("from", FROM.toString()).param("to", TO.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.averageSleepMinutes").value(450))
                .andExpect(jsonPath("$.current.averageSleepQuality").value(4.0))
                .andExpect(jsonPath("$.current.completedHabitEntries").value(1))
                .andExpect(jsonPath("$.current.trackedHabitEntries").value(2))
                .andExpect(jsonPath("$.current.habitCompletionPercent").value(50))
                .andExpect(jsonPath("$.current.gameMinutes").value(60))
                .andExpect(jsonPath("$.current.gameSessions").value(1))
                .andExpect(jsonPath("$.current.unlockedAchievements").value(2))
                .andExpect(jsonPath("$.current.moviesWatched").value(1))
                .andExpect(jsonPath("$.current.seriesEpisodesWatched").value(1))
                .andExpect(jsonPath("$.current.animeEpisodesWatched").value(1))
                .andExpect(jsonPath("$.current.pagesRead").value(25))
                .andExpect(jsonPath("$.current.readingMinutes").value(30));
    }

    private Long addContent(String title, String itemType, String format) {
        return jdbc.queryForObject("""
                INSERT INTO content_items(title, item_type, format, release_status)
                VALUES (?, ?, ?, 'ENDED') RETURNING id
                """, Long.class, title, itemType, format);
    }

    private Long addLibraryEntry(Long contentId) {
        return jdbc.queryForObject("""
                INSERT INTO user_content(user_id, content_id, status)
                VALUES (1, ?, 'IN_PROGRESS') RETURNING id
                """, Long.class, contentId);
    }

    private void addEpisodeWatch(String title, String itemType, String format, LocalDate watchedAt) {
        Long contentId = addContent(title, itemType, format);
        Long seasonId = jdbc.queryForObject(
                "INSERT INTO content_seasons(content_id, season_number) VALUES (?, 1) RETURNING id",
                Long.class, contentId);
        Long episodeId = jdbc.queryForObject("""
                INSERT INTO content_episodes(season_id, episode_number, title)
                VALUES (?, 1, 'Episode 1') RETURNING id
                """, Long.class, seasonId);
        jdbc.update("""
                INSERT INTO episode_watch_history(user_id, episode_id, watched_at, watch_number, is_bulk)
                VALUES (1, ?, ?::date + time '12:00', 1, false)
                """, episodeId, watchedAt);
    }

    private void addCompletedLibraryEntry(String title, String itemType, String format) {
        Long contentId = addContent(title, itemType, format);
        jdbc.update("""
                INSERT INTO user_content(user_id, content_id, status, completed_at)
                VALUES (1, ?, 'COMPLETED', ?::date + time '12:00')
                """, contentId, FROM);
    }
}
