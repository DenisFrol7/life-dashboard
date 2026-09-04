package com.lifedashboard.game;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface XboxAchievementRepository extends JpaRepository<XboxAchievement, Long> {
    List<XboxAchievement> findAllByProgressId(Long progressId);
}
