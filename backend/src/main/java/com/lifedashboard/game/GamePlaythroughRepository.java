package com.lifedashboard.game;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface GamePlaythroughRepository extends JpaRepository<GamePlaythrough, Long> {
    List<GamePlaythrough> findAllByLibraryEntryIdAndLibraryEntryUserContentUserIdOrderByPlaythroughNumberDesc(
            Long libraryId, Long userId);
    Optional<GamePlaythrough> findByIdAndLibraryEntryUserContentUserId(Long id, Long userId);
    Optional<GamePlaythrough> findByLibraryEntryIdAndPlaythroughNumber(Long libraryId, Integer playthroughNumber);
    @Query("select coalesce(max(p.playthroughNumber), 0) from GamePlaythrough p where p.libraryEntry.id=:libraryId")
    int maxNumber(@Param("libraryId") Long libraryId);
}
