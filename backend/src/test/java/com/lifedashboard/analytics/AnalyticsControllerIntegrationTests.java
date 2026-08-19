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
}
