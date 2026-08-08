package com.lifedashboard.book;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ReadingSessionRepository extends JpaRepository<ReadingSession,Long>{List<ReadingSession> findAllByUserContentIdOrderByStartedAtDesc(Long userContentId);java.util.Optional<ReadingSession> findByIdAndUserContentUserId(Long id,Long userId);}
