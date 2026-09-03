package com.lifedashboard.content;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.time.Instant;

public interface ContentItemRepository extends JpaRepository<ContentItem, Long> {
    List<ContentItem> findAllByOrderByTitleAsc();
    List<ContentItem> findAllByItemTypeOrderByTitleAsc(ContentType itemType);
    Optional<ContentItem> findByTitle(String title);
    Optional<ContentItem> findByKinopoiskFilmId(Long kinopoiskFilmId);
    Optional<ContentItem> findByShikimoriId(Long shikimoriId);
    Optional<ContentItem> findByRawgId(Long rawgId);
    List<ContentItem> findAllByItemTypeAndKinopoiskFilmIdIsNotNullOrderByTitleAsc(ContentType itemType);
    List<ContentItem> findAllByItemTypeAndKinopoiskFilmIdIsNotNullAndKinopoiskEnrichedAtIsNullOrderByIdAsc(ContentType itemType);

    @Query(value = """
            select c.id, c.title, c.original_title as "originalTitle", c.format,
                   c.release_year as "releaseYear", c.description, c.cover_url as "coverUrl",
                   c.duration_minutes as "durationMinutes", c.release_status as "releaseStatus",
                   c.genre, c.developer, c.release_date as "releaseDate", uc.id as "libraryId",
                   uc.status as "userStatus", uc.rating, coalesce(uc.is_favorite, false) as favorite,
                   uc.started_at as "startedAt", uc.completed_at as "completedAt", uc.personal_note as "personalNote",
                   count(distinct s.id) as "seasonCount", count(distinct e.id) as "episodeCount",
                   count(distinct case when w.id is not null then e.id end) as "watchedEpisodeCount",
                   coalesce(sum(case when w.id is not null then coalesce(e.duration_minutes, 0) else 0 end), 0) as "watchedMinutes"
              from content_items c
              left join user_content uc on uc.content_id = c.id and uc.user_id = :userId
              left join content_seasons s on s.content_id = c.id
              left join content_episodes e on e.season_id = s.id
              left join episode_watch_history w on w.episode_id = e.id and w.user_id = :userId
             where c.item_type = :itemType
             group by c.id, uc.id
             order by c.title
            """, nativeQuery = true)
    List<SeriesCatalogProjection> findSerialCatalog(@Param("userId") Long userId, @Param("itemType") String itemType);

    @Query(value = """
            select 'MOVIE' as kind, w.id as "eventId", w.watched_at as "occurredAt", c.title,
                   w.watch_number as "watchNumber", null::integer as "seasonNumber",
                   null::integer as "episodeNumber", null::varchar as "episodeTitle",
                   null::integer as "episodeCount", c.duration_minutes as "durationMinutes"
              from movie_watch_history w join content_items c on c.id = w.content_id
             where w.user_id = :userId and w.watched_at >= :from and w.watched_at < :to
            union all
            select 'EPISODE', w.id, w.watched_at, c.title, w.watch_number, s.season_number,
                   e.episode_number, e.title, null::integer, e.duration_minutes
              from episode_watch_history w
              join content_episodes e on e.id = w.episode_id
              join content_seasons s on s.id = e.season_id
              join content_items c on c.id = s.content_id
             where w.user_id = :userId and w.is_bulk = false and w.watched_at >= :from and w.watched_at < :to
            union all
            select 'SEASON', h.id, h.completed_at, c.title, null::integer, s.season_number,
                   null::integer, null::varchar, h.episode_count,
                   nullif(sum(coalesce(e.duration_minutes, 0)), 0)::integer
              from season_completion_history h
              join content_seasons s on s.id = h.season_id
              join content_items c on c.id = s.content_id
              left join content_episodes e on e.season_id = s.id
             where h.user_id = :userId and h.completed_at >= :from and h.completed_at < :to
             group by h.id, c.title, s.season_number
             order by "occurredAt"
            """, nativeQuery = true)
    List<MediaTimelineProjection> findMediaTimeline(@Param("userId") Long userId,
            @Param("from") Instant from, @Param("to") Instant to);

    @Query(value = """
            select c.id, c.title, c.original_title as "originalTitle", c.format,
                   c.release_year as "releaseYear", c.description, c.cover_url as "coverUrl",
                   c.duration_minutes as "durationMinutes", c.release_status as "releaseStatus",
                   c.genre, c.developer, c.release_date as "releaseDate", uc.id as "libraryId",
                   uc.status as "userStatus", uc.rating, coalesce(uc.is_favorite, false) as favorite,
                   uc.started_at as "startedAt", uc.completed_at as "completedAt", uc.personal_note as "personalNote",
                   count(w.id) as "watchCount",
                   count(w.id) * coalesce(c.duration_minutes, 0) as "watchedMinutes"
              from content_items c
              left join user_content uc on uc.content_id = c.id and uc.user_id = :userId
              left join movie_watch_history w on w.content_id = c.id and w.user_id = :userId
             where c.item_type = 'MOVIE'
             group by c.id, uc.id
             order by c.title
            """, nativeQuery = true)
    List<MovieCatalogProjection> findMovieCatalog(@Param("userId") Long userId);
}
