package com.lifedashboard.habit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "habit_entries")
public class HabitEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "habit_id", nullable = false)
    private Habit habit;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(precision = 14, scale = 2)
    private BigDecimal value;

    @Column(name = "target_value_snapshot", precision = 14, scale = 2)
    private BigDecimal targetValueSnapshot;

    @Column(name = "is_skipped", nullable = false)
    private boolean skipped;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "recorded_at", nullable = false, insertable = false, updatable = false)
    private Instant recordedAt;

    protected HabitEntry() {
    }

    public HabitEntry(Habit habit, LocalDate entryDate, BigDecimal targetValueSnapshot) {
        this.habit = habit;
        this.entryDate = entryDate;
        this.targetValueSnapshot = targetValueSnapshot;
    }

    public void update(BigDecimal value, boolean skipped, String note) {
        this.value = value;
        this.skipped = skipped;
        this.note = note;
    }

    public Long getId() { return id; }
    public Habit getHabit() { return habit; }
    public LocalDate getEntryDate() { return entryDate; }
    public BigDecimal getValue() { return value; }
    public BigDecimal getTargetValueSnapshot() { return targetValueSnapshot; }
    public boolean isSkipped() { return skipped; }
    public String getNote() { return note; }
    public Instant getRecordedAt() { return recordedAt; }
}
