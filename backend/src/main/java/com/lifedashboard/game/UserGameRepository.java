package com.lifedashboard.game;
import com.lifedashboard.content.UserContentStatus;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface UserGameRepository extends JpaRepository<UserGame, Long> {
    @Query("select g from UserGame g where g.userContent.user.id=:userId " +
           "and (:status is null or g.status=:status) " +
           "and (:platformId is null or g.platform.id=:platformId) order by g.id desc")
    List<UserGame> findLibrary(@Param("userId") Long userId, @Param("status") UserContentStatus status,
                               @Param("platformId") Long platformId);
    Optional<UserGame> findByIdAndUserContentUserId(Long id, Long userId);
    Optional<UserGame> findBySteamAppIdAndUserContentUserId(Long steamAppId, Long userId);
    Optional<UserGame> findFirstByUserContentUserIdAndUserContentContentIdOrderByIdAsc(Long userId, Long contentId);
    @Query("select g from UserGame g join fetch g.userContent uc join fetch uc.content " +
           "join g.source s where uc.user.id=:userId and s.code='STEAM' " +
           "and g.steamAppId is not null order by g.id")
    List<UserGame> findSteamCopies(@Param("userId") Long userId);
}
