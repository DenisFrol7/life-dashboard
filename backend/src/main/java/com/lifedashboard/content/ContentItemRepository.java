package com.lifedashboard.content;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ContentItemRepository extends JpaRepository<ContentItem, Long> {
    List<ContentItem> findAllByOrderByTitleAsc();
    List<ContentItem> findAllByItemTypeOrderByTitleAsc(ContentType itemType);
    Optional<ContentItem> findByTitle(String title);

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
}
