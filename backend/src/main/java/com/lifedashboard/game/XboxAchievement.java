package com.lifedashboard.game;

import com.lifedashboard.game.openxbl.OpenXblAchievement;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "xbox_achievements", uniqueConstraints =
        @UniqueConstraint(columnNames = {"progress_id", "achievement_id"}))
public class XboxAchievement {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "progress_id", nullable = false)
    private XboxGameProgress progress;
    @Column(name = "achievement_id", nullable = false, length = 255)
    private String achievementId;
    @Column(name = "display_name", nullable = false, length = 500)
    private String displayName;
    @Column(columnDefinition = "text")
    private String description;
    @Column(name = "locked_description", columnDefinition = "text")
    private String lockedDescription;
    @Column(name = "icon_url", columnDefinition = "text")
    private String iconUrl;
    @Column(nullable = false)
    private int gamerscore;
    @Column(name = "is_hidden", nullable = false)
    private boolean hidden;
    @Column(name = "is_unlocked", nullable = false)
    private boolean unlocked;
    @Column(name = "unlocked_at")
    private Instant unlockedAt;

    protected XboxAchievement() {}

    public XboxAchievement(XboxGameProgress progress, String achievementId) {
        this.progress = progress;
        this.achievementId = achievementId;
    }

    public void update(OpenXblAchievement source) {
        displayName = source.displayName();
        description = source.description();
        lockedDescription = source.lockedDescription();
        iconUrl = source.iconUrl();
        gamerscore = source.gamerscore();
        hidden = source.hidden();
        unlocked = source.unlocked();
        unlockedAt = source.unlockedAt();
    }

    public String getAchievementId() { return achievementId; }
    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
    public String getLockedDescription() { return lockedDescription; }
    public String getIconUrl() { return iconUrl; }
    public int getGamerscore() { return gamerscore; }
    public boolean isHidden() { return hidden; }
    public boolean isUnlocked() { return unlocked; }
    public Instant getUnlockedAt() { return unlockedAt; }
}
