package com.lifedashboard.game;

import com.lifedashboard.content.UserContent;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "user_game_library")
public class UserGame {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_content_id", nullable = false)
    private UserContent userContent;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "platform_id", nullable = false)
    private GamingPlatform platform;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_id", nullable = false)
    private GameSource source;
    @Enumerated(EnumType.STRING) @Column(name = "access_type", nullable = false, length = 20)
    private GameAccessType accessType;
    @Column(length = 200)
    private String edition;
    @Column(name = "acquired_at")
    private Instant acquiredAt;
    @Column(columnDefinition = "text")
    private String note;
    protected UserGame() {}
    public UserGame(UserContent userContent) { this.userContent = userContent; }
    public void update(GamingPlatform platform, GameSource source, GameAccessType accessType,
                       String edition, Instant acquiredAt, String note) {
        this.platform = platform; this.source = source; this.accessType = accessType;
        this.edition = edition; this.acquiredAt = acquiredAt; this.note = note;
    }
    public Long getId() { return id; }
    public UserContent getUserContent() { return userContent; }
    public GamingPlatform getPlatform() { return platform; }
    public GameSource getSource() { return source; }
    public GameAccessType getAccessType() { return accessType; }
    public String getEdition() { return edition; }
    public Instant getAcquiredAt() { return acquiredAt; }
    public String getNote() { return note; }
}
