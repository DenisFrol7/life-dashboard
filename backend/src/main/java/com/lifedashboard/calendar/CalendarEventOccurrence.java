package com.lifedashboard.calendar;

import jakarta.persistence.Column;
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

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "calendar_event_occurrences")
public class CalendarEventOccurrence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private CalendarEvent event;

    @Column(name = "occurrence_date", nullable = false)
    private LocalDate occurrenceDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OccurrenceStatus status;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(columnDefinition = "text")
    private String note;

    protected CalendarEventOccurrence() {
    }

    public CalendarEventOccurrence(CalendarEvent event, LocalDate occurrenceDate) {
        this.event = event;
        this.occurrenceDate = occurrenceDate;
    }

    public void update(OccurrenceStatus status, Instant completedAt, String note) {
        this.status = status;
        this.completedAt = completedAt;
        this.note = note;
    }

    public Long getId() { return id; }
    public CalendarEvent getEvent() { return event; }
    public LocalDate getOccurrenceDate() { return occurrenceDate; }
    public OccurrenceStatus getStatus() { return status; }
    public Instant getCompletedAt() { return completedAt; }
    public String getNote() { return note; }
}
