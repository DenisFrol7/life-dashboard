package com.lifedashboard.game;
import com.lifedashboard.content.UserContentStatus;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
public interface UserGameRepository extends JpaRepository<UserGame, Long> {
    @Query("select g from UserGame g where g.userContent.user.id=:userId " +
           "and (:status is null or g.status=:status) " +
           "and (:platformId is null or g.platform.id=:platformId) order by g.id desc")
    List<UserGame> findLibrary(@Param("userId") Long userId, @Param("status") UserContentStatus status,
                               @Param("platformId") Long platformId);
    Optional<UserGame> findByIdAndUserContentUserId(Long id, Long userId);
    Optional<UserGame> findBySteamAppIdAndUserContentUserId(Long steamAppId, Long userId);
    Optional<UserGame> findByXboxTitleIdAndUserContentUserId(Long xboxTitleId, Long userId);
    Optional<UserGame> findFirstByUserContentUserIdAndUserContentContentIdOrderByIdAsc(Long userId, Long contentId);
    @Query("select g from UserGame g join fetch g.userContent uc join fetch uc.content " +
           "join g.source s where uc.user.id=:userId and s.code='STEAM' " +
           "and g.steamAppId is not null order by g.id")
    List<UserGame> findSteamCopies(@Param("userId") Long userId);
    @Query("select g from UserGame g join fetch g.userContent uc join fetch uc.content " +
           "join fetch g.platform p where uc.user.id=:userId " +
           "and (p.code like 'XBOX_%' or p.code='ORIGINAL_XBOX') order by g.id")
    List<UserGame> findXboxCopies(@Param("userId") Long userId);
    @Modifying
    @Transactional
    @Query("update UserGame g set g.legacyPlaytimeMinutes=:playtimeMinutes " +
           "where g.id=:id and g.userContent.user.id=:userId and g.source.code='STEAM'")
    int updateSteamPlaytime(@Param("id") Long id, @Param("userId") Long userId,
                            @Param("playtimeMinutes") long playtimeMinutes);
    @Modifying
    @Transactional
    @Query("update UserGame g set g.legacyPlaytimeMinutes=:playtimeMinutes " +
           "where g.id=:id and g.userContent.user.id=:userId " +
           "and (g.platform.code like 'XBOX_%' or g.platform.code='ORIGINAL_XBOX')")
    int updateXboxPlaytime(@Param("id") Long id, @Param("userId") Long userId,
                           @Param("playtimeMinutes") long playtimeMinutes);
}
