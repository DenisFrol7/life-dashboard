package com.lifedashboard.calendar;

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

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "calendar_events")
public class CalendarEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 20)
    private EventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type", nullable = false, length = 20)
    private ScheduleType scheduleType;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "repeat_until")
    private LocalDate repeatUntil;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "is_all_day", nullable = false)
    private boolean allDay;

    @Column(length = 500)
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CalendarEventStatus status;

    @ElementCollection
    @CollectionTable(name = "calendar_event_schedule_days", joinColumns = @JoinColumn(name = "event_id"))
    @Column(name = "day_of_week", nullable = false)
    private Set<Short> scheduleDays = new LinkedHashSet<>();

    protected CalendarEvent() {
    }

    public CalendarEvent(User user) {
        this.user = user;
    }

    public void update(String title, String description, EventType eventType, ScheduleType scheduleType,
                       LocalDate startDate, LocalDate repeatUntil, LocalTime startTime, LocalTime endTime,
                       boolean allDay, String location, CalendarEventStatus status, Set<Short> scheduleDays) {
        this.title = title;
        this.description = description;
        this.eventType = eventType;
        this.scheduleType = scheduleType;
        this.startDate = startDate;
        this.repeatUntil = repeatUntil;
        this.startTime = startTime;
        this.endTime = endTime;
        this.allDay = allDay;
        this.location = location;
        this.status = status;
        this.scheduleDays.clear();
        this.scheduleDays.addAll(scheduleDays);
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public EventType getEventType() { return eventType; }
    public ScheduleType getScheduleType() { return scheduleType; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getRepeatUntil() { return repeatUntil; }
    public LocalTime getStartTime() { return startTime; }
    public LocalTime getEndTime() { return endTime; }
    public boolean isAllDay() { return allDay; }
    public String getLocation() { return location; }
    public CalendarEventStatus getStatus() { return status; }
    public Set<Short> getScheduleDays() { return scheduleDays; }
}
