package com.lifedashboard.game;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SteamAchievementRepository extends JpaRepository<SteamAchievement, Long> {
    List<SteamAchievement> findAllByProgressId(Long progressId);
}
