package com.lifedashboard.game;

import org.springframework.data.jpa.repository.JpaRepository;
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
}
