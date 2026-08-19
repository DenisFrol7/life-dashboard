package com.lifedashboard.game;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface XboxGameProgressRepository extends JpaRepository<XboxGameProgress, Long> {
    Optional<XboxGameProgress> findByLibraryEntryId(Long libraryEntryId);
    @Query("select progress from XboxGameProgress progress join fetch progress.libraryEntry game "
            + "where game.userContent.user.id = :userId")
    List<XboxGameProgress> findAllByUserId(@Param("userId") Long userId);
}
