package com.lifedashboard.sleep;

import com.lifedashboard.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "sleep_sessions")
public class SleepSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at", nullable = false)
    private Instant endedAt;

    @Column(name = "deep_sleep_minutes")
    private Integer deepSleepMinutes;

    @Column(name = "light_sleep_minutes")
    private Integer lightSleepMinutes;

    @Column(name = "rem_sleep_minutes")
    private Integer remSleepMinutes;

    @Column(name = "awake_minutes")
    private Integer awakeMinutes;

    @Column(name = "quality_rating")
    private Short qualityRating;

    @Column(columnDefinition = "text")
    private String note;

    protected SleepSession() {
    }

    public SleepSession(User user) {
        this.user = user;
    }

    public void update(Instant startedAt, Instant endedAt, Integer deepSleepMinutes, Integer lightSleepMinutes,
                       Integer remSleepMinutes, Integer awakeMinutes, Short qualityRating, String note) {
        this.startedAt = startedAt;
        this.endedAt = endedAt;
        this.deepSleepMinutes = deepSleepMinutes;
        this.lightSleepMinutes = lightSleepMinutes;
        this.remSleepMinutes = remSleepMinutes;
        this.awakeMinutes = awakeMinutes;
        this.qualityRating = qualityRating;
        this.note = note;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public Integer getDeepSleepMinutes() { return deepSleepMinutes; }
    public Integer getLightSleepMinutes() { return lightSleepMinutes; }
    public Integer getRemSleepMinutes() { return remSleepMinutes; }
    public Integer getAwakeMinutes() { return awakeMinutes; }
    public Short getQualityRating() { return qualityRating; }
    public String getNote() { return note; }
}
