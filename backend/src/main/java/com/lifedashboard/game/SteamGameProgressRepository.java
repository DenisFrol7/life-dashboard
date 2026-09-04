package com.lifedashboard.game;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SteamGameProgressRepository extends JpaRepository<SteamGameProgress, Long> {
    Optional<SteamGameProgress> findByLibraryEntryId(Long libraryEntryId);
    List<SteamGameProgress> findAllByLibraryEntryIdIn(List<Long> libraryEntryIds);
    @Query("select progress from SteamGameProgress progress " +
            "join fetch progress.libraryEntry game where game.userContent.user.id=:userId")
    List<SteamGameProgress> findAllByUserId(@Param("userId") Long userId);
}
