package com.lifedashboard.sleep;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SleepSessionRepository extends JpaRepository<SleepSession, Long> {

    Optional<SleepSession> findByIdAndUserId(Long id, Long userId);

    @Query("""
            select session from SleepSession session
            where session.user.id = :userId
              and session.startedAt < :to
              and session.endedAt > :from
            order by session.startedAt asc, session.id asc
            """)
    List<SleepSession> findOverlapping(
            @Param("userId") Long userId,
            @Param("from") Instant from,
            @Param("to") Instant to
    );
}
