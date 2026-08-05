package com.lifedashboard.habit;

import com.lifedashboard.user.User;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "habits")
public class Habit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "tracking_type", nullable = false, length = 20)
    private TrackingType trackingType;

    @Enumerated(EnumType.STRING)
    @Column(name = "data_source", nullable = false, length = 40)
    private HabitDataSource dataSource;

    @Column(name = "target_value", precision = 14, scale = 2)
    private BigDecimal targetValue;

    @Column(length = 50)
    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type", nullable = false, length = 20)
    private HabitScheduleType scheduleType;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private HabitStatus status;

    @ElementCollection
    @CollectionTable(name = "habit_schedule_days", joinColumns = @JoinColumn(name = "habit_id"))
    @Column(name = "day_of_week", nullable = false)
    private Set<Short> scheduleDays = new LinkedHashSet<>();

    protected Habit() {
    }

    public Habit(User user) {
        this.user = user;
    }

    public void update(String name, String description, TrackingType trackingType, HabitDataSource dataSource,
                       BigDecimal targetValue, String unit, HabitScheduleType scheduleType, LocalDate startDate,
                       LocalDate endDate, HabitStatus status, Set<Short> scheduleDays) {
        this.name = name;
        this.description = description;
        this.trackingType = trackingType;
        this.dataSource = dataSource;
        this.targetValue = targetValue;
        this.unit = unit;
        this.scheduleType = scheduleType;
        this.startDate = startDate;
        this.endDate = endDate;
        this.status = status;
        this.scheduleDays.clear();
        this.scheduleDays.addAll(scheduleDays);
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public TrackingType getTrackingType() { return trackingType; }
    public HabitDataSource getDataSource() { return dataSource; }
    public BigDecimal getTargetValue() { return targetValue; }
    public String getUnit() { return unit; }
    public HabitScheduleType getScheduleType() { return scheduleType; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public HabitStatus getStatus() { return status; }
    public Set<Short> getScheduleDays() { return scheduleDays; }
}
