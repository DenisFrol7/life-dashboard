package com.lifedashboard.book;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ReadingSessionRepository extends JpaRepository<ReadingSession, Long> {
    List<ReadingSession> findAllByUserContentIdOrderByStartedAtDesc(Long userContentId);
    @EntityGraph(attributePaths = "userContent")
    List<ReadingSession> findAllByUserContentUserIdOrderByStartedAtDesc(Long userId);
    Optional<ReadingSession> findByIdAndUserContentUserId(Long id, Long userId);

    @EntityGraph(attributePaths = {"userContent", "userContent.content"})
    List<ReadingSession> findAllByUserContentUserIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtAsc(
            Long userId, Instant from, Instant to);
}
