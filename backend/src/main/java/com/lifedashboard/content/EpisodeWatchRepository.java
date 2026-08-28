package com.lifedashboard.content;
import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param; import java.util.*;
public interface EpisodeWatchRepository extends JpaRepository<EpisodeWatch,Long>{
 List<EpisodeWatch> findAllByEpisodeIdAndUserIdOrderByWatchNumber(Long e,Long u);
 @Query("select w from EpisodeWatch w join fetch w.episode e where w.user.id=:u and e.season.content.id=:c order by e.id,w.watchNumber")
 List<EpisodeWatch> findAllByUserIdAndContentId(@Param("u") Long userId,@Param("c") Long contentId);
 @Query("select coalesce(max(w.watchNumber),0) from EpisodeWatch w where w.episode.id=:e and w.user.id=:u") int maxNumber(@Param("e")Long e,@Param("u")Long u);
 @Query("select count(distinct w.episode.id) from EpisodeWatch w where w.user.id=:u and w.episode.season.content.id=:c") long watchedCount(@Param("u")Long u,@Param("c")Long c);
 @Query("select count(distinct w.episode.id) from EpisodeWatch w where w.user.id=:u and w.episode.season.id=:s") long watchedCountBySeason(@Param("u")Long u,@Param("s")Long s);
 @Query("select count(w) from EpisodeWatch w where w.user.id=:u and w.episode.season.content.id=:c and w.bulk=false") long individualWatchCount(@Param("u")Long u,@Param("c")Long c);
 long countByEpisodeIdAndUserId(Long episodeId, Long userId);
 boolean existsByEpisodeIdAndUserIdAndWatchedAt(Long episodeId, Long userId, java.time.Instant watchedAt);
 @Modifying @Query("delete from EpisodeWatch w where w.user.id=:u and w.episode.season.id=:s")
 void deleteAllByUserAndSeason(@Param("u") Long userId,@Param("s") Long seasonId);
}
