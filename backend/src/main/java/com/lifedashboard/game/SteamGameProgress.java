package com.lifedashboard.game;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "steam_game_progress")
public class SteamGameProgress {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "library_entry_id", nullable = false, unique = true)
    private UserGame libraryEntry;
    @Column(name = "total_achievements", nullable = false)
    private Integer totalAchievements;
    @Column(name = "unlocked_achievements", nullable = false)
    private Integer unlockedAchievements;
    @Column(name = "last_unlocked_at")
    private Instant lastUnlockedAt;
    @Column(name = "last_synced_at", nullable = false)
    private Instant lastSyncedAt;

    protected SteamGameProgress() {}

    public SteamGameProgress(UserGame libraryEntry) {
        this.libraryEntry = libraryEntry;
    }

    public void update(int totalAchievements, int unlockedAchievements,
            Instant lastUnlockedAt, Instant lastSyncedAt) {
        this.totalAchievements = totalAchievements;
        this.unlockedAchievements = unlockedAchievements;
        this.lastUnlockedAt = lastUnlockedAt;
        this.lastSyncedAt = lastSyncedAt;
    }

    public Long getId() { return id; }
    public UserGame getLibraryEntry() { return libraryEntry; }
    public Integer getTotalAchievements() { return totalAchievements; }
    public Integer getUnlockedAchievements() { return unlockedAchievements; }
    public Instant getLastUnlockedAt() { return lastUnlockedAt; }
    public Instant getLastSyncedAt() { return lastSyncedAt; }
}
