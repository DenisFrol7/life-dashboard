package com.lifedashboard.content;

import com.lifedashboard.user.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "season_completion_history")
public class SeasonCompletion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "season_id", nullable = false) private ContentSeason season;
    @Column(name = "completed_at") private Instant completedAt;
    @Column(name = "episode_count", nullable = false) private Integer episodeCount;
    protected SeasonCompletion() {}
    public SeasonCompletion(User user, ContentSeason season) { this.user = user; this.season = season; }
    public void update(Instant completedAt, int episodeCount) { this.completedAt = completedAt; this.episodeCount = episodeCount; }
    public Long getId() { return id; } public ContentSeason getSeason() { return season; }
    public Instant getCompletedAt() { return completedAt; } public Integer getEpisodeCount() { return episodeCount; }
}
