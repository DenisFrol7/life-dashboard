package com.lifedashboard.game;

import com.lifedashboard.game.steam.SteamAchievementData;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "steam_achievements", uniqueConstraints =
        @UniqueConstraint(columnNames = {"progress_id", "api_name"}))
public class SteamAchievement {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "progress_id", nullable = false)
    private SteamGameProgress progress;
    @Column(name = "api_name", nullable = false, length = 255)
    private String apiName;
    @Column(name = "display_name", nullable = false, length = 500)
    private String displayName;
    @Column(columnDefinition = "text")
    private String description;
    @Column(name = "icon_url", columnDefinition = "text")
    private String iconUrl;
    @Column(name = "locked_icon_url", columnDefinition = "text")
    private String lockedIconUrl;
    @Column(name = "is_hidden", nullable = false)
    private boolean hidden;
    @Column(name = "is_unlocked", nullable = false)
    private boolean unlocked;
    @Column(name = "unlocked_at")
    private Instant unlockedAt;

    protected SteamAchievement() {}

    public SteamAchievement(SteamGameProgress progress, String apiName) {
        this.progress = progress;
        this.apiName = apiName;
    }

    public void update(SteamAchievementData data) {
        displayName = data.displayName();
        description = data.description();
        iconUrl = data.iconUrl();
        lockedIconUrl = data.lockedIconUrl();
        hidden = data.hidden();
        unlocked = data.unlocked();
        unlockedAt = data.unlockedAt();
    }

    public Long getId() { return id; }
    public SteamGameProgress getProgress() { return progress; }
    public String getApiName() { return apiName; }
    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
    public String getIconUrl() { return iconUrl; }
    public String getLockedIconUrl() { return lockedIconUrl; }
    public boolean isHidden() { return hidden; }
    public boolean isUnlocked() { return unlocked; }
    public Instant getUnlockedAt() { return unlockedAt; }
}
