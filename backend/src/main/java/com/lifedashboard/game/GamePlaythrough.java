package com.lifedashboard.game;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "game_playthroughs")
public class GamePlaythrough {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "library_entry_id", nullable = false)
    private UserGame libraryEntry;
    @Column(name = "playthrough_number", nullable = false)
    private Integer playthroughNumber;
    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;
    @Column(name = "playtime_minutes", nullable = false)
    private Long playtimeMinutes;
    @Enumerated(EnumType.STRING)
    @Column(name = "completion_source", nullable = false, length = 30)
    private GamePlaythroughSource completionSource = GamePlaythroughSource.MANUAL;
    @Column(columnDefinition = "text")
    private String note;

    protected GamePlaythrough() {}
    public GamePlaythrough(UserGame libraryEntry, Integer playthroughNumber, Instant completedAt,
            Long playtimeMinutes, String note) {
        this(libraryEntry, playthroughNumber, completedAt, playtimeMinutes,
                GamePlaythroughSource.MANUAL, note);
    }
    public GamePlaythrough(UserGame libraryEntry, Integer playthroughNumber, Instant completedAt,
            Long playtimeMinutes, GamePlaythroughSource completionSource, String note) {
        this.libraryEntry = libraryEntry; this.playthroughNumber = playthroughNumber;
        this.completedAt = completedAt; this.playtimeMinutes = playtimeMinutes;
        this.completionSource = completionSource; this.note = note;
    }
    public Long getId() { return id; }
    public UserGame getLibraryEntry() { return libraryEntry; }
    public Integer getPlaythroughNumber() { return playthroughNumber; }
    public Instant getCompletedAt() { return completedAt; }
    public Long getPlaytimeMinutes() { return playtimeMinutes; }
    public GamePlaythroughSource getCompletionSource() { return completionSource; }
    public String getNote() { return note; }
    public void updateCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public void updatePlaytimeMinutes(long playtimeMinutes) { this.playtimeMinutes = playtimeMinutes; }
    public void update(Instant completedAt, String note) {
        this.completedAt = completedAt;
        this.completionSource = GamePlaythroughSource.MANUAL;
        this.note = note;
    }
    public void markManual() { this.completionSource = GamePlaythroughSource.MANUAL; }
}
