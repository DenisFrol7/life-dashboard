package com.lifedashboard.content;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface SeasonCompletionRepository extends JpaRepository<SeasonCompletion, Long> {
    Optional<SeasonCompletion> findByUserIdAndSeasonId(Long userId, Long seasonId);
    java.util.List<SeasonCompletion> findAllByUserIdAndSeasonContentId(Long userId, Long contentId);
    void deleteByUserIdAndSeasonId(Long userId, Long seasonId);
}
