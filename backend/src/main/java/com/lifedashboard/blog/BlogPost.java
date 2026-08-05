package com.lifedashboard.blog;

import com.lifedashboard.journal.JournalEntry;
import com.lifedashboard.journal.Tag;
import com.lifedashboard.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "blog_posts")
public class BlogPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_journal_entry_id")
    private JournalEntry sourceJournalEntry;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(nullable = false, length = 300)
    private String slug;

    @Column(columnDefinition = "text")
    private String excerpt;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "cover_image_url", columnDefinition = "text")
    private String coverImageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BlogPostStatus status;

    @Column(name = "published_at")
    private Instant publishedAt;

    @ManyToMany
    @JoinTable(
            name = "blog_post_tags",
            joinColumns = @JoinColumn(name = "blog_post_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new LinkedHashSet<>();

    protected BlogPost() {
    }

    public BlogPost(User user, JournalEntry sourceJournalEntry) {
        this.user = user;
        this.sourceJournalEntry = sourceJournalEntry;
    }

    public void update(String title, String slug, String excerpt, String content, String coverImageUrl,
                       BlogPostStatus status, Instant publishedAt) {
        this.title = title;
        this.slug = slug;
        this.excerpt = excerpt;
        this.content = content;
        this.coverImageUrl = coverImageUrl;
        this.status = status;
        this.publishedAt = publishedAt;
    }

    public void addTag(Tag tag) { tags.add(tag); }
    public void removeTag(Tag tag) { tags.remove(tag); }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public JournalEntry getSourceJournalEntry() { return sourceJournalEntry; }
    public String getTitle() { return title; }
    public String getSlug() { return slug; }
    public String getExcerpt() { return excerpt; }
    public String getContent() { return content; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public BlogPostStatus getStatus() { return status; }
    public Instant getPublishedAt() { return publishedAt; }
    public Set<Tag> getTags() { return tags; }
}
