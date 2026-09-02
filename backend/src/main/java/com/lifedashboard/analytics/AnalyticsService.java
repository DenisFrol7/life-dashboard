package com.lifedashboard.analytics;

import org.jspecify.annotations.NonNull;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class AnalyticsService {

    private static final int MAX_DAYS = 366;
    private static final int MAX_ALL_TIME_DAYS = 36_525;
    private static final long ACTIVE_DAY_STEPS = 1_000;
    private final NamedParameterJdbcTemplate jdbc;
    private final long userId;

    public AnalyticsService(NamedParameterJdbcTemplate jdbc,
                            @Value("${app.default-user-id}") long userId) {
        this.jdbc = jdbc;
        this.userId = userId;
    }

    public AnalyticsResponse get(LocalDate from, LocalDate to, boolean allTime) {
        String timezone = jdbc.query("SELECT timezone FROM users WHERE id = :userId",
                new MapSqlParameterSource("userId", userId),
                result -> result.next() ? result.getString(1) : null);
        if (timezone == null) throw new ResourceNotFoundException("Default user was not found");
        ZoneId zone = ZoneId.of(timezone);
        LocalDate effectiveTo = to == null ? LocalDate.now(zone) : to;
        LocalDate effectiveFrom = allTime ? earliestDate(effectiveTo, zone)
                : from == null ? effectiveTo.minusDays(29) : from;
        validate(effectiveFrom, effectiveTo, allTime);

        long days = ChronoUnit.DAYS.between(effectiveFrom, effectiveTo) + 1;
        LocalDate previousTo = effectiveFrom.minusDays(1);
        LocalDate previousFrom = previousTo.minusDays(days - 1);
        List<AnalyticsResponse.DailyPoint> current = daily(effectiveFrom, effectiveTo, zone);
        List<AnalyticsResponse.DailyPoint> previous = daily(previousFrom, previousTo, zone);
        return new AnalyticsResponse(effectiveFrom, effectiveTo, previousFrom, previousTo,
                overview(current), overview(previous), current);
    }

    private void validate(LocalDate from, LocalDate to, boolean allTime) {
        if (to.isBefore(from)) throw new InvalidRequestException("to must not be before from");
        long days = ChronoUnit.DAYS.between(from, to);
        if (!allTime && days >= MAX_DAYS) {
            throw new InvalidRequestException("Analytics period must not exceed 366 days");
        }
        if (allTime && days >= MAX_ALL_TIME_DAYS) {
            throw new InvalidRequestException("All-time analytics period must not exceed 100 years");
        }
    }

    private LocalDate earliestDate(LocalDate to, ZoneId zone) {
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("userId", userId).addValue("toDate", to).addValue("timezone", zone.getId());
        LocalDate earliest = jdbc.queryForObject(EARLIEST_DATE_SQL, parameters, LocalDate.class);
        return earliest == null ? to : earliest;
    }

    private List<AnalyticsResponse.DailyPoint> daily(LocalDate from, LocalDate to, ZoneId zone) {
        Instant fromInstant = from.atStartOfDay(zone).toInstant();
        Instant toInstant = to.plusDays(1).atStartOfDay(zone).toInstant();
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("userId", userId).addValue("fromDate", from).addValue("toDate", to)
                .addValue("fromInstant", Timestamp.from(fromInstant)).addValue("toInstant", Timestamp.from(toInstant))
                .addValue("timezone", zone.getId());
        return jdbc.query(DAILY_SQL, parameters,
                (@NonNull ResultSet result, int rowNumber) -> dailyPoint(result, rowNumber));
    }

    private AnalyticsResponse.DailyPoint dailyPoint(ResultSet result, int rowNumber) throws SQLException {
        double quality = result.getDouble("sleep_quality");
        Double sleepQuality = result.wasNull() ? null : quality;
        return new AnalyticsResponse.DailyPoint(result.getObject("day", LocalDate.class),
                result.getLong("steps"), result.getLong("distance_meters"),
                result.getLong("sleep_minutes"), result.getLong("sleep_sessions"), sleepQuality,
                result.getLong("completed_habits"), result.getLong("tracked_habits"),
                result.getLong("game_minutes"), result.getLong("game_sessions"),
                result.getLong("achievements"), result.getLong("movies_watched"),
                result.getLong("series_episodes"), result.getLong("anime_episodes"),
                result.getLong("pages_read"), result.getLong("reading_minutes"));
    }

    private AnalyticsResponse.Overview overview(List<AnalyticsResponse.DailyPoint> daily) {
        long totalSteps = daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.steps()).sum();
        long distance = daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.distanceMeters()).sum();
        int activeDays = (int) daily.stream().filter(day -> day.steps() >= ACTIVE_DAY_STEPS).count();
        long sleepMinutes = daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.sleepMinutes()).sum();
        long sleepSessions = daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.sleepSessions()).sum();
        double qualityTotal = daily.stream().filter(day -> day.sleepQuality() != null)
                .mapToDouble((AnalyticsResponse.@NonNull DailyPoint point) ->
                        java.util.Objects.requireNonNull(point.sleepQuality())).sum();
        long qualityDays = daily.stream().filter(day -> day.sleepQuality() != null).count();
        long completed = daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.completedHabitEntries()).sum();
        long tracked = daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.trackedHabitEntries()).sum();
        return new AnalyticsResponse.Overview(totalSteps, distance, activeDays,
                sleepSessions == 0 ? 0 : (int) Math.round((double) sleepMinutes / sleepSessions),
                qualityDays == 0 ? 0 : Math.round(qualityTotal / qualityDays * 10.0) / 10.0,
                completed, tracked, tracked == 0 ? 0 : (int) Math.round(completed * 100.0 / tracked),
                daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.gameMinutes()).sum(),
                daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.gameSessions()).sum(),
                daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.unlockedAchievements()).sum(),
                daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.moviesWatched()).sum(),
                daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.seriesEpisodesWatched()).sum(),
                daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.animeEpisodesWatched()).sum(),
                daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.pagesRead()).sum(),
                daily.stream().mapToLong((AnalyticsResponse.@NonNull DailyPoint point) -> point.readingMinutes()).sum());
    }

    private static final String DAILY_SQL = """
            WITH dates AS (
                SELECT generate_series(CAST(:fromDate AS date), CAST(:toDate AS date), interval '1 day')::date AS day
            ), activity AS (
                SELECT activity_date AS day, COALESCE(SUM(steps), 0) AS steps,
                       COALESCE(SUM(distance_meters), 0) AS distance_meters
                FROM daily_activity WHERE user_id = :userId AND activity_date BETWEEN :fromDate AND :toDate
                GROUP BY activity_date
            ), sleep AS (
                SELECT day,
                       COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
                           - COALESCE(awake_minutes, 0))), 0)::bigint AS sleep_minutes,
                       COUNT(*) AS sleep_sessions, AVG(quality_rating)::double precision AS sleep_quality
                FROM (SELECT (ended_at AT TIME ZONE :timezone)::date AS day, started_at, ended_at,
                             awake_minutes, quality_rating FROM sleep_sessions
                      WHERE user_id = :userId AND ended_at >= :fromInstant AND ended_at < :toInstant) source
                GROUP BY day
            ), habit_data AS (
                SELECT entry_date AS day,
                       COUNT(*) FILTER (WHERE NOT entry.is_skipped AND entry.value IS NOT NULL AND
                           CASE WHEN habit.tracking_type = 'BOOLEAN' THEN entry.value = 1
                                WHEN COALESCE(entry.target_value_snapshot, habit.target_value) IS NULL THEN true
                                ELSE entry.value >= COALESCE(entry.target_value_snapshot, habit.target_value) END) AS completed_habits,
                       COUNT(*) FILTER (WHERE NOT entry.is_skipped) AS tracked_habits
                FROM habit_entries entry JOIN habits habit ON habit.id = entry.habit_id
                WHERE habit.user_id = :userId AND entry.entry_date BETWEEN :fromDate AND :toDate
                GROUP BY entry_date
            ), gaming AS (
                SELECT day, SUM(duration_minutes) AS game_minutes, COUNT(*) AS game_sessions,
                       SUM(unlocked_achievements) AS achievements
                FROM (SELECT (session.started_at AT TIME ZONE :timezone)::date AS day,
                             session.duration_minutes, session.unlocked_achievements
                      FROM game_sessions session JOIN user_game_library game ON game.id = session.library_entry_id
                      JOIN user_content library ON library.id = game.user_content_id
                      WHERE library.user_id = :userId AND session.started_at >= :fromInstant
                        AND session.started_at < :toInstant) source
                GROUP BY day
            ), movies AS (
                SELECT day, COUNT(*) AS movies_watched
                FROM (SELECT (watched_at AT TIME ZONE :timezone)::date AS day FROM movie_watch_history
                      WHERE user_id = :userId AND watched_at >= :fromInstant AND watched_at < :toInstant) source
                GROUP BY day
            ), episodes AS (
                SELECT day, COUNT(*) FILTER (WHERE item_type = 'SERIES') AS series_episodes,
                       COUNT(*) FILTER (WHERE item_type = 'ANIME') AS anime_episodes
                FROM (SELECT (watch.watched_at AT TIME ZONE :timezone)::date AS day, content.item_type
                      FROM episode_watch_history watch JOIN content_episodes episode ON episode.id = watch.episode_id
                      JOIN content_seasons season ON season.id = episode.season_id
                      JOIN content_items content ON content.id = season.content_id
                      LEFT JOIN season_completion_history completion ON completion.season_id = season.id
                          AND completion.user_id = watch.user_id
                      WHERE watch.user_id = :userId AND watch.watched_at >= :fromInstant
                        AND watch.watched_at < :toInstant
                        AND (NOT watch.is_bulk OR completion.completed_at IS NOT NULL)) source
                GROUP BY day
            ), reading AS (
                SELECT day, SUM(pages_read) AS pages_read, SUM(duration_minutes) AS reading_minutes
                FROM (SELECT (session.started_at AT TIME ZONE :timezone)::date AS day,
                             session.pages_read, session.duration_minutes
                      FROM reading_sessions session JOIN user_content library ON library.id = session.user_content_id
                      WHERE library.user_id = :userId AND session.started_at >= :fromInstant
                        AND session.started_at < :toInstant) source
                GROUP BY day
            )
            SELECT dates.day, COALESCE(activity.steps, 0) AS steps,
                   COALESCE(activity.distance_meters, 0) AS distance_meters,
                   COALESCE(sleep.sleep_minutes, 0) AS sleep_minutes,
                   COALESCE(sleep.sleep_sessions, 0) AS sleep_sessions, sleep.sleep_quality,
                   COALESCE(habit_data.completed_habits, 0) AS completed_habits,
                   COALESCE(habit_data.tracked_habits, 0) AS tracked_habits,
                   COALESCE(gaming.game_minutes, 0) AS game_minutes,
                   COALESCE(gaming.game_sessions, 0) AS game_sessions,
                   COALESCE(gaming.achievements, 0) AS achievements,
                   COALESCE(movies.movies_watched, 0) AS movies_watched,
                   COALESCE(episodes.series_episodes, 0) AS series_episodes,
                   COALESCE(episodes.anime_episodes, 0) AS anime_episodes,
                   COALESCE(reading.pages_read, 0) AS pages_read,
                   COALESCE(reading.reading_minutes, 0) AS reading_minutes
            FROM dates LEFT JOIN activity USING (day) LEFT JOIN sleep USING (day)
            LEFT JOIN habit_data USING (day) LEFT JOIN gaming USING (day) LEFT JOIN movies USING (day)
            LEFT JOIN episodes USING (day) LEFT JOIN reading USING (day) ORDER BY dates.day
            """;

    private static final String EARLIEST_DATE_SQL = """
            SELECT COALESCE(
                (SELECT MIN(day) FROM (
                    SELECT activity_date AS day FROM daily_activity WHERE user_id = :userId
                    UNION ALL
                    SELECT (ended_at AT TIME ZONE :timezone)::date FROM sleep_sessions WHERE user_id = :userId
                    UNION ALL
                    SELECT entry.entry_date FROM habit_entries entry
                        JOIN habits habit ON habit.id = entry.habit_id WHERE habit.user_id = :userId
                ) tracking_dates WHERE day <= :toDate),
                (SELECT (created_at AT TIME ZONE :timezone)::date FROM users WHERE id = :userId)
            )
            """;
}
