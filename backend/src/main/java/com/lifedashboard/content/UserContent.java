package com.lifedashboard.content;

import com.lifedashboard.user.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "user_content")
public class UserContent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "content_id", nullable = false)
    private ContentItem content;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private UserContentStatus status;
    private Short rating;
    @Column(name = "is_favorite", nullable = false)
    private boolean favorite;
    @Column(name = "started_at")
    private Instant startedAt;
    @Column(name = "completed_at")
    private Instant completedAt;
    @Column(name = "personal_note", columnDefinition = "text")
    private String personalNote;

    protected UserContent() {}
    public UserContent(User user, ContentItem content) { this.user = user; this.content = content; }
    public void update(UserContentStatus status, Short rating, boolean favorite, Instant startedAt,
                       Instant completedAt, String personalNote) {
        this.status = status; this.rating = rating; this.favorite = favorite; this.startedAt = startedAt;
        this.completedAt = completedAt; this.personalNote = personalNote;
    }
    public Long getId() { return id; }
    public ContentItem getContent() { return content; }
    public UserContentStatus getStatus() { return status; }
    public Short getRating() { return rating; }
    public boolean isFavorite() { return favorite; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public String getPersonalNote() { return personalNote; }
    public void changeStatus(UserContentStatus status, Instant completedAt) {
        this.status = status;
        this.completedAt = completedAt;
        if (completedAt != null && startedAt != null && completedAt.isBefore(startedAt)) {
            startedAt = completedAt;
        }
    }
}
