package com.lifedashboard.activity;

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

import java.time.LocalDate;

@Entity
@Table(name = "daily_activity")
public class DailyActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "activity_date", nullable = false)
    private LocalDate activityDate;

    private Long steps;

    @Column(name = "distance_meters")
    private Long distanceMeters;

    @Column(columnDefinition = "text")
    private String note;

    protected DailyActivity() {
    }

    public DailyActivity(User user, LocalDate activityDate) {
        this.user = user;
        this.activityDate = activityDate;
    }

    public void update(Long steps, Long distanceMeters, String note) {
        this.steps = steps;
        this.distanceMeters = distanceMeters;
        this.note = note;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public LocalDate getActivityDate() { return activityDate; }
    public Long getSteps() { return steps; }
    public Long getDistanceMeters() { return distanceMeters; }
    public String getNote() { return note; }
}
