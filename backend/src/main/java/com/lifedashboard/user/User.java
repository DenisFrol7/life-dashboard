package com.lifedashboard.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(name = "display_name", length = 200)
    private String displayName;

    @Column(unique = true, length = 320)
    private String email;

    @Column(nullable = false, length = 100)
    private String timezone;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private Instant updatedAt;

    protected User() {
    }

    public User(String username, String displayName, String email, String timezone) {
        this.username = username;
        this.displayName = displayName;
        this.email = email;
        this.timezone = timezone;
    }

    public void update(String username, String displayName, String email, String timezone) {
        this.username = username;
        this.displayName = displayName;
        this.email = email;
        this.timezone = timezone;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getDisplayName() { return displayName; }
    public String getEmail() { return email; }
    public String getTimezone() { return timezone; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
