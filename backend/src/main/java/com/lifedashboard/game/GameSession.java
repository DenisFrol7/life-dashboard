package com.lifedashboard.game;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "game_sessions")
public class GameSession {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "library_entry_id", nullable = false)
    private UserGame libraryEntry;
    @Column(name = "started_at", nullable = false)
    private Instant startedAt;
    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;
    @Column(columnDefinition = "text")
    private String note;
    @Column(name = "unlocked_achievements", nullable = false)
    private Integer unlockedAchievements = 0;
    @Column(name = "earned_gamerscore", nullable = false)
    private Integer earnedGamerscore = 0;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "achievement_group_id")
    private XboxAchievementGroup achievementGroup;

    protected GameSession() {}
    public GameSession(UserGame libraryEntry) { this.libraryEntry = libraryEntry; }
    public void update(Instant startedAt, Integer durationMinutes, String note,
            int unlockedAchievements, int earnedGamerscore, XboxAchievementGroup achievementGroup) {
        this.startedAt = startedAt; this.durationMinutes = durationMinutes; this.note = note;
        this.unlockedAchievements = unlockedAchievements; this.earnedGamerscore = earnedGamerscore;
        this.achievementGroup = achievementGroup;
    }
    public Long getId() { return id; }
    public UserGame getLibraryEntry() { return libraryEntry; }
    public Instant getStartedAt() { return startedAt; }
    public Integer getDurationMinutes() { return durationMinutes; }
    public String getNote() { return note; }
    public Integer getUnlockedAchievements() { return unlockedAchievements; }
    public Integer getEarnedGamerscore() { return earnedGamerscore; }
    public XboxAchievementGroup getAchievementGroup() { return achievementGroup; }
}
