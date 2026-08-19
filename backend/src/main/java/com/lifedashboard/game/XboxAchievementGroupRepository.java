package com.lifedashboard.game;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface XboxAchievementGroupRepository extends JpaRepository<XboxAchievementGroup, Long> {
    List<XboxAchievementGroup> findAllByLibraryEntryIdOrderByGroupTypeAscIdAsc(Long libraryId);
    Optional<XboxAchievementGroup> findByLibraryEntryIdAndGroupType(Long libraryId, XboxAchievementGroupType type);
    Optional<XboxAchievementGroup> findByIdAndLibraryEntryUserContentUserId(Long id, Long userId);
    boolean existsByLibraryEntryIdAndNameIgnoreCaseAndIdNot(Long libraryId, String name, Long id);
    @Query("select achievementGroup from XboxAchievementGroup achievementGroup "
            + "join fetch achievementGroup.libraryEntry game where game.userContent.user.id = :userId "
            + "and achievementGroup.groupType = :groupType")
    List<XboxAchievementGroup> findAllByUserIdAndGroupType(@Param("userId") Long userId,
            @Param("groupType") XboxAchievementGroupType groupType);
}
