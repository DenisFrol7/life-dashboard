package com.lifedashboard.game;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface XboxGameProgressRepository extends JpaRepository<XboxGameProgress, Long> {
    Optional<XboxGameProgress> findByLibraryEntryId(Long libraryEntryId);
}
