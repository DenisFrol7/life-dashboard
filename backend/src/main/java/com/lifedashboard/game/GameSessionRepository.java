package com.lifedashboard.game;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;

public interface GameSessionRepository extends JpaRepository<GameSession, Long> {
    List<GameSession> findAllByLibraryEntryUserContentUserIdOrderByStartedAtDesc(Long userId);
    List<GameSession> findAllByLibraryEntryUserContentUserIdAndStartedAtGreaterThanEqualOrderByStartedAtDesc(
            Long userId, Instant from);
    List<GameSession> findAllByLibraryEntryUserContentUserIdAndStartedAtLessThanOrderByStartedAtDesc(
            Long userId, Instant to);
    List<GameSession> findAllByLibraryEntryUserContentUserIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtDesc(
            Long userId, Instant from, Instant to);
    Optional<GameSession> findByIdAndLibraryEntryUserContentUserId(Long id, Long userId);
    @Query("select coalesce(sum(s.durationMinutes), 0) from GameSession s where s.libraryEntry.id=:libraryId " +
            "and s.libraryEntry.userContent.user.id=:userId")
    long totalMinutes(@Param("libraryId") Long libraryId, @Param("userId") Long userId);
}
