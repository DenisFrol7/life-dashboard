package com.lifedashboard.game;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SteamGameProgressRepository extends JpaRepository<SteamGameProgress, Long> {
    Optional<SteamGameProgress> findByLibraryEntryId(Long libraryEntryId);
}
