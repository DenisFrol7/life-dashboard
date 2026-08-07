package com.lifedashboard.game;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface XboxAchievementGroupRepository extends JpaRepository<XboxAchievementGroup, Long> {
    List<XboxAchievementGroup> findAllByLibraryEntryIdOrderByGroupTypeAscIdAsc(Long libraryId);
    Optional<XboxAchievementGroup> findByLibraryEntryIdAndGroupType(Long libraryId, XboxAchievementGroupType type);
    Optional<XboxAchievementGroup> findByIdAndLibraryEntryUserContentUserId(Long id, Long userId);
    boolean existsByLibraryEntryIdAndNameIgnoreCaseAndIdNot(Long libraryId, String name, Long id);
}
