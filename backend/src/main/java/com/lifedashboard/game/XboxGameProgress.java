package com.lifedashboard.game;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "xbox_game_progress")
public class XboxGameProgress {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "library_entry_id", nullable = false, unique = true)
    private UserGame libraryEntry;
    @Column(name = "total_achievements", nullable = false)
    private Integer totalAchievements;
    @Column(name = "unlocked_achievements", nullable = false)
    private Integer unlockedAchievements;
    @Column(name = "total_gamerscore", nullable = false)
    private Integer totalGamerscore;
    @Column(name = "earned_gamerscore", nullable = false)
    private Integer earnedGamerscore;
    @Column(name = "last_updated_at", nullable = false)
    private Instant lastUpdatedAt;

    protected XboxGameProgress() {}
    public XboxGameProgress(UserGame libraryEntry) { this.libraryEntry = libraryEntry; }
    public void update(int totalAchievements, int unlockedAchievements, int totalGamerscore,
                       int earnedGamerscore, Instant lastUpdatedAt) {
        this.totalAchievements = totalAchievements; this.unlockedAchievements = unlockedAchievements;
        this.totalGamerscore = totalGamerscore; this.earnedGamerscore = earnedGamerscore;
        this.lastUpdatedAt = lastUpdatedAt;
    }
    public Long getId() { return id; }
    public UserGame getLibraryEntry() { return libraryEntry; }
    public Integer getTotalAchievements() { return totalAchievements; }
    public Integer getUnlockedAchievements() { return unlockedAchievements; }
    public Integer getTotalGamerscore() { return totalGamerscore; }
    public Integer getEarnedGamerscore() { return earnedGamerscore; }
    public Instant getLastUpdatedAt() { return lastUpdatedAt; }
}
