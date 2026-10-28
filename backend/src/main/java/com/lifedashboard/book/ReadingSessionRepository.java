package com.lifedashboard.book;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ReadingSessionRepository extends JpaRepository<ReadingSession, Long> {
    List<ReadingSession> findAllByUserIdAndBookIdOrderByStartedAtDesc(Long userId,Long bookId);
    @EntityGraph(attributePaths = "book")
    List<ReadingSession> findAllByUserIdOrderByStartedAtDesc(Long userId);
    Optional<ReadingSession> findByIdAndUserId(Long id, Long userId);
    void deleteAllByUserIdAndBookId(Long userId,Long bookId);

    @EntityGraph(attributePaths = {"book", "book.content"})
    List<ReadingSession> findAllByUserIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtAsc(
            Long userId, Instant from, Instant to);
}
