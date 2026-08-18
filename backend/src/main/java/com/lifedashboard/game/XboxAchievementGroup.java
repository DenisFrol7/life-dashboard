package com.lifedashboard.game;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "xbox_achievement_groups")
public class XboxAchievementGroup {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "library_entry_id", nullable = false)
    private UserGame libraryEntry;
    @Column(nullable = false, length = 200)
    private String name;
    @Enumerated(EnumType.STRING) @Column(name = "group_type", nullable = false, length = 20)
    private XboxAchievementGroupType groupType;
    @Column(name = "total_achievements", nullable = false) private Integer totalAchievements;
    @Column(name = "unlocked_achievements", nullable = false) private Integer unlockedAchievements;
    @Column(name = "total_gamerscore", nullable = false) private Integer totalGamerscore;
    @Column(name = "earned_gamerscore", nullable = false) private Integer earnedGamerscore;
    @Column(name = "completed_at") private Instant completedAt;

    protected XboxAchievementGroup() {}
    public XboxAchievementGroup(UserGame libraryEntry, String name, XboxAchievementGroupType groupType) {
        this.libraryEntry = libraryEntry; this.name = name; this.groupType = groupType;
    }
    public void update(String name, int totalAchievements, int unlockedAchievements,
            int totalGamerscore, int earnedGamerscore, Instant completedAt) {
        this.name = name; this.totalAchievements = totalAchievements;
        this.unlockedAchievements = unlockedAchievements; this.totalGamerscore = totalGamerscore;
        this.earnedGamerscore = earnedGamerscore;
        this.completedAt = completedAt;
    }
    public Long getId() { return id; }
    public UserGame getLibraryEntry() { return libraryEntry; }
    public String getName() { return name; }
    public XboxAchievementGroupType getGroupType() { return groupType; }
    public Integer getTotalAchievements() { return totalAchievements; }
    public Integer getUnlockedAchievements() { return unlockedAchievements; }
    public Integer getTotalGamerscore() { return totalGamerscore; }
    public Integer getEarnedGamerscore() { return earnedGamerscore; }
    public Instant getCompletedAt() { return completedAt; }
}
