package com.lifedashboard.content;
import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param; import java.util.*;
public interface EpisodeWatchRepository extends JpaRepository<EpisodeWatch,Long>{
 List<EpisodeWatch> findAllByEpisodeIdAndUserIdOrderByWatchNumber(Long e,Long u);
 @Query("select coalesce(max(w.watchNumber),0) from EpisodeWatch w where w.episode.id=:e and w.user.id=:u") int maxNumber(@Param("e")Long e,@Param("u")Long u);
 @Query("select count(distinct w.episode.id) from EpisodeWatch w where w.user.id=:u and w.episode.season.content.id=:c") long watchedCount(@Param("u")Long u,@Param("c")Long c);
 long countByEpisodeIdAndUserId(Long episodeId, Long userId);
}
