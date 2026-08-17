package com.lifedashboard.content;
import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param; import java.util.*;
public interface ContentEpisodeRepository extends JpaRepository<ContentEpisode,Long>{
 List<ContentEpisode> findAllBySeasonIdOrderByEpisodeNumber(Long id); boolean existsBySeasonIdAndEpisodeNumber(Long id,Integer n);
 @Query("select e from ContentEpisode e join fetch e.season s where s.content.id=:id order by s.seasonNumber,e.episodeNumber")
 List<ContentEpisode> findAllByContentId(@Param("id") Long id);
 boolean existsBySeasonIdAndEpisodeNumberAndIdNot(Long seasonId,Integer episodeNumber,Long id);
 @Query("select count(e) from ContentEpisode e where e.season.content.id=:id") long countByContent(@Param("id") Long id);
}
