package com.lifedashboard.tag;

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

@Entity
@Table(name = "tags")
public class Tag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 100)
    private String slug;

    protected Tag() {
    }

    public Tag(User user) {
        this.user = user;
    }

    public void update(String name, String slug) {
        this.name = name;
        this.slug = slug;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getName() { return name; }
    public String getSlug() { return slug; }
}
